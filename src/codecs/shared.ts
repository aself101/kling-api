/**
 * Field readers shared by the two codecs (spec D3, D4, Q12; §8 V2).
 *
 * Not in the §5 file table — the table lists `task.ts`, `new-standard.ts` and
 * `legacy.ts`, and the same six helpers appeared in both parsers the moment the second
 * was written. A sibling inside `src/codecs/` sits in the same import zone (may import
 * `codecs/task`, `http/errors`, `config/constants`; nothing else), so the graph is
 * unchanged. The types module stays types-only.
 *
 * Reading policy, in one place so both codecs agree:
 *  - a wrong-shaped ENVELOPE or an unknown top-level STATUS throws `KlingCodecError`
 *    (the caller passed a response from the other standard, or the vendor changed the
 *    vocabulary — both must fail loudly, never parse as `processing`);
 *  - a wrong-shaped OUTPUT is dropped with a warning, never a throw. A hard throw here
 *    would block every `get()` on that task until a library release (the Q12 reasoning
 *    applied to outputs; run #2 A24).
 */
import { OUTPUT_RETENTION_MS, TIMESTAMP_SECONDS_CEILING } from '../config/constants.js';
import { KlingCodecError } from '../http/errors.js';
import type { Product, Standard, TaskStatus } from './task.js';

/** Per-call context a product module passes down; codecs hold no state. */
export interface ParseContext {
  /** Known to the caller (creates, product-scoped queries); absent for `/tasks` results. */
  product?: Product;
  /** Receives non-fatal normalisation notes (seconds→ms, dropped outputs). Defaults to silence. */
  warn?: (message: string) => void;
}

export type JsonObject = Record<string, unknown>;

export function isObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Envelope guard: `{ code, data }` where `data` is an object or array. Throws on anything else. */
export function envelopeData(json: unknown, standard: Standard): unknown {
  if (!isObject(json) || !('data' in json)) {
    throw new KlingCodecError('response is not a vendor envelope (no `data`)', standard, 'data');
  }
  return json.data;
}

export function requireObject(v: unknown, standard: Standard, path: string): JsonObject {
  if (!isObject(v)) throw new KlingCodecError(`expected an object at ${path}`, standard, path);
  return v;
}

export function requireArray(v: unknown, standard: Standard, path: string): unknown[] {
  if (!Array.isArray(v)) throw new KlingCodecError(`expected an array at ${path}`, standard, path);
  return v;
}

export function requireString(v: unknown, standard: Standard, path: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new KlingCodecError(`expected a non-empty string at ${path}`, standard, path);
  }
  return v;
}

/** A string if present and non-empty, else undefined — the vendor omits optional fields rather than nulling them. */
export function optString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Vendor durations are decimal strings in seconds (App. B §3.2). A number is accepted
 * too. Anything non-finite (the docs' own `"string"` placeholder included) → undefined.
 */
export function optSeconds(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Unix timestamp → ms (spec Q12). `undefined`, `0`, negatives and non-numbers stay
 * ABSENT — never `0 × 1000`, never an `outputsExpireAt` counted from the epoch
 * (run #3 architect edge case). A positive value below `TIMESTAMP_SECONDS_CEILING`
 * is read as seconds, scaled, and reported through `warn`.
 */
export function optTimestampMs(v: unknown, path: string, ctx: ParseContext | undefined): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return undefined;
  if (v < TIMESTAMP_SECONDS_CEILING) {
    ctx?.warn?.(`${path}: ${v} is below 1e11 — read as seconds and scaled to ms (spec Q12)`);
    return v * 1000;
  }
  return v;
}

/**
 * The four-state vocabulary. Both spellings of the terminal state are accepted by
 * both codecs — the standards are told apart by their id fields (`data.id` vs
 * `data.task_id`), not by this word, and the vendor has changed the spelling once
 * already. Anything else throws (§8 V2): an unknown status must never read as
 * `processing`, because `wait()` would poll it forever.
 */
export function parseStatus(v: unknown, standard: Standard, path: string): TaskStatus {
  switch (v) {
    case 'submitted':
    case 'processing':
    case 'failed':
      return v;
    case 'succeed':
    case 'succeeded':
      return 'succeeded';
    default:
      throw new KlingCodecError(`unknown task status ${JSON.stringify(v)} at ${path}`, standard, path);
  }
}

/** Element/voice status: `succeed`/`succeeded` → `succeeded`, `deleted` → `deleted`; anything else defaults with a warning (outputs never throw). */
export function parseResourceStatus(v: unknown, path: string, ctx: ParseContext | undefined): 'succeeded' | 'deleted' {
  if (v === 'deleted') return 'deleted';
  if (v === 'succeed' || v === 'succeeded' || v === undefined) return 'succeeded';
  ctx?.warn?.(`${path}: unknown resource status ${JSON.stringify(v)} — recorded as 'succeeded'; the vendor value is in raw`);
  return 'succeeded';
}

/** `updatedAt + 30 d` on `succeeded`, else undefined (spec D4). */
export function outputsExpireAt(status: TaskStatus, updatedAt: number | undefined): number | undefined {
  return status === 'succeeded' && updatedAt !== undefined ? updatedAt + OUTPUT_RETENTION_MS : undefined;
}
