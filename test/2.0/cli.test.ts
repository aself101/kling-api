/**
 * CLI (spec D15; checklist 6a/6b). The command tree is driven in-process through
 * `buildProgram()` with commander's exitOverride, so the tests need no build; one smoke
 * test spawns `dist/cli/index.js` when it exists.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/program.js';
import { elementArgs, mediaArg, resolveApiKey } from '../../src/cli/shared.js';

/** Run the tree with args, capturing commander's help/error output; returns { out, code }. */
async function run(args: string[]): Promise<{ out: string; code: number | undefined; thrown?: unknown }> {
  const program = buildProgram();
  let out = '';
  let code: number | undefined;
  program.exitOverride();
  program.configureOutput({ writeOut: (s) => void (out += s), writeErr: (s) => void (out += s) });
  for (const c of program.commands) {
    c.exitOverride();
    c.configureOutput({ writeOut: (s) => void (out += s), writeErr: (s) => void (out += s) });
    for (const sub of c.commands) {
      sub.exitOverride();
      sub.configureOutput({ writeOut: (s) => void (out += s), writeErr: (s) => void (out += s) });
    }
  }
  let thrown: unknown;
  try {
    await program.parseAsync(['node', 'kling', ...args]);
  } catch (e) {
    thrown = e;
    code = (e as { exitCode?: number }).exitCode;
  }
  // Help wraps long lines; collapse the wrapping so `(default: "…")` can be matched.
  return { out: out.replace(/\n\s{10,}/g, ' '), code, thrown };
}

const TREE: Record<string, string[]> = {
  video: ['t2v', 'i2v', 'omni', 'motion-control'],
  image: ['generate', 'omni', 'multi', 'outpaint', 'subject-completion'],
  elements: ['create', 'get', 'list', 'presets', 'delete'],
  voices: ['create', 'get', 'list', 'presets', 'delete'],
  avatar: ['create'],
  audio: ['tts'],
  tasks: ['get', 'list', 'get-by-product', 'list-by-product', 'recover'],
  account: ['usage', 'balance', 'packages'],
};
const DEAD_FLAGS = /--access-key|--secret-key|--mode <|--cfg-scale|--camera-|--image-tail|--sound <on/;

describe('kling command tree (D15)', () => {
  it('every group and subcommand from the spec exists and prints help', async () => {
    const top = await run(['--help']);
    for (const group of Object.keys(TREE)) expect(top.out).toContain(`\n  ${group} `);
    for (const [group, subs] of Object.entries(TREE)) {
      const help = await run([group, '--help']);
      for (const sub of subs) expect(help.out, `${group} ${sub}`).toMatch(new RegExp(`\\n  ${sub}( |\\n)`));
    }
  });

  it('global flags: --api-key, --output-dir, --json, --debug, -q; no JWT flags anywhere', async () => {
    const { out } = await run(['--help']);
    for (const f of ['--api-key <key>', '--output-dir <dir>', '--json', '--debug', '-q, --quiet']) expect(out).toContain(f);
    expect(out).not.toMatch(DEAD_FLAGS);
  });

  it('video defaults printed in help: kling-3.0-turbo (t2v, i2v), kling-3.0-omni (omni), kling-3.0 (motion-control)', async () => {
    expect((await run(['video', 't2v', '--help'])).out).toContain('(default: "kling-3.0-turbo")');
    expect((await run(['video', 'i2v', '--help'])).out).toContain('(default: "kling-3.0-turbo")');
    expect((await run(['video', 'omni', '--help'])).out).toContain('(default: "kling-3.0-omni")');
    expect((await run(['video', 'motion-control', '--help'])).out).toContain('(default: "kling-3.0")');
  });

  it('image defaults: kling-v3 (generate), kling-v3-omni (omni); multi has no model flag', async () => {
    expect((await run(['image', 'generate', '--help'])).out).toContain('(default: "kling-v3")');
    expect((await run(['image', 'omni', '--help'])).out).toContain('(default: "kling-v3-omni")');
    expect((await run(['image', 'multi', '--help'])).out).not.toContain('--model');
  });

  it('removed 1.x flags are absent from every video/image help; the video flags 2.0 adds are present', async () => {
    for (const [group, subs] of Object.entries(TREE)) {
      for (const sub of subs) {
        const { out } = await run([group, sub, '--help']);
        // avatar keeps `--mode <std|pro>` — the one surviving use of mode (spec §6.3).
        expect(out, `${group} ${sub}`).not.toMatch(group === 'avatar' ? /--access-key|--secret-key|--cfg-scale|--camera-|--image-tail/ : DEAD_FLAGS);
        if (group === 'video') expect(out).not.toContain('--negative-prompt');
      }
    }
    const i2v = (await run(['video', 'i2v', '--help'])).out;
    for (const f of ['--first-frame', '--last-frame', '--element <id[:alias]>', '--voice <id[:alias]>', '--wait', '--no-download', '--with-watermark', '--callback-url', '--external-task-id']) expect(i2v).toContain(f);
    const omni = (await run(['video', 'omni', '--help'])).out;
    for (const f of ['--refer-image', '--feature-video', '--base-video', '--multi-shot', '--no-multi-shot']) expect(omni).toContain(f);
    expect((await run(['video', 'motion-control', '--help'])).out).toContain('--character-orientation <image|video>');
    expect((await run(['elements', 'delete', '--help'])).out).toContain('--kind <video|image>');
  });

  it('a missing required option is a commander error (exit 1) before any network call', async () => {
    const { out, code } = await run(['video', 't2v']);
    expect(code).toBe(1);
    expect(out).toContain("required option '-p, --prompt <text>' not specified");
    expect((await run(['video', 'motion-control', '--image', 'x.png', '--video', 'https://v/x.mp4'])).out).toContain('--character-orientation');
  });

  it('typed option parsers: an integer flag rejects a non-integer with a KlingValidationError (exit 1 in the binary via reportError)', async () => {
    const { thrown } = await run(['video', 't2v', '-p', 'x', '-d', 'five', '--api-key', 'k']);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/duration must be an integer/);
  });
});

describe('cli helpers', () => {
  it('mediaArg: https passes through; anything else becomes { path } (absolute)', () => {
    expect(mediaArg('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(mediaArg('./a.png')).toEqual({ path: expect.stringMatching(/\/a\.png$/) });
    expect(mediaArg('http://insecure/a.png')).toEqual({ path: expect.stringMatching(/a\.png$/) }); // not https → treated as a file, and the library will refuse the missing file
  });

  it('elementArgs: id or id:alias, repeatable', () => {
    expect(elementArgs(['E1', 'E2:Zhang'])).toEqual([{ elementId: 'E1' }, { elementId: 'E2', id: 'Zhang' }]);
    expect(elementArgs(undefined)).toBeUndefined();
  });

  it('resolveApiKey: --api-key wins over KLING_API_KEY; both trimmed; none → undefined (env restored)', () => {
    const saved = process.env.KLING_API_KEY;
    try {
      process.env.KLING_API_KEY = ' env-k ';
      expect(resolveApiKey(' arg-k ')).toEqual({ apiKey: 'arg-k', source: '--api-key' });
      expect(resolveApiKey(undefined)).toEqual({ apiKey: 'env-k', source: 'KLING_API_KEY' });
    } finally {
      if (saved === undefined) delete process.env.KLING_API_KEY;
      else process.env.KLING_API_KEY = saved;
    }
  });
});

describe('dist/cli/index.js smoke', () => {
  const bin = 'dist/cli/index.js';
  it.skipIf(!existsSync(bin))('--version prints the package version; --help exits 0; a garbage key fails with exit 1 and a KlingAPIError line', () => {
    const version = execFileSync(process.execPath, [bin, '--version'], { encoding: 'utf8' }).trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(execFileSync(process.execPath, [bin, '--help'], { encoding: 'utf8' })).toContain('Usage: kling');
    let code = 0;
    let stderr = '';
    try {
      execFileSync(process.execPath, [bin, 'tasks', 'get', '0', '--api-key', 'garbage'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, KLING_API_KEY: '' } });
    } catch (e) {
      code = (e as { status: number }).status;
      stderr = (e as { stderr: string }).stderr;
    }
    expect(code).toBe(1);
    expect(stderr).toMatch(/Kling\w+Error/); // KlingBatchError wrapping the 401 KlingAPIError
    expect(stderr).toMatch(/1002|Authentication|fetch failed|ENOTFOUND/);
  }, 30_000);
});

describe('finishCreate — ship run #4: the paid task id survives a failed wait/save', () => {
  it('under --json a failing wait() still prints the summary with the id before the error propagates', async () => {
    const { finishCreate } = await import('../../src/cli/shared.js');
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { writes.push(String(chunk)); return true; }) as typeof process.stdout.write;
    try {
      const handle = {
        id: 'paid-1', externalId: 'ext-1', standard: 'new' as const, product: 'text-to-video' as const, request: {},
        get: async () => { throw new Error('unused'); },
        wait: async () => { throw new Error('poll exploded'); },
      };
      await expect(finishCreate({} as never, handle, { json: true }, { wait: true })).rejects.toThrow('poll exploded');
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(writes.join(''));
    expect(json).toMatchObject({ taskId: 'paid-1', externalId: 'ext-1', product: 'text-to-video', error: 'Error' });
  });

  it('tasks list --days 0 reaches the real handler as a zero-width window (startTime === endTime), while omitting --days sends no window', async () => {
    // Route through the REAL action: a fake fetch records the POST /tasks body the handler built.
    const bodies: Record<string, unknown>[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_u: string | URL | Request, init?: RequestInit) => {
      bodies.push(init?.body ? JSON.parse(String(init.body)) : {});
      return new Response(JSON.stringify({ code: 0, message: 'SUCCEED', request_id: 'r', data: { result: [], count: 0, has_more: false } }), { status: 200 });
    }) as typeof fetch;
    try {
      await buildProgram().parseAsync(['node', 'kling', '--api-key', 'k', '-q', 'tasks', 'list', '--days', '0']);
      await buildProgram().parseAsync(['node', 'kling', '--api-key', 'k', '-q', 'tasks', 'list']);
    } finally {
      globalThis.fetch = origFetch;
    }
    expect(bodies).toHaveLength(2);
    const [withDays, without] = bodies as { start_time?: number; end_time?: number }[];
    expect(withDays.start_time).toBeDefined();
    expect(withDays.start_time).toBe(withDays.end_time); // 0 days → zero-width window, not "unset"
    expect(without).not.toHaveProperty('start_time');
  });

  it('tasks list rejects an unknown --status / --product-type before any network call', async () => {
    let fetched = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => { fetched++; return new Response('{}'); }) as typeof fetch;
    try {
      await expect(buildProgram().parseAsync(['node', 'kling', '--api-key', 'k', '-q', 'tasks', 'list', '--status', 'bogus'])).rejects.toThrow(/--status must be one of submitted, processing, succeeded, failed, got "bogus"/);
      await expect(buildProgram().parseAsync(['node', 'kling', '--api-key', 'k', '-q', 'tasks', 'list', '--product-type', 'audio'])).rejects.toThrow(/--product-type must be one of video, image, try_on/);
    } finally {
      globalThis.fetch = origFetch;
    }
    expect(fetched).toBe(0);
  });
});
