# bgm-cli Agent 友好性改进设计

- 日期：2026-07-21
- 分支：feat/agent-friendly
- 基于：`docs/superpowers/specs/2026-07-20-bangumi-cli-design.md`（原 CLI 设计）

## 背景与目标

当前 bgm-cli 的三种输出格式（json/text/markdown）都基于 `Renderable` 描述符，`rows` 是 command 层从 API 返回中挑出的字段子集（search 5 列、subject 8 字段、export 4 列）。AI agent 用 `--format json` 时只能拿到截断字段，拿不到 tags/infobox/images/platform/rating distribution 等完整数据。

同时项目没有任何给 AI agent 用的操作文档，agent 只能靠 `--help` 和试错。

本设计解决两项：

1. **json 输出改为 API 原始 payload**：让 AI 拿到完整数据。
2. **新增 operate skill**：让 AI agent 能安装、配置、运行 bgm-cli，并支持 `npx skills add` 发现。

## 关键决策

| 维度 | 决策 |
|---|---|
| json 语义 | `--format json` 输出 API 原始 payload（破坏性变更，项目 0.1.0 未发布，无迁移） |
| raw 字段 | `Renderable` 加 `raw?: unknown`，command 挂载原始 payload，renderer json 分支优先输出 raw |
| json 包裹 | 不包裹，直接原始 payload（search 是 `{total,data}`、subject 是单对象） |
| text/markdown | 不变，只读 columns/rows/meta/summary，raw 对它们透明 |
| skill 范围 | 只做 operate skill，不做 develop skill（项目小，develop 收益低） |
| skill 发现 | 放顶层 `skills/bgm-cli-operate/`，带 frontmatter，支持 `npx skills add yuelu-lan/bgm-cli` |

## 第 1 部分：json 语义改造

### Renderable 加字段

```ts
export interface Renderable {
  title?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  meta?: Record<string, unknown>;
  summary?: string;
  raw?: unknown;  // API 原始 payload，仅 json 格式读取
}
```

### renderer json 分支

```ts
if (fmt === 'json') {
  const payload = r.raw ?? { title: r.title ?? null, meta: r.meta ?? null, rows: r.rows, summary: r.summary ?? null };
  return JSON.stringify(payload, null, 2);
}
```

有 raw 优先输出 raw，无 raw 走旧结构兜底（防御，实际所有 command 都会挂 raw）。

### 各 command 挂载 raw

| command | raw 值 | 结构 |
|---|---|---|
| search | `result`（client.searchSubjects 返回值） | `{total, data: Subject[]}` |
| subject | `s`（client.getSubject 返回值） | 单 Subject 对象 |
| export | `{total, data: allSubjects}` | 聚合所有页的完整 Subject 数组 |

### export 改动

当前 export action 只挑 4 字段进 allRows。需额外维护 `allSubjects: Subject[]`：

- 每页 `for (const s of result.data)` 时，`allSubjects.push(s)` 同步进行
- `--max` 截断时，allSubjects 与 allRows 同步停止
- 最后 `raw: { total, data: allSubjects }`

### 影响面

- `src/format/types.ts`：加 `raw?: unknown`
- `src/format/renderer.ts`：json 分支改
- `src/commands/search.ts`、`subject.ts`、`export.ts`：return 时加 `raw`
- `src/index.ts`：format enum 不变（json|text|markdown）
- `README.md`：json 示例同步更新

## 第 2 部分：operate skill

### 目录结构

```
skills/
  bgm-cli-operate/
    SKILL.md
    references/
      install-and-auth.md
      commands.md
      troubleshooting.md
```

### SKILL.md

- **frontmatter**：`name: bgm-cli-operate`、`description`（agent 安装+运行 bgm 的场景：检测、装、配 token、search/subject/export、优先 --format json、排查代理/token/退出码）
- **Use This Skill For**：检测 `bgm` 可执行、`npm i -g` 安装、配 token（`bgm config set token`）、search/subject/export/config 操作、优先 `--format json` 给 agent 推理（配合第 1 部分，json 是完整 payload）
- **Do Not Use For**：改仓库代码（指向 README 与源码）
- **Primary Contract**：agent 只靠这个 skill 能完成「检测→装→配 token→用 --format json 跑命令→读懂退出码」
- **Default Workflow**：
  1. `bgm --help` 检测
  2. 缺则 `npm i -g bgm-cli`
  3. `bgm config set token <value>`（公开接口非必需，但建议配）
  4. 用 `bgm --format json search ...` / `bgm --format json subject <id>` 拿完整数据
- **Operational Rules**：
  - bangumi API 需代理，`HTTPS_PROXY` 环境变量
  - 公开接口匿名可调，token 预留给未来收藏管理
  - text/markdown 是人读视图，json 是 agent 接口
  - stdout 只产出数据，错误走 stderr，可 `| jq`
- **Output Expectations**：agent 回报时说清用的哪个命令、是否 --format json、退出码含义

### references/install-and-auth.md

- npm/npx 安装（`npm i -g bgm-cli`、`npx bgm-cli`）
- XDG 配置路径（`XDG_CONFIG_HOME` 优先，回退 env-paths）
- `bgm config set/get token`（get 输出打码前4末4）
- 环境变量：`BGM_ACCESS_TOKEN` 覆盖 token、`BGM_API_BASE` 覆盖 baseURL、`HTTPS_PROXY`/`HTTP_PROXY` 代理

### references/commands.md

按命令分组：

- **search**：`bgm search <keyword>` + `--type/--tag/--sort/--nsfw/--limit/--offset`。注意：`--sort rank` 加 rank 列、`--sort heat` 加 collection 列、type 数字转中文
- **subject**：`bgm subject <id>`。注意：summary 作为独立段全文显示，不进表格
- **export**：`bgm export search <keyword>`。注意：内部翻页，`--max` 上限保护
- **config**：`bgm config get/set <key> <value>`

反复强调：**agent 优先 `--format json` 拿完整 payload，text/markdown 是人看**。

### references/troubleshooting.md

退出码映射与排查：

| 退出码 | 原因 | 排查 |
|---|---|---|
| 2 | 401 未授权 | `bgm config set token <value>` |
| 3 | 404 条目不存在 | 核对 id |
| 4 | 其他 4xx | 看 stderr message |
| 5 | 5xx 服务端 | 重试 |
| 6 | 网络错误/超时 | 检查 `HTTPS_PROXY`、网络 |
| 7 | ConfigError（含 format 校验失败） | 核对 `--format` 取值、配置文件 |

## 第 3 部分：README 更新

README 加一节「Agent / Skills」：

- 说明 `npx skills add yuelu-lan/bgm-cli` 可安装 operate skill 给 agent 用
- 指向 `skills/bgm-cli-operate/SKILL.md`
- 强调 agent 用 `--format json` 拿完整数据

## 测试与验证

### json 语义改造测试

- `renderer.test.ts`：现有 json 用例改断言 raw 优先输出；加用例：有 raw 时输出 raw、无 raw 时兜底旧结构
- `commands-search.test.ts`：断言 Renderable 含 `raw`，等于 mock client 返回的完整 `SearchResult`
- `commands-subject.test.ts`：断言 `raw` 等于完整 `Subject`
- `commands-export.test.ts`：断言 `raw` 是 `{total, data: allSubjects}`，allSubjects 受 `--max` 截断同步
- text/markdown 用例不变（raw 透明）

### skill 文档验证

- 纯文档，无单测
- 核对 frontmatter 合法（name+description）+ 顶层 `skills/` 目录结构
- 可选：本地 agent 会话按 skill 跑通 `bgm --format json search "孤独摇滚" --limit 5`

### 回归

- `pnpm typecheck` 通过
- `pnpm test` 全绿
- `pnpm build` 通过
- 手动 smoke：`bgm --format json search "孤独摇滚" --limit 3` 输出完整 payload（含 tags/infobox/images），`bgm --format text subject <id>` 表格不受影响

## 非目标

- 不做 develop skill
- 不改 text/markdown 输出
- 不加新命令
- 不改 client 层（搜索/详情接口不变）
- 不做 `npx skills add` 之外的 skill 发布渠道
