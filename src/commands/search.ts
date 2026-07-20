import type { Command } from 'commander';
import type { Client } from '../api/client.js';
import type { Renderable } from '../format/types.js';

const SUBJECT_TYPE_LABEL: Record<number, string> = {
  1: '书籍',
  2: '动画',
  3: '音乐',
  4: '游戏',
  6: '三次元',
};

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

  const collectionTotal = (c?: { wish?: number; collect?: number; doing?: number; on_hold?: number; dropped?: number }) =>
    (c?.wish ?? 0) + (c?.collect ?? 0) + (c?.doing ?? 0) + (c?.on_hold ?? 0) + (c?.dropped ?? 0);

  const columns = ['id', 'type', 'name', 'date', 'score'];
  if (args.sort === 'rank') columns.push('rank');
  if (args.sort === 'heat') columns.push('collection');

  const rows = result.data.map((s) => {
    const row: Record<string, unknown> = {
      id: s.id,
      type: SUBJECT_TYPE_LABEL[s.type] ?? s.type,
      name: s.name,
      date: s.date ?? '',
      score: s.rating?.score ?? '',
    };
    if (args.sort === 'rank') row.rank = s.rating?.rank ?? '';
    if (args.sort === 'heat') row.collection = collectionTotal(s.collection);
    return row;
  });

  return {
    title: `搜索: ${args.keyword}`,
    columns,
    rows,
    meta: { total: result.total, limit: result.limit, offset: result.offset, sort: args.sort ?? 'match' },
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
