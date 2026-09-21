/**
 * Cross-codec controls (spec §8 V1: "wrong-standard fixture → KlingCodecError").
 *
 * The two standards are told apart by their id field. Every legacy fixture through the
 * new-standard parsers, and every new fixture through the legacy parsers, must throw —
 * a parser that quietly accepted the other envelope would route a legacy task to
 * `/tasks` (which answers `200 []`) and report it missing.
 */
import { describe, expect, it } from 'vitest';
import * as legacy from '../../../src/codecs/legacy.js';
import * as newStd from '../../../src/codecs/new-standard.js';
import { KlingCodecError } from '../../../src/http/errors.js';
import { LEGACY_FIXTURES, NEW_FIXTURES, fixture } from './fixtures.js';

const isCallback = (f: string) => f.endsWith('callback.json');

describe('cross-codec controls', () => {
  it.each(LEGACY_FIXTURES.filter((f) => !isCallback(f)))('legacy fixture %s → new-standard parsers throw KlingCodecError', (f) => {
    const json = fixture(f);
    for (const parse of [newStd.parseCreate, newStd.parseTasks, newStd.parseCursor]) {
      expect(() => parse(json), parse.name).toThrow(KlingCodecError);
    }
  });

  it.each(NEW_FIXTURES.filter((f) => !isCallback(f)))('new fixture %s → legacy parsers throw KlingCodecError', (f) => {
    const json = fixture(f);
    for (const parse of [legacy.parseCreate, legacy.parseTask, legacy.parseList]) {
      expect(() => parse(json), parse.name).toThrow(KlingCodecError);
    }
  });

  it('callback bodies: each record parser rejects the other standard', () => {
    const newBody = fixture('new/callback.json') as Record<string, unknown>;
    const legacyBody = fixture('legacy/callback.json') as Record<string, unknown>;
    expect(() => legacy.parseTaskRecord(newBody)).toThrow(KlingCodecError);
    expect(() => newStd.parseTaskRecord(legacyBody)).toThrow(KlingCodecError);
  });

  it('positive control: each fixture parses under its own codec (so the throws above are not vacuous)', () => {
    for (const f of LEGACY_FIXTURES.filter((x) => !isCallback(x))) {
      const json = fixture(f);
      const ok = [legacy.parseCreate, legacy.parseTask, legacy.parseList].some((p) => {
        try {
          p(json);
          return true;
        } catch {
          return false;
        }
      });
      expect(ok, f).toBe(true);
    }
    for (const f of NEW_FIXTURES.filter((x) => !isCallback(x))) {
      const json = fixture(f);
      const ok = [newStd.parseCreate, newStd.parseTasks, newStd.parseCursor].some((p) => {
        try {
          p(json);
          return true;
        } catch {
          return false;
        }
      });
      expect(ok, f).toBe(true);
    }
  });
});
