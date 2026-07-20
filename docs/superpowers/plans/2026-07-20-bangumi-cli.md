# bangumi CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 `bgm` CLI，支持搜索条目、查看条目详情、批量导出，输出 json/text/markdown 三种格式。

**Architecture:** 分层架构——`commands/`（commander 命令定义 + 参数到 Renderable 映射）、`api/`（fetch 封装 + 生成类型）、`format/`（统一渲染器）、`config/`（env-paths 路径 + 读写）。命令产出 `Renderable` 描述符，由 renderer 按全局 `--format` 渲染，错误冒泡到 `index.ts` 全局兜底。

**Tech Stack:** TypeScript（ESM）、commander、tsup、vitest、msw、openapi-typescript、env-paths、string-width

## Global Constraints

- 包管理器：pnpm（所有命令用 `pnpm` 而非 npm/yarn）
- Node 版本：`>=20`（package.json `engines.node`）
- 模块系统：ESM（`"type": "module"`），所有内部导入用 `.js` 扩展名
- 构建产物：tsup 打包成单文件，`bin` 指向 `dist/index.js`
- 错误输出走 stderr，数据走 stdout
- 不引入未在计划中列出的依赖
- 生成的 `src/api/types.ts` 不手改（由 `pnpm gen:types` 生成）

---

## File Structure

```
package.json
tsconfig.json
tsup.config.ts
vitest.config.ts
.gitignore
open-api/v0.yaml                 # 下游 spec 快照（gen:types 读取）
scripts/gen-types.ts             # 类型生成脚本
src/
  index.ts                       # 入口：根命令 + 全局选项 + 错误兜底
  api/
    client.ts                    # ApiError, fetchWithTimeout, createClient
    types.ts                     # openapi-typescript 生成（不手改）
  format/
    types.ts                     # Renderable, Format
    renderer.ts                  # render(r, fmt)
  config/
    load.ts                      # loadConfig, saveConfig, maskToken
  commands/
    search.ts                    # search 命令
    subject.ts                   # subject 命令
    config.ts                    # config get/set 命令
    export.ts                    # export search 子命令
  __tests__/
    renderer.test.ts
    config.test.ts
    client.test.ts
    commands-search.test.ts
    commands-subject.test.ts
    commands-export.test.ts
    setup.ts                     # msw server setup
```

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: 可运行的 `pnpm install` + `pnpm typecheck`（空通过）+ `pnpm build`（产出空 bundle）

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "bgm-cli",
  "version": "0.1.0",
  "description": "Bangumi CLI built with TypeScript + commander",
  "type": "module",
  "bin": {
    "bgm": "dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "gen:types": "tsx scripts/gen-types.ts"
  },
  "dependencies": {
    "env-paths": "^3.0.0",
    "string-width": "^7.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "commander": "^12.0.0",
    "msw": "^2.3.0",
    "openapi-typescript": "^7.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "yaml": "^2.4.0"
  }
}
```

> 注意：`commander` 放 devDependencies（tsup 打包进 bundle，运行时不依赖）。`env-paths` 和 `string-width` 是运行时依赖（不打包或打包后仍需保留，作为 dependencies）。

- [ ] **Step 2: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__/**/*"]
}
```

- [ ] **Step 3: 创建 `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  bundling: true,
  clean: true,
  sourcemap: false,
});
```

- [ ] **Step 4: 创建 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: 创建 `.gitignore`**

```
node_modules/
dist/
*.log
.env
.DS_Store
coverage/
```

- [ ] **Step 6: 创建空的 `src/__tests__/setup.ts` 占位（后续 Task 6 填充 msw）**

```ts
// msw server setup placeholder, filled in Task 6
```

- [ ] **Step 7: 创建空的 `src/index.ts` 占位**

```ts
// entry point, filled in Task 11
export {};
```

- [ ] **Step 8: 安装依赖并验证**

Run: `pnpm install`
Run: `pnpm typecheck`
Expected: 通过（无类型错误，因为只有空文件）

Run: `pnpm build`
Expected: 产出 `dist/index.js`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold ts + commander + tsup + vitest project"
```

---

### Task 2: OpenAPI 类型生成

**Files:**
- Create: `open-api/v0.yaml`（从 bangumi/api 下载）
- Create: `scripts/gen-types.ts`
- Create: `src/api/types.ts`（生成产物）

**Interfaces:**
- Produces: `src/api/types.ts`，导出 `paths`（openapi-typescript 标准产物），供 Task 6 的 client.ts 用路径式类型抽取引用

- [ ] **Step 1: 下载 OpenAPI spec 快照**

Run:
```bash
mkdir -p open-api
curl -fsSL https://raw.githubusercontent.com/bangumi/api/master/open-api/v0.yaml -o open-api/v0.yaml
```
Expected: `open-api/v0.yaml` 存在且非空

- [ ] **Step 2: 创建 `scripts/gen-types.ts`**

```ts
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const yamlText = readFileSync(resolve(root, 'open-api/v0.yaml'), 'utf8');
const spec = parse(yamlText);

const ast = await openapiTS(spec);
const content = `// AUTO-GENERATED by \`pnpm gen:types\` — do not edit\n${astToString(ast)}`;

writeFileSync(resolve(root, 'src/api/types.ts'), content);
console.log('types written to src/api/types.ts');
```

- [ ] **Step 3: 运行生成**

Run: `pnpm gen:types`
Expected: `src/api/types.ts` 生成，首行注释为 `// AUTO-GENERATED`，包含 `paths` 导出

- [ ] **Step 4: 验证类型可被引用**

创建临时检查（不提交）：在 `src/index.ts` 临时加 `import type { paths } from './api/types.js';` 然后运行 `pnpm typecheck`，确认 `paths` 存在。确认后还原 `src/index.ts` 为占位。

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 5: 在 `.gitignore` 中不要排除 `src/api/types.ts`（需入库以守护漂移）**

确认 `.gitignore` 不含 `src/api/types.ts`（Task 1 的 .gitignore 已正确）。

- [ ] **Step 6: Commit**

```bash
git add open-api/v0.yaml scripts/gen-types.ts src/api/types.ts
git commit -m "feat: add openapi type generation"
```

---

### Task 3: Renderable 类型定义

**Files:**
- Create: `src/format/types.ts`

**Interfaces:**
- Produces: `Renderable` interface、`Format` 类型，供 Task 4 renderer 与 Task 7-10 commands 消费

- [ ] **Step 1: 创建 `src/format/types.ts`**

```ts
export interface Renderable {
  title?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  meta?: Record<string, unknown>;
}

export type Format = 'json' | 'text' | 'markdown';
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add src/format/types.ts
git commit -m "feat: add Renderable descriptor type"
```

---

### Task 4: 渲染器（json / text / markdown）

**Files:**
- Create: `src/format/renderer.ts`
- Test: `src/__tests__/renderer.test.ts`

**Interfaces:**
- Consumes: `Renderable`, `Format` from `./types.js`
- Produces: `render(r: Renderable, fmt: Format): string`

- [ ] **Step 1: 写失败测试 `src/__tests__/renderer.test.ts`**

```ts
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
  it('outputs JSON with title meta rows', () => {
    const out = JSON.parse(render(sample, 'json'));
    expect(out.title).toBe('搜索结果');
    expect(out.meta.total).toBe(2);
    expect(out.rows).toHaveLength(2);
  });
});

describe('render text', () => {
  it('aligns columns with CJK width', () => {
    const out = render(sample, 'text');
    const lines = out.split('\n');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('rating');
    // header separator line exists
    expect(lines[1]).toMatch(/^-/);
    // CJK name '孤独摇滚' (4 full-width) padded so next column aligns
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- renderer`
Expected: FAIL，`render` 未定义

- [ ] **Step 3: 实现 `src/format/renderer.ts`**

```ts
import stringWidth from 'string-width';
import type { Format, Renderable } from './types.js';

export function render(r: Renderable, fmt: Format): string {
  if (fmt === 'json') {
    return JSON.stringify(
      { title: r.title ?? null, meta: r.meta ?? null, rows: r.rows },
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
  return lines.join('\n');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- renderer`
Expected: PASS（全部用例）

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/format/renderer.ts src/__tests__/renderer.test.ts
git commit -m "feat: add json/text/markdown renderer"
```

---

### Task 5: 配置加载与持久化

**Files:**
- Create: `src/config/load.ts`
- Test: `src/__tests__/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(overridePath?)`, `saveConfig(partial, overridePath?)`, `maskToken(token)`, `ConfigFile` 类型

- [ ] **Step 1: 写失败测试 `src/__tests__/config.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, maskToken } from '../config/load.js';

let dir: string;
const origEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bgm-cfg-'));
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.BGM_ACCESS_TOKEN;
  delete process.env.BGM_API_BASE;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const k of ['XDG_CONFIG_HOME', 'BGM_ACCESS_TOKEN', 'BGM_API_BASE']) {
    if (k in origEnv) process.env[k] = origEnv[k];
    else delete process.env[k];
  }
});

describe('loadConfig', () => {
  it('returns defaults when no file', () => {
    const cfg = loadConfig();
    expect(cfg.token).toBeUndefined();
    expect(cfg.apiBase).toBe('https://api.bgm.tv/v0');
  });

  it('reads token from file', () => {
    const path = loadConfig().configPath;
    writeFileSync(path, JSON.stringify({ token: 'file-token' }));
    const cfg = loadConfig();
    expect(cfg.token).toBe('file-token');
  });

  it('env BGM_ACCESS_TOKEN overrides file', () => {
    const path = loadConfig().configPath;
    writeFileSync(path, JSON.stringify({ token: 'file-token' }));
    process.env.BGM_ACCESS_TOKEN = 'env-token';
    expect(loadConfig().token).toBe('env-token');
  });

  it('env BGM_API_BASE overrides default', () => {
    process.env.BGM_API_BASE = 'https://test.local/v0';
    expect(loadConfig().apiBase).toBe('https://test.local/v0');
  });

  it('throws ConfigError on corrupt file', async () => {
    const path = loadConfig().configPath;
    writeFileSync(path, '{ not json');
    await expect(() => loadConfig()).toThrow(/配置文件解析失败/);
  });
});

describe('saveConfig', () => {
  it('writes token to file and round-trips', () => {
    saveConfig({ token: 'new-token' });
    expect(loadConfig().token).toBe('new-token');
  });

  it('merges with existing keys', () => {
    saveConfig({ token: 'a' });
    saveConfig({ apiBase: 'https://x.local/v0' });
    const cfg = loadConfig();
    expect(cfg.token).toBe('a');
    expect(cfg.apiBase).toBe('https://x.local/v0');
  });
});

describe('maskToken', () => {
  it('masks middle of long token', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('abcd****ijkl');
  });
  it('fully masks short token', () => {
    expect(maskToken('abc')).toBe('****');
  });
  it('returns undefined for undefined', () => {
    expect(maskToken(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- config`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现 `src/config/load.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import envPaths from 'env-paths';

const paths = envPaths('bgm-cli', { type: 'config' });

export interface ConfigFile {
  token?: string;
  apiBase?: string;
}

export interface ResolvedConfig extends ConfigFile {
  apiBase: string;
  configPath: string;
}

const DEFAULT_API_BASE = 'https://api.bgm.tv/v0';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(overridePath?: string): ResolvedConfig {
  const configPath = overridePath ?? paths.config;
  let file: ConfigFile = {};
  if (existsSync(configPath)) {
    try {
      file = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      throw new ConfigError('配置文件解析失败');
    }
  }
  const token = process.env.BGM_ACCESS_TOKEN ?? file.token;
  const apiBase = process.env.BGM_API_BASE ?? file.apiBase ?? DEFAULT_API_BASE;
  return { token, apiBase, configPath };
}

export function saveConfig(partial: ConfigFile, overridePath?: string): void {
  const configPath = overridePath ?? paths.config;
  const existing = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, 'utf8')) as ConfigFile)
    : {};
  const merged = { ...existing, ...partial };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

export function maskToken(token?: string): string | undefined {
  if (!token) return undefined;
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- config`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/config/load.ts src/__tests__/config.test.ts
git commit -m "feat: add config load/save with env override"
```

---

### Task 6: API client（fetch 封装 + 错误归一化）

**Files:**
- Create: `src/api/client.ts`
- Modify: `src/__tests__/setup.ts`（填充 msw server）
- Test: `src/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `paths` type from `./types.js`（路径式类型抽取），`ConfigFile` from `../config/load.js`
- Produces: `ApiError`, `createClient(opts)`, `Client` 类型，方法 `searchSubjects(p)`, `getSubject(id)`

- [ ] **Step 1: 填充 msw setup `src/__tests__/setup.ts`**

```ts
import { setupServer } from 'msw/node';

export const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 2: 写失败测试 `src/__tests__/client.test.ts`**

```ts
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
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test -- client`
Expected: FAIL，模块不存在

- [ ] **Step 4: 实现 `src/api/client.ts`**

```ts
import type { paths } from './types.js';

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

const DEFAULT_UA = 'bgm-cli/0.1.0 (https://github.com/yuelu-lan/bgm-cli)';
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
```

> 类型抽取说明：`SearchResult` 和 `Subject` 用 openapi-typescript 的路径式类型从 `paths` 抽取。若 Task 2 生成的 `paths` 中路径键名与上述不完全一致（例如 `/v0/subjects/{subject_id}` vs `/v0/subjects/{id}`），运行 `pnpm typecheck` 报错时，打开 `src/api/types.ts` 搜索实际路径键名并替换为真实键名——这是唯一允许对 client.ts 类型抽取做调整的情况。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test -- client`
Expected: PASS。若类型抽取报错，按 Step 4 说明修正路径键名后重跑。

- [ ] **Step 6: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 7: Commit**

```bash
git add src/api/client.ts src/__tests__/setup.ts src/__tests__/client.test.ts
git commit -m "feat: add api client with timeout and error normalization"
```

---

### Task 7: search 命令

**Files:**
- Create: `src/commands/search.ts`
- Test: `src/__tests__/commands-search.test.ts`

**Interfaces:**
- Consumes: `Client` from `../api/client.js`, `Renderable` from `../format/types.js`
- Produces: `searchAction(client, args)` 返回 `Renderable`（不直接打印，便于测试）；`registerSearch(program, client)` 注册 commander 子命令

- [ ] **Step 1: 写失败测试 `src/__tests__/commands-search.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-search`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现 `src/commands/search.ts`**

```ts
import type { Command } from 'commander';
import type { Client } from '../api/client.js';
import type { Renderable } from '../format/types.js';

export interface SearchArgs {
  keyword: string;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  type?: string[];
  tag?: string[];
  nsfw?: boolean;
  limit: number;
  offset: number;
}

export async function searchAction(client: Client, args: SearchArgs): Promise<Renderable> {
  const filter =
    args.type || args.tag || args.nsfw !== undefined
      ? {
          ...(args.type ? { type: args.type.map((t) => Number(t)) } : {}),
          ...(args.tag ? { tag: args.tag } : {}),
          ...(args.nsfw !== undefined ? { nsfw: args.nsfw } : {}),
        }
      : undefined;

  const result = await client.searchSubjects({
    keyword: args.keyword,
    sort: args.sort,
    filter,
    limit: args.limit,
    offset: args.offset,
  });

  const rows = result.data.map((s) => ({
    id: s.id,
    name: s.name,
    date: s.date ?? '',
    rating: s.rating?.score ?? '',
  }));

  return {
    title: `搜索: ${args.keyword}`,
    columns: ['id', 'name', 'date', 'rating'],
    rows,
    meta: { total: result.total, limit: result.limit, offset: result.offset },
  };
}

export function registerSearch(program: Command, client: Client): void {
  program
    .command('search <keyword>')
    .option('-s, --sort <sort>', 'match | heat | rank | score')
    .option('-t, --type <type...>', 'subject type ids')
    .option('--tag <tag...>', 'tags')
    .option('--nsfw [bool]', 'include nsfw', (v) => v !== 'false')
    .option('-l, --limit <n>', 'page size', '10')
    .option('-o, --offset <n>', 'page offset', '0')
    .action(async (keyword: string, opts: Record<string, unknown>) => {
      const { render } = await import('../format/renderer.js');
      const r = await searchAction(client, {
        keyword,
        sort: opts.sort as SearchArgs['sort'],
        type: opts.type as string[] | undefined,
        tag: opts.tag as string[] | undefined,
        nsfw: opts.nsfw as boolean | undefined,
        limit: Number(opts.limit),
        offset: Number(opts.offset),
      });
      const fmt = (program.opts().format ?? 'text') as 'json' | 'text' | 'markdown';
      process.stdout.write(render(r, fmt) + '\n');
    });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- commands-search`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过（若 `s.date`/`s.rating` 字段在生成类型中名字不同，按 Task 6 说明核对 `src/api/types.ts` 中 Subject 摘要字段名后调整）

- [ ] **Step 6: Commit**

```bash
git add src/commands/search.ts src/__tests__/commands-search.test.ts
git commit -m "feat: add search command"
```

---

### Task 8: subject 命令

**Files:**
- Create: `src/commands/subject.ts`
- Test: `src/__tests__/commands-subject.test.ts`

**Interfaces:**
- Consumes: `Client`, `Renderable`
- Produces: `subjectAction(client, id)` 返回 `Renderable`；`registerSubject(program, client)`

- [ ] **Step 1: 写失败测试 `src/__tests__/commands-subject.test.ts`**

```ts
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
```

> subject 详情用「字段表」而非列表——`columns: ['key','value']`，`rows` 每行一个字段。这样 renderer 通用，无需为详情单独渲染。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-subject`
Expected: FAIL

- [ ] **Step 3: 实现 `src/commands/subject.ts`**

```ts
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
    ['rating', s.rating?.score ?? ''],
    ['rating_count', s.rating?.total ?? ''],
    ['summary', s.summary ?? ''],
  ];
  return {
    title: s.name_cn || s.name,
    columns: ['key', 'value'],
    rows: fields.map(([key, value]) => ({ key, value })),
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- commands-subject`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过（核对 `s.name_cn`/`s.summary`/`s.rating.total` 字段名与生成类型一致）

- [ ] **Step 6: Commit**

```bash
git add src/commands/subject.ts src/__tests__/commands-subject.test.ts
git commit -m "feat: add subject detail command"
```

---

### Task 9: config 命令

**Files:**
- Create: `src/commands/config.ts`
- Test: `src/__tests__/commands-config.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `saveConfig`, `maskToken` from `../config/load.js`
- Produces: `configGetAction(key)`, `configSetAction(key, value)` 返回字符串；`registerConfig(program)`

- [ ] **Step 1: 写失败测试 `src/__tests__/commands-config.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configGetAction, configSetAction } from '../commands/config.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bgm-cfg-'));
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.BGM_ACCESS_TOKEN;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('configSetAction / configGetAction', () => {
  it('set then get token (masked)', async () => {
    await configSetAction('token', 'abcdefghijklmnop');
    const out = await configGetAction('token');
    expect(out).toBe('abcd****ijkl');
  });

  it('get apiBase returns resolved base', async () => {
    await configSetAction('apiBase', 'https://custom.local/v0');
    const out = await configGetAction('apiBase');
    expect(out).toBe('https://custom.local/v0');
  });

  it('get unknown key returns empty', async () => {
    const out = await configGetAction('nope');
    expect(out).toBe('');
  });

  it('set rejects unknown key', async () => {
    await expect(configSetAction('bad', 'x')).rejects.toThrow(/未知配置项/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-config`
Expected: FAIL

- [ ] **Step 3: 实现 `src/commands/config.ts`**

```ts
import type { Command } from 'commander';
import { loadConfig, saveConfig, maskToken, ConfigError } from '../config/load.js';

const KEYS = new Set(['token', 'apiBase']);

export async function configGetAction(key: string): Promise<string> {
  if (!KEYS.has(key)) throw new ConfigError(`未知配置项: ${key}`);
  const cfg = loadConfig();
  if (key === 'token') return maskToken(cfg.token) ?? '';
  return (cfg.apiBase as string) ?? '';
}

export async function configSetAction(key: string, value: string): Promise<void> {
  if (!KEYS.has(key)) throw new ConfigError(`未知配置项: ${key}`);
  saveConfig({ [key]: value });
}

export function registerConfig(program: Command): void {
  const cmd = program.command('config').description('view or set config');
  cmd
    .command('get <key>')
    .action(async (key: string) => {
      const out = await configGetAction(key);
      process.stdout.write(out + '\n');
    });
  cmd
    .command('set <key> <value>')
    .action(async (key: string, value: string) => {
      await configSetAction(key, value);
      process.stdout.write(`已设置 ${key}\n`);
    });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- commands-config`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/commands/config.ts src/__tests__/commands-config.test.ts
git commit -m "feat: add config get/set command"
```

---

### Task 10: export 命令（全量翻页导出）

**Files:**
- Create: `src/commands/export.ts`
- Test: `src/__tests__/commands-export.test.ts`

**Interfaces:**
- Consumes: `Client`, `Renderable`, `render`
- Produces: `exportSearchAction(client, args, onBatch?)` 返回合并后的 `Renderable`；`registerExport(program, client)`

- [ ] **Step 1: 写失败测试 `src/__tests__/commands-export.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-export`
Expected: FAIL

- [ ] **Step 3: 实现 `src/commands/export.ts`**

```ts
import type { Command } from 'commander';
import type { Client } from '../api/client.js';
import type { Renderable } from '../format/types.js';

export interface ExportArgs {
  keyword: string;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  type?: string[];
  tag?: string[];
  nsfw?: boolean;
  limit: number;
  max?: number;
}

export async function exportSearchAction(client: Client, args: ExportArgs): Promise<Renderable> {
  const limit = args.limit;
  const cap = args.max;
  const filter =
    args.type || args.tag || args.nsfw !== undefined
      ? {
          ...(args.type ? { type: args.type.map((t) => Number(t)) } : {}),
          ...(args.tag ? { tag: args.tag } : {}),
          ...(args.nsfw !== undefined ? { nsfw: args.nsfw } : {}),
        }
      : undefined;

  const allRows: Record<string, unknown>[] = [];
  let offset = 0;
  let total = 0;

  while (true) {
    const result = await client.searchSubjects({
      keyword: args.keyword,
      sort: args.sort,
      filter,
      limit,
      offset,
    });
    total = result.total;
    for (const s of result.data) {
      allRows.push({ id: s.id, name: s.name, date: s.date ?? '', rating: s.rating?.score ?? '' });
      if (cap !== undefined && allRows.length >= cap) break;
    }
    offset += limit;
    if (offset >= total) break;
    if (cap !== undefined && allRows.length >= cap) break;
  }

  return {
    title: `导出: ${args.keyword}`,
    columns: ['id', 'name', 'date', 'rating'],
    rows: allRows,
    meta: { total, exported: allRows.length },
  };
}

export function registerExport(program: Command, client: Client): void {
  const cmd = program.command('export').description('batch export');
  cmd
    .command('search <keyword>')
    .option('-s, --sort <sort>', 'match | heat | rank | score')
    .option('-t, --type <type...>', 'subject type ids')
    .option('--tag <tag...>', 'tags')
    .option('--nsfw [bool]', 'include nsfw', (v) => v !== 'false')
    .option('-l, --limit <n>', 'page size', '10')
    .option('--max <n>', 'cap total rows')
    .action(async (keyword: string, opts: Record<string, unknown>) => {
      const { render } = await import('../format/renderer.js');
      const r = await exportSearchAction(client, {
        keyword,
        sort: opts.sort as ExportArgs['sort'],
        type: opts.type as string[] | undefined,
        tag: opts.tag as string[] | undefined,
        nsfw: opts.nsfw as boolean | undefined,
        limit: Number(opts.limit),
        max: opts.max ? Number(opts.max) : undefined,
      });
      const fmt = (program.opts().format ?? 'text') as 'json' | 'text' | 'markdown';
      process.stdout.write(render(r, fmt) + '\n');
    });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- commands-export`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/commands/export.ts src/__tests__/commands-export.test.ts
git commit -m "feat: add export search with pagination"
```

---

### Task 11: 入口、全局选项与错误兜底

**Files:**
- Modify: `src/index.ts`（替换占位）

**Interfaces:**
- Consumes: 所有 `register*` 函数、`loadConfig`、`createClient`、`ApiError`、`ConfigError`、`render`
- Produces: 可执行的 `bgm` CLI

- [ ] **Step 1: 实现 `src/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { createClient, ApiError } from './api/client.js';
import { ConfigError } from './config/load.js';
import { loadConfig } from './config/load.js';
import { registerSearch } from './commands/search.js';
import { registerSubject } from './commands/subject.js';
import { registerConfig } from './commands/config.js';
import { registerExport } from './commands/export.js';

const FORMAT_CHOICES = ['json', 'text', 'markdown'] as const;

function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) {
    if (err.status === 0) return 6;
    if (err.status === 401) return 2;
    if (err.status === 404) return 3;
    if (err.status >= 400 && err.status < 500) return 4;
    if (err.status >= 500) return 5;
  }
  if (err instanceof ConfigError) return 7;
  return 1;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('bgm')
    .description('Bangumi CLI')
    .option('-f, --format <format>', 'json | text | markdown', 'text')
    .option('-c, --config <path>', 'config file path')
    .hook('preAction', (cmd) => {
      const fmt = cmd.opts().format;
      if (!FORMAT_CHOICES.includes(fmt)) {
        throw new ConfigError(`不支持的 format: ${fmt}`);
      }
    });

  const cfg = loadConfig(program.opts().config);
  const client = createClient({ token: cfg.token, apiBase: cfg.apiBase });

  registerSearch(program, client);
  registerSubject(program, client);
  registerConfig(program);
  registerExport(program, client);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`bgm: ${msg}\n`);
  process.exit(exitCodeFor(err));
});
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 产出 `dist/index.js`，首行含 shebang

- [ ] **Step 3: 验证 `--format` 校验（错误路径）**

Run: `node dist/index.js --format xml search x`
Expected: stderr 输出 `bgm: 不支持的 format: xml`，退出码 7

- [ ] **Step 4: 验证 --help**

Run: `node dist/index.js --help`
Expected: 列出 search / subject / config / export 子命令

- [ ] **Step 5: 运行全部测试与 typecheck**

Run: `pnpm test`
Expected: 全部 PASS

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up entry point with global options and error boundary"
```

---

### Task 12: 端到端 smoke 验证

**Files:**
- 无新文件（手动验证已实现的 CLI）

**Interfaces:**
- Consumes: Task 11 产物 `dist/index.js`

- [ ] **Step 1: 构建并链接本地**

Run: `pnpm build && npm link`
Expected: `bgm` 命令全局可用

- [ ] **Step 2: smoke 测试搜索（真实 API，可选）**

Run: `bgm search "孤独摇滚" --limit 3 --format text`
Expected: 输出表格，含 id/name/date/rating 列

Run: `bgm search "孤独摇滚" --limit 3 --format json | head`
Expected: 合法 JSON

- [ ] **Step 3: smoke 测试详情**

Run: `bgm subject 326661 --format markdown`
Expected: 输出 markdown 字段表（用真实存在的 subject id，若 404 换一个）

- [ ] **Step 4: smoke 测试导出**

Run: `bgm export search "孤独摇滚" --limit 5 --max 8 --format json`
Expected: JSON 含 `exported` 和 `total` meta

- [ ] **Step 5: smoke 测试 config**

Run: `bgm config set apiBase https://api.bgm.tv/v0 && bgm config get apiBase`
Expected: 输出 `https://api.bgm.tv/v0`

- [ ] **Step 6: smoke 测试错误路径**

Run: `bgm subject 999999999`
Expected: stderr `bgm: ...`，退出码 3（404）

- [ ] **Step 7: 解除 link 并提交最终状态**

Run: `npm unlink -g bgm-cli`

Run: `pnpm typecheck && pnpm test`
Expected: 全部通过

- [ ] **Step 8: Commit（若有改动）+ tag**

```bash
git add -A
git commit -m "chore: smoke verified" --allow-empty
```

---

## Self-Review 结果

**1. Spec coverage**：逐条核对——
- 搜索/详情/导出场景 → Task 7/8/10
- 预留 token 配置 → Task 5 (config) + Task 6 (client 注入) + Task 9 (config 命令)
- 生成类型 + 手写 fetch → Task 2 + Task 6
- `--format json|text|markdown` → Task 4 + Task 11 (全局选项 + 校验)
- pnpm + npm 发布 → Task 1 (package.json bin) + Task 12 (npm link 验证)
- 纯参数式 → 所有 command 无交互
- XDG 配置 + env → Task 5
- tsup + ESM → Task 1
- string-width CJK → Task 4
- fetchWithTimeout → Task 6
- typecheck + engines → Task 1
- commander 作 devDep → Task 1
- `__tests__` 目录 → Task 4 起
- 错误分类 + 退出码映射 → Task 6 (ApiError) + Task 11 (exitCodeFor)
- stdout/stderr 分离 → Task 6-11 (stdout) + Task 11 (stderr)
- 分层测试策略 → Task 4/5/6/7-10 各对应一层

**2. Placeholder scan**：无 TBD/TODO；唯一「待核对」项是 openapi 生成类型的路径键名与字段名，已在 Task 6 Step 4 与 Task 7/8 Step 5 显式说明核对方式（这是生成类型的固有不确定性，非占位）。

**3. Type consistency**：
- `Renderable`/`Format` 在 Task 3 定义，Task 4/7/8/10 一致引用
- `Client` 在 Task 6 定义为 `ReturnType<typeof createClient>`，Task 7/8/10 一致
- `searchAction`/`subjectAction`/`configGetAction`/`configSetAction`/`exportSearchAction` 命名在定义任务与 index.ts 中一致
- `ApiError`/`ConfigError` 字段在 Task 5/6 定义，Task 11 exitCodeFor 一致引用

无遗漏。
