/**
 * Account and billing reads (spec Phase 5; App. C §6). All three are `kind: 'read'` (retried
 * on the read policy) and live outside both task standards.
 */
import {
  parseBalanceLedger,
  parsePackageLedger,
  parseUsage,
  type CashDeductionEntry,
  type LedgerPage,
  type ResourcePackage,
  type UnitDeductionEntry,
} from '../codecs/account.js';
import type { RequestOptions } from '../codecs/task.js';
import type { HttpCore } from '../http/core.js';
import { KlingValidationError } from '../http/errors.js';
import type { ProductApiConfig } from './shared.js';

export interface UsageOptions extends RequestOptions {
  /** Narrow to one package by its `resource_pack_name`. */
  resourcePackName?: string;
}

export interface LedgerOptions extends RequestOptions {
  /** Unix ms; required unless `cursor` is set (the vendor: "Required when cursor is empty"). */
  startTime?: number;
  endTime?: number;
  /** From the previous page's `nextCursor`; overrides every other parameter. */
  cursor?: string;
  /** ≤ 500 (vendor default 500). */
  limit?: number;
  /** `filters[] { key: 'api_key_name' }` — same-type filters OR, different types AND. */
  apiKeyName?: string | string[];
}

export interface PackageLedgerOptions extends LedgerOptions {
  productType?: 'video' | 'image' | 'try-on' | ('video' | 'image' | 'try-on')[];
  /** Mutually exclusive with `packageId`. */
  packageName?: string | string[];
  packageId?: string | string[];
}

const LEDGER_MAX_LIMIT = 500;

/** `client.account` — resource packages (`usage`) and per-task cash / unit deduction ledgers (App. C §6). */
export class AccountApi {
  readonly #core: HttpCore;
  readonly #config: ProductApiConfig;

  constructor(core: HttpCore, config: ProductApiConfig) {
    this.#core = core;
    this.#config = config;
  }

  #ctx() {
    return { warn: (m: string) => this.#config.logger.warn(m) };
  }

  /**
   * `GET /account/costs` — the packages under the account and what is left on each.
   * Free, QPS ≤ 1, remaining quantities lag by up to 12 h (the vendor's caveat).
   */
  async usage(
    startTime: number,
    endTime: number,
    options: UsageOptions = {}
  ): Promise<ResourcePackage[]> {
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
      throw new KlingValidationError(
        'startTime',
        'startTime and endTime are required Unix ms timestamps with startTime < endTime'
      );
    }
    const res = await this.#core.request({
      method: 'GET',
      path: '/account/costs',
      query: {
        start_time: startTime,
        end_time: endTime,
        resource_pack_name: options.resourcePackName,
      },
      kind: 'read',
      signal: options.signal,
    });
    return parseUsage(res.envelope, this.#ctx());
  }

  /** `POST /account/billing/balance` — cash deductions per task, cursor-paged. */
  async balanceLedger(options: LedgerOptions = {}): Promise<LedgerPage<CashDeductionEntry>> {
    const body = ledgerBody(options, [['api_key_name', options.apiKeyName]]);
    const res = await this.#core.request({
      method: 'POST',
      path: '/account/billing/balance',
      body,
      kind: 'read',
      signal: options.signal,
    });
    return parseBalanceLedger(res.envelope, this.#ctx());
  }

  /** `POST /account/billing/package` — unit (resource-pack) deductions per task, cursor-paged. */
  async packageLedger(options: PackageLedgerOptions = {}): Promise<LedgerPage<UnitDeductionEntry>> {
    if (options.packageName !== undefined && options.packageId !== undefined) {
      throw new KlingValidationError(
        'packageName',
        'packageName and packageId are mutually exclusive filters (the vendor: "cannot be set as filtering conditions at the same time")'
      );
    }
    const body = ledgerBody(options, [
      ['api_key_name', options.apiKeyName],
      ['product_type', options.productType],
      ['package_name', options.packageName],
      ['package_id', options.packageId],
    ]);
    const res = await this.#core.request({
      method: 'POST',
      path: '/account/billing/package',
      body,
      kind: 'read',
      signal: options.signal,
    });
    return parsePackageLedger(res.envelope, this.#ctx());
  }
}

function ledgerBody(
  options: LedgerOptions,
  filterPairs: [string, string | string[] | undefined][]
): Record<string, unknown> {
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > LEDGER_MAX_LIMIT)
  ) {
    throw new KlingValidationError(
      'limit',
      `limit must be an integer in 1–${LEDGER_MAX_LIMIT}, got ${options.limit}`
    );
  }
  if (
    options.cursor === undefined &&
    (options.startTime === undefined || options.endTime === undefined)
  ) {
    throw new KlingValidationError(
      'startTime',
      'startTime and endTime are required when cursor is not set'
    );
  }
  const body: Record<string, unknown> = {};
  if (options.cursor !== undefined) {
    body.cursor = options.cursor; // overrides everything else (vendor)
    return body;
  }
  body.start_time = options.startTime;
  body.end_time = options.endTime;
  if (options.limit !== undefined) body.limit = options.limit;
  const filters = filterPairs
    .filter(([, v]) => v !== undefined)
    .map(([key, v]) => ({ key, values: [v!].flat() }));
  if (filters.length > 0) body.filters = filters;
  return body;
}
