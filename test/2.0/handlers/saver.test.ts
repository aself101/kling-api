/** save() (spec D14; checklist 2c). Downloads through an injected fetch with public DNS stubbed. */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Task } from '../../../src/codecs/task.js';
import { extensionFor, save } from '../../../src/handlers/saver.js';
import { KlingDownloadError, KlingNoOutputsError, KlingOutputsExpiredError } from '../../../src/http/errors.js';
import { KlingClient } from '../../../src/client.js';

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const NOW = 1_800_000_000_000;

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    standard: 'new',
    product: 'text-to-video',
    status: 'succeeded',
    updatedAt: NOW - 1000,
    outputsExpireAt: NOW + 86_400_000,
    outputs: [{ type: 'video', id: 'v', url: 'https://cdn.example/v.mp4', watermarkUrl: 'https://cdn.example/v-wm.mp4', durationSeconds: 3 }],
    raw: { id: 't-1' },
    ...overrides,
  };
}

function cdn(files: Record<string, { body: string; type?: string; status?: number }>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const f = files[url];
    if (!f) return new Response(null, { status: 404 });
    return new Response(f.body, { status: f.status ?? 200, headers: f.type ? { 'content-type': f.type } : {} });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'kling-save-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('save', () => {
  it('writes <id>-<index>.<ext> from Content-Type plus a sidecar with product/standard/request/outputs/raw', async () => {
    const { fetchImpl, calls } = cdn({ 'https://cdn.example/v.mp4': { body: 'MP4BYTES', type: 'video/mp4' } });
    const written = await save(task(), dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW, request: { model: 'kling-3.0-turbo', firstFrame: { kind: 'base64', bytes: 5_000_000, sha256: 'ab'.repeat(32) } } });
    expect(written).toEqual([join(dir, 't-1-0.mp4'), join(dir, 't-1.json')]);
    expect(readFileSync(written[0], 'utf8')).toBe('MP4BYTES');
    const sidecar = JSON.parse(readFileSync(written[1], 'utf8'));
    expect(sidecar).toMatchObject({ product: 'text-to-video', standard: 'new', request: { model: 'kling-3.0-turbo' }, raw: { id: 't-1' } });
    expect(sidecar.outputs).toHaveLength(1);
    expect(readFileSync(written[1]).byteLength).toBeLessThan(10_000); // a 5 MB inline input is a 3-field triple here
    expect(calls).toEqual(['https://cdn.example/v.mp4']); // no watermark by default
  });

  it('includeWatermark adds the -watermark variant; audio outputs save mp3 and -wav', async () => {
    const { fetchImpl } = cdn({
      'https://cdn.example/v.mp4': { body: 'a', type: 'video/mp4' },
      'https://cdn.example/v-wm.mp4': { body: 'b', type: 'video/mp4' },
      'https://cdn.example/s.mp3': { body: 'c', type: 'audio/mpeg' },
      'https://cdn.example/s.wav': { body: 'd', type: 'audio/wav' },
    });
    const t = task({ outputs: [...task().outputs, { type: 'audio', id: 'a', mp3Url: 'https://cdn.example/s.mp3', wavUrl: 'https://cdn.example/s.wav' }] });
    const written = await save(t, dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW, includeWatermark: true });
    expect(written.map((p) => p.slice(dir.length + 1))).toEqual(['t-1-0.mp4', 't-1-1-watermark.mp4', 't-1-2.mp3', 't-1-3-wav.wav', 't-1.json']);
  });

  it('expired outputs → KlingOutputsExpiredError before any fetch; force bypasses', async () => {
    const { fetchImpl, calls } = cdn({ 'https://cdn.example/v.mp4': { body: 'x' } });
    const expired = task({ outputsExpireAt: NOW - 1 });
    await expect(save(expired, dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW })).rejects.toBeInstanceOf(KlingOutputsExpiredError);
    expect(calls).toEqual([]);
    await expect(save(expired, dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW, force: true })).resolves.toHaveLength(2);
    expect(calls).toHaveLength(1);
  });

  it('succeeded with no outputs → KlingNoOutputsError; a non-succeeded task too', async () => {
    const { fetchImpl } = cdn({});
    await expect(save(task({ outputs: [] }), dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW })).rejects.toBeInstanceOf(KlingNoOutputsError);
    await expect(save(task({ status: 'processing' }), dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW })).rejects.toBeInstanceOf(KlingNoOutputsError);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('a 404 from the CDN surfaces as KlingDownloadError(http, 404) with the URL', async () => {
    const { fetchImpl } = cdn({});
    const err = await save(task(), dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW }).catch((e) => e as KlingDownloadError);
    expect(err).toBeInstanceOf(KlingDownloadError);
    expect(err).toMatchObject({ reason: 'http', httpStatus: 404, url: 'https://cdn.example/v.mp4' });
    expect(existsSync(join(dir, 't-1.json'))).toBe(false); // no sidecar for a failed save
  });

  it('extensionFor: Content-Type → URL extension → bin', () => {
    expect(extensionFor('image/png', 'https://x/y')).toBe('png');
    expect(extensionFor('video/mp4; charset=binary', 'https://x/y.mov')).toBe('mp4');
    expect(extensionFor('application/octet-stream', 'https://x/y.MOV?sig=1')).toBe('mov');
    expect(extensionFor(undefined, 'https://x/y')).toBe('bin');
    expect(extensionFor(undefined, 'not a url')).toBe('bin');
  });

  it('client.save forwards the client fetch (the injected fetch is the one called)', async () => {
    const { fetchImpl, calls } = cdn({ 'https://cdn.example/v.mp4': { body: 'via-client', type: 'video/mp4' } });
    const client = new KlingClient({ apiKey: 'k', fetch: fetchImpl });
    const written = await client.save(task(), dir, { lookup: publicDns, now: () => NOW });
    expect(calls).toEqual(['https://cdn.example/v.mp4']);
    expect(readFileSync(written[0], 'utf8')).toBe('via-client');
  });
});
