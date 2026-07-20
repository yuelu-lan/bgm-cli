import { describe, it, expect, vi } from 'vitest';
import { searchAction } from '../commands/search.js';

function mockClient(data: unknown, total: number) {
  return {
    searchSubjects: vi.fn().mockResolvedValue({ total, limit: 10, offset: 0, data }),
    getSubject: vi.fn(),
  };
}

describe('searchAction', () => {
  it('maps results to Renderable', async () => {
    const client = mockClient(
      [
        { id: 1, name: '孤独摇滚', type: 2, date: '2022-10-08', rating: { score: 8.5 } },
      ],
      1,
    );
    const r = await searchAction(client, { keyword: '孤独摇滚', sort: 'rank', limit: 10, offset: 0 });
    expect(r.columns).toEqual(['id', 'name', 'date', 'rating']);
    expect(r.rows[0]).toEqual({ id: 1, name: '孤独摇滚', date: '2022-10-08', rating: 8.5 });
    expect(r.meta?.total).toBe(1);
    expect(client.searchSubjects).toHaveBeenCalledWith({
      keyword: '孤独摇滚',
      sort: 'rank',
      filter: undefined,
      limit: 10,
      offset: 0,
    });
  });

  it('passes type/tag/nsfw as filter', async () => {
    const client = mockClient([], 0);
    await searchAction(client, {
      keyword: 'x',
      type: ['2'],
      tag: ['原创'],
      nsfw: false,
      limit: 5,
      offset: 0,
    });
    expect(client.searchSubjects).toHaveBeenCalledWith({
      keyword: 'x',
      sort: undefined,
      filter: { type: [2], tag: ['原创'], nsfw: false },
      limit: 5,
      offset: 0,
    });
  });

  it('empty results still produce empty Renderable with total 0', async () => {
    const client = mockClient([], 0);
    const r = await searchAction(client, { keyword: 'x', limit: 10, offset: 0 });
    expect(r.rows).toEqual([]);
    expect(r.meta?.total).toBe(0);
  });
});
