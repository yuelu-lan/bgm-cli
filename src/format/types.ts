export interface Renderable {
  title?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  meta?: Record<string, unknown>;
  summary?: string;
}

export type Format = 'json' | 'text' | 'markdown';
