/**
 * Callback parsing and webhook signature verification (spec D16; App. C §4).
 *
 * The vendor signs callbacks with the Standard Webhooks scheme once a Webhook Secret
 * exists: headers `webhook-id`, `webhook-timestamp` (seconds), `webhook-signature`
 * (`v1,<base64>`, several space-separated during rotation); signed content is
 * `${id}.${timestamp}.${rawBody}`; key = Base64-decode of the secret after `whsec_`;
 * HMAC-SHA256, Base64, constant-time compare, ±5 min skew.
 *
 * **`rawBody` must be the exact bytes received.** Express / Fastify JSON parsers
 * re-serialise the body and break the signature — mount `express.raw({ type:
 * 'application/json' })` on the callback route and pass `req.body` (a Buffer) here.
 *
 * `parseCallback` returns `{ task, verified }`. With a `secret`, a missing header set, a
 * bad signature or a stale timestamp THROWS `KlingWebhookError` — the parsed task is never
 * handed back on a failed check (run #2 A21). Without a `secret`, `verified` is `null`:
 * **the body is unauthenticated** and `save()` will fetch whatever URLs it names — treat
 * it as untrusted input from the network. A callback RECEIVER (HTTP server) is out of
 * scope (§12). Import graph (§5): `codecs/*`, `http/errors`, `node:crypto`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as legacy from './codecs/legacy.js';
import * as newStd from './codecs/new-standard.js';
import { isObject } from './codecs/shared.js';
import type { Task } from './codecs/task.js';
import { KlingCodecError, KlingWebhookError } from './http/errors.js';

export interface VerifyWebhookSignatureInput {
  /** `webhook-id` header. */
  id: string;
  /** `webhook-timestamp` header — Unix SECONDS, as sent. */
  timestamp: string | number;
  /** `webhook-signature` header — `v1,<sig>` (space-separated list during rotation). */
  signature: string;
  rawBody: string | Uint8Array;
  /** `whsec_…` as issued by the console. */
  secret: string;
  /** Allowed |now − timestamp|. Default 300 s (the vendor's ±5 min). */
  toleranceSeconds?: number;
  /** Clock seam (ms). The vendor's published vector is dated 2026-06-10; tests pin `now` to it (run #3 anxiety F2). */
  now?: () => number;
}

/** Throws `KlingWebhookError('bad-signature' | 'stale-timestamp')`; returns on success. */
export function verifyWebhookSignature(input: VerifyWebhookSignatureInput): void {
  const tolerance = input.toleranceSeconds ?? 300;
  const now = (input.now ?? Date.now)();
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) throw new KlingWebhookError('stale-timestamp', 'webhook-timestamp is not a number');

  const expected = sign(input.secret, input.id, input.timestamp, input.rawBody);
  const candidates = input.signature
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => (s.startsWith('v1,') ? s.slice(3) : undefined))
    .filter((s): s is string => s !== undefined);
  const matched = candidates.some((c) => constantTimeEqual(c, expected));
  if (!matched) throw new KlingWebhookError('bad-signature', 'webhook-signature does not match the body (or is not a v1 signature)');

  // Skew is checked AFTER the signature so a forged timestamp cannot be used to probe the clock.
  if (Math.abs(now / 1000 - ts) > tolerance) throw new KlingWebhookError('stale-timestamp', `webhook-timestamp is ${Math.round(Math.abs(now / 1000 - ts))} s from now (tolerance ${tolerance} s)`);
}

/** `Base64(HMAC-SHA256(Base64Decode(secret sans whsec_), "${id}.${timestamp}.${rawBody}"))`. */
export function sign(secret: string, id: string, timestamp: string | number, rawBody: string | Uint8Array): string {
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength);
  return createHmac('sha256', key).update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`, 'utf8'), body])).digest('base64');
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface ParseCallbackOptions {
  /** The request headers (case-insensitive lookup). Required when `secret` is given. */
  headers?: Record<string, string | string[] | undefined> | Headers;
  secret?: string;
  toleranceSeconds?: number;
  now?: () => number;
  /** Receives codec warnings (dropped outputs, seconds→ms). */
  warn?: (message: string) => void;
}

export interface ParsedCallback {
  task: Task;
  /** `true` when a secret was supplied and the signature checked out; `null` when no secret was supplied — UNAUTHENTICATED. */
  verified: true | null;
}

/**
 * Parse a callback body into a `Task`, verifying the signature first when a `secret` is
 * given. Detects the standard by `id` (new) vs `task_id` (legacy); a body carrying both
 * is `KlingCodecError`.
 */
/**
 * @param rawBody The EXACT bytes received — a JSON body parser re-serializes and breaks the signature.
 * @param options `secret` enables verification (a bad signature, stale timestamp or missing header
 *   throws `KlingWebhookError`); without one, `verified` is `null` and the body is unauthenticated.
 * @returns `{ task, verified }` — check `verified === true` explicitly before trusting `task`.
 * @example
 * ```ts
 * const { task, verified } = parseCallback(req.body, { headers: req.headers, secret: SECRET });
 * if (verified !== true) return res.sendStatus(401);
 * ```
 */
export function parseCallback(rawBody: string | Uint8Array, options: ParseCallbackOptions = {}): ParsedCallback {
  let verified: true | null = null;
  if (options.secret !== undefined) {
    const id = header(options.headers, 'webhook-id');
    const timestamp = header(options.headers, 'webhook-timestamp');
    const signature = header(options.headers, 'webhook-signature');
    if (!id || !timestamp || !signature) {
      throw new KlingWebhookError('missing-headers', 'webhook-id / webhook-timestamp / webhook-signature headers are missing — the vendor omits them until a Webhook Secret exists');
    }
    verifyWebhookSignature({ id, timestamp, signature, rawBody, secret: options.secret, toleranceSeconds: options.toleranceSeconds, now: options.now });
    verified = true;
  }

  const text = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength).toString('utf8');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new KlingCodecError('callback body is not JSON', 'new', '$', { cause });
  }
  if (!isObject(json)) throw new KlingCodecError('callback body is not an object', 'new', '$');
  const hasNew = 'id' in json;
  const hasLegacy = 'task_id' in json;
  if (hasNew && hasLegacy) throw new KlingCodecError('callback body carries both `id` and `task_id` — neither standard', 'new', '$');
  if (!hasNew && !hasLegacy) throw new KlingCodecError('callback body carries neither `id` nor `task_id`', 'new', '$');
  const ctx = { warn: options.warn };
  const task = hasNew ? newStd.parseTaskRecord(json, ctx, '$') : legacy.parseTaskRecord(json, ctx, '$');
  return { task, verified };
}

function header(headers: ParseCallbackOptions['headers'], name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const v = key === undefined ? undefined : headers[key];
  return Array.isArray(v) ? v[0] : v;
}
