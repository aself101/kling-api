/** fetchToBuffer (spec D12, run #1 A3, run #3 anxiety F3): byte cap, redirect cap, per-hop SSRF. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KlingDownloadError } from '../../../src/http/errors.js';
import { fetchToBuffer, fetchToFile } from '../../../src/media/download.js';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Step { status?: number; body?: Uint8Array | string; headers?: Record<string, string>; stream?: Uint8Array[]; throw?: unknown }
const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];

function routed(routes: Record<string, Step | Step[]>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    expect(init?.redirect).toBe('manual');
    const r = routes[url];
    if (!r) throw new Error(`unrouted ${url}`);
    const step = Array.isArray(r) ? r.shift()! : r;
    if (step.throw) throw step.throw;
    if (step.stream) {
      const chunks = [...step.stream];
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          const c = chunks.shift();
          if (c) controller.enqueue(c);
          else controller.close();
        },
      });
      return new Response(body, { status: step.status ?? 200, headers: step.headers });
    }
    return new Response(step.body ?? null, { status: step.status ?? 200, headers: step.headers });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const opts = (fetchImpl: typeof fetch, extra: Partial<Parameters<typeof fetchToBuffer>[1]> = {}) => ({ maxBytes: 1_000_000, fetch: fetchImpl, lookup: publicDns, ...extra });

describe('fetchToBuffer', () => {
  it('returns the bytes, content type and final URL', async () => {
    const { fetchImpl } = routed({ 'https://cdn.example/a.mp4': { body: 'abc', headers: { 'content-type': 'video/mp4' } } });
    const res = await fetchToBuffer('https://cdn.example/a.mp4', opts(fetchImpl));
    expect(res.buffer.toString()).toBe('abc');
    expect(res.contentType).toBe('video/mp4');
    expect(res).toMatchObject({ finalUrl: 'https://cdn.example/a.mp4', hops: 0 });
  });

  it('follows manual redirects up to the cap; the cap+1 hop → too-many-redirects', async () => {
    const chain: Record<string, Step> = {};
    for (let i = 0; i < 7; i++) chain[`https://cdn.example/r${i}`] = { status: 302, headers: { location: `/r${i + 1}` } };
    chain['https://cdn.example/r7'] = { body: 'end' };
    const ok = routed(chain);
    const res = await fetchToBuffer('https://cdn.example/r0', opts(ok.fetchImpl, { maxRedirects: 7 }));
    expect(res.buffer.toString()).toBe('end');
    expect(res.hops).toBe(7);
    const tooMany = routed(structuredClone(chain));
    const err = await fetchToBuffer('https://cdn.example/r0', opts(tooMany.fetchImpl, { maxRedirects: 5 })).catch((e) => e as KlingDownloadError);
    expect(err).toBeInstanceOf(KlingDownloadError);
    expect(err.reason).toBe('too-many-redirects');
    expect(tooMany.calls).toHaveLength(6); // r0..r5 fetched; r6 refused before the fetch
  });

  it('per-hop SSRF: first hop public, second hop https://127.0.0.1/ → blocked-host BEFORE the second fetch (the HOST rule fires, not the protocol rule)', async () => {
    const { fetchImpl, calls } = routed({ 'https://cdn.example/a': { status: 302, headers: { location: 'https://127.0.0.1/secret' } } });
    const err = await fetchToBuffer('https://cdn.example/a', opts(fetchImpl)).catch((e) => e as KlingDownloadError);
    expect(err.reason).toBe('blocked-host');
    expect(err.url).toBe('https://127.0.0.1/secret');
    expect(calls).toEqual(['https://cdn.example/a']);
    // Controls: [::1], hex-encoded v4 — and http://127.0.0.1/ which is blocked too but proves only the protocol rule.
    for (const loc of ['https://[::1]/', 'https://0x7f000001/', 'http://127.0.0.1/']) {
      const r = routed({ 'https://cdn.example/a': { status: 302, headers: { location: loc } } });
      expect((await fetchToBuffer('https://cdn.example/a', opts(r.fetchImpl)).catch((e) => e as KlingDownloadError)).reason, loc).toBe('blocked-host');
    }
  });

  it('a hostname that resolves to a private address is blocked; DNS failure is blocked-host with the lookup error as cause', async () => {
    const { fetchImpl, calls } = routed({});
    const err = await fetchToBuffer('https://evil.example/', opts(fetchImpl, { lookup: async () => [{ address: '10.0.0.1', family: 4 }] })).catch((e) => e as KlingDownloadError);
    expect(err.reason).toBe('blocked-host');
    const dns = await fetchToBuffer('https://gone.example/', opts(fetchImpl, { lookup: async () => { throw new Error('ENOTFOUND'); } })).catch((e) => e as KlingDownloadError);
    expect(dns.reason).toBe('blocked-host');
    expect((dns.cause as Error).message).toMatch(/failing closed/);
    expect(calls).toEqual([]);
  });

  it('byte cap: a streamed body of maxBytes + 1 → too-large; a declared Content-Length over the cap is refused before reading', async () => {
    const chunk = new Uint8Array(400);
    const streamed = routed({ 'https://cdn.example/big': { stream: [chunk, chunk, chunk] } });
    const err = await fetchToBuffer('https://cdn.example/big', opts(streamed.fetchImpl, { maxBytes: 1199 })).catch((e) => e as KlingDownloadError);
    expect(err.reason).toBe('too-large');
    const exact = routed({ 'https://cdn.example/big': { stream: [chunk, chunk, chunk] } });
    expect((await fetchToBuffer('https://cdn.example/big', opts(exact.fetchImpl, { maxBytes: 1200 }))).buffer.byteLength).toBe(1200);
    const declared = routed({ 'https://cdn.example/big': { body: 'x', headers: { 'content-length': '5000000' } } });
    expect((await fetchToBuffer('https://cdn.example/big', opts(declared.fetchImpl)).catch((e) => e as KlingDownloadError)).reason).toBe('too-large');
  });

  it('non-2xx → http with the status; a network failure → http with the cause', async () => {
    const r404 = routed({ 'https://cdn.example/x': { status: 404 } });
    const err = await fetchToBuffer('https://cdn.example/x', opts(r404.fetchImpl)).catch((e) => e as KlingDownloadError);
    expect(err).toMatchObject({ reason: 'http', httpStatus: 404 });
    const net = routed({ 'https://cdn.example/x': { throw: new TypeError('fetch failed') } });
    const nerr = await fetchToBuffer('https://cdn.example/x', opts(net.fetchImpl)).catch((e) => e as KlingDownloadError);
    expect(nerr.reason).toBe('http');
    expect(nerr.cause).toBeInstanceOf(TypeError);
  });

  it("the caller's abort surfaces as their reason, unwrapped", async () => {
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))) as typeof fetch;
    // Abort mid-flight …
    const ac = new AbortController();
    const p = fetchToBuffer('https://cdn.example/slow', opts(fetchImpl, { signal: ac.signal }));
    await new Promise((r) => setTimeout(r, 5));
    ac.abort('stop');
    await expect(p).rejects.toBe('stop');
    // … and before the first hop.
    const pre = new AbortController();
    pre.abort('early');
    await expect(fetchToBuffer('https://cdn.example/slow', opts(fetchImpl, { signal: pre.signal }))).rejects.toBe('early');
  });
});

// ── ship run #4 fixes ─────────────────────────────────────────────────────────────────

describe('fetchToBuffer — ship run #4 regressions', () => {
  it("a caller abort DURING the body read is rethrown as the caller's own reason, not wrapped as 'http'", async () => {
    const ac = new AbortController();
    // Like real undici, the body stream errors when the request signal aborts (1c proved that live).
    const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(10));
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason));
        },
      });
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const p = fetchToBuffer('https://cdn.example/slow-body', opts(fetchImpl, { signal: ac.signal }));
    await new Promise((r) => setTimeout(r, 10));
    ac.abort('caller-cancel');
    await expect(p).rejects.toBe('caller-cancel');
  });

  it("the hop deadline mid-body → KlingDownloadError('timeout'), not 'http'", async () => {
    const fetchImpl = (async (_u: unknown, init?: RequestInit) =>
      new Response(new ReadableStream<Uint8Array>({ start(controller) { init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason)); } }), { status: 200 })) as typeof fetch;
    const err = await fetchToBuffer('https://cdn.example/stall', opts(fetchImpl, { timeoutMs: 30 })).catch((e) => e as KlingDownloadError);
    expect(err).toBeInstanceOf(KlingDownloadError);
    expect(err.reason).toBe('timeout');
  });

  it("a malformed Location header → KlingDownloadError('invalid-redirect'), never a raw TypeError", async () => {
    const { fetchImpl } = routed({ 'https://cdn.example/a': { status: 302, headers: { location: 'https://exa mple.com/x' } } });
    const err = await fetchToBuffer('https://cdn.example/a', opts(fetchImpl)).catch((e) => e as KlingDownloadError);
    expect(err).toBeInstanceOf(KlingDownloadError);
    expect(err.reason).toBe('invalid-redirect');
    const noLoc = routed({ 'https://cdn.example/a': { status: 302 } });
    expect((await fetchToBuffer('https://cdn.example/a', opts(noLoc.fetchImpl)).catch((e) => e as KlingDownloadError)).reason).toBe('invalid-redirect');
  });

  it('a hung DNS lookup is bounded by the hop deadline and honours the caller abort', async () => {
    const hang = () => new Promise<never>(() => undefined);
    const { fetchImpl, calls } = routed({});
    const err = await fetchToBuffer('https://slow-dns.example/x', opts(fetchImpl, { lookup: hang, timeoutMs: 30 })).catch((e) => e as KlingDownloadError);
    expect(err.reason).toBe('timeout');
    const ac = new AbortController();
    const p = fetchToBuffer('https://slow-dns.example/x', opts(fetchImpl, { lookup: hang, signal: ac.signal }));
    setTimeout(() => ac.abort('cancelled-during-dns'), 5);
    await expect(p).rejects.toBe('cancelled-during-dns');
    expect(calls).toEqual([]);
  });
});

describe('fetchToFile — streamed to disk (ship run #6, 006bb99e)', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'kling-stream-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const dest = () => join(dir, 'out.bin');

  it('writes the body to disk and reports bytes, contentType and finalUrl', async () => {
    const { fetchImpl } = routed({
      'https://cdn.example/a.mp4': { stream: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])], headers: { 'content-type': 'video/mp4' } },
    });
    const res = await fetchToFile('https://cdn.example/a.mp4', dest(), opts(fetchImpl));
    expect(res).toMatchObject({ bytes: 5, contentType: 'video/mp4', finalUrl: 'https://cdn.example/a.mp4', hops: 0 });
    expect([...readFileSync(dest())]).toEqual([1, 2, 3, 4, 5]);
  });

  it('the byte cap still fires mid-stream AND the partial file is removed', async () => {
    const chunk = new Uint8Array(400);
    const { fetchImpl } = routed({ 'https://cdn.example/big.mp4': { stream: [chunk, chunk, chunk] } });
    const err = await fetchToFile('https://cdn.example/big.mp4', dest(), opts(fetchImpl, { maxBytes: 500 }))
      .catch((e) => e as KlingDownloadError);
    expect(err).toBeInstanceOf(KlingDownloadError);
    expect(err.reason).toBe('too-large');
    expect(existsSync(dest())).toBe(false); // no truncated file left behind
  });

  it('a mid-stream network failure removes the partial file too', async () => {
    const boom = new Error('socket reset');
    const body = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new Uint8Array(10)); },
      pull() { throw boom; },
    });
    const fetchImpl = (async () => new Response(body, { status: 200 })) as typeof fetch;
    await expect(fetchToFile('https://cdn.example/x.mp4', dest(), opts(fetchImpl))).rejects.toBeInstanceOf(KlingDownloadError);
    expect(existsSync(dest())).toBe(false);
  });

  it('the SSRF and redirect guards apply on every hop, as they do for fetchToBuffer', async () => {
    const { fetchImpl } = routed({
      'https://cdn.example/r.mp4': { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data' } },
    });
    const err = await fetchToFile('https://cdn.example/r.mp4', dest(), opts(fetchImpl)).catch((e) => e as KlingDownloadError);
    expect(err.reason).toBe('blocked-host');
    expect(existsSync(dest())).toBe(false);
  });

  it('the caller\'s own abort is rethrown unwrapped and leaves no file', async () => {
    const ac = new AbortController();
    const reason = new Error('cancelled');
    const body = new ReadableStream<Uint8Array>({
      pull(c) { ac.abort(reason); c.enqueue(new Uint8Array(4)); },
    });
    const fetchImpl = (async () => new Response(body, { status: 200 })) as typeof fetch;
    await expect(fetchToFile('https://cdn.example/x.mp4', dest(), opts(fetchImpl, { signal: ac.signal }))).rejects.toBe(reason);
    expect(readdirSync(dir)).toEqual([]);
  });
});
