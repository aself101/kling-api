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

  it('{ path }, Buffer and Uint8Array say they arrive in 2c (not silently accepted, not silently ignored)', () => {
    expect(() => resolveMediaSource({ path: '/tmp/a.png' }, opts)).toThrow(/Phase 2c/);
    expect(() => resolveMediaSource(Buffer.from('x'), opts)).toThrow(/Phase 2c/);
    expect(() => resolveMediaSource(new Uint8Array(4), opts)).toThrow(/Phase 2c/);
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
