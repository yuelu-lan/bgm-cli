import { describe, it, expect, vi } from 'vitest';
import { exportSearchAction } from '../commands/export.js';

describe('exportSearchAction', () => {
  it('paginates until total reached and merges rows', async () => {
    const pages = [
      { total: 25, limit: 10, offset: 0, data: Array.from({ length: 10 }, (_, i) => ({ id: i, name: `n${i}`, date: '', rating: { score: 0 } })) },
      { total: 25, limit: 10, offset: 10, data: Array.from({ length: 10 }, (_, i) => ({ id: 10 + i, name: `n${10 + i}`, date: '', rating: { score: 0 } })) },
      { total: 25, limit: 10, offset: 20, data: Array.from({ length: 5 }, (_, i) => ({ id: 20 + i, name: `n${20 + i}`, date: '', rating: { score: 0 } })) },
    ];
    const searchSubjects = vi.fn().mockImplementation((p: { offset: number }) =>
      Promise.resolve(pages.find((pg) => pg.offset === p.offset)!),
    );
    const client = { searchSubjects, getSubject: vi.fn() };

    const r = await exportSearchAction(client, { keyword: 'x', limit: 10 });
    expect(searchSubjects).toHaveBeenCalledTimes(3);
    expect(r.rows).toHaveLength(25);
    expect(r.meta?.total).toBe(25);
  });

  it('respects --max cap', async () => {
    const searchSubjects = vi.fn().mockImplementation((p: { offset: number }) =>
      Promise.resolve({
        total: 100, limit: 10, offset: p.offset,
        data: Array.from({ length: 10 }, (_, i) => ({ id: p.offset + i, name: 'n', date: '', rating: { score: 0 } })),
      }),
    );
    const client = { searchSubjects, getSubject: vi.fn() };
    const r = await exportSearchAction(client, { keyword: 'x', limit: 10, max: 25 });
    expect(r.rows).toHaveLength(25);
  });
});
