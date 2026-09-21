/** media/source.ts — the URL / Base64 half (spec D12; 2a₃). `{ path }` / Buffer land in 2c. */
import { describe, expect, it } from 'vitest';
import { INLINE_MEDIA_CAP_BYTES } from '../../../src/config/constants.js';
import { KlingValidationError } from '../../../src/http/errors.js';
import { MediaBudget, isBase64, resolveMediaSource, stripDataPrefix } from '../../../src/media/source.js';

const opts = { kind: 'image' as const, standard: 'new' as const, field: 'firstFrame' };
const b64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');

describe('resolveMediaSource — strings', () => {
  it('https URL → { url }; http is not accepted', () => {
    expect(resolveMediaSource('https://cdn.example/a.png', opts)).toEqual({ url: 'https://cdn.example/a.png' });
    expect(() => resolveMediaSource('http://cdn.example/a.png', opts)).toThrow(KlingValidationError);
  });

  it('Base64 string → { base64 }; a data: prefix is stripped', () => {
    expect(resolveMediaSource('iVBORw0KGgoAAAANSUhEUg==', opts)).toEqual({ base64: 'iVBORw0KGgoAAAANSUhEUg==' });
    expect(resolveMediaSource('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==', opts)).toEqual({ base64: 'iVBORw0KGgoAAAANSUhEUg==' });
  });

  it('a string that IS a real path on disk is rejected without being read (never existsSync)', () => {
    const err = (() => { try { resolveMediaSource('package.json', opts); } catch (e) { return e as KlingValidationError; } })();
    expect(err).toBeInstanceOf(KlingValidationError);
    expect(err!.field).toBe('firstFrame');
    expect(err!.message).toMatch(/filesystem path is never read from a bare string/);
    expect(() => resolveMediaSource('/etc/hosts', opts)).toThrow(KlingValidationError);
    expect(() => resolveMediaSource('./test/2.0/fixtures/new/t2v-create.json', opts)).toThrow(KlingValidationError);
  });

  it('{ url } and { base64 } objects', () => {
    expect(resolveMediaSource({ url: 'https://x/y.jpg' }, opts)).toEqual({ url: 'https://x/y.jpg' });
    expect(() => resolveMediaSource({ url: 'ftp://x/y.jpg' }, opts)).toThrow(/https URL/);
    expect(resolveMediaSource({ base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }, opts)).toEqual({ base64: '/9j/4AAQSkZJRg==' });
    expect(() => resolveMediaSource({ base64: 'not base64!' }, opts)).toThrow(/not valid Base64/);
  });

  it('kind: video accepts only a URL — Base64, buffers and paths name the missing upload endpoint', () => {
    const v = { ...opts, kind: 'video' as const, field: 'featureVideo' };
    expect(resolveMediaSource('https://x/v.mp4', v)).toEqual({ url: 'https://x/v.mp4' });
    for (const src of ['AAAAIGZ0eXBpc29t', { base64: 'AAAAIGZ0eXBpc29t' }, Buffer.alloc(8), { path: '/v.mp4' }] as const) {
      expect(() => resolveMediaSource(src, v)).toThrow(/no upload endpoint for video/);
    }
  });

  it('garbage → KlingValidationError listing the accepted forms', () => {
    expect(() => resolveMediaSource(42 as never, opts)).toThrow(/is not a MediaSource/);
    expect(() => resolveMediaSource({} as never, opts)).toThrow(/is not a MediaSource/);
  });
});

describe('inline caps (decimal MB, per standard) and the aggregate budget', () => {
  it('new: 20 000 000 bytes passes, +1 fails naming the cap and the reason', () => {
    expect(() => resolveMediaSource(b64(INLINE_MEDIA_CAP_BYTES.new), opts)).not.toThrow();
    expect(() => resolveMediaSource(b64(INLINE_MEDIA_CAP_BYTES.new + 1), opts)).toThrow(/over the 20 MB inline cap for the new standard — a larger Base64 payload/);
  });

  it('legacy: 10 000 000 bytes passes, +1 fails citing the vendor limit', () => {
    const legacy = { ...opts, standard: 'legacy' as const };
    expect(() => resolveMediaSource(b64(INLINE_MEDIA_CAP_BYTES.legacy), legacy)).not.toThrow();
    expect(() => resolveMediaSource(b64(INLINE_MEDIA_CAP_BYTES.legacy + 1), legacy)).toThrow(/10 MB inline cap for the legacy standard — the vendor documents a 10 MB limit/);
  });

  it('aggregate: 9 MB legacy inputs (12 MB encoded each) — three fit, the fourth would pass 40 MB encoded and throws "host the files"', () => {
    const budget = new MediaBudget();
    const legacy = { ...opts, standard: 'legacy' as const, budget };
    const nine = b64(9_000_000);
    for (let i = 0; i < 3; i++) resolveMediaSource(nine, { ...legacy, field: `images[${i}]` });
    expect(budget.used).toBe(nine.length * 3); // 36 MB encoded
    expect(() => resolveMediaSource(nine, { ...legacy, field: 'images[3]' })).toThrow(/aggregate cap — host the files and pass URLs/);
    // URLs are free.
    expect(() => resolveMediaSource('https://x/y.png', legacy)).not.toThrow();
  });
});

describe('helpers', () => {
  it('isBase64 / stripDataPrefix', () => {
    expect(isBase64('iVBORw0KGgo=')).toBe(true);
    expect(isBase64('short')).toBe(false);
    expect(isBase64('has spaces in')).toBe(false);
    expect(isBase64('/Users/aself/a.png')).toBe(false); // length 18 % 4 ≠ 0 and has '.'
    expect(stripDataPrefix('data:audio/mpeg;base64,AAAA')).toBe('AAAA');
    expect(stripDataPrefix('AAAA')).toBe('AAAA');
  });
});

// ── { path } / Buffer / Uint8Array (2c) ──────────────────────────────────────────────

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { sniffAudio, sniffImage } from '../../../src/media/source.js';

/** A minimal PNG header (signature + IHDR) with the given dimensions — enough for sniffing, not a decodable image. */
function png(width: number, height: number, padTo = 0): Buffer {
  const b = Buffer.alloc(Math.max(33, padTo));
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
/** SOI, an APP0 segment, then SOF0 carrying the dimensions. */
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.alloc(14)]);
  const sof = Buffer.alloc(2 + 17);
  sof[0] = 0xff; sof[1] = 0xc0; sof.writeUInt16BE(17, 2); sof[4] = 8; sof.writeUInt16BE(height, 5); sof.writeUInt16BE(width, 7); sof[9] = 3;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xda, 0, 2])]);
}

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'kling-media-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('sniffImage / sniffAudio', () => {
  it('reads PNG and JPEG dimensions; rejects other bytes', () => {
    expect(sniffImage(png(640, 480))).toEqual({ format: 'png', width: 640, height: 480 });
    expect(sniffImage(jpeg(1024, 768))).toEqual({ format: 'jpeg', width: 1024, height: 768 });
    expect(sniffImage(Buffer.from('GIF89a…'))).toBeUndefined();
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toEqual({ format: 'jpeg' }); // SOS before any SOF: format known, size not
  });

  it('recognises ID3/MPEG-sync/WAV/ftyp audio and nothing else', () => {
    expect(sniffAudio(Buffer.concat([Buffer.from('ID3'), Buffer.alloc(12)]))).toBe(true);
    expect(sniffAudio(Buffer.concat([Buffer.from([0xff, 0xfb]), Buffer.alloc(12)]))).toBe(true);
    expect(sniffAudio(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(4)]))).toBe(true);
    expect(sniffAudio(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(4)]))).toBe(true);
    expect(sniffAudio(png(300, 300))).toBe(false);
  });
});

describe('resolveMediaSource — files and buffers', () => {
  it('a Buffer / Uint8Array image → { base64 } after magic-byte and dimension checks', () => {
    const b = png(300, 300);
    expect(resolveMediaSource(b, opts)).toEqual({ base64: b.toString('base64') });
    expect(resolveMediaSource(new Uint8Array(b), opts)).toEqual({ base64: b.toString('base64') });
  });

  it('{ path }: extension checked BEFORE the read; magic bytes and dimensions after', () => {
    const good = join(dir, 'ok.png');
    writeFileSync(good, png(400, 300));
    expect(resolveMediaSource({ path: good }, opts)).toEqual({ base64: png(400, 300).toString('base64') });
    expect(() => resolveMediaSource({ path: join(dir, 'nope.gif') }, opts)).toThrow(/unsupported image extension ".gif"/);
    const lying = join(dir, 'lying.png');
    writeFileSync(lying, Buffer.from('not a png at all, honestly'));
    expect(() => resolveMediaSource({ path: lying }, opts)).toThrow(/is not a PNG or JPEG \(magic bytes\)/);
    expect(() => resolveMediaSource({ path: join(dir, 'missing.png') }, opts)).toThrow(/cannot read/);
  });

  it('vendor image rules: ≥ 300 px per side; aspect within 1:2.5 – 2.5:1', () => {
    expect(() => resolveMediaSource(png(299, 600), opts)).toThrow(/299×600 px; the vendor requires at least 300 px/);
    expect(() => resolveMediaSource(png(1000, 300), opts)).toThrow(/aspect ratio 3.33 is outside/);
    expect(() => resolveMediaSource(png(300, 1000), opts)).toThrow(/aspect ratio 0.30 is outside/);
    expect(() => resolveMediaSource(png(750, 300), opts)).not.toThrow(); // exactly 2.5:1
    expect(() => resolveMediaSource(jpeg(300, 750), opts)).not.toThrow();
  });

  it('size cap applies to bytes (checked first); the aggregate budget is charged on the encoded length', () => {
    const big = png(300, 300, INLINE_MEDIA_CAP_BYTES.new + 1);
    expect(() => resolveMediaSource(big, opts)).toThrow(/is 20\.0 MB, over the 20 MB inline cap for the new standard/);
    const budget = new MediaBudget(10_000);
    const small = png(300, 300, 6000);
    expect(() => resolveMediaSource(small, { ...opts, budget })).not.toThrow();
    expect(budget.used).toBe(small.toString('base64').length);
    expect(() => resolveMediaSource(small, { ...opts, budget })).toThrow(/aggregate cap/);
  });

  it('audio kind: extension list and magic bytes; video kind still refuses bytes', () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(100)]);
    const a = { ...opts, kind: 'audio' as const, field: 'voiceUrl' };
    expect(resolveMediaSource(wav, a)).toEqual({ base64: wav.toString('base64') });
    expect(() => resolveMediaSource(png(300, 300), a)).toThrow(/not MP3, WAV, M4A or AAC/);
    const f = join(dir, 'clip.ogg');
    writeFileSync(f, wav);
    expect(() => resolveMediaSource({ path: f }, a)).toThrow(/unsupported audio extension ".ogg" — the vendor accepts .mp3, .wav, .m4a, .aac/);
    expect(() => resolveMediaSource(wav, { ...opts, kind: 'video' as const })).toThrow(/no upload endpoint for video/);
  });
});
