/**
 * Webhook verification and callback parsing (spec D16; §8 V13). The vendor's published test
 * vector is dated 2026-06-10, so `now` is pinned to the vector's own instant to prove the
 * signature and then moved to prove the skew control (run #3 anxiety F2).
 */
import { describe, expect, it } from 'vitest';
import { KlingCodecError, KlingWebhookError } from '../../src/http/errors.js';
import { parseCallback, sign, verifyWebhookSignature } from '../../src/webhooks.js';
import { fixture } from './codecs/fixtures.js';

// App. C §4d, verbatim.
const VECTOR = {
  secret: 'whsec_dGVzdHNlY3JldHRlc3RzZWNyZXR0ZXN0c2VjcmV0MTI=',
  id: '9876543210',
  timestamp: '1781080794',
  rawBody: '{"id":"1234567890","status":"succeeded","message":"","create_time":1781080778802,"update_time":1781080794151}',
  signature: 'v1,UsKlJP00XoQyOn410NM9xv34sP+Gl0jnOO9Lcpr7NJ4=',
};
const AT_VECTOR = () => 1781080794 * 1000;

describe('verifyWebhookSignature (V13)', () => {
  it('the vendor vector passes with now pinned to its timestamp', () => {
    expect(sign(VECTOR.secret, VECTOR.id, VECTOR.timestamp, VECTOR.rawBody)).toBe(VECTOR.signature.slice(3));
    expect(() => verifyWebhookSignature({ ...VECTOR, now: AT_VECTOR })).not.toThrow();
    expect(() => verifyWebhookSignature({ ...VECTOR, rawBody: Buffer.from(VECTOR.rawBody), now: AT_VECTOR })).not.toThrow();
  });

  it('control: one body byte flipped → bad-signature', () => {
    const flipped = VECTOR.rawBody.replace('"succeeded"', '"succeedeD"');
    const err = (() => { try { verifyWebhookSignature({ ...VECTOR, rawBody: flipped, now: AT_VECTOR }); } catch (e) { return e as KlingWebhookError; } })();
    expect(err).toBeInstanceOf(KlingWebhookError);
    expect(err!.reason).toBe('bad-signature');
  });

  it('skew: +299 s passes, +301 s → stale-timestamp (and −301 s too)', () => {
    expect(() => verifyWebhookSignature({ ...VECTOR, now: () => AT_VECTOR() + 299_000 })).not.toThrow();
    for (const delta of [301_000, -301_000]) {
      const err = (() => { try { verifyWebhookSignature({ ...VECTOR, now: () => AT_VECTOR() + delta }); } catch (e) { return e as KlingWebhookError; } })();
      expect(err?.reason, String(delta)).toBe('stale-timestamp');
    }
    expect(() => verifyWebhookSignature({ ...VECTOR, now: () => AT_VECTOR() + 301_000, toleranceSeconds: 600 })).not.toThrow();
  });

  it('rotation: a correct v1 signature among several passes', () => {
    expect(() => verifyWebhookSignature({ ...VECTOR, signature: `v1,AAAA${'A'.repeat(40)}= ${VECTOR.signature}`, now: AT_VECTOR })).not.toThrow();
  });

  it('rotation: a non-v1 scheme entry is not accepted in place of v1', () => {
    expect(() => verifyWebhookSignature({ ...VECTOR, signature: `v0,${VECTOR.signature.slice(3)}`, now: AT_VECTOR })).toThrow(/bad-signature|not a v1/);
  });

  it('rotation: a malformed v1 entry alone fails', () => {
    expect(() => verifyWebhookSignature({ ...VECTOR, signature: 'v1,nope', now: AT_VECTOR })).toThrow(KlingWebhookError);
  });


  it('a different secret fails (so the vector test is not vacuous); the whsec_ prefix is optional', () => {
    expect(() => verifyWebhookSignature({ ...VECTOR, secret: 'whsec_b3RoZXJzZWNyZXRvdGhlcnNlY3JldG90aGVyc2VjcmV0', now: AT_VECTOR })).toThrow(KlingWebhookError);
    expect(() => verifyWebhookSignature({ ...VECTOR, secret: VECTOR.secret.slice(6), now: AT_VECTOR })).not.toThrow();
  });
});

describe('parseCallback', () => {
  const headers = { 'Webhook-Id': VECTOR.id, 'webhook-timestamp': VECTOR.timestamp, 'WEBHOOK-SIGNATURE': VECTOR.signature };

  it('with a secret and good headers (case-insensitive) → task from the new codec, verified: true', () => {
    const { task, verified } = parseCallback(VECTOR.rawBody, { headers, secret: VECTOR.secret, now: AT_VECTOR });
    expect(verified).toBe(true);
    expect(task).toMatchObject({ id: '1234567890', standard: 'new', status: 'succeeded', createdAt: 1781080778802 });
    const viaHeaders = parseCallback(Buffer.from(VECTOR.rawBody), { headers: new Headers(headers), secret: VECTOR.secret, now: AT_VECTOR });
    expect(viaHeaders.verified).toBe(true);
  });

  it('with a secret: missing headers → missing-headers; bad signature → bad-signature; stale → stale-timestamp — and NO task is returned', () => {
    const reasons: string[] = [];
    for (const [opts, expected] of [
      [{ secret: VECTOR.secret, now: AT_VECTOR }, 'missing-headers'],
      [{ headers: { 'webhook-id': VECTOR.id, 'webhook-timestamp': VECTOR.timestamp, 'webhook-signature': 'v1,bad' }, secret: VECTOR.secret, now: AT_VECTOR }, 'bad-signature'],
      [{ headers, secret: VECTOR.secret, now: () => AT_VECTOR() + 400_000 }, 'stale-timestamp'],
    ] as const) {
      let result: unknown;
      try {
        result = parseCallback(VECTOR.rawBody, opts as never);
      } catch (e) {
        reasons.push((e as KlingWebhookError).reason);
      }
      expect(result, expected).toBeUndefined();
    }
    expect(reasons).toEqual(['missing-headers', 'bad-signature', 'stale-timestamp']);
  });

  it('without a secret → verified: null (UNAUTHENTICATED), headers ignored', () => {
    const { verified, task } = parseCallback(VECTOR.rawBody);
    expect(verified).toBeNull();
    expect(task.status).toBe('succeeded');
  });

  it('both callback fixtures parse: id → new codec, task_id → legacy codec (succeed → succeeded)', () => {
    const n = parseCallback(JSON.stringify(fixture('new/callback.json')));
    expect(n.task).toMatchObject({ standard: 'new', status: 'succeeded' });
    expect(n.task.outputs).toHaveLength(5);
    const l = parseCallback(JSON.stringify(fixture('legacy/callback.json')));
    expect(l.task).toMatchObject({ standard: 'legacy', status: 'succeeded', externalId: 'string' });
    expect(l.task.outputs.map((o) => o.type)).toEqual(['video', 'image']);
  });

  it('a body with both id and task_id, neither, non-JSON, or a non-object → KlingCodecError', () => {
    expect(() => parseCallback('{"id":"a","task_id":"b","status":"succeeded"}')).toThrow(KlingCodecError);
    expect(() => parseCallback('{"status":"succeeded"}')).toThrow(/neither/);
    expect(() => parseCallback('not json')).toThrow(/not JSON/);
    expect(() => parseCallback('[1,2]')).toThrow(/not an object/);
  });
});
