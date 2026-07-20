import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import { createClient, ApiError } from '../api/client.js';

const BASE = 'https://api.bgm.tv/v0';

describe('createClient.searchSubjects', () => {
  it('POSTs search body and parses result', async () => {
    server.use(
      http.post(`${BASE}/search/subjects`, async ({ request }) => {
        const body = (await request.json()) as { keyword: string };
        expect(body.keyword).toBe('孤独摇滚');
        expect(request.headers.get('user-agent')).toMatch(/^bgm-cli\//);
        return HttpResponse.json({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 1, name: '孤独摇滚', type: 2, rating: 8.5 }],
        });
      }),
    );
    const client = createClient({});
    const result = await client.searchSubjects({ keyword: '孤独摇滚', limit: 10 });
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe('孤独摇滚');
  });

  it('sends Authorization header when token provided', async () => {
    let authHeader: string | null = null;
    server.use(
      http.post(`${BASE}/search/subjects`, ({ request }) => {
        authHeader = request.headers.get('authorization');
        return HttpResponse.json({ total: 0, limit: 10, offset: 0, data: [] });
      }),
    );
    await createClient({ token: 'abc' }).searchSubjects({ keyword: 'x' });
    expect(authHeader).toBe('Bearer abc');
  });

  it('throws ApiError on 4xx', async () => {
    server.use(
      http.post(`${BASE}/search/subjects`, () =>
        HttpResponse.json({ description: 'bad request' }, { status: 400 }),
      ),
    );
    await expect(createClient({}).searchSubjects({ keyword: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
    });
  });

  it('throws ApiError on 404', async () => {
    server.use(
      http.get(`${BASE}/subjects/9999`, () =>
        HttpResponse.json({ description: 'not found' }, { status: 404 }),
      ),
    );
    await expect(createClient({}).getSubject(9999)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });

  it('normalizes network error to status 0', async () => {
    server.use(
      http.post(`${BASE}/search/subjects`, () => HttpResponse.error()),
    );
    await expect(createClient({}).searchSubjects({ keyword: 'x' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });
});

describe('createClient.getSubject', () => {
  it('GETs subject by id', async () => {
    server.use(
      http.get(`${BASE}/subjects/123`, () =>
        HttpResponse.json({ id: 123, name: '测试条目', date: '2020-01-01', rating: { score: 7.5 } }),
      ),
    );
    const subject = await createClient({}).getSubject(123);
    expect(subject.id).toBe(123);
    expect(subject.name).toBe('测试条目');
  });
});
