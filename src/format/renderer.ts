import stringWidth from 'string-width';
import type { Format, Renderable } from './types.js';

export function render(r: Renderable, fmt: Format): string {
  if (fmt === 'json') {
    return JSON.stringify(
      { title: r.title ?? null, meta: r.meta ?? null, rows: r.rows, summary: r.summary ?? null },
      null,
      2,
    );
  }
  if (fmt === 'markdown') {
    return renderMarkdown(r);
  }
  return renderText(r);
}

function escapeMarkdownCell(v: unknown): string {
  return String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderMarkdown(r: Renderable): string {
  const header = `| ${r.columns.join(' | ')} |`;
  const sep = `| ${r.columns.map(() => '---').join(' | ')} |`;
  const body = r.rows.map((row) => {
    const cells = r.columns.map((c) => escapeMarkdownCell(row[c]));
    return `| ${cells.join(' | ')} |`;
  });
  const lines = [header, sep, ...body];
  if (r.meta && Object.keys(r.meta).length) {
    lines.push('', ...Object.entries(r.meta).map(([k, v]) => `> ${k}: ${v}`));
  }
  if (r.summary) {
    lines.push('', r.summary);
  }
  return lines.join('\n');
}

function renderText(r: Renderable): string {
  const widths = r.columns.map((c) => {
    const headerW = stringWidth(c);
    const maxCellW = Math.max(0, ...r.rows.map((row) => stringWidth(String(row[c] ?? ''))));
    return Math.max(headerW, maxCellW);
  });

  const pad = (text: string, width: number) => {
    const padCount = Math.max(0, width - stringWidth(text));
    return text + ' '.repeat(padCount);
  };

  const formatRow = (cells: string[]) =>
    cells.map((cell, i) => pad(cell, widths[i])).join('  ');

  const lines: string[] = [];
  lines.push(formatRow(r.columns));
  lines.push(formatRow(widths.map((w) => '-'.repeat(w))));
  for (const row of r.rows) {
    lines.push(formatRow(r.columns.map((c) => String(row[c] ?? ''))));
  }
  if (r.meta && Object.keys(r.meta).length) {
    lines.push('');
    for (const [k, v] of Object.entries(r.meta)) {
      lines.push(`${k}: ${v}`);
    }
  }
  if (r.summary) {
    lines.push('', r.summary);
  }
  return lines.join('\n');
}
