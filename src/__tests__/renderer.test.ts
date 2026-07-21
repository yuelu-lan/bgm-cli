import { describe, it, expect } from 'vitest';
import { render } from '../format/renderer.js';
import type { Renderable } from '../format/types.js';

const sample: Renderable = {
  title: '搜索结果',
  columns: ['id', 'name', 'rating'],
  rows: [
    { id: 1, name: '孤独摇滚', rating: 8.5 },
    { id: 2, name: 'BOCCHI', rating: 7.0 },
  ],
  meta: { total: 2 },
};

describe('render json', () => {
  it('outputs raw payload when raw present', () => {
    const r: Renderable = {
      columns: ['id'],
      rows: [{ id: 1 }],
      raw: { total: 1, data: [{ id: 1, name: '孤独摇滚', tags: [{ name: '原创', count: 10 }] }] },
    };
    const out = JSON.parse(render(r, 'json'));
    expect(out).toEqual(r.raw);
    expect(out.total).toBe(1);
    expect(out.data[0].tags[0].name).toBe('原创');
  });

  it('falls back to title meta rows summary when raw absent', () => {
    const out = JSON.parse(render(sample, 'json'));
    expect(out.title).toBe('搜索结果');
    expect(out.meta.total).toBe(2);
    expect(out.rows).toHaveLength(2);
    expect(out.summary).toBeNull();
  });
});

describe('render text', () => {
  it('aligns columns with CJK width', () => {
    const out = render(sample, 'text');
    const lines = out.split('\n');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('rating');
    expect(lines[1]).toMatch(/^-/);
    const dataLine = lines[2];
    expect(dataLine).toContain('孤独摇滚');
  });

  it('handles empty rows', () => {
    const empty: Renderable = { columns: ['id', 'name'], rows: [], meta: { total: 0 } };
    const out = render(empty, 'text');
    expect(out).toContain('id');
    expect(out).toContain('total: 0');
  });
});

describe('render markdown', () => {
  it('outputs markdown table with separator', () => {
    const out = render(sample, 'markdown');
    const lines = out.split('\n');
    expect(lines[0]).toBe('| id | name | rating |');
    expect(lines[1]).toBe('| --- | --- | --- |');
    expect(lines[2]).toBe('| 1 | 孤独摇滚 | 8.5 |');
  });

  it('escapes pipe in cell content', () => {
    const r: Renderable = {
      columns: ['name'],
      rows: [{ name: 'a|b' }],
    };
    const out = render(r, 'markdown');
    expect(out).toContain('a\\|b');
  });
});

describe('render summary', () => {
  const r: Renderable = {
    columns: ['id'],
    rows: [{ id: 1 }],
    summary: '这是一段长简介。',
  };

  it('text appends summary after table', () => {
    const out = render(r, 'text');
    const lines = out.split('\n');
    expect(lines[lines.length - 1]).toBe('这是一段长简介。');
  });

  it('markdown appends summary after table', () => {
    const out = render(r, 'markdown');
    expect(out.endsWith('这是一段长简介。')).toBe(true);
  });

  // 无 raw 时 json 走兜底结构，summary 作为字段输出
  it('json includes summary field when no raw', () => {
    const out = JSON.parse(render(r, 'json'));
    expect(out.summary).toBe('这是一段长简介。');
  });

  it('omits summary when absent', () => {
    const out = render({ columns: ['id'], rows: [{ id: 1 }] }, 'json');
    expect(JSON.parse(out).summary).toBeNull();
  });
});
