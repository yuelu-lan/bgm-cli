import type { Command } from 'commander';
import type { Client } from '../api/client.js';
import type { Renderable } from '../format/types.js';

export async function subjectAction(client: Client, id: number): Promise<Renderable> {
  const s = await client.getSubject(id);
  const fields: [string, unknown][] = [
    ['id', s.id],
    ['name', s.name],
    ['name_cn', s.name_cn ?? ''],
    ['date', s.date ?? ''],
    ['type', s.type],
    ['score', s.rating?.score ?? ''],
    ['rank', s.rating?.rank ?? ''],
    ['rating_count', s.rating?.total ?? ''],
  ];
  return {
    title: s.name_cn || s.name,
    columns: ['key', 'value'],
    rows: fields.map(([key, value]) => ({ key, value })),
    summary: s.summary || undefined,
    raw: s,
  };
}

export function registerSubject(program: Command, client: Client): void {
  program
    .command('subject <id>')
    .description('show subject detail')
    .action(async (id: string) => {
      const { render } = await import('../format/renderer.js');
      const r = await subjectAction(client, Number(id));
      const fmt = (program.opts().format ?? 'text') as 'json' | 'text' | 'markdown';
      process.stdout.write(render(r, fmt) + '\n');
    });
}
