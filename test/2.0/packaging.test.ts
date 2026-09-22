/**
 * Packaging invariants a consumer sees and the repo does not (ship run #6, Phase 7d).
 *
 * These exist because Verdaccio validation caught something every in-repo check was blind to:
 * the published `.d.ts` files name the Node global `Buffer`, but `@types/node` was a
 * devDependency, so a TypeScript consumer installing the tarball could not compile against the
 * package at all — four errors from inside our own types. `npm run build`, `npm test` and lint
 * were all green, because in this repo `@types/node` is always present.
 *
 * The guard is the general form of that bug: if the emitted types reference a Node global, the
 * package must declare the types package that supplies it, as a real dependency.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  files?: string[];
  types?: string;
  main?: string;
  bin?: Record<string, string>;
};

/** Every emitted declaration file, or [] when dist has not been built. */
function declarations(dir = 'dist'): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...declarations(full));
    else if (entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Node globals that only exist with `@types/node` loaded. */
const NODE_GLOBALS = /\b(Buffer|NodeJS\.|AbortSignal\s*\|\s*undefined\b(?=.*node)|process\.)/;

describe('packaging invariants (what a consumer installs, not what the repo has)', () => {
  const dts = declarations();

  it('dist/*.d.ts exist to check (the suite is meaningless without a build)', () => {
    expect(dts.length).toBeGreaterThan(10);
  });

  it('if the published types name a Node global, @types/node is a real dependency — not a dev one', () => {
    const offenders = dts.filter((f) => NODE_GLOBALS.test(readFileSync(f, 'utf8')));
    if (offenders.length === 0) return; // nothing to require
    expect(
      pkg.dependencies?.['@types/node'],
      `these published types name a Node global, so @types/node must be in "dependencies" ` +
        `(it was a devDependency until Phase 7d, and a TS consumer could not compile):\n  ` +
        offenders.slice(0, 6).join('\n  ')
    ).toBeDefined();
  });

  it('CONTROL — the detector actually fires on a file that names Buffer', () => {
    // Guards the guard: if NODE_GLOBALS stopped matching, the test above would pass vacuously.
    expect(NODE_GLOBALS.test('export interface X { buffer: Buffer; }')).toBe(true);
    expect(NODE_GLOBALS.test('export interface X { id: string; }')).toBe(false);
  });

  it('every declared entry point exists in the build', () => {
    for (const p of [pkg.main, pkg.types, ...Object.values(pkg.bin ?? {})]) {
      expect(existsSync(String(p).replace(/^\.\//, '')), `${p} is declared but missing`).toBe(true);
    }
  });

  it('npm pack ships dist + docs only — no src, no tests, no env files', () => {
    const listing = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
    const files = (JSON.parse(listing) as [{ files: { path: string }[] }])[0].files.map((f) => f.path);
    expect(files.length).toBeGreaterThan(50);
    for (const bad of [/^src\//, /^test\//, /^scripts\//, /^docs\//, /\.env/, /^tsconfig/, /^eslint/]) {
      expect(files.filter((f) => bad.test(f)), `${bad} must not ship`).toEqual([]);
    }
    expect(files).toContain('README.md');
    expect(files).toContain('package.json');
  });
});
