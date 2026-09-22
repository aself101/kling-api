/**
 * The DNS-rebinding recipe the README documents (ship run #6, 1f39a37c).
 *
 * `assertSafeUrl` resolves a hostname, checks every address, then hands the URL — not the
 * address — to `fetch`. A host that answers with a public IP at check time and a private one at
 * connect time defeats it (CWE-367). Closing that needs control of the socket, which the WHATWG
 * `fetch` does not expose; the library therefore does NOT pin by default, because doing so would
 * mean a 2 MB fourth runtime dependency for a hole that requires control of the vendor's own CDN
 * DNS to exploit. Spec §12 records the acceptance.
 *
 * What the library does instead is accept a `fetch`, and a consumer with a stricter threat model
 * supplies a pinned one. This file exists so that recipe is TESTED rather than asserted — a
 * documented mitigation nobody has run is not a mitigation.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent, fetch as undiciFetch } from 'undici';
import { fetchToBuffer } from '../../../src/media/download.js';

let certDir: string;
let server: Server;
let port: number;
let openssl = true;

beforeAll(async () => {
  certDir = mkdtempSync(join(tmpdir(), 'kling-pin-'));
  try {
    execFileSync(
      'openssl',
      ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', join(certDir, 'k.pem'), '-out', join(certDir, 'c.pem'),
       '-days', '1', '-nodes', '-subj', '/CN=pinned.test', '-addext', 'subjectAltName=DNS:pinned.test'],
      { stdio: 'ignore' }
    );
  } catch {
    openssl = false; // no openssl on this machine — the suite skips rather than fails
    return;
  }
  server = createServer(
    { key: readFileSync(join(certDir, 'k.pem')), cert: readFileSync(join(certDir, 'c.pem')) },
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'video/mp4' });
      res.end('PINNED');
    }
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server?.close();
  if (certDir) rmSync(certDir, { recursive: true, force: true });
});

/**
 * The recipe, verbatim from the README: force the socket to one already-validated address while
 * TLS still validates the HOSTNAME, so a rebind between check and connect cannot redirect it.
 */
function pinnedFetch(pinTo: string, ca: Buffer): typeof fetch {
  const agent = new Agent({
    connect: {
      ca,
      lookup: (_hostname, options, cb) => {
        const entry = { address: pinTo, family: 4 as const };
        // node:net calls this with `all` set; honour both shapes.
        (cb as (e: Error | null, a: unknown, f?: number) => void)(null, options?.all ? [entry] : pinTo, 4);
      },
    },
  });
  return ((input: string | URL | Request, init?: RequestInit) =>
    undiciFetch(String(input), { ...init, dispatcher: agent } as never)) as unknown as typeof fetch;
}

describe('DNS-rebinding mitigation: the documented pinned-fetch recipe', () => {
  it.skipIf(!openssl)('a pinned fetch composes with the library\'s `fetch` seam and delivers the body', async () => {
    // NOTE on the shape of this test: the guard is given a public address and the socket is
    // pinned to 127.0.0.1, because that is where the test server can bind — the library's own
    // guard refuses a loopback resolution, so "guard and pin agree on a public IP" is not
    // stageable locally. What this proves is the plumbing: a pinned dispatcher passed through
    // `options.fetch` is used, and the library's parsing and byte cap work over it unchanged.
    // That the pin DECIDES the destination is the control test below.
    const lookups: string[] = [];
    const ca = readFileSync(join(certDir, 'c.pem'));
    const agent = new Agent({
      connect: {
        ca,
        lookup: (hostname: string, options: { all?: boolean } | undefined, cb: (e: Error | null, a: unknown, f?: number) => void) => {
          lookups.push(hostname);
          cb(null, options?.all ? [{ address: '127.0.0.1', family: 4 }] : '127.0.0.1', 4);
        },
      },
    });
    const fetchImpl = ((input: string | URL | Request, init?: RequestInit) =>
      undiciFetch(String(input), { ...init, dispatcher: agent } as never)) as unknown as typeof fetch;

    const res = await fetchToBuffer(`https://pinned.test:${port}/v.mp4`, {
      maxBytes: 1_000_000,
      fetch: fetchImpl,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    });
    expect(res.buffer.toString()).toBe('PINNED');
    expect(res.contentType).toBe('video/mp4');
    // The socket used the pin, not a fresh resolution of "pinned.test" (which resolves nowhere).
    expect(lookups).toContain('pinned.test');
    await agent.close();
  });

  it.skipIf(!openssl)('CONTROL — the pin actually decides the destination: pinned elsewhere, the request fails', async () => {
    // If the pin were cosmetic this would still reach the server on 127.0.0.1. It must not.
    const ca = readFileSync(join(certDir, 'c.pem'));
    const fetchImpl = pinnedFetch('127.0.0.9', ca);
    // A pin to an address with no listener hangs rather than refusing, so lean on the library's
    // own hop deadline: the point is that it does NOT reach the server on 127.0.0.1 and return
    // 'PINNED', which is what it would do if the pin were ignored.
    const err = await fetchToBuffer(`https://pinned.test:${port}/v.mp4`, {
      maxBytes: 1_000_000,
      timeoutMs: 1_500,
      fetch: fetchImpl,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { buffer?: unknown }).buffer).toBeUndefined();
  });

  it("the library's OWN guard still runs first — a pinned fetch does not bypass assertSafeUrl", async () => {
    // Pinning is defence in depth, not a replacement: a URL whose resolved address is private is
    // refused before any socket is opened, pinned fetch or not.
    const never = (() => {
      throw new Error('fetch must not be reached for a blocked host');
    }) as unknown as typeof fetch;
    await expect(
      fetchToBuffer('https://metadata.internal/v.mp4', {
        maxBytes: 1_000_000,
        fetch: never,
        lookup: async () => [{ address: '169.254.169.254', family: 4 }],
      })
    ).rejects.toMatchObject({ reason: 'blocked-host' });
  });
});
