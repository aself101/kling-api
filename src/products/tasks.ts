/**
 * Task handles and product-neutral task queries (spec D5, D10, D13).
 *
 * This module owns the product → path routing table, so it is the one place that knows
 * a `text-to-video` task is queried at `/tasks` and an `image-generation` task at
 * `/v1/images/generations/{id}`. Codecs import no HTTP; product modules import this.
 * Import graph (§5): `http/*`, `codecs/*`, `handlers/poller`, `config/constants`,
 * `node:crypto`. It never imports `media/*` — the `request` a handle records arrives
 * already redacted by the product module (run #3 architect F-5).
 */
import { randomUUID } from 'node:crypto';
import * as legacy from '../codecs/legacy.js';
import * as newStd from '../codecs/new-standard.js';
import type { ParseContext } from '../codecs/shared.js';
import type {
  LegacyProduct,
  NewStandardProduct,
  PageOptions,
  Product,
  RequestOptions,
  Standard,
  Task,
  TaskHandle,
  TaskStatus,
  WaitOptions,
} from '../codecs/task.js';
import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT, ERROR_CODES } from '../config/constants.js';
import { TaskReadCoalescer } from '../handlers/coalescer.js';
import { assertDeadlineMs, assertIntervalMs, poll } from '../handlers/poller.js';
import type { HttpCore, Logger } from '../http/core.js';
import {
  KlingAPIError,
  KlingBatchError,
  KlingPollTimeoutError,
  KlingTaskFailedError,
  KlingTaskNotFoundError,
  KlingValidationError,
} from '../http/errors.js';

// ============================================================================
// Routing table
// ============================================================================

/** Legacy product → `/v1/` collection path. `GET <path>/{id}` queries one; `GET <path>?pageNum&pageSize` lists. */
export const LEGACY_PRODUCT_PATHS: Readonly<Record<LegacyProduct, string>> = {
  'image-generation': '/v1/images/generations',
  'omni-image': '/v1/images/omni-image',
  'multi-image-to-image': '/v1/images/multi-image2image',
  outpainting: '/v1/images/editing/expand',
  'subject-completion': '/v1/general/ai-multi-shot',
  avatar: '/v1/videos/avatar/image2video',
  element: '/v1/general/advanced-custom-elements',
  voice: '/v1/general/custom-voices',
};

const NEW_STANDARD_PRODUCTS: ReadonlySet<string> = new Set<NewStandardProduct>([
  'text-to-video',
  'image-to-video',
  'omni-video',
  'motion-control',
]);

/** Which API standard a product lives on; throws `KlingValidationError('product')` for an unknown value — the runtime guard behind the `Product` type at the CLI boundary. */
export function standardOf(product: Product): Standard {
  if (NEW_STANDARD_PRODUCTS.has(product)) return 'new';
  if (product in LEGACY_PRODUCT_PATHS) return 'legacy';
  throw new KlingValidationError('product', `unknown product ${JSON.stringify(product)}`);
}

/**
 * `GET /tasks` ids per request. The docs state no cap; the live API answers HTTP 400 /
 * `1201` "task_ids and external_task_ids cannot exceed 20 in total" for 21 and accepts 20
 * [LIVE 2026-09-20, §11 Q13]. The spec's 50 would have failed every batch over 20.
 */
export const TASKS_CHUNK_SIZE = 20;
/** `POST /tasks` `limit` maximum (`docs/api/kling-3.0-turbo-t2v.md`, "limit: Maximum value: 500"). */
export const TASKS_LIST_MAX_LIMIT = 500;

const isTerminal = (t: Task): boolean => t.status === 'succeeded' || t.status === 'failed';

/**
 * The `external_task_id` a create will carry (D10). A UUID unless the caller supplied
 * one or opted out with `false` — the only recovery key for a create whose response was
 * lost, so opting out is explicit.
 */
export function resolveExternalId(requested: string | false | undefined): string | undefined {
  if (requested === false) return undefined;
  if (requested !== undefined) return requested;
  return randomUUID();
}

// ============================================================================
// Queries
// ============================================================================

export interface GetOptions extends RequestOptions {
  /** Treat `ids` as `external_task_id`s (`GET /tasks?external_task_ids=`). */
  byExternalId?: boolean;
}

export interface ListOptions extends RequestOptions {
  /** Unix ms. Vendor default `endTime − 30 d`. */
  startTime?: number;
  /** Unix ms. Vendor default now. */
  endTime?: number;
  /** `nextCursor` from the previous page; when set the vendor ignores the time window. */
  cursor?: string;
  /** 1–500, vendor default 100. */
  limit?: number;
  status?: TaskStatus | TaskStatus[];
  /** The vendor's `product_type` — coarser than `Product`; results are NOT back-filled with `product`. */
  productType?: ProductType | ProductType[];
}

export type ProductType = 'video' | 'image' | 'try_on';

/** `client.tasks` — product-neutral task queries: unified `get`/`list`, per-product `getByProduct`/`listByProduct`, `recover`, `handle` (spec D5). */
export class TasksApi {
  readonly #core: HttpCore;
  readonly #logger: Logger;

  constructor(core: HttpCore, logger: Logger) {
    this.#core = core;
    this.#logger = logger;
  }

  #ctx(product?: Product): ParseContext {
    return { product, warn: (m) => this.#logger.warn(m) };
  }

  /**
   * New-standard batch (`GET /tasks`). `missing` lists ids the vendor did not return — it
   * answers `200 data: []` for unknown ids, so absence is the only signal. Chunks of
   * `TASKS_CHUNK_SIZE` run sequentially; a failing chunk throws `KlingBatchError` carrying
   * what earlier chunks returned, which attempted ids are missing, and which ids were
   * never sent (run #3 excavator A43).
   */
  async get(
    ids: string | string[],
    options: GetOptions = {}
  ): Promise<{ tasks: Task[]; missing: string[] }> {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return { tasks: [], missing: [] };
    const key = options.byExternalId ? 'external_task_ids' : 'task_ids';
    const idOf = (t: Task) => (options.byExternalId ? t.externalId : t.id);

    const tasks: Task[] = [];
    const missing: string[] = [];
    for (let i = 0; i < list.length; i += TASKS_CHUNK_SIZE) {
      const chunk = list.slice(i, i + TASKS_CHUNK_SIZE);
      let page: Task[];
      try {
        page = await this.#fetchNew(chunk, key, options.signal);
      } catch (cause) {
        // The caller's own abort is rethrown unwrapped, as everywhere else on the read path
        // (`HttpCore` attempt, `download`): a cancel is the caller's, not a batch failure, and a
        // consumer matching on `signal.reason` must not have to unwrap a KlingBatchError to see
        // it (ship run #6 — healthCheck's abort surfaced here as "chunk 1 of 1 failed").
        if (options.signal?.aborted) throw options.signal.reason ?? cause;
        throw new KlingBatchError(
          `tasks.get: chunk ${i / TASKS_CHUNK_SIZE + 1} of ${Math.ceil(list.length / TASKS_CHUNK_SIZE)} failed`,
          { tasks, missing, unattempted: list.slice(i + TASKS_CHUNK_SIZE) },
          cause
        );
      }
      tasks.push(...page);
      const returned = new Set(page.map(idOf));
      for (const id of chunk) if (!returned.has(id)) missing.push(id);
    }
    return { tasks, missing };
  }

  /** New-standard cursor query (`POST /tasks` — a read despite the verb). */
  async list(options: ListOptions = {}): Promise<newStd.CursorPage> {
    if (
      options.limit !== undefined &&
      (!Number.isInteger(options.limit) ||
        options.limit < 1 ||
        options.limit > TASKS_LIST_MAX_LIMIT)
    ) {
      throw new KlingValidationError(
        'limit',
        `limit must be an integer in 1–${TASKS_LIST_MAX_LIMIT}, got ${options.limit}`
      );
    }
    const filters: { key: 'status' | 'product_type'; values: string[] }[] = [];
    if (options.status !== undefined)
      filters.push({ key: 'status', values: [options.status].flat() });
    if (options.productType !== undefined)
      filters.push({ key: 'product_type', values: [options.productType].flat() });
    const body: Record<string, unknown> = {};
    // Numeric ms per the vendor table (`long`); §11 Q2 records whether the live API wants strings.
    if (options.startTime !== undefined) body.start_time = options.startTime;
    if (options.endTime !== undefined) body.end_time = options.endTime;
    if (options.cursor !== undefined) body.cursor = options.cursor;
    if (options.limit !== undefined) body.limit = options.limit;
    if (filters.length > 0) body.filters = filters;
    const res = await this.#core.request({
      method: 'POST',
      path: '/tasks',
      body,
      kind: 'read',
      signal: options.signal,
    });
    return newStd.parseCursor(res.envelope, this.#ctx());
  }

  /**
   * One task by product — the method for reconstituting a stored id. Routes by standard.
   * A single-id lookup is not a batch: a failing request surfaces its own error
   * (`KlingAPIError`, `KlingTimeoutError`, …), not a `KlingBatchError` around it.
   */
  async getByProduct(product: Product, id: string, options: RequestOptions = {}): Promise<Task> {
    if (standardOf(product) === 'new') {
      // Batched with every other single-id read from this client in the same window — N polling
      // handles become ceil(N/20) requests instead of N (see handlers/coalescer.ts). Identical
      // wire call to the un-coalesced form: `GET /tasks?task_ids=…`, parsed by the same codec.
      const task = await this.#coalescer().read(id, options.signal);
      if (!task) throw new KlingTaskNotFoundError(product, id);
      return { ...task, product };
    }
    return this.#legacyGet(product as LegacyProduct, id, false, options);
  }

  /** Legacy per-product list (`GET /v1/<product>?pageNum&pageSize`). */
  async listByProduct(product: LegacyProduct, options: PageOptions = {}): Promise<Task[]> {
    if (standardOf(product) !== 'legacy')
      throw new KlingValidationError(
        'product',
        `${product} is a new-standard product; use tasks.list()`
      );
    const { pageNum, pageSize } = options;
    if (pageNum !== undefined && (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > 1000))
      throw new KlingValidationError(
        'pageNum',
        `pageNum must be an integer in 1–1000, got ${pageNum}`
      );
    // pageSize 1–500 everywhere except the voice endpoints, which document 1–1000 (App. C §7.10).
    const maxPageSize = product === 'voice' ? 1000 : 500;
    if (
      pageSize !== undefined &&
      (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize)
    )
      throw new KlingValidationError(
        'pageSize',
        `pageSize must be an integer in 1–${maxPageSize}, got ${pageSize}`
      );
    const res = await this.#core.request({
      method: 'GET',
      path: LEGACY_PRODUCT_PATHS[product],
      query: { pageNum, pageSize },
      kind: 'read',
      signal: options.signal,
    });
    return legacy.parseList(res.envelope, this.#ctx(product));
  }

  /**
   * Recover a create whose response was lost, by the `external_task_id` it carried (D10).
   * `null` means *not visible to this account* — not *never created*. TTS carries no
   * external id and is not a `Product`; it cannot reach here.
   *
   * @param product The product the lost create targeted; routes the read.
   * @param externalId The `external_task_id` the create carried.
   * @returns The task, or `null` when this account cannot see it.
   * @example
   * ```ts
   * // After a `may-exist` failure — see the README's recovery section for the full loop.
   * const found = await client.tasks.recover('text-to-video', err.externalId);
   * if (!found) {
   *   // Re-submit with the SAME id, never a fresh one, or the vendor's duplicate check
   *   // cannot protect you from paying twice.
   *   await client.video.textToVideo({ ...params, externalTaskId: err.externalId });
   * }
   * ```
   */
  async recover(
    product: Product,
    externalId: string,
    options: RequestOptions = {}
  ): Promise<Task | null> {
    if (standardOf(product) === 'new') {
      const [task] = await this.#fetchNew([externalId], 'external_task_ids', options.signal);
      return task ? { ...task, product } : null;
    }
    try {
      return await this.#legacyGet(product as LegacyProduct, externalId, true, options);
    } catch (err) {
      if (err instanceof KlingTaskNotFoundError) return null;
      throw err;
    }
  }

  /** A handle for a task this process did not create (or created before a restart). */
  handle(
    product: Product,
    id: string,
    request: Record<string, unknown> = {},
    externalId?: string
  ): TaskHandle {
    return createHandle(this.#core, this.#logger, product, id, request, externalId);
  }

  /** One `GET /tasks` request for up to `TASKS_CHUNK_SIZE` ids; the codec's warnings go to the logger. */
  #coalescer(): TaskReadCoalescer {
    return coalescerFor(this.#core, (ids) => this.#fetchNew(ids, 'task_ids', undefined));
  }

  async #fetchNew(
    ids: string[],
    key: 'task_ids' | 'external_task_ids',
    signal: AbortSignal | undefined
  ): Promise<Task[]> {
    const res = await this.#core.request({
      method: 'GET',
      path: '/tasks',
      query: { [key]: ids.join(',') },
      kind: 'read',
      signal,
    });
    return newStd.parseTasks(res.envelope, this.#ctx());
  }

  /**
   * `GET /v1/<product>/{id}` — the `{id}` segment accepts an external id on the products
   * that document it (App. B §3.6; per-product acceptance is recorded in the V10 blanks).
   *
   * Not-found is NOT the table's `1203`: the live API answers HTTP 400 / `1201` with the
   * message "Task not found by id/external id: <id>" [LIVE 2026-09-20, image-generation].
   * `1201` is otherwise the generic bad-parameter code, so the message is what
   * discriminates — fragile, and the only signal there is; `1203` is mapped too in case
   * the vendor ever aligns with its own table.
   */
  async #legacyGet(
    product: LegacyProduct,
    id: string,
    byExternalId: boolean,
    options: RequestOptions
  ): Promise<Task> {
    try {
      const res = await this.#core.request({
        method: 'GET',
        path: `${LEGACY_PRODUCT_PATHS[product]}/${encodeURIComponent(id)}`,
        kind: 'read',
        signal: options.signal,
      });
      return legacy.parseTask(res.envelope, this.#ctx(product));
    } catch (err) {
      if (isLegacyNotFound(err)) {
        throw new KlingTaskNotFoundError(product, id, byExternalId, {
          requestId: err.requestId,
          cause: err,
        });
      }
      throw err;
    }
  }
}

const LEGACY_NOT_FOUND_MESSAGE = /task not found/i;

function isLegacyNotFound(err: unknown): err is KlingAPIError {
  if (!(err instanceof KlingAPIError)) return false;
  if (err.code === ERROR_CODES.RESOURCE_NOT_FOUND) return true;
  return err.code === ERROR_CODES.INVALID_PARAM_VALUE && LEGACY_NOT_FOUND_MESSAGE.test(err.message);
}

/**
 * One coalescer per client. `createHandle` builds its own `TasksApi` per handle, so the thing
 * every handle from one client shares is the transport — key off it. A `WeakMap` so a discarded
 * client takes its coalescer with it.
 */
const coalescers = new WeakMap<HttpCore, TaskReadCoalescer>();

function coalescerFor(core: HttpCore, fetcher: (ids: string[]) => Promise<Task[]>): TaskReadCoalescer {
  let c = coalescers.get(core);
  if (!c) {
    c = new TaskReadCoalescer(fetcher);
    coalescers.set(core, c);
  }
  return c;
}

// ============================================================================
// TaskHandle
// ============================================================================

interface Subscriber {
  intervalMs: number;
  settle: (task: Task) => void;
  fail: (err: unknown) => void;
}

/**
 * Build a `TaskHandle` (D5). `get()` routes by product. `wait()` shares ONE in-flight
 * poll loop across concurrent callers with per-caller semantics: the loop polls at the
 * shortest interval any subscriber asked for; each caller's `deadlineMs` and `signal`
 * settle that caller's promise only; the loop stops when the last subscriber has
 * settled (run #3 anxiety F4). A terminal task settles every subscriber at once —
 * `succeeded` resolves, `failed` rejects with `KlingTaskFailedError`.
 */
export function createHandle(
  core: HttpCore,
  logger: Logger,
  product: Product,
  id: string,
  request: Record<string, unknown>,
  externalId?: string
): TaskHandle {
  const tasks = new TasksApi(core, logger);
  const subscribers = new Set<Subscriber>();
  let loop: Promise<void> | null = null;
  let loopAbort: AbortController | null = null;
  /** The most recent task the shared loop saw — what a per-caller timeout reports as `task`. */
  let lastSeen: Task | null = null;

  const get = (options?: RequestOptions) => tasks.getByProduct(product, id, options);

  const settleAll = (task: Task) => {
    for (const s of [...subscribers]) {
      subscribers.delete(s);
      if (task.status === 'failed') s.fail(new KlingTaskFailedError(task, vendorCodeOf(task)));
      else s.settle(task);
    }
  };
  const failAll = (err: unknown) => {
    for (const s of [...subscribers]) {
      subscribers.delete(s);
      s.fail(err);
    }
  };

  const runLoop = async (): Promise<void> => {
    const controller = new AbortController();
    loopAbort = controller;
    try {
      const task = await poll(
        async (signal) => {
          const t = await get({ signal });
          lastSeen = t;
          return t;
        },
        {
          until: isTerminal,
          // Sleep to the next boundary of a shared wall-clock grid, not `interval` measured from
          // whenever THIS handle's last request happened to return.
          //
          // Independent loops drift: each one's sleep starts when its own response landed, so
          // handles created even a few ms apart wake at different milliseconds and the read
          // coalescer (handlers/coalescer.ts) never sees two reads in one tick. Quantising pulls
          // them onto a common cadence, after which one batched response keeps them in step.
          // Measured, 25 handles, `GET /tasks` calls to reach terminal:
          //
          //                        no grid   grid
          //   created together        6        8
          //   created 3 ms apart     70       32     (~20 of those are the unavoidable
          //                                           first poll each handle does at creation)
          //
          // The cost is one extra shortened interval; the gain is that batching survives how
          // the caller happened to create the handles.
          intervalMs: () => {
            const base = Math.min(...[...subscribers].map((s) => s.intervalMs));
            const now = Date.now();
            return Math.ceil((now + 1) / base) * base - now;
          },
          deadlineMs: Infinity,
          signal: controller.signal,
        }
      );
      settleAll(task);
    } catch (err) {
      // The loop aborts ITSELF when the last subscriber leaves. That abort is never a
      // subscriber's failure — a caller that re-joins in the microtask between the last
      // cleanup() and this catch must not be handed the loop's own AbortError (ship run #4,
      // code-auditor: `try { await h.wait({ signal }) } catch {}; await h.wait()` rejected
      // immediately and never polled). Anything else is a real failure for everyone waiting.
      if (!controller.signal.aborted) failAll(err);
    } finally {
      loop = null;
      loopAbort = null;
      // Subscribers who joined while this loop was dying get a fresh loop.
      // AUDIT-OK(no_fire_and_forget): runLoop never rejects — its body is fully try/catch/finally-guarded.
      if (subscribers.size > 0) loop = runLoop();
    }
  };

  const wait = (options: WaitOptions = {}): Promise<Task> =>
    new Promise<Task>((resolve, reject) => {
      // Throwing here rejects the promise — a bad option surfaces as KlingValidationError, not
      // as a 1 ms poll storm or an instant KlingPollTimeoutError (ship run #6).
      const intervalMs = assertIntervalMs(options.intervalMs ?? DEFAULT_POLL_INTERVAL);
      const deadlineMs = assertDeadlineMs(options.deadlineMs ?? DEFAULT_POLL_TIMEOUT);
      const started = Date.now();
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onAbort);
        subscribers.delete(sub);
        if (subscribers.size === 0) loopAbort?.abort();
      };
      const sub: Subscriber = {
        intervalMs,
        settle: (task) => {
          cleanup();
          resolve(task);
        },
        fail: (err) => {
          cleanup();
          reject(err);
        },
      };
      const timer = Number.isFinite(deadlineMs)
        ? setTimeout(
            () => sub.fail(new KlingPollTimeoutError(lastSeen, Date.now() - started)),
            deadlineMs
          )
        : undefined;
      const onAbort = () => sub.fail(options.signal?.reason);
      if (options.signal?.aborted) return sub.fail(options.signal.reason);
      options.signal?.addEventListener('abort', onAbort, { once: true });
      subscribers.add(sub);
      // AUDIT-OK(no_fire_and_forget): runLoop never rejects (see above); settlement reaches callers through the subscribers.
      loop ??= runLoop();
    });

  const handle: TaskHandle = { id, standard: standardOf(product), product, request, get, wait };
  if (externalId !== undefined) handle.externalId = externalId;
  return handle;
}

/**
 * The vendor puts no business code on a failed task record on either standard — `message`
 * (`task.message`) carries the reason — so this is `null` today on every live task seen.
 * Kept for a future envelope that carries one; consumers should read `task.message`.
 */
function vendorCodeOf(task: Task): number | null {
  const raw = task.raw as { code?: unknown } | undefined;
  return typeof raw?.code === 'number' ? raw.code : null;
}
