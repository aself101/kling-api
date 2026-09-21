/** `kling tasks …` and `kling account …` (spec D15, D5; App. C §6). */
import type { Command } from 'commander';
import type { LegacyProduct, Product, Task, TaskStatus } from '../codecs/task.js';
import type { ProductType } from '../products/tasks.js';
import {
  collect,
  globalsOf,
  handler,
  handler1,
  handler2,
  int,
  makeClient,
  print,
  type GlobalOptions,
} from './shared.js';
import { KlingValidationError } from '../http/errors.js';
import { LEGACY_PRODUCT_PATHS, standardOf } from '../products/tasks.js';

interface GetOptions {
  byExternalId?: boolean;
}
interface ListOptions {
  cursor?: string;
  status?: string[];
  productType?: string[];
  limit?: number;
  days?: number;
}
interface PageOpts {
  page?: number;
  pageSize?: number;
}
interface UsageOptions {
  days: number;
  pack?: string;
}
interface LedgerOptions {
  days: number;
  limit?: number;
  cursor?: string;
}

/** A positional `<product>` is a shell string; `standardOf` is the runtime guard behind the `Product` annotation. */
function asProduct(value: string): Product {
  standardOf(value as Product); // throws KlingValidationError('product') for an unknown value
  return value as Product;
}
function asLegacyProduct(value: string): LegacyProduct {
  if (!(value in LEGACY_PRODUCT_PATHS))
    throw new KlingValidationError(
      'product',
      `${JSON.stringify(value)} is not a legacy product (one of ${Object.keys(LEGACY_PRODUCT_PATHS).join(', ')})`
    );
  return value as LegacyProduct;
}

function printTaskList(g: GlobalOptions, tasks: Task[], extra: Record<string, unknown> = {}): void {
  const human =
    tasks.length === 0
      ? '(no tasks)'
      : tasks
          .map(
            (t) =>
              `${t.id}\t${t.status}\t${t.product ?? t.standard}\t${t.outputs.map((o) => o.type).join(',') || '-'}\t${t.billing?.map((b) => `${b.amount} ${b.chargeType}`).join(' ') ?? ''}`
          )
          .join('\n');
  print(g, human, { tasks, ...extra });
}

export function registerTasks(program: Command): void {
  const tasks = program.command('tasks').description('task queries across products');
  tasks
    .command('get <ids...>')
    .description('unified GET /tasks — any task id (20 per request; chunked)')
    .option('--by-external-id', 'treat the ids as external_task_ids')
    .action(
      handler1<string[], GetOptions>(async (ids, o, cmd) => {
        const g = globalsOf(cmd);
        const r = await makeClient(g).tasks.get(ids, { byExternalId: o.byExternalId });
        printTaskList(g, r.tasks, { missing: r.missing });
        if (r.missing.length > 0 && !g.json && !g.quiet)
          process.stdout.write(`missing: ${r.missing.join(', ')}\n`);
      })
    );
  tasks
    .command('list')
    .description('cursor list (POST /tasks)')
    .option('--cursor <cursor>', 'next_cursor from a previous page')
    .option(
      '--status <status>',
      'submitted | processing | succeeded | failed (repeatable)',
      collect
    )
    .option('--product-type <type>', 'video | image | try_on (repeatable)', collect)
    .option('--limit <n>', '1–500', int('limit'))
    .option('--days <n>', 'window ending now (ignored with --cursor)', int('days'))
    .action(
      handler<ListOptions>(async (o, cmd) => {
        const g = globalsOf(cmd);
        const end = Date.now();
        // The list filters are the one CLI input no library [shape] rule checks (the vendor validates
        // them), so the enum guard lives here rather than in the handler<T>() cast.
        const STATUSES = new Set<string>(['submitted', 'processing', 'succeeded', 'failed']);
        const PRODUCT_TYPES = new Set<string>(['video', 'image', 'try_on']);
        for (const v of o.status ?? [])
          if (!STATUSES.has(v))
            throw new KlingValidationError(
              'status',
              `--status must be one of ${[...STATUSES].join(', ')}, got ${JSON.stringify(v)}`
            );
        for (const v of o.productType ?? [])
          if (!PRODUCT_TYPES.has(v))
            throw new KlingValidationError(
              'productType',
              `--product-type must be one of ${[...PRODUCT_TYPES].join(', ')}, got ${JSON.stringify(v)}`
            );
        const page = await makeClient(g).tasks.list({
          cursor: o.cursor,
          status: o.status as TaskStatus[] | undefined,
          productType: o.productType as ProductType[] | undefined,
          limit: o.limit,
          startTime: o.days !== undefined ? end - o.days * 86_400_000 : undefined,
          endTime: o.days !== undefined ? end : undefined,
        });
        printTaskList(g, page.tasks, {
          count: page.count,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
        if (page.hasMore && !g.json && !g.quiet)
          process.stdout.write(`more: --cursor ${page.nextCursor}\n`);
      })
    );
  tasks
    .command('get-by-product <product> <id>')
    .description('one task by its product (legacy products go to /v1/<product>/{id})')
    .action(
      handler2<string, string, object>(async (product, id, _o, cmd) => {
        const g = globalsOf(cmd);
        const t = await makeClient(g).tasks.getByProduct(asProduct(product), id);
        print(
          g,
          [
            `${t.id}\t${t.status}\t${t.product}`,
            ...t.outputs.map((o) => `  ${o.type}${'url' in o && o.url ? ` ${o.url}` : ''}`),
            t.message ? `  message: ${t.message}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          { task: t }
        );
      })
    );
  tasks
    .command('list-by-product <product>')
    .description('legacy per-product list')
    .option('--page <n>', 'page number', int('pageNum'))
    .option('--page-size <n>', 'items per page', int('pageSize'))
    .action(
      handler1<string, PageOpts>(async (product, o, cmd) => {
        const g = globalsOf(cmd);
        printTaskList(
          g,
          await makeClient(g).tasks.listByProduct(asLegacyProduct(product), {
            pageNum: o.page,
            pageSize: o.pageSize,
          })
        );
      })
    );
  tasks
    .command('recover <product> <externalId>')
    .description('find a task by the external id its create carried')
    .action(
      handler2<string, string, object>(async (product, externalId, _o, cmd) => {
        const g = globalsOf(cmd);
        const t = await makeClient(g).tasks.recover(asProduct(product), externalId);
        print(g, t ? `${t.id}\t${t.status}\t${t.product}` : 'not visible to this account', {
          task: t,
        });
      })
    );

  const account = program.command('account').description('resource packages and deduction ledgers');
  account
    .command('usage')
    .description('packages under the account and what is left (free; up to 12 h lag)')
    .option('--days <n>', 'window ending now', int('days'), 30)
    .option('--pack <name>', 'one resource pack by name')
    .action(
      handler<UsageOptions>(async (o, cmd) => {
        const g = globalsOf(cmd);
        const end = Date.now();
        const packs = await makeClient(g).account.usage(end - o.days * 86_400_000, end, {
          resourcePackName: o.pack,
        });
        print(
          g,
          packs.length === 0
            ? '(no packages)'
            : packs
                .map(
                  (p) =>
                    `${p.name}\t${p.status ?? ''}\t${p.remainingQuantity ?? '?'} / ${p.totalQuantity ?? '?'}\texpires ${p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : '?'}`
                )
                .join('\n'),
          { packages: packs }
        );
      })
    );
  for (const [name, method, label] of [
    ['balance', 'balanceLedger', 'cash'],
    ['packages', 'packageLedger', 'unit'],
  ] as const) {
    account
      .command(name)
      .description(
        `${label} deductions per task (POST /account/billing/${name === 'balance' ? 'balance' : 'package'})`
      )
      .option('--days <n>', 'window ending now', int('days'), 7)
      .option('--limit <n>', '1–500', int('limit'))
      .option('--cursor <cursor>', 'next page')
      .action(
        handler<LedgerOptions>(async (o, cmd) => {
          const g = globalsOf(cmd);
          const end = Date.now();
          const page = await makeClient(g).account[method]({
            cursor: o.cursor,
            limit: o.limit,
            startTime: end - o.days * 86_400_000,
            endTime: end,
          });
          const human =
            page.entries.length === 0
              ? '(no entries)'
              : page.entries
                  .map(
                    (e) =>
                      `${e.taskId}\t${e.productFunction ?? ''}\t${e.modelName ?? ''}\t${'amount' in e ? e.amount : ''}\t${e.deductedAt ? new Date(e.deductedAt).toISOString() : ''}`
                  )
                  .join('\n');
          print(g, human + (page.hasMore ? `\nmore: --cursor ${page.nextCursor}` : ''), page);
        })
      );
  }
}
