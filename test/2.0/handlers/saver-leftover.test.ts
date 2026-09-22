/**
 * Ship run #6 (code-auditor AF-002): when the failed write's temp file cannot be removed
 * either, `KlingSaveError.leftover` names it — otherwise `<file>.<pid>.part` is on disk and
 * named by neither `written` nor the error. The fault sits between write and rename, which no
 * real filesystem lets a test inject, so `node:fs` is partially mocked here and only here.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../src/codecs/task.js';
import { save } from '../../../src/handlers/saver.js';
import { KlingSaveError } from '../../../src/http/errors.js';

const errno = (code: string, msg: string) => Object.assign(new Error(msg), { code });
const mode = { rename: false, rm: false };

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>();
  return {
    ...real,
    renameSync: (...a: Parameters<typeof real.renameSync>) => {
      if (mode.rename) throw errno('EISDIR', 'illegal operation on a directory, rename');
      return real.renameSync(...a);
    },
    rmSync: (...a: Parameters<typeof real.rmSync>) => {
      if (mode.rm) throw errno('EACCES', 'permission denied, unlink');
      return real.rmSync(...a);
    },
  };
});

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const NOW = 1_800_000_000_000;
const task = (): Task => ({
  id: 't-1', standard: 'new', product: 'text-to-video', status: 'succeeded',
  updatedAt: NOW - 1000, outputsExpireAt: NOW + 86_400_000,
  outputs: [{ type: 'video', id: 'v', url: 'https://cdn.example/v.mp4', watermarkUrl: 'https://cdn.example/v-wm.mp4', durationSeconds: 3 }],
  raw: { id: 't-1' },
});
const fetchImpl = (async () => new Response('MP4', { status: 200, headers: { 'content-type': 'video/mp4' } })) as typeof fetch;

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'kling-save-leftover-')); mode.rename = false; mode.rm = false; });
afterEach(() => { mode.rename = false; mode.rm = false; rmSync(dir, { recursive: true, force: true }); });

describe('save — temp-file cleanup failure', () => {
  it('rename fails AND rm fails → KlingSaveError.leftover names the .part file and the rm cause; the message says so', async () => {
    mode.rename = true; mode.rm = true;
    const err = await save(task(), dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW }).catch((e) => e as KlingSaveError);
    expect(err).toBeInstanceOf(KlingSaveError);
    expect((err.cause as NodeJS.ErrnoException).code).toBe('EISDIR');
    // The temp name is keyed on the OUTPUT INDEX, not the final file name: since ship run #6
    // the body is streamed straight into it, and the extension is only known once the
    // response's Content-Type arrives.
    expect(err.leftover?.path).toBe(join(dir, `t-1-0.${process.pid}.part`));
    expect((err.leftover?.cause as NodeJS.ErrnoException).code).toBe('EACCES');
    expect(err.message).toMatch(/temp file .*t-1-0\.\d+\.part could not be removed: permission denied/);
    expect(err.written).toEqual([]);
  });

  it('control: rename fails but rm succeeds → no leftover, no cleanup tail in the message', async () => {
    mode.rename = true;
    const err = await save(task(), dir, { fetch: fetchImpl, lookup: publicDns, now: () => NOW }).catch((e) => e as KlingSaveError);
    expect(err).toBeInstanceOf(KlingSaveError);
    expect(err.leftover).toBeUndefined();
    expect(err.message).not.toMatch(/could not be removed/);
  });
});
