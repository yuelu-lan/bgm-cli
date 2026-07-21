import type { Command } from 'commander';
import type { Client } from '../api/client.js';
import type { Renderable } from '../format/types.js';

export interface ExportArgs {
  keyword: string;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  type?: string[];
  tag?: string[];
  nsfw?: boolean;
  limit: number;
  max?: number;
}

export async function exportSearchAction(client: Client, args: ExportArgs): Promise<Renderable> {
  const limit = args.limit;
  const cap = args.max;
  const filter =
    args.type || args.tag || args.nsfw !== undefined
      ? {
          ...(args.type ? { type: args.type.map((t) => Number(t)) } : {}),
          ...(args.tag ? { tag: args.tag } : {}),
          ...(args.nsfw !== undefined ? { nsfw: args.nsfw } : {}),
        }
      : undefined;

  const allRows: Record<string, unknown>[] = [];
  const allSubjects: unknown[] = [];
  let offset = 0;
  let total = 0;

  while (true) {
    const result = await client.searchSubjects({
      keyword: args.keyword,
      sort: args.sort,
      filter,
      limit,
      offset,
    });
    total = result.total;
    for (const s of result.data) {
      allRows.push({ id: s.id, name: s.name, date: s.date ?? '', score: s.rating?.score ?? '' });
      allSubjects.push(s);
      if (cap !== undefined && allRows.length >= cap) break;
    }
    offset += limit;
    if (offset >= total) break;
    if (cap !== undefined && allRows.length >= cap) break;
  }

  return {
    title: `导出: ${args.keyword}`,
    columns: ['id', 'name', 'date', 'score'],
    rows: allRows,
    meta: { total, exported: allRows.length },
    raw: { total, data: allSubjects },
  };
}

export function registerExport(program: Command, client: Client): void {
  const cmd = program.command('export').description('batch export');
  cmd
    .command('search <keyword>')
    .option('-s, --sort <sort>', 'match | heat | rank | score')
    .option('-t, --type <type...>', 'subject type ids')
    .option('--tag <tag...>', 'tags')
    .option('--nsfw [bool]', 'include nsfw', (v) => v !== 'false')
    .option('-l, --limit <n>', 'page size', '10')
    .option('--max <n>', 'cap total rows')
    .action(async (keyword: string, opts: Record<string, unknown>) => {
      const { render } = await import('../format/renderer.js');
      const r = await exportSearchAction(client, {
        keyword,
        sort: opts.sort as ExportArgs['sort'],
        type: opts.type as string[] | undefined,
        tag: opts.tag as string[] | undefined,
        nsfw: opts.nsfw as boolean | undefined,
        limit: Number(opts.limit),
        max: opts.max ? Number(opts.max) : undefined,
      });
      const fmt = (program.opts().format ?? 'text') as 'json' | 'text' | 'markdown';
      process.stdout.write(render(r, fmt) + '\n');
    });
}
