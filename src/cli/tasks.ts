/** `kling tasks …` and `kling account …` (spec D15, D5; App. C §6). */
import type { Command } from 'commander';
import type { LegacyProduct, Product, Task } from '../codecs/task.js';
import { collect, globalsOf, int, makeClient, print, type GlobalOptions } from './shared.js';

function printTaskList(g: GlobalOptions, tasks: Task[], extra: Record<string, unknown> = {}): void {
  const human = tasks.length === 0 ? '(no tasks)' : tasks.map((t) => `${t.id}\t${t.status}\t${t.product ?? t.standard}\t${t.outputs.map((o) => o.type).join(',') || '-'}\t${t.billing?.map((b) => `${b.amount} ${b.chargeType}`).join(' ') ?? ''}`).join('\n');
  print(g, human, { tasks, ...extra });
}

export function registerTasks(program: Command): void {
  const tasks = program.command('tasks').description('task queries across products');
  tasks
    .command('get <ids...>')
    .description('unified GET /tasks — any task id (20 per request; chunked)')
    .option('--by-external-id', 'treat the ids as external_task_ids')
    .action(async (ids: string[], o, cmd: Command) => {
      const g = globalsOf(cmd);
      const r = await makeClient(g).tasks.get(ids, { byExternalId: o.byExternalId });
      printTaskList(g, r.tasks, { missing: r.missing });
      if (r.missing.length > 0 && !g.json && !g.quiet) process.stdout.write(`missing: ${r.missing.join(', ')}\n`);
    });
  tasks
    .command('list')
    .description('cursor list (POST /tasks)')
    .option('--cursor <cursor>', 'next_cursor from a previous page')
    .option('--status <status>', 'submitted | processing | succeeded | failed (repeatable)', collect)
    .option('--product-type <type>', 'video | image | try_on (repeatable)', collect)
    .option('--limit <n>', '1–500', int('limit'))
    .option('--days <n>', 'window ending now (ignored with --cursor)', int('days'))
    .action(async (o, cmd: Command) => {
      const g = globalsOf(cmd);
      const end = Date.now();
      const page = await makeClient(g).tasks.list({ cursor: o.cursor, status: o.status, productType: o.productType, limit: o.limit, startTime: o.days ? end - o.days * 86_400_000 : undefined, endTime: o.days ? end : undefined });
      printTaskList(g, page.tasks, { count: page.count, nextCursor: page.nextCursor, hasMore: page.hasMore });
      if (page.hasMore && !g.json && !g.quiet) process.stdout.write(`more: --cursor ${page.nextCursor}\n`);
    });
  tasks.command('get-by-product <product> <id>').description('one task by its product (legacy products go to /v1/<product>/{id})').action(async (product: Product, id: string, _o, cmd: Command) => {
    const g = globalsOf(cmd);
    const t = await makeClient(g).tasks.getByProduct(product, id);
    print(g, [`${t.id}\t${t.status}\t${t.product}`, ...t.outputs.map((o) => `  ${o.type}${'url' in o && o.url ? ` ${o.url}` : ''}`), t.message ? `  message: ${t.message}` : ''].filter(Boolean).join('\n'), { task: t });
  });
  tasks
    .command('list-by-product <product>')
    .description('legacy per-product list')
    .option('--page <n>', 'page number', int('pageNum'))
    .option('--page-size <n>', 'items per page', int('pageSize'))
    .action(async (product: LegacyProduct, o, cmd: Command) => {
      const g = globalsOf(cmd);
      printTaskList(g, await makeClient(g).tasks.listByProduct(product, { pageNum: o.page, pageSize: o.pageSize }));
    });
  tasks.command('recover <product> <externalId>').description('find a task by the external id its create carried').action(async (product: Product, externalId: string, _o, cmd: Command) => {
    const g = globalsOf(cmd);
    const t = await makeClient(g).tasks.recover(product, externalId);
    print(g, t ? `${t.id}\t${t.status}\t${t.product}` : 'not visible to this account', { task: t });
  });

  const account = program.command('account').description('resource packages and deduction ledgers');
  account
    .command('usage')
    .description('packages under the account and what is left (free; up to 12 h lag)')
    .option('--days <n>', 'window ending now', int('days'), 30)
    .option('--pack <name>', 'one resource pack by name')
    .action(async (o, cmd: Command) => {
      const g = globalsOf(cmd);
      const end = Date.now();
      const packs = await makeClient(g).account.usage(end - o.days * 86_400_000, end, { resourcePackName: o.pack });
      print(g, packs.length === 0 ? '(no packages)' : packs.map((p) => `${p.name}\t${p.status ?? ''}\t${p.remainingQuantity ?? '?'} / ${p.totalQuantity ?? '?'}\texpires ${p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : '?'}`).join('\n'), { packages: packs });
    });
  for (const [name, method, label] of [['balance', 'balanceLedger', 'cash'], ['packages', 'packageLedger', 'unit']] as const) {
    account
      .command(name)
      .description(`${label} deductions per task (POST /account/billing/${name === 'balance' ? 'balance' : 'package'})`)
      .option('--days <n>', 'window ending now', int('days'), 7)
      .option('--limit <n>', '1–500', int('limit'))
      .option('--cursor <cursor>', 'next page')
      .action(async (o, cmd: Command) => {
        const g = globalsOf(cmd);
        const end = Date.now();
        const page = await makeClient(g).account[method]({ cursor: o.cursor, limit: o.limit, startTime: end - o.days * 86_400_000, endTime: end });
        const human = page.entries.length === 0 ? '(no entries)' : page.entries.map((e) => `${e.taskId}\t${e.productFunction ?? ''}\t${e.modelName ?? ''}\t${'amount' in e ? e.amount : ''}\t${e.deductedAt ? new Date(e.deductedAt).toISOString() : ''}`).join('\n');
        print(g, human + (page.hasMore ? `\nmore: --cursor ${page.nextCursor}` : ''), page);
      });
  }
}
