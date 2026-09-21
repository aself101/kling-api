/**
 * Fixture provenance (spec V1, D17, D20).
 *
 * The codec tests are only as good as the fixtures' fidelity to `docs/api`. Three checks:
 *  1. every fixture on disk has an INDEX row (a hand-dropped JSON has no provenance);
 *  2. every fixture the tests name exists (a renamed file would silently skip a table row);
 *  3. re-running the extractor reproduces the tree byte-for-byte — the fixtures ARE the
 *     vendor examples plus the listed substitutions, and nothing else. Control: a fixture
 *     mutated in a temp copy fails the comparison.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR, LEGACY_FIXTURES, NEW_FIXTURES, REQUEST_FIXTURES } from './fixtures.js';

const onDisk = (): string[] =>
  ['new', 'legacy', 'requests'].flatMap((d) => readdirSync(join(FIXTURES_DIR, d)).map((f) => `${d}/${f}`)).sort();

describe('codec fixtures — provenance', () => {
  it('every fixture on disk has an INDEX.md row, and every named fixture is on disk', () => {
    const index = readFileSync(join(FIXTURES_DIR, 'INDEX.md'), 'utf8');
    const files = onDisk();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(index, `${f} has no INDEX row`).toContain(`| \`${f}\` |`);
    expect(files).toEqual([...NEW_FIXTURES, ...LEGACY_FIXTURES, ...REQUEST_FIXTURES].sort());
  });

  it('the extractor reproduces the tree byte-for-byte (and a mutated copy is detected)', () => {
    const before = Object.fromEntries(onDisk().map((f) => [f, readFileSync(join(FIXTURES_DIR, f), 'utf8')]));
    // Regenerate into a scratch copy of the whole repo slice the script needs (docs/api + the script).
    const tmp = mkdtempSync(join(tmpdir(), 'kling-fixtures-'));
    try {
      cpSync(join(FIXTURES_DIR, '..', '..', '..', 'docs', 'api'), join(tmp, 'docs', 'api'), { recursive: true });
      cpSync(FIXTURES_DIR, join(tmp, 'test', '2.0', 'fixtures'), { recursive: true });
      // Control: corrupt one fixture in the copy, then regenerate — the script must restore it.
      const victim = join(tmp, 'test', '2.0', 'fixtures', 'new', 't2v-create.json');
      writeFileSync(victim, '{"corrupt":true}\n');
      expect(readFileSync(victim, 'utf8')).not.toBe(before['new/t2v-create.json']);
      execFileSync(process.execPath, [join(tmp, 'test', '2.0', 'fixtures', 'extract.mjs')], { stdio: 'pipe' });
      for (const [f, content] of Object.entries(before)) {
        expect(readFileSync(join(tmp, 'test', '2.0', 'fixtures', f), 'utf8'), `${f} drifted from docs/api`).toBe(content);
      }
      expect(readFileSync(join(tmp, 'test', '2.0', 'fixtures', 'INDEX.md'), 'utf8')).toBe(readFileSync(join(FIXTURES_DIR, 'INDEX.md'), 'utf8'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
