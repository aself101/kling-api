/**
 * Account / billing envelopes (spec Phase 5; App. C §6). Three read endpoints outside both
 * task standards, each with its own shape; every vendor-spelled field is read HERE (D3).
 *
 *  - `GET /account/costs` — DOUBLE-WRAPPED: `data.code`, `data.msg` (not `message`),
 *    `data.resource_pack_subscribe_infos[]`. Free to call, QPS ≤ 1, "remaining quantity
 *    statistics have a 12h delay" (kling-assets-account-usage.md).
 *  - `POST /account/billing/balance` / `POST /account/billing/package` — cursor pages of
 *    per-task deductions: `data.result.detail[]`, `data.result.count`, `data.next_cursor`,
 *    `data.has_more` (kling-assets-balance.md, kling-assets-package.md).
 */
import { KlingCodecError } from '../http/errors.js';
import { envelopeData, isObject, optString, optTimestampMs, requireArray, requireObject, type JsonObject, type ParseContext } from './shared.js';

const STANDARD = 'legacy' as const;

export interface ResourcePackage {
  name: string;
  id: string;
  /** `decreasing_total` (units drawn down) | `constant_period` (a subscription window). */
  type?: 'decreasing_total' | 'constant_period' | (string & {});
  totalQuantity?: number;
  /** "remaining quantity statistics have a 12h delay" — the vendor's caveat, not the library's. */
  remainingQuantity?: number;
  purchasedAt?: number;
  effectiveAt?: number;
  expiresAt?: number;
  status?: 'toBeOnline' | 'online' | 'expired' | 'runOut' | (string & {});
  raw: unknown;
}

/** `GET /account/costs`. The inner `data.code` is checked too — the outer envelope can be `0` while the inner says otherwise. */
export function parseUsage(json: unknown, ctx?: ParseContext): ResourcePackage[] {
  const data = requireObject(envelopeData(json, STANDARD), STANDARD, 'data');
  if (typeof data.code === 'number' && data.code !== 0) {
    throw new KlingCodecError(`account/costs inner code ${data.code}: ${optString(data.msg) ?? 'no message'}`, STANDARD, 'data.code');
  }
  const list = data.resource_pack_subscribe_infos === undefined ? [] : requireArray(data.resource_pack_subscribe_infos, STANDARD, 'data.resource_pack_subscribe_infos');
  return list.map((entry, i) => {
    const path = `data.resource_pack_subscribe_infos[${i}]`;
    const o = requireObject(entry, STANDARD, path);
    const pkg: ResourcePackage = { name: optString(o.resource_pack_name) ?? '', id: optString(o.resource_pack_id) ?? '', raw: o };
    const type = optString(o.resource_pack_type);
    if (type !== undefined) pkg.type = type;
    if (typeof o.total_quantity === 'number') pkg.totalQuantity = o.total_quantity;
    if (typeof o.remaining_quantity === 'number') pkg.remainingQuantity = o.remaining_quantity;
    const purchasedAt = optTimestampMs(o.purchase_time, `${path}.purchase_time`, ctx);
    if (purchasedAt !== undefined) pkg.purchasedAt = purchasedAt;
    const effectiveAt = optTimestampMs(o.effective_time, `${path}.effective_time`, ctx);
    if (effectiveAt !== undefined) pkg.effectiveAt = effectiveAt;
    const expiresAt = optTimestampMs(o.invalid_time, `${path}.invalid_time`, ctx);
    if (expiresAt !== undefined) pkg.expiresAt = expiresAt;
    const status = optString(o.status);
    if (status !== undefined) pkg.status = status;
    return pkg;
  });
}

/** One deduction row, common to both ledgers; cash and unit ledgers add their own amounts. */
export interface DeductionEntry {
  taskId: string;
  apiKeyName?: string;
  /** e.g. "Image to Video". */
  productFunction?: string;
  modelName?: string;
  /** `720p | 1080p | 4k` — legacy `mode` mapped `std → 720p`, `pro → 1080p`. */
  resolution?: string;
  /** Seconds, video only (the vendor sends a string). */
  durationSeconds?: number;
  referVideoInput?: boolean;
  videoSound?: 'native' | 'original' | 'off' | (string & {});
  voiceControl?: boolean;
  /** Unix ms (the vendor sends a string). */
  deductedAt?: number;
  raw: unknown;
}

export interface CashDeductionEntry extends DeductionEntry {
  cashType?: 'balance' | 'test_balance' | (string & {});
  balanceBefore?: number;
  amount?: number;
  balanceAfter?: number;
  listPrice?: number;
  currency?: string;
}

export interface UnitDeductionEntry extends DeductionEntry {
  packageId?: string;
  productType?: 'video' | 'image' | 'try-on' | (string & {});
  unitsBefore?: number;
  amount?: number;
  unitsAfter?: number;
}

export interface LedgerPage<T extends DeductionEntry> {
  entries: T[];
  count: number;
  nextCursor?: string;
  hasMore: boolean;
}

function baseEntry(o: JsonObject, path: string, ctx: ParseContext | undefined): DeductionEntry {
  const e: DeductionEntry = { taskId: optString(o.task_id) ?? '', raw: o };
  const s = (k: string) => optString(o[k]);
  if (s('api_key_name')) e.apiKeyName = s('api_key_name');
  if (s('product_function')) e.productFunction = s('product_function');
  if (s('model_name')) e.modelName = s('model_name');
  if (s('resolution')) e.resolution = s('resolution');
  const dur = Number(o.duration);
  if (typeof o.duration === 'string' && o.duration !== '' && Number.isFinite(dur)) e.durationSeconds = dur;
  if (typeof o.refer_video_input === 'boolean') e.referVideoInput = o.refer_video_input;
  if (s('video_sound')) e.videoSound = s('video_sound');
  if (typeof o.voice_control === 'boolean') e.voiceControl = o.voice_control;
  const t = typeof o.deduction_time === 'string' ? Number(o.deduction_time) : o.deduction_time;
  const deductedAt = optTimestampMs(t, `${path}.deduction_time`, ctx);
  if (deductedAt !== undefined) e.deductedAt = deductedAt;
  return e;
}

function ledgerPage<T extends DeductionEntry>(json: unknown, mapEntry: (o: JsonObject, path: string) => T): LedgerPage<T> {
  const data = requireObject(envelopeData(json, STANDARD), STANDARD, 'data');
  const result = isObject(data.result) ? data.result : {};
  const detail = result.detail === undefined ? [] : requireArray(result.detail, STANDARD, 'data.result.detail');
  const entries = detail.map((row, i) => mapEntry(requireObject(row, STANDARD, `data.result.detail[${i}]`), `data.result.detail[${i}]`));
  return { entries, count: typeof result.count === 'number' ? result.count : entries.length, nextCursor: optString(data.next_cursor), hasMore: data.has_more === true };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** `POST /account/billing/balance`. */
export function parseBalanceLedger(json: unknown, ctx?: ParseContext): LedgerPage<CashDeductionEntry> {
  return ledgerPage(json, (o, path) => {
    const e: CashDeductionEntry = baseEntry(o, path, ctx);
    if (optString(o.cash_type)) e.cashType = optString(o.cash_type);
    if (num(o.balance_before_deduction) !== undefined) e.balanceBefore = num(o.balance_before_deduction);
    if (num(o.deduction_amount) !== undefined) e.amount = num(o.deduction_amount);
    if (num(o.balance_after_deduction) !== undefined) e.balanceAfter = num(o.balance_after_deduction);
    if (num(o.list_price) !== undefined) e.listPrice = num(o.list_price);
    if (optString(o.currency)) e.currency = optString(o.currency);
    return e;
  });
}

/** `POST /account/billing/package`. */
export function parsePackageLedger(json: unknown, ctx?: ParseContext): LedgerPage<UnitDeductionEntry> {
  return ledgerPage(json, (o, path) => {
    const e: UnitDeductionEntry = baseEntry(o, path, ctx);
    if (optString(o.package_id)) e.packageId = optString(o.package_id);
    if (optString(o.product_type)) e.productType = optString(o.product_type);
    if (num(o.unit_before_deduction) !== undefined) e.unitsBefore = num(o.unit_before_deduction);
    if (num(o.deduction_amount) !== undefined) e.amount = num(o.deduction_amount);
    if (num(o.unit_after_deduction) !== undefined) e.unitsAfter = num(o.unit_after_deduction);
    return e;
  });
}
