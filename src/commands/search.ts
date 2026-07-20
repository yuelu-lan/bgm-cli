import type { Command } from 'commander';
import type { Client } from '../api/client.js';
import type { Renderable } from '../format/types.js';

export interface SearchArgs {
  keyword: string;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  type?: string[];
  tag?: string[];
  nsfw?: boolean;
  limit: number;
  offset: number;
}

export async function searchAction(client: Client, args: SearchArgs): Promise<Renderable> {
  const filter =
    args.type || args.tag || args.nsfw !== undefined
      ? {
          ...(args.type ? { type: args.type.map((t) => Number(t)) } : {}),
          ...(args.tag ? { tag: args.tag } : {}),
          ...(args.nsfw !== undefined ? { nsfw: args.nsfw } : {}),
        }
      : undefined;

  const result = await client.searchSubjects({
    keyword: args.keyword,
    sort: args.sort,
    filter,
    limit: args.limit,
    offset: args.offset,
  });

  const rows = result.data.map((s) => ({
    id: s.id,
    name: s.name,
    date: s.date ?? '',
    rating: s.rating?.score ?? '',
  }));

  return {
    title: `搜索: ${args.keyword}`,
    columns: ['id', 'name', 'date', 'rating'],
    rows,
    meta: { total: result.total, limit: result.limit, offset: result.offset },
  };
}

export function registerSearch(program: Command, client: Client): void {
  program
    .command('search <keyword>')
    .option('-s, --sort <sort>', 'match | heat | rank | score')
    .option('-t, --type <type...>', 'subject type ids')
    .option('--tag <tag...>', 'tags')
    .option('--nsfw [bool]', 'include nsfw', (v) => v !== 'false')
    .option('-l, --limit <n>', 'page size', '10')
    .option('-o, --offset <n>', 'page offset', '0')
    .action(async (keyword: string, opts: Record<string, unknown>) => {
      const { render } = await import('../format/renderer.js');
      const r = await searchAction(client, {
        keyword,
        sort: opts.sort as SearchArgs['sort'],
        type: opts.type as string[] | undefined,
        tag: opts.tag as string[] | undefined,
        nsfw: opts.nsfw as boolean | undefined,
        limit: Number(opts.limit),
        offset: Number(opts.offset),
      });
      const fmt = (program.opts().format ?? 'text') as 'json' | 'text' | 'markdown';
      process.stdout.write(render(r, fmt) + '\n');
    });
}
