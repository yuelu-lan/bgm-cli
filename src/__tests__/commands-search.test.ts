import { describe, it, expect, vi } from 'vitest';
import { searchAction } from '../commands/search.js';

function mockClient(data: unknown, total: number) {
  return {
    searchSubjects: vi.fn().mockResolvedValue({ total, limit: 10, offset: 0, data }),
    getSubject: vi.fn(),
  };
}

describe('searchAction', () => {
  it('maps results with type column and score, adds rank column on sort=rank', async () => {
    const client = mockClient(
      [
        { id: 1, name: '孤独摇滚', type: 2, date: '2022-10-08', rating: { score: 8.5, rank: 23 } },
      ],
      1,
    );
    const r = await searchAction(client, { keyword: '孤独摇滚', sort: 'rank', limit: 10, offset: 0 });
    expect(r.columns).toEqual(['id', 'type', 'name', 'date', 'score', 'rank']);
    expect(r.rows[0]).toEqual({ id: 1, type: '动画', name: '孤独摇滚', date: '2022-10-08', score: 8.5, rank: 23 });
    expect(r.meta?.total).toBe(1);
    expect(r.meta?.sort).toBe('rank');
    expect(client.searchSubjects).toHaveBeenCalledWith({
      keyword: '孤独摇滚',
      sort: 'rank',
      filter: undefined,
      limit: 10,
      offset: 0,
    });
    expect(r.raw).toEqual({ total: 1, limit: 10, offset: 0, data: [{ id: 1, name: '孤独摇滚', type: 2, date: '2022-10-08', rating: { score: 8.5, rank: 23 } }] });
  });

  it('adds collection column on sort=heat', async () => {
    const client = mockClient(
      [{ id: 1, name: 'x', type: 2, date: '', rating: { score: 7 }, collection: { wish: 10, collect: 20, doing: 5, on_hold: 2, dropped: 3 } }],
      1,
    );
    const r = await searchAction(client, { keyword: 'x', sort: 'heat', limit: 10, offset: 0 });
    expect(r.columns).toEqual(['id', 'type', 'name', 'date', 'score', 'collection']);
    expect(r.rows[0].collection).toBe(40);
  });

  it('no dynamic column on sort=match/undefined', async () => {
    const client = mockClient([{ id: 1, name: 'x', type: 2, date: '', rating: { score: 7 } }], 1);
    const r = await searchAction(client, { keyword: 'x', limit: 10, offset: 0 });
    expect(r.columns).toEqual(['id', 'type', 'name', 'date', 'score']);
    expect(r.meta?.sort).toBe('match');
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
    expect(r.raw).toEqual({ total: 0, limit: 10, offset: 0, data: [] });
  });
});
