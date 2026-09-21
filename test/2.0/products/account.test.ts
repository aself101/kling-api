/** AccountApi and the account codec (App. C §6). */
import { describe, expect, it } from 'vitest';
import { parseUsage } from '../../../src/codecs/account.js';
import { HttpCore } from '../../../src/http/core.js';
import { KlingCodecError, KlingValidationError } from '../../../src/http/errors.js';
import { AccountApi } from '../../../src/products/account.js';

interface Call { url: URL; method: string; body?: Record<string, unknown> }
function rig(route: (c: Call) => unknown) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: new URL(String(input)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    return new Response(JSON.stringify(route(call)), { status: 200 });
  }) as typeof fetch;
  const logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };
  return { calls, account: new AccountApi(new HttpCore({ apiKey: 'k', fetch: fetchImpl, retry: { maxAttempts: 1 } }), { logger, unknownModels: 'passthrough', capabilityValidation: 'error' }) };
}

const USAGE = {
  code: 0, message: 'SUCCEED', request_id: 'r',
  data: {
    code: 0, msg: 'success',
    resource_pack_subscribe_infos: [
      { resource_pack_name: 'Trial-Video-100Units-5Con-1Months', resource_pack_id: 'p1', resource_pack_type: 'decreasing_total', total_quantity: 100, remaining_quantity: 91.3, purchase_time: 1789800000000, effective_time: 1789800000000, invalid_time: 1792392000000, status: 'online' },
    ],
  },
};

describe('account.usage', () => {
  it('GET /account/costs with ms bounds; parses the double envelope into camelCase packages', async () => {
    const { account, calls } = rig(() => USAGE);
    const pkgs = await account.usage(1789800000000, 1789900000000, { resourcePackName: 'Trial-Video-100Units-5Con-1Months' });
    expect(calls[0].url.pathname).toBe('/account/costs');
    expect(calls[0].url.searchParams.get('start_time')).toBe('1789800000000');
    expect(calls[0].url.searchParams.get('resource_pack_name')).toBe('Trial-Video-100Units-5Con-1Months');
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0]).toMatchObject({ name: 'Trial-Video-100Units-5Con-1Months', id: 'p1', type: 'decreasing_total', totalQuantity: 100, remainingQuantity: 91.3, expiresAt: 1792392000000, status: 'online' });
  });

  it('bad bounds → KlingValidationError before any request; an inner non-zero code → KlingCodecError', async () => {
    const { account, calls } = rig(() => USAGE);
    await expect(account.usage(5, 5)).rejects.toBeInstanceOf(KlingValidationError);
    expect(calls).toHaveLength(0);
    expect(() => parseUsage({ code: 0, data: { code: 1100, msg: 'account abnormal' } })).toThrow(KlingCodecError);
    expect(parseUsage({ code: 0, data: { code: 0, msg: 'ok' } })).toEqual([]);
  });
});

describe('account ledgers', () => {
  const PAGE = { code: 0, data: { result: { detail: [{ task_id: 't1', api_key_name: 'main', product_function: 'Text to Video', model_name: 'kling-3.0-turbo', resolution: '720p', duration: '3.041', video_sound: 'native', deduction_time: '1789956078000', package_id: 'p1', product_type: 'video', unit_before_deduction: 93.7, deduction_amount: 2.4, unit_after_deduction: 91.3 }], count: 1 }, next_cursor: 'c2', has_more: true } };

  it('packageLedger: body with ms window, limit, filters[]; parses unit entries', async () => {
    const { account, calls } = rig(() => PAGE);
    const page = await account.packageLedger({ startTime: 1, endTime: 2, limit: 50, productType: 'video', apiKeyName: ['a', 'b'] });
    expect(calls[0].url.pathname).toBe('/account/billing/package');
    expect(calls[0].body).toEqual({ start_time: 1, end_time: 2, limit: 50, filters: [{ key: 'api_key_name', values: ['a', 'b'] }, { key: 'product_type', values: ['video'] }] });
    expect(page).toMatchObject({ count: 1, nextCursor: 'c2', hasMore: true });
    expect(page.entries[0]).toMatchObject({ taskId: 't1', modelName: 'kling-3.0-turbo', durationSeconds: 3.041, deductedAt: 1789956078000, unitsBefore: 93.7, amount: 2.4, unitsAfter: 91.3, productType: 'video' });
  });

  it('cursor overrides everything; window required without a cursor; limit ≤ 500; packageName XOR packageId', async () => {
    const { account, calls } = rig(() => PAGE);
    await account.balanceLedger({ cursor: 'c2', startTime: 1, endTime: 2, limit: 10 });
    expect(calls[0].url.pathname).toBe('/account/billing/balance');
    expect(calls[0].body).toEqual({ cursor: 'c2' });
    await expect(account.balanceLedger({})).rejects.toThrow(/startTime and endTime are required/);
    await expect(account.balanceLedger({ startTime: 1, endTime: 2, limit: 501 })).rejects.toThrow(/limit/);
    await expect(account.packageLedger({ startTime: 1, endTime: 2, packageName: 'x', packageId: 'y' })).rejects.toThrow(/mutually exclusive/);
    expect(calls).toHaveLength(1);
  });
});

describe('account.balanceLedger — cash fields (ship run #4)', () => {
  const CASH_PAGE = { code: 0, data: { result: { detail: [{ task_id: 't2', api_key_name: 'main', product_function: 'Image Generation', model_name: 'kling-v3', cash_type: 'balance', balance_before_deduction: 120.5, deduction_amount: 8.4, balance_after_deduction: 112.1, list_price: 8.4, currency: 'USD', deduction_time: '1789956078000' }], count: 1 }, next_cursor: 'c3', has_more: false } };

  it('maps cash_type / balance_before / amount / balance_after / list_price / currency', async () => {
    const { account } = rig(() => CASH_PAGE);
    const page = await account.balanceLedger({ startTime: 1, endTime: 2 });
    expect(page.entries[0]).toMatchObject({ taskId: 't2', cashType: 'balance', balanceBefore: 120.5, amount: 8.4, balanceAfter: 112.1, listPrice: 8.4, currency: 'USD', deductedAt: 1789956078000 });
    expect(page).toMatchObject({ count: 1, nextCursor: 'c3', hasMore: false });
    // Control: a renamed vendor field is not silently mapped.
    const renamed = rig(() => ({ ...CASH_PAGE, data: { ...CASH_PAGE.data, result: { detail: [{ ...CASH_PAGE.data.result.detail[0], balance_after_deduction: undefined, balance_after: 112.1 }], count: 1 } } }));
    expect((await renamed.account.balanceLedger({ startTime: 1, endTime: 2 })).entries[0]).not.toHaveProperty('balanceAfter');
  });
});
