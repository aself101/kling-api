/**
 * Real-undici integration (spec D11, D20, V14; run #3 A23/A36/F3/F6).
 *
 * The unit tests prove HttpCore against a MODEL of fetch. Three behaviours the design
 * relies on are undici/Node-specific, so each gets one test here that goes THROUGH
 * `HttpCore` — not bare fetch — against a real local server:
 *
 *   1. `redirect: 'manual'` exposes a readable 3xx with its `Location`;
 *   2. a refused connection to a HOSTNAME (dual-stack path) surfaces `cause.code === 'ECONNREFUSED'`;
 *   3. an abort mid-body rejects the body read, so the deadline covers a stalled body.
 *
 * The core is https-only, so the server is `https.createServer` with a self-signed cert
 * minted by `openssl` at test start, reached via an injected undici `fetch` bound to an
 * `Agent({ connect: { rejectUnauthorized: false } })`. Nothing in production is relaxed.
 * CI runs this on Node 20 and 22 (spec Q14).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent, fetch as undiciFetch } from 'undici';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpCore } from '../../../src/http/core.js';
import { KlingNetworkError, KlingResponseError, KlingTimeoutError } from '../../../src/http/errors.js';

let dir: string;
let server: https.Server;
let port: number;
let agent: Agent;

const opensslAvailable = (() => {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const describeIf = opensslAvailable ? describe : describe.skip;

describeIf('HttpCore over real undici (local https)', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'kling-undici-'));
    execFileSync(
      'openssl',
      ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'key.pem', '-out', 'cert.pem', '-days', '1', '-subj', '/CN=localhost'],
      { cwd: dir, stdio: 'ignore' }
    );
    server = https.createServer(
      { key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) },
      (req, res) => {
        if (req.url?.startsWith('/redirect')) {
          res.writeHead(302, { Location: 'https://api-elsewhere.klingai.com/tasks' });
          res.end();
          return;
        }
        if (req.url?.startsWith('/stall')) {
          // Headers and half a body, then silence: the client's deadline must fire on the body read.
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.write('{"code":0,"message":"SUC');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 0, message: 'SUCCEED', request_id: 'local', data: { ok: true } }));
      }
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
    agent = new Agent({ connect: { rejectUnauthorized: false } });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await agent.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** An injected fetch: undici's, bound to the permissive agent. This is the D11 seam a proxied consumer would use. */
  const injected = ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) =>
    undiciFetch(input, { ...init, dispatcher: agent })) as unknown as typeof fetch;

  const core = (timeout = 2_000) =>
    new HttpCore({ apiKey: 'k-test', baseUrl: `https://localhost:${port}`, fetch: injected, timeout, retry: { maxAttempts: 1 } });

  it('baseline: a real envelope round-trips through the core', async () => {
    const res = await core().request<{ ok: boolean }>({ method: 'GET', path: '/tasks', kind: 'read' });
    expect(res.envelope.data).toEqual({ ok: true });
    expect(res.requestId).toBe('local');
  });

  it('(1) redirect: manual — a 302 is surfaced with its Location, not followed', async () => {
    const err = await core().request({ method: 'GET', path: '/redirect', kind: 'read' }).catch((e) => e);
    expect(err).toBeInstanceOf(KlingResponseError);
    expect(err.httpStatus).toBe(302);
    expect(err.location).toBe('https://api-elsewhere.klingai.com/tasks');
  });

  it('(2) refused connection to a HOSTNAME → KlingNetworkError with ECONNREFUSED in the cause chain; a write is not-created', async () => {
    // Find a closed port on localhost. Using the hostname (not 127.0.0.1) exercises the
    // dual-stack path on which Node may wrap the failures in an AggregateError.
    const closed = await new Promise<number>((resolve) => {
      const s = net.createServer();
      s.listen(0, '127.0.0.1', () => {
        const p = (s.address() as net.AddressInfo).port;
        s.close(() => resolve(p));
      });
    });
    const c = new HttpCore({ apiKey: 'k-test', baseUrl: `https://localhost:${closed}`, fetch: injected, retry: { maxAttempts: 1 } });
    const err = await c.request({ method: 'POST', path: '/text-to-video/x', body: {}, kind: 'write', externalId: 'e1' }).catch((e) => e);
    expect(err).toBeInstanceOf(KlingNetworkError);
    expect(err.taskState).toBe('not-created');
    expect(err.externalId).toBe('e1');
    // Record how the code arrived (directly or via AggregateError.errors[]) — spec Q14 / run #3 F6.
    const cause = err.cause as { code?: string; cause?: { code?: string; errors?: { code?: string }[] } };
    const direct = cause?.code ?? cause?.cause?.code;
    const aggregated = cause?.cause?.errors?.map((e) => e.code);
    expect([direct, ...(aggregated ?? [])]).toContain('ECONNREFUSED');
  });

  it('(3) a stalled body trips the per-attempt deadline → KlingTimeoutError; a write is may-exist', async () => {
    const err = await core(300).request({ method: 'POST', path: '/stall', body: {}, kind: 'write', externalId: 'e2' }).catch((e) => e);
    expect(err).toBeInstanceOf(KlingTimeoutError);
    expect(err.deadlineMs).toBe(300);
    expect(err.taskState).toBe('may-exist');
  });
});
