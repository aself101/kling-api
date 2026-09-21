/**
 * Validator plumbing (spec D9). Two rule classes:
 *
 *  - `[shape]`  — required fields, types, mutually exclusive fields, URL-only media,
 *                 and any rule that changes what a PAID request means. Always throws.
 *  - `[capability]` — "does this known model accept this value": resolution/duration/
 *                 audio/content-type sets and the cross-field rules. Throws under
 *                 `capabilityValidation: 'error'` (default), warns and proceeds under
 *                 `'warn'` — the "vendor moved before we did" knob (run #2 A19/A26).
 *
 * An UNKNOWN model gets shape rules only: there is no row to check capabilities against.
 * Import graph (§5): `config/models`, `config/constants`, `http/errors`, `codecs/*` types.
 */
import { VIDEO_MODELS, type VideoModelCaps } from '../models.js';
import type { KnownVideoModel } from '../../codecs/params.js';
import { KlingValidationError } from '../../http/errors.js';

export interface ValidationPolicy {
  unknownModels: 'passthrough' | 'reject';
  capabilityValidation: 'error' | 'warn';
  warn: (message: string) => void;
}

/** Always throws — the rule guards the request's meaning, not a model's feature list. */
export function shape(condition: boolean, field: string, message: string): void {
  if (!condition) throw new KlingValidationError(field, message);
}

/** Throws or warns per policy. Returns whether the rule PASSED, so a dependent rule can skip. */
export function capability(condition: boolean, field: string, message: string, policy: ValidationPolicy): boolean {
  if (condition) return true;
  if (policy.capabilityValidation === 'warn') {
    policy.warn(`[capability] ${field}: ${message} — sent anyway (capabilityValidation: 'warn')`);
    return false;
  }
  throw new KlingValidationError(field, message);
}

/**
 * The capability row for a model id, or `undefined` for an unknown id under
 * `'passthrough'` (with a warning naming the id and the knob). `'reject'` throws.
 */
export function resolveVideoCaps(model: string, policy: ValidationPolicy): VideoModelCaps | undefined {
  if (Object.prototype.hasOwnProperty.call(VIDEO_MODELS, model)) return VIDEO_MODELS[model as KnownVideoModel];
  if (policy.unknownModels === 'reject') {
    throw new KlingValidationError('model', `unknown video model ${JSON.stringify(model)}; known: ${Object.keys(VIDEO_MODELS).join(', ')} (unknownModels: 'reject')`);
  }
  policy.warn(`model ${JSON.stringify(model)} is not in this library's capability registry — sent with shape-only validation (unknownModels: 'passthrough')`);
  return undefined;
}

/** `extraSettings` / `extraOptions` may not carry a key the library models (run #3 A41). */
export function rejectModeledExtras(extras: Record<string, unknown> | undefined, modeled: ReadonlySet<string>, field: string): void {
  if (!extras) return;
  for (const key of Object.keys(extras)) {
    shape(!modeled.has(key), field, `${field}.${key} is a field the library models — pass it as its own parameter, not through ${field}`);
  }
}

export const isInteger = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
