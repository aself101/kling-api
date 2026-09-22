/**
 * Coalesce concurrent single-id task reads into the vendor's 20-id batch.
 *
 * `TaskHandle.wait()` polls one id per handle, so N in-flight tasks were N `GET /tasks`
 * requests per tick — the emergent-load finding from ship run #4's anxiety read ("N handles
 * are N poll loops; `wait()` never uses the 20-id batch"). Fifty tasks at the default 3 s
 * interval is fifty requests every three seconds, against an API that answers `1303
 * "parallel task over resource pack limit"`.
 *
 * Every read that arrives in the same turn is merged into `GET /tasks?task_ids=…`, chunked at
 * the vendor's cap of 20. Fifty handles become three requests per tick, not fifty. This works
 * with the grid-aligned poll cadence in `createHandle`: alignment puts the reads in one turn,
 * this turns that turn into one request. Neither half is much use without the other.
 *
 * **This is why the poll interval is NOT jittered while the retry backoff is.** They are
 * opposite problems: N clients retrying a *failure* in lockstep is a thundering herd, so the
 * backoff spreads them out (`retry.jitter`, default `'equal'`); N handles polling *normally*
 * in lockstep is exactly the alignment this batches, so spreading them out would be actively
 * worse — it would turn one 20-id request back into twenty single-id ones.
 *
 * Semantics preserved from the un-coalesced path:
 * - a caller's `signal` still rejects that caller's promise immediately; it no longer aborts
 *   the underlying request, because the request is now shared (the same trade the shared poll
 *   loop already makes across subscribers on one handle).
 * - a failing chunk rejects exactly the waiters whose ids were in it, nobody else.
 * - an id the vendor does not return resolves `undefined`, as `#fetchNew` does — absence is
 *   the only not-found signal on this endpoint.
 */
import type { Task } from '../codecs/task.js';

/** The vendor refuses more than 20 ids per `GET /tasks` (checklist Q13, observed live). */
export const COALESCE_CHUNK = 20;

/**
 * The batch window, in ms. `0` means "the next macrotask" — one `setTimeout(…, 0)` turn.
 *
 * It must be a macrotask, not a microtask. A woken poll loop crosses several `await` boundaries
 * between its timer firing and the read reaching this class, and those hops are microtasks: a
 * microtask flush therefore runs while the other handles are still part-way down their own
 * chains, and each read goes out alone. Measured on 25 handles: 77 requests with a microtask
 * flush, 8 with `setTimeout(…, 0)`. Zero is enough — no real delay is needed, only a yield past
 * the microtask queue.
 *
 * A longer window widens the net at the cost of that much latency on every single-id read;
 * nothing in the library sets one.
 */
export const COALESCE_WINDOW_MS = 0;

type Fetcher = (ids: string[], signal?: AbortSignal) => Promise<Task[]>;

interface Waiter {
  resolve: (task: Task | undefined) => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

export class TaskReadCoalescer {
  readonly #fetch: Fetcher;
  readonly #windowMs: number;
  readonly #setTimer: (fn: () => void, ms: number) => unknown;
  readonly #clearTimer: (handle: unknown) => void;
  /** id → everyone waiting on it this window. One id asked for twice is still one wire id. */
  #pending = new Map<string, Waiter[]>();
  #timer: unknown = null;
  #scheduled = false;

  constructor(
    fetcher: Fetcher,
    options: {
      windowMs?: number;
      setTimer?: (fn: () => void, ms: number) => unknown;
      clearTimer?: (handle: unknown) => void;
    } = {}
  ) {
    this.#fetch = fetcher;
    this.#windowMs = options.windowMs ?? COALESCE_WINDOW_MS;
    this.#setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.#clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** Read one id, batched with whatever else arrives in this window. */
  read(id: string, signal?: AbortSignal): Promise<Task | undefined> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise<Task | undefined>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal };
      if (signal) {
        // The caller's cancel is theirs alone: it settles this promise and drops them from the
        // batch. The request itself continues for whoever else is in it.
        waiter.onAbort = () => {
          this.#drop(id, waiter);
          reject(signal.reason);
        };
        signal.addEventListener('abort', waiter.onAbort, { once: true });
      }
      const waiters = this.#pending.get(id);
      if (waiters) waiters.push(waiter);
      else this.#pending.set(id, [waiter]);
      if (!this.#scheduled) {
        this.#scheduled = true;
        this.#timer = this.#setTimer(() => void this.#flush(), this.#windowMs);
      }
    });
  }

  #drop(id: string, waiter: Waiter): void {
    const waiters = this.#pending.get(id);
    if (!waiters) return;
    const i = waiters.indexOf(waiter);
    if (i !== -1) waiters.splice(i, 1);
    if (waiters.length === 0) this.#pending.delete(id);
    // A pending flush with nothing left to fetch is harmless (it returns immediately), so the
    // timer is only cleared when there is one to clear; the microtask always runs.
    if (this.#pending.size === 0 && this.#timer !== null) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
      this.#scheduled = false;
    }
  }

  #settle(waiters: Waiter[], settle: (w: Waiter) => void): void {
    for (const w of waiters) {
      if (w.signal && w.onAbort) w.signal.removeEventListener('abort', w.onAbort);
      settle(w);
    }
  }

  async #flush(): Promise<void> {
    this.#timer = null;
    this.#scheduled = false;
    const batch = [...this.#pending];
    this.#pending.clear();
    if (batch.length === 0) return;

    for (let i = 0; i < batch.length; i += COALESCE_CHUNK) {
      const chunk = batch.slice(i, i + COALESCE_CHUNK);
      const ids = chunk.map(([id]) => id);
      try {
        // No signal: the request is shared, so no one caller may abort it. Each caller's own
        // abort already settled their promise in `read`.
        const tasks = await this.#fetch(ids);
        const byId = new Map(tasks.map((t) => [t.id, t]));
        for (const [id, waiters] of chunk) this.#settle(waiters, (w) => w.resolve(byId.get(id)));
      } catch (err) {
        for (const [, waiters] of chunk) this.#settle(waiters, (w) => w.reject(err));
      }
    }
  }
}
