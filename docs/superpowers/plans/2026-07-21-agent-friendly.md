# bgm-cli Agent 友好性改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `--format json` 输出 API 原始 payload（AI 拿到完整数据），并新增 operate skill 让 AI agent 能安装运行 bgm-cli。

**Architecture:** Renderable 加 `raw?: unknown` 字段，command 挂载 client 返回的原始 payload，renderer json 分支优先输出 raw；text/markdown 不变。skill 放顶层 `skills/bgm-cli-operate/`，带 frontmatter，支持 `npx skills add` 发现。

**Tech Stack:** TypeScript ESM、commander、tsup、vitest、msw（沿用现有栈，无新依赖）。

## Global Constraints

- Node `>=20`，原生 fetch / AbortController
- 包管理 pnpm，构建 tsup（ESM，`skipNodeModulesBundle: true`）
- 测试 vitest + msw，命令层测 Renderable 结构（不测渲染），renderer 纯函数单测
- `Renderable` 接口定义在 `src/format/types.ts`，renderer 在 `src/format/renderer.ts`
- format 取值限定 `json | text | markdown`（`src/index.ts` 的 `FORMAT_CHOICES`，不变）
- skill 是纯文档，无测试；frontmatter 必须有 `name` + `description`
- 所有改动遵循现有代码风格：不写无意义注释、最小化修改、错误只在边界处理
- 中文回复（用户 CLAUDE.md 偏好）

---

## File Structure

**修改：**
- `src/format/types.ts` — Renderable 加 `raw?: unknown` 字段
- `src/format/renderer.ts` — json 分支优先输出 raw
- `src/commands/search.ts` — searchAction 返回时挂 `raw: result`
- `src/commands/subject.ts` — subjectAction 返回时挂 `raw: s`
- `src/commands/export.ts` — 累积 allSubjects，返回时挂 `raw: { total, data: allSubjects }`
- `src/__tests__/renderer.test.ts` — json 用例改断言 raw 优先 + 兜底
- `src/__tests__/commands-search.test.ts` — 断言 raw 等于完整 SearchResult
- `src/__tests__/commands-subject.test.ts` — 断言 raw 等于完整 Subject
- `src/__tests__/commands-export.test.ts` — 断言 raw 结构与 --max 截断
- `README.md` — json 示例更新 + 新增 Agent / Skills 节

**新建：**
- `skills/bgm-cli-operate/SKILL.md`
- `skills/bgm-cli-operate/references/install-and-auth.md`
- `skills/bgm-cli-operate/references/commands.md`
- `skills/bgm-cli-operate/references/troubleshooting.md`

---

## Task 1: Renderable 加 raw 字段 + renderer json 分支优先 raw

**Files:**
- Modify: `src/format/types.ts`
- Modify: `src/format/renderer.ts`
- Test: `src/__tests__/renderer.test.ts`

**Interfaces:**
- Produces: `Renderable.raw?: unknown`（新字段）；`render(r, 'json')` 当 `r.raw` 存在时输出 `JSON.stringify(r.raw, null, 2)`，否则输出旧结构 `{title,meta,rows,summary}` 兜底

- [ ] **Step 1: 改 renderer.test.ts 的 json 用例 + 加 raw 用例**

把 `src/__tests__/renderer.test.ts` 的 `describe('render json', ...)` 整块替换为：

```ts
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
```

同时把 `describe('render summary', ...)` 里的 `it('json includes summary field', ...)` 用例改掉——因为该用例的 Renderable 没有 raw，走兜底，summary 仍应出现在输出里。该用例**不需要改**（兜底逻辑保留 summary）。但为避免与「raw 优先」混淆，在该用例上方加一条注释行：

```ts
  // 无 raw 时 json 走兜底结构，summary 作为字段输出
  it('json includes summary field when no raw', () => {
```

即把原来 `it('json includes summary field', ...)` 的描述字符串改为 `'json includes summary field when no raw'`，函数体不变。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- renderer`
Expected: FAIL，`out.total` undefined（当前 json 输出 `{title,meta,rows,summary}` 无 raw 优先逻辑）

- [ ] **Step 3: 改 `src/format/types.ts` 加 raw 字段**

把整个文件改为：

```ts
export interface Renderable {
  title?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  meta?: Record<string, unknown>;
  summary?: string;
  raw?: unknown;
}

export type Format = 'json' | 'text' | 'markdown';
```

- [ ] **Step 4: 改 `src/format/renderer.ts` 的 json 分支**

把 `render` 函数的 json 分支（第 5-11 行）替换为：

```ts
  if (fmt === 'json') {
    const payload =
      r.raw ?? { title: r.title ?? null, meta: r.meta ?? null, rows: r.rows, summary: r.summary ?? null };
    return JSON.stringify(payload, null, 2);
  }
```

text/markdown 分支不动。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test -- renderer`
Expected: PASS（全部用例）

- [ ] **Step 6: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 7: Commit**

```bash
git add src/format/types.ts src/format/renderer.ts src/__tests__/renderer.test.ts
git commit -m "feat: render json outputs raw API payload when present"
```

---

## Task 2: search action 挂载 raw

**Files:**
- Modify: `src/commands/search.ts`
- Test: `src/__tests__/commands-search.test.ts`

**Interfaces:**
- Consumes: `Renderable.raw?: unknown`（Task 1 产出）
- Produces: `searchAction` 返回的 Renderable 含 `raw`，值为 `client.searchSubjects` 的完整返回值 `{total, limit, offset, data}`

- [ ] **Step 1: 加测试断言 raw**

在 `src/__tests__/commands-search.test.ts` 的 `describe('searchAction', ...)` 内，第一个用例（`'maps results with type column and score, adds rank column on sort=rank'`）末尾、`expect(client.searchSubjects).toHaveBeenCalledWith(...)` 之后加一行断言：

```ts
    expect(r.raw).toEqual({ total: 1, limit: 10, offset: 0, data: [{ id: 1, name: '孤独摇滚', type: 2, date: '2022-10-08', rating: { score: 8.5, rank: 23 } }] });
```

再在最后一个用例（`'empty results still produce empty Renderable with total 0'`）末尾加：

```ts
    expect(r.raw).toEqual({ total: 0, limit: 10, offset: 0, data: [] });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-search`
Expected: FAIL，`r.raw` undefined

- [ ] **Step 3: 改 `src/commands/search.ts` 挂载 raw**

把 `searchAction` 的 return 块（第 61-67 行）改为：

```ts
  return {
    title: `搜索: ${args.keyword}`,
    columns,
    rows,
    meta: { total: result.total, limit: result.limit, offset: result.offset, sort: args.sort ?? 'match' },
    raw: result,
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- commands-search`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/commands/search.ts src/__tests__/commands-search.test.ts
git commit -m "feat: search action attaches raw API payload to Renderable"
```

---

## Task 3: subject action 挂载 raw

**Files:**
- Modify: `src/commands/subject.ts`
- Test: `src/__tests__/commands-subject.test.ts`

**Interfaces:**
- Consumes: `Renderable.raw?: unknown`（Task 1 产出）
- Produces: `subjectAction` 返回的 Renderable 含 `raw`，值为 `client.getSubject` 的完整返回值（单 Subject 对象）

- [ ] **Step 1: 加测试断言 raw**

在 `src/__tests__/commands-subject.test.ts` 的第一个用例（`'maps subject detail to Renderable with summary separated'`）末尾、`expect(r.summary).toBe('summary text')` 之后加：

```ts
    expect(r.raw).toEqual({
      id: 123,
      name: '孤独摇滚',
      name_cn: '孤独摇滚',
      date: '2022-10-08',
      summary: 'summary text',
      rating: { score: 8.5, total: 5000, rank: 23 },
      type: 2,
    });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-subject`
Expected: FAIL，`r.raw` undefined

- [ ] **Step 3: 改 `src/commands/subject.ts` 挂载 raw**

把 `subjectAction` 的 return 块（第 17-23 行）改为：

```ts
  return {
    title: s.name_cn || s.name,
    columns: ['key', 'value'],
    rows: fields.map(([key, value]) => ({ key, value })),
    summary: s.summary || undefined,
    raw: s,
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- commands-subject`
Expected: PASS

- [ ] **Step 5: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: Commit**

```bash
git add src/commands/subject.ts src/__tests__/commands-subject.test.ts
git commit -m "feat: subject action attaches raw API payload to Renderable"
```

---

## Task 4: export action 累积 allSubjects 并挂载 raw

**Files:**
- Modify: `src/commands/export.ts`
- Test: `src/__tests__/commands-export.test.ts`

**Interfaces:**
- Consumes: `Renderable.raw?: unknown`（Task 1 产出）
- Produces: `exportSearchAction` 返回的 Renderable 含 `raw`，值为 `{ total, data: allSubjects }`，allSubjects 是所有页累积的完整 Subject 数组，受 `--max` 截断同步

- [ ] **Step 1: 加测试断言 raw 结构与截断**

在 `src/__tests__/commands-export.test.ts` 的第一个用例（`'paginates until total reached and merges rows'`）末尾加：

```ts
    expect(r.raw).toEqual({ total: 25, data: expect.arrayContaining([...Array.from({ length: 25 }, (_, i) => expect.objectContaining({ id: i }))]) });
    expect((r.raw as { data: unknown[] }).data).toHaveLength(25);
```

在第二个用例（`'respects --max cap'`）末尾加：

```ts
    expect((r.raw as { data: unknown[] }).data).toHaveLength(25);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- commands-export`
Expected: FAIL，`r.raw` undefined

- [ ] **Step 3: 改 `src/commands/export.ts` 累积 allSubjects 并挂载 raw**

把 `exportSearchAction` 的循环与 return 块（第 27-55 行）替换为：

```ts
  const allRows: Record<string, unknown>[] = [];
  const allSubjects: unknown[] = [];
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
      allRows.push({ id: s.id, name: s.name, date: s.date ?? '', score: s.rating?.score ?? '' });
      allSubjects.push(s);
      if (cap !== undefined && allRows.length >= cap) break;
    }
    offset += limit;
    if (offset >= total) break;
    if (cap !== undefined && allRows.length >= cap) break;
  }

  return {
    title: `导出: ${args.keyword}`,
    columns: ['id', 'name', 'date', 'score'],
    rows: allRows,
    meta: { total, exported: allRows.length },
    raw: { total, data: allSubjects },
  };
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
git commit -m "feat: export action attaches raw aggregated payload to Renderable"
```

---

## Task 5: 全量回归（typecheck + test + build + smoke）

**Files:**
- 无修改（验证 task）

**Interfaces:**
- Consumes: Task 1-4 全部产出

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: 全绿（33+ 用例，含新增 raw 断言）

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 3: build**

Run: `pnpm build`
Expected: 成功生成 `dist/index.js`

- [ ] **Step 4: smoke 验证 json 输出完整 payload（需代理）**

Run: `HTTPS_PROXY=http://127.0.0.1:7897 node dist/index.js --format json search "孤独摇滚" --limit 2 | head -40`
Expected: 输出 JSON，含 `total`、`data` 数组，每个 subject 含 `tags`、`infobox`、`images`、`platform` 等完整字段（而非旧的 `{title,meta,rows}`）

- [ ] **Step 5: smoke 验证 text 不受影响**

Run: `HTTPS_PROXY=http://127.0.0.1:7897 node dist/index.js --format text subject 348335`
Expected: 表格正常输出（id/name/score 等列），summary 独立段，与改造前一致

- [ ] **Step 6: 无新 commit（本 task 仅验证）**

若 smoke 发现问题，回对应 task 修；通过则进入 Task 6。

---

## Task 6: 新建 operate skill — SKILL.md

**Files:**
- Create: `skills/bgm-cli-operate/SKILL.md`

**Interfaces:**
- Produces: skill 入口文件，frontmatter（name + description）+ Use/Do Not/Workflow/Rules/Output Expectations，供 `npx skills add` 发现

- [ ] **Step 1: 写 `skills/bgm-cli-operate/SKILL.md`**

完整内容：

```markdown
---
name: bgm-cli-operate
description: Use when an agent needs to install and run the bgm Bangumi CLI — detect the executable, install via npm, configure auth token, run search/subject/export/config commands, prefer --format json for complete API payloads, and troubleshoot proxy/token/exit-code issues.
---

# bgm-cli Operate

This is the published end-user skill for `bgm-cli`.

Use it when the task is to operate `bgm` for a user, including first-time installation and setup.

## Use This Skill For

- detecting whether `bgm` is available (`bgm --help`)
- installing `bgm-cli` via `npm i -g bgm-cli` or `npx bgm-cli`
- configuring the Bangumi access token (`bgm config set token <value>`)
- running `search`, `subject`, `export`, `config` commands
- preferring `--format json` for agent consumption (json outputs the complete raw API payload)
- troubleshooting proxy, token, and exit-code issues

## Do Not Use This Skill For

- editing the `bgm-cli` repository itself (see README and source)
- changing command behavior or output contracts
- collection / progress management (not yet implemented; token is reserved for future use)

## Primary Contract

An agent using only this skill should be able to:

1. detect the usable executable
2. install `bgm-cli` if missing
3. bring the user to a usable auth state (token optional for public endpoints)
4. run the requested task with the narrowest correct command
5. read exit codes and report failures plainly

## Default Workflow

### 1. Detect the executable

```bash
bgm --help
```

If missing, install:

```bash
npm i -g bgm-cli
# or one-off:
npx bgm-cli --help
```

### 2. Configure auth (optional for public endpoints)

Public search/subject/export endpoints work anonymously. Configure a token only if needed or for future collection features:

```bash
bgm config set token <your_access_token>
bgm config get token
```

### 3. Prefer --format json for complete data

`--format json` outputs the raw API payload (complete fields: tags, infobox, images, platform, rating distribution, etc.). `text` / `markdown` are human-readable truncated views.

```bash
bgm --format json search "孤独摇滚" --limit 5
bgm --format json subject 348335
bgm --format json export search "孤独摇滚" --max 50
```

stdout carries only data; errors go to stderr, so `| jq` pipelines stay clean.

## Operational Rules

- Bangumi API requires a proxy in some regions; set `HTTPS_PROXY` (e.g. `HTTPS_PROXY=http://127.0.0.1:7897`) if direct connection fails.
- Public endpoints are anonymous; the token is reserved for future collection/progress management.
- `text` / `markdown` are human views with truncated columns; `json` is the agent interface with complete payloads.
- stdout = data only, stderr = errors; safe to pipe (`bgm --format json search x | jq '.data[]'`).
- `--limit` / `--offset` pass through to the API (no auto-pagination in `search`); `export` auto-paginates internally with an optional `--max` cap.

## Exit Codes

See `references/troubleshooting.md` for the full mapping. Key codes: 2 = 401 unauthorized, 3 = 404 not found, 6 = network/timeout, 7 = config error (incl. invalid `--format`).

## Output Expectations

When reporting back, always say:

- which command was run
- whether `--format json` was used
- the exit code if non-zero
- what could not be completed (missing token, network, unsupported scope)

## References

- `references/install-and-auth.md`
- `references/commands.md`
- `references/troubleshooting.md`
```

- [ ] **Step 2: Commit**

```bash
git add skills/bgm-cli-operate/SKILL.md
git commit -m "docs: add bgm-cli-operate skill entry"
```

---

## Task 7: 新建 references/install-and-auth.md

**Files:**
- Create: `skills/bgm-cli-operate/references/install-and-auth.md`

- [ ] **Step 1: 写文件**

完整内容：

```markdown
# Install & Auth

## Installation

Install globally via npm:

```bash
npm i -g bgm-cli
```

Or run one-off without installing:

```bash
npx bgm-cli --help
```

Requires Node `>=20`.

## Config File Location

`bgm` stores config at a cross-platform path resolved via `env-paths`:

- If `XDG_CONFIG_HOME` is set: `$XDG_CONFIG_HOME/bgm-cli-nodejs`
- Otherwise macOS: `~/Library/Preferences/bgm-cli-nodejs`
- Otherwise Linux: `~/.config/bgm-cli-nodejs`

Override the path with the global `--config <path>` flag:

```bash
bgm --config /tmp/bgm.json config get token
```

Config file schema (JSON):

```json
{ "token": "string?", "apiBase": "string?" }
```

## Token Management

Set the Bangumi access token:

```bash
bgm config set token <your_access_token>
```

Read it back (masked — first 4 + last 4 characters shown, middle replaced):

```bash
bgm config get token
```

Public search/subject/export endpoints work without a token. The token is reserved for future collection/progress management.

## Environment Variables

| Variable | Purpose |
|---|---|
| `BGM_ACCESS_TOKEN` | Overrides `token` in config file |
| `BGM_API_BASE` | Overrides default base URL `https://api.bgm.tv/v0` (testing) |
| `HTTPS_PROXY` / `HTTP_PROXY` | Proxy for bangumi API access (read case-insensitively) |

Example with proxy:

```bash
HTTPS_PROXY=http://127.0.0.1:7897 bgm --format json search "孤独摇滚" --limit 5
```

## Unknown Config Keys

- `bgm config get <unknown>` returns empty (lenient).
- `bgm config set <unknown> <value>` throws a ConfigError (strict, prevents writing dirty data).
```

- [ ] **Step 2: Commit**

```bash
git add skills/bgm-cli-operate/references/install-and-auth.md
git commit -m "docs: add install-and-auth reference"
```

---

## Task 8: 新建 references/commands.md

**Files:**
- Create: `skills/bgm-cli-operate/references/commands.md`

- [ ] **Step 1: 写文件**

完整内容：

```markdown
# Command Reference

This reference is for agents operating `bgm-cli`.

## Preferred Patterns

- prefer `bgm --format json <command...>` for reads — json outputs the complete raw API payload
- prefer exact subject IDs over keyword search when known
- keep search result sets small (`--limit`) when exploring
- `text` / `markdown` are human-readable truncated views; `json` is the agent interface

## Global Options

```bash
bgm -f, --format <json|text|markdown>   # default: text
bgm -c, --config <path>                 # override config file path
```

## search

```bash
bgm search <keyword> [--type <id...>] [--tag <tag...>] [--sort match|heat|rank|score] [--nsfw [bool]] [--limit n] [--offset n] [--format json]
```

Examples:

```bash
bgm --format json search "孤独摇滚" --limit 5
bgm --format json search "EVA" --type 2 --sort rank --limit 10
```

Notes:

- `--type` filters by subject type id (2=动画, 1=书籍, 3=音乐, 4=游戏, 6=三次元)
- `--sort rank` adds a `rank` column (text/markdown); `--sort heat` adds a `collection` column; `match`/`score` add none
- `--limit` / `--offset` pass through to the API (no auto-pagination)
- `--format json` returns `{ total, data: Subject[] }` with complete fields per subject

## subject

```bash
bgm subject <id> [--format json]
```

Examples:

```bash
bgm --format json subject 348335
bgm --format text subject 348335
```

Notes:

- In `text` / `markdown`, `summary` is shown as a separate paragraph below the field table (not crammed into a cell)
- In `--format json`, the complete Subject object is returned (id, name, name_cn, date, type, rating, summary, tags, infobox, images, platform, etc.)

## export

```bash
bgm export search <keyword> [--type <id...>] [--tag <tag...>] [--sort ...] [--nsfw [bool]] [--limit n] [--max n] [--format json]
```

Examples:

```bash
bgm --format json export search "孤独摇滚" --max 50
```

Notes:

- Auto-paginates internally (`offset += limit` until `offset >= total`)
- `--max` caps total rows to protect against huge result sets
- `--format json` returns `{ total, data: Subject[] }` with all accumulated subjects (complete fields)
- `text` / `markdown` output `id / name / date / score` columns only (no `type` column — batch export stays concise)

## config

```bash
bgm config get <key>
bgm config set <key> <value>
```

Examples:

```bash
bgm config set token <your_access_token>
bgm config get token        # masked output
bgm config get apiBase
```

Notes:

- `token` output is masked (first 4 + last 4 characters)
- Unknown keys: `get` returns empty, `set` throws ConfigError
```

- [ ] **Step 2: Commit**

```bash
git add skills/bgm-cli-operate/references/commands.md
git commit -m "docs: add commands reference"
```

---

## Task 9: 新建 references/troubleshooting.md

**Files:**
- Create: `skills/bgm-cli-operate/references/troubleshooting.md`

- [ ] **Step 1: 写文件**

完整内容：

```markdown
# Troubleshooting

## Exit Code Mapping

`bgm` exits non-zero on failure. Error messages go to stderr (`bgm: <message>`); stdout stays clean.

| Exit code | Cause | Troubleshooting |
|---|---|---|
| 1 | Unexpected error | Read stderr message |
| 2 | 401 Unauthorized | `bgm config set token <value>` |
| 3 | 404 Not Found | Verify the subject id |
| 4 | Other 4xx client error | Read stderr message |
| 5 | 5xx server error | Retry after a moment |
| 6 | Network error / timeout (10s) | Check `HTTPS_PROXY` and connectivity |
| 7 | ConfigError (incl. invalid `--format`) | Verify `--format` value, check config file |

## Common Issues

### Connection fails / network error (exit 6)

Bangumi API may require a proxy. Set the proxy environment variable:

```bash
HTTPS_PROXY=http://127.0.0.1:7897 bgm --format json search "孤独摇滚" --limit 5
```

`bgm` reads `HTTPS_PROXY` / `HTTP_PROXY` (case-insensitively) and applies the proxy globally via undici `ProxyAgent`.

### 401 Unauthorized (exit 2)

Public search/subject/export endpoints work anonymously. A 401 means a protected endpoint was hit without a valid token:

```bash
bgm config set token <your_access_token>
bgm config get token   # verify it was saved (masked)
```

### 404 Not Found (exit 3)

The subject id does not exist. Verify with search first:

```bash
bgm --format json search "keyword" --limit 5
```

### Invalid --format (exit 7)

`--format` must be one of `json`, `text`, `markdown`:

```bash
bgm --format jsonl search x   # exit 7, stderr: 不支持的 format: jsonl
```

### Config file parse failure (exit 7)

If the config file is corrupt JSON, `bgm` reports `配置文件解析失败`. Fix or remove the file at the path shown by `bgm config get` (or override with `--config <path>` to a fresh file).

### Request timeout (exit 6)

Default timeout is 10s. For slow connections, ensure the proxy is fast and reachable. Timeout is normalized to `ApiError { status: 0, message: '请求超时' }` → exit 6.
```

- [ ] **Step 2: Commit**

```bash
git add skills/bgm-cli-operate/references/troubleshooting.md
git commit -m "docs: add troubleshooting reference"
```

---

## Task 10: README 更新（json 示例 + Agent / Skills 节）

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 读当前 README 找 json 示例与结构**

Run: `cat README.md`（或用 Read 工具）
找到所有 `--format json` 示例的位置，以及合适的插入点（末尾或「使用」节之后）放 Agent / Skills 节。

- [ ] **Step 2: 更新 json 示例**

把 README 里现有的 `--format json` 示例输出说明从「`{title, meta, rows}` 结构」改为「API 原始 payload」。具体改法依当前 README 行文调整，要点：

- 若示例展示了 json 输出结构，改为说明「json 输出 bangumi API 的完整原始 payload（含 tags/infobox/images 等全部字段）」
- 保留 text/markdown 示例不变

- [ ] **Step 3: 加 Agent / Skills 节**

在 README 合适位置（推荐末尾，License 之前）加一节：

```markdown
## Agent / Skills

`bgm-cli` ships an agent skill under `skills/bgm-cli-operate/` for AI agents that need to install and operate the CLI. Install it with:

```bash
npx skills add yuelu-lan/bgm-cli
```

The skill covers executable detection, installation, auth configuration, command reference, and troubleshooting. Agents should prefer `--format json` to get complete API payloads (the `json` format outputs the raw bangumi API response with all fields).
```

- [ ] **Step 4: 验证 README 渲染（可选）**

Run: `head -5 README.md && grep -c 'skills' README.md`
Expected: 能看到 skills 相关内容已加入

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README json examples and add Agent/Skills section"
```

---

## Task 11: 最终验证

**Files:**
- 无修改（验证 task）

- [ ] **Step 1: 全量测试 + typecheck + build**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: 全绿 + typecheck 通过 + build 成功

- [ ] **Step 2: 核对 skill 目录结构**

Run: `find skills -type f | sort`
Expected:
```
skills/bgm-cli-operate/SKILL.md
skills/bgm-cli-operate/references/commands.md
skills/bgm-cli-operate/references/install-and-auth.md
skills/bgm-cli-operate/references/troubleshooting.md
```

- [ ] **Step 3: 核对 frontmatter**

Run: `head -5 skills/bgm-cli-operate/SKILL.md`
Expected: 包含 `name: bgm-cli-operate` 和 `description:` 两行

- [ ] **Step 4: smoke 端到端（需代理）**

Run: `HTTPS_PROXY=http://127.0.0.1:7897 node dist/index.js --format json search "孤独摇滚" --limit 1 | python3 -c "import sys,json; d=json.load(sys.stdin); print('total=',d['total']); print('first subject keys=',list(d['data'][0].keys()))"`
Expected: 输出 total 与 first subject 的字段列表（应含 name/tags/images/infobox 等完整字段）

- [ ] **Step 5: 无新 commit（本 task 仅验证）**

全部通过则分支完成，可进入 finishing-a-development-branch。
