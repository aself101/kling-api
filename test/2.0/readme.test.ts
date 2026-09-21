/**
 * README guards (checklist 6c, V9): the model tables are generated from the registry and
 * must not drift; no stale 1.x vocabulary outside the migration table.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');

describe('README', () => {
  it.skipIf(!existsSync('dist/index.js'))('model tables equal the generator output (control: a mutated table differs)', () => {
    const generated = execFileSync(process.execPath, ['scripts/render-model-tables.mjs'], { encoding: 'utf8' }).trim();
    const start = readme.indexOf('<!-- model-tables:start -->') + '<!-- model-tables:start -->'.length;
    const end = readme.indexOf('<!-- model-tables:end -->');
    const inReadme = readme.slice(start, end).trim();
    expect(inReadme).toBe(generated);
    expect(inReadme.replace('kling-3.0-turbo', 'kling-3.0-turbo-x')).not.toBe(generated);
  });

  it('V9: no 1.x vocabulary outside the migration table and the legacy-callback sentence', () => {
    const lines = readme.split('\n');
    const migrationStart = lines.findIndex((l) => l.startsWith('## Migration from 1.x'));
    const migrationEnd = lines.findIndex((l, i) => i > migrationStart && l.startsWith('## '));
    const outside = lines.filter((_, i) => i < migrationStart || i >= migrationEnd);
    const stale = /accessKey|secretKey|kling-v1\b|kling-v2-master|kling-v2-6|kling-video-o1|'succeed'|\bKlingAPI\b/;
    const hits = outside.filter((l) => stale.test(l));
    expect(hits).toEqual([]);
    // `task_id` only as the vendor's own field name (external_task_id, task_ids, the legacy callback key).
    const rawTaskId = outside.filter((l) => /(^|[^_])task_id\b/.test(l) && !/task_ids/.test(l));
    expect(rawTaskId).toEqual([expect.stringContaining('legacy `task_id`')]);
    // kling-image-o1 appears only in the model table.
    expect(readme.split('\n').filter((l) => l.includes('kling-image-o1'))).toHaveLength(1);
  });

  it('every ToC entry has a heading and headings are unique; no empty sections', () => {
    const headings = readme.split('\n').filter((l) => /^##+ /.test(l)).map((l) => l.replace(/^#+ /, ''));
    expect(new Set(headings).size).toBe(headings.length);
    const slug = (h: string) => h.toLowerCase().replace(/[`'.,/()]/g, '').replace(/\s+/g, '-');
    const toc = [...readme.matchAll(/^- \[(.+?)\]\(#(.+?)\)$/gm)].map((m) => m[2]);
    for (const anchor of toc) expect(headings.map(slug), anchor).toContain(anchor);
    const lines = readme.split('\n');
    lines.forEach((l, i) => {
      if (/^##+ /.test(l)) {
        const next = lines.slice(i + 1).find((x) => x.trim() !== '');
        expect(next && !/^##+ /.test(next), `empty section: ${l}`).toBe(true);
      }
    });
  });
});
