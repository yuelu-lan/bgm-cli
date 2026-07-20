import { describe, it, expect, vi } from 'vitest';
import { subjectAction } from '../commands/subject.js';

describe('subjectAction', () => {
  it('maps subject detail to Renderable', async () => {
    const client = {
      searchSubjects: vi.fn(),
      getSubject: vi.fn().mockResolvedValue({
        id: 123,
        name: '孤独摇滚',
        name_cn: '孤独摇滚',
        date: '2022-10-08',
        summary: 'summary text',
        rating: { score: 8.5, total: 5000 },
        type: 2,
      }),
    };
    const r = await subjectAction(client, 123);
    expect(r.title).toBe('孤独摇滚');
    const fields = Object.fromEntries(r.rows.map((row) => [row.key, row.value]));
    expect(fields.id).toBe(123);
    expect(fields.rating).toBe(8.5);
    expect(fields.date).toBe('2022-10-08');
  });

  it('uses name_cn as title when present', async () => {
    const client = {
      searchSubjects: vi.fn(),
      getSubject: vi.fn().mockResolvedValue({
        id: 1, name: ' bocchi', name_cn: '孤独摇滚', date: '', summary: '', rating: { score: 0 }, type: 2,
      }),
    };
    const r = await subjectAction(client, 1);
    expect(r.title).toBe('孤独摇滚');
  });
});
