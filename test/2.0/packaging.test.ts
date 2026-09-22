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

  it('no consumer-facing doc links point at paths the tarball does not ship', () => {
    // README and CHANGELOG travel INSIDE the package; a relative link into docs/ resolves
    // nowhere from node_modules (dx-validator, Phase 7d). Absolute repo URLs work everywhere.
    const shipped = new Set((pkg.files ?? []).map((f) => f.replace(/\/$/, '')));
    for (const doc of ['README.md', 'CHANGELOG.md']) {
      const rel = [...readFileSync(doc, 'utf8').matchAll(/\]\((?!https?:|#)\.?\/?([^)]+)\)/g)].map((m) => m[1]);
      const dead = rel.filter((r) => !shipped.has(r.split('/')[0]!));
      expect(dead, `${doc} links to paths absent from package.json "files": ${dead.join(', ')}`).toEqual([]);
    }
  });

  /**
   * Anchors a handful of load-bearing behaviour claims to the code that decides them.
   *
   * Six README passages described superseded behaviour at once in this release — batching,
   * streaming, jitter, abort semantics — because each behaviour change updated the CHANGELOG
   * and left the prose section alone (consumer-validate, Phase 7d). This cannot verify prose
   * generally; it pins the specific claims a consumer plans capacity and error handling
   * against, and fails when the code moves and the README does not.
   */
  it('README behaviour claims match the code that decides them', () => {
    const readme = readFileSync('README.md', 'utf8');
    const anchors: [claim: string, sourceOfTruth: string, mustSay: RegExp, mustNotSay: RegExp][] = [
      ['reads are batched', 'src/handlers/coalescer.ts', /batches reads across handles/i, /does not batch across handles/i],
      ['save streams', 'src/handlers/saver.ts', /\bstreams\b[^.]*to disk/i, /buffered before it is written/i],
      ['backoff is jittered', 'src/http/core.ts', /jitter/i, /backoff is deterministic/i],
      ['a caller abort is rethrown', 'src/products/tasks.ts', /rethrown unwrapped/i, /never mind/],
    ];
    for (const [claim, source, mustSay, mustNotSay] of anchors) {
      expect(existsSync(source), `${source} backs the "${claim}" claim`).toBe(true);
      expect(mustSay.test(readme), `README must state: ${claim}`).toBe(true);
      expect(mustNotSay.test(readme), `README still carries superseded text for: ${claim}`).toBe(false);
    }
  });

  it('every type named in a public return signature is exported from the root', () => {
    // A consumer can use `page.malformed` without this, but cannot name its type to hold it in
    // a variable or a wrapper signature. The same gap shipped as TtsParams earlier in this
    // release and was caught both times only by compiling a real consumer against the tarball.
    const barrel = readFileSync('src/index.ts', 'utf8');
    for (const t of ['MalformedRecord', 'TaskPage', 'CursorPage', 'TtsParams', 'StreamedResource']) {
      expect(new RegExp(`\\b${t}\\b`).test(barrel), `${t} appears in a public return type but is not exported from src/index.ts`).toBe(true);
    }
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
