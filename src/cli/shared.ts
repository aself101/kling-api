/**
 * CLI plumbing (spec D15): credential chain, client construction, output modes, media
 * argument wrapping, the spinner-wrapped wait, and the save step. `src/cli/**` is the one
 * tree the import graph does not restrict — and the only place `dotenv` and `ora` are
 * imported (spec D11).
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import dotenv from 'dotenv';
import ora from 'ora';
import type { Command } from 'commander';
import { KlingClient } from '../client.js';
import type { MediaSource } from '../codecs/params.js';
import type { Task, TaskHandle } from '../codecs/task.js';
import { MISSING_API_KEY_MESSAGE } from '../config/loaders.js';
import { KlingError, KlingValidationError } from '../http/errors.js';

export interface GlobalOptions {
  apiKey?: string;
  outputDir?: string;
  json?: boolean;
  debug?: boolean;
  quiet?: boolean;
}

export interface CreateOptions {
  wait?: boolean;
  download?: boolean;
  withWatermark?: boolean;
  callbackUrl?: string;
  externalTaskId?: string;
}

/**
 * The credential chain the CLI owns (D2): `--api-key` → `KLING_API_KEY` in the process
 * environment → `./.env` → `~/.kling/.env`. The library itself reads only the first two.
 * `.env` files are parsed, not loaded into `process.env`, so nothing leaks to child
 * processes.
 */
export function resolveApiKey(explicit: string | undefined): { apiKey: string; source: string } | undefined {
  const fromArg = explicit?.trim();
  if (fromArg) return { apiKey: fromArg, source: '--api-key' };
  const fromEnv = process.env.KLING_API_KEY?.trim();
  if (fromEnv) return { apiKey: fromEnv, source: 'KLING_API_KEY' };
  for (const file of [resolve('.env'), join(homedir(), '.kling', '.env')]) {
    if (!existsSync(file)) continue;
    const parsed = dotenv.parse(readFileSync(file));
    const key = parsed.KLING_API_KEY?.trim();
    if (key) return { apiKey: key, source: file };
  }
  return undefined;
}

export function globalsOf(cmd: Command): GlobalOptions {
  return cmd.optsWithGlobals() as GlobalOptions;
}

export function makeClient(globals: GlobalOptions): KlingClient {
  const key = resolveApiKey(globals.apiKey);
  if (!key) throw new KlingValidationError('apiKey', MISSING_API_KEY_MESSAGE);
  const log = (level: string) => (message: string) => {
    if (globals.json && level !== 'error') return;
    if (globals.quiet && level !== 'error') return;
    if (level === 'debug' && !globals.debug) return;
    process.stderr.write(`[kling:${level}] ${message}\n`);
  };
  const client = new KlingClient({ apiKey: key.apiKey, logger: { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') } });
  if (globals.debug) process.stderr.write(`[kling:debug] credential from ${key.source} (${client.http.describeCredential()})\n`);
  return client;
}

/**
 * A CLI media argument: an `https://` URL passes through as a string; anything else is a
 * local file and is wrapped as `{ path }`. The string-is-never-a-path rule is a LIBRARY
 * rule (D12) — the CLI is the place that knows its argument came from a shell.
 */
export function mediaArg(value: string): MediaSource {
  return /^https:\/\//i.test(value) ? value : { path: resolve(value) };
}

/** Repeatable `id:alias` option into `{ elementId, id }` entries. */
export function elementArgs(values: string[] | undefined): { elementId: string; id?: string }[] | undefined {
  if (!values || values.length === 0) return undefined;
  return values.map((v) => {
    const [elementId, id] = v.split(':', 2);
    return id ? { elementId, id } : { elementId };
  });
}

export const int = (label: string) => (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new KlingValidationError(label, `${label} must be an integer, got ${JSON.stringify(v)}`);
  return n;
};
export const num = (label: string) => (v: string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new KlingValidationError(label, `${label} must be a number, got ${JSON.stringify(v)}`);
  return n;
};
export const collect = (v: string, prev: string[] = []) => [...prev, v];

export function print(globals: GlobalOptions, human: string, json: unknown): void {
  if (globals.json) process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  else if (!globals.quiet) process.stdout.write(`${human}\n`);
}

/** `handle.wait()` behind an `ora` spinner unless `--json` / `-q` (D13). */
export async function waitWithSpinner(handle: TaskHandle, globals: GlobalOptions): Promise<Task> {
  const spinner = globals.json || globals.quiet ? undefined : ora({ text: `waiting for ${handle.product} task ${handle.id}…`, stream: process.stderr }).start();
  const started = Date.now();
  try {
    const task = await handle.wait();
    spinner?.succeed(`${handle.product} task ${handle.id} ${task.status} in ${Math.round((Date.now() - started) / 1000)} s`);
    return task;
  } catch (err) {
    spinner?.fail(`${handle.product} task ${handle.id}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

/**
 * The tail every create command shares: print the handle; with `--wait`, poll and (unless
 * `--no-download`) save into `--output-dir` (default `./output`).
 */
export async function finishCreate(client: KlingClient, handle: TaskHandle, globals: GlobalOptions, options: CreateOptions): Promise<void> {
  const summary = { taskId: handle.id, externalId: handle.externalId, product: handle.product, standard: handle.standard };
  if (!options.wait) {
    print(globals, `submitted ${handle.product} task ${handle.id}${handle.externalId ? ` (external id ${handle.externalId})` : ''}\n  kling tasks get-by-product ${handle.product} ${handle.id}`, summary);
    return;
  }
  const task = await waitWithSpinner(handle, globals);
  let files: string[] = [];
  if (options.download !== false && task.outputs.length > 0) {
    files = await client.save(task, globals.outputDir ?? 'output', { includeWatermark: options.withWatermark === true, request: handle.request });
  }
  const human = [
    `${task.status}: ${task.outputs.length} output(s)`,
    ...task.outputs.map((o) => `  ${o.type}${'url' in o && o.url ? ` ${o.url}` : ''}${o.type === 'audio' && o.mp3Url ? ` ${o.mp3Url}` : ''}`),
    ...(task.billing ? [`billing: ${task.billing.map((b) => `${b.amount} ${b.chargeType}${b.packageType ? ` (${b.packageType})` : ''}`).join(', ')}`] : []),
    ...files.map((f) => `saved ${f}`),
  ].join('\n');
  print(globals, human, { ...summary, task, files });
}

/** One place errors leave the process: the family's fields on stderr, exit 1. */
export function reportError(err: unknown, globals: GlobalOptions): never {
  if (globals.json) {
    const cause = (err as { cause?: unknown }).cause;
    const body = err instanceof KlingError
      ? { error: err.name, message: err.message, ...Object.fromEntries(Object.entries(err).filter(([k]) => k !== 'task' && k !== 'raw')), ...(cause instanceof Error ? { cause: { error: cause.name, message: cause.message, ...Object.fromEntries(Object.entries(cause).filter(([k]) => ['code', 'httpStatus', 'taskState', 'reason', 'requestId'].includes(k))) } } : {}) }
      : { error: 'Error', message: String(err) };
    process.stderr.write(`${JSON.stringify(body)}\n`);
  } else {
    const name = err instanceof Error ? err.name : 'Error';
    const message = err instanceof Error ? err.message : String(err);
    const fields = (e: object) => Object.entries(e).filter(([k, v]) => ['code', 'httpStatus', 'taskState', 'field', 'reason', 'requestId'].includes(k) && v !== undefined).map(([k, v]) => `${k}=${String(v)}`).join(' ');
    const extra = err instanceof KlingError ? fields(err) : '';
    process.stderr.write(`${name}: ${message}${extra ? `\n  ${extra}` : ''}\n`);
    // Walk the cause chain — a KlingBatchError or KlingDownloadError says little without it.
    for (let cause = (err as { cause?: unknown }).cause, depth = 0; cause instanceof Error && depth < 3; cause = (cause as { cause?: unknown }).cause, depth++) {
      const f = fields(cause);
      process.stderr.write(`  caused by ${cause.name}: ${cause.message}${f ? ` (${f})` : ''}\n`);
    }
  }
  process.exit(1);
}
