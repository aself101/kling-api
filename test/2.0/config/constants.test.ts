/**
 * ERROR_CODES must be a faithful transcription of the vendor's error table.
 * The oracle is the snapshot itself: docs/api/kling-get-started-error-codes.md.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  PERMANENT_429_CODES,
  TRANSIENT_ERROR_CODES,
  VENDOR_HTTP_STATUS,
  WRITE_NOT_CREATED_CODES,
} from '../../../src/config/constants.js';

const doc = readFileSync(new URL('../../../docs/api/kling-get-started-error-codes.md', import.meta.url), 'utf8');

/** `| 429 | 1303 | ... |` rows → Map<code, httpStatus>. */
function vendorRows(): Map<number, number> {
  const rows = new Map<number, number>();
  for (const line of doc.split('\n')) {
    const m = /^\|\s*(\d{3})\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) rows.set(Number(m[2]), Number(m[1]));
  }
  return rows;
}

describe('ERROR_CODES — vendor table transcription', () => {
  const rows = vendorRows();

  it('the snapshot has 22 rows (21 codes + success) — the count the spec states', () => {
    expect(rows.size).toBe(22);
  });

  it('every ERROR_CODES value is a vendor code, and every vendor code has a name', () => {
    const ours = new Set(Object.values(ERROR_CODES));
    expect([...ours].sort()).toEqual([...rows.keys()].sort());
  });

  it('VENDOR_HTTP_STATUS matches the HTTP column for every code', () => {
    for (const [code, status] of rows) {
      expect(VENDOR_HTTP_STATUS[code as keyof typeof VENDOR_HTTP_STATUS]).toBe(status);
    }
  });

  it('the phantom 1.x code 1104 is not in the table', () => {
    expect(rows.has(1104)).toBe(false);
    expect(Object.values(ERROR_CODES)).not.toContain(1104);
  });

  it('control: a row parser that could not fail would be worthless — a made-up code is absent', () => {
    expect(rows.has(9999)).toBe(false);
  });
});

describe('classification sets', () => {
  it('transient codes are exactly the vendor "try later" rows', () => {
    expect([...TRANSIENT_ERROR_CODES].sort()).toEqual([1302, 1303, 5000, 5001, 5002]);
  });

  it('permanent 429s are 1102 (pack exhausted) and 1304 (IP whitelist)', () => {
    expect([...PERMANENT_429_CODES].sort()).toEqual([1102, 1304]);
  });

  it('every 4xx business code is a write-not-created code; no 5xx code is', () => {
    for (const [code, status] of vendorRows()) {
      if (code === 0) continue;
      if (status < 500) expect(WRITE_NOT_CREATED_CODES.has(code), `code ${code}`).toBe(true);
      else expect(WRITE_NOT_CREATED_CODES.has(code), `code ${code}`).toBe(false);
    }
  });
});
