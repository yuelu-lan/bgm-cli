import { ProxyAgent, setGlobalDispatcher } from 'undici';
import type { paths } from './types.js';

let proxyConfigured = false;
function ensureProxyDispatcher(): void {
  if (proxyConfigured) return;
  const proxyUrl =
    process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
  proxyConfigured = true;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ClientOptions {
  token?: string;
  userAgent?: string;
  apiBase?: string;
  timeoutMs?: number;
}

type SearchResult = paths['/v0/search/subjects']['post']['responses']['200']['content']['application/json'];
type Subject = paths['/v0/subjects/{subject_id}']['get']['responses']['200']['content']['application/json'];

export interface SearchParams {
  keyword: string;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  filter?: { type?: number[]; tag?: string[]; nsfw?: boolean };
  limit?: number;
  offset?: number;
}

const PKG_VERSION = process.env.PACKAGE_VERSION ?? '0.0.0-dev';
const DEFAULT_UA = `bgm-cli/${PKG_VERSION} (https://github.com/yuelu-lan/bgm-cli)`;
const DEFAULT_BASE = 'https://api.bgm.tv/v0';
const DEFAULT_TIMEOUT = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, '请求超时');
    }
    throw new ApiError(0, '网络错误');
  } finally {
    clearTimeout(timer);
  }
}

export function createClient(opts: ClientOptions = {}) {
  const base = opts.apiBase ?? DEFAULT_BASE;
  const ua = opts.userAgent ?? DEFAULT_UA;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;

  async function request(path: string, init: RequestInit): Promise<unknown> {
    ensureProxyDispatcher();
    const headers = new Headers(init.headers);
    headers.set('User-Agent', ua);
    headers.set('Content-Type', 'application/json');
    if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);
    let res: Response;
    try {
      res = await fetchWithTimeout(`${base}${path}`, { ...init, headers }, timeoutMs);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, '网络错误');
    }
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const body = (await res.json()) as { description?: string; title?: string };
        message = body.description ?? body.title ?? message;
        code = body.title;
      } catch {
        // non-json error body, keep default message
      }
      throw new ApiError(res.status, message, code);
    }
    return res.json();
  }

  return {
    async searchSubjects(p: SearchParams): Promise<SearchResult> {
      const body = {
        keyword: p.keyword,
        sort: p.sort,
        filter: p.filter,
        ...(p.limit !== undefined ? { limit: p.limit } : {}),
        ...(p.offset !== undefined ? { offset: p.offset } : {}),
      };
      return (await request('/search/subjects', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as SearchResult;
    },
    async getSubject(id: number): Promise<Subject> {
      return (await request(`/subjects/${id}`, { method: 'GET' })) as Subject;
    },
  };
}

export type Client = ReturnType<typeof createClient>;
