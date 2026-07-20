# bangumi CLI 设计文档

- 日期：2026-07-20
- 技术栈：TypeScript + commander + tsup（ESM）+ undici（代理）
- 包管理：pnpm，发布到 npm
- Node 基线：`>=20`（原生 fetch / AbortController）

## 背景与目标

基于 [bangumi/api](https://github.com/bangumi/api) 提供的 OpenAPI 规范，构建一个命令行工具 `bgm`，用于搜索条目、查看条目详情、批量导出数据。

### 核心场景

1. **搜索与查看条目**：按关键词搜索，查看条目详情（简介、评分、标签等）。
2. **数据导出 / 批处理**：批量搜索、导出结果，适合脚本化与管道场景。

### 非目标（后续考虑）

- 收藏与进度管理（标记在看 / 看过 / 想看、打分、短评）。架构上预留 token 配置，但 MVP 不实现相关命令。

## 关键决策

| 维度 | 决策 |
|---|---|
| 构建 | tsup 打包 ESM（`"type": "module"`），`bin` 指向 `dist/index.js`；`skipNodeModulesBundle: true`（运行时依赖 external，不打包进 bundle）——因 esbuild 把 CJS 依赖（commander）bundle 进 ESM 时对 Node 内置模块的 require shim 会失败，故 commander/env-paths/string-width/undici 作为 dependencies，运行时从 node_modules 解析。`npm i -g` 会一并安装 |
| API 封装 | `openapi-typescript` 从 `open-api/v0.yaml` 生成类型，运行时手写 fetch 封装 |
| 认证 | 预留 token 配置（XDG 配置文件 + 环境变量），MVP 公开接口匿名可调 |
| 配置存储 | `env-paths` 解析跨平台路径，读写仍手写；env-paths v3 无 `type` 选项，`resolveConfigPath` 优先读 `XDG_CONFIG_HOME`（文件名统一 `bgm-cli-nodejs`），否则回退 `envPaths('bgm-cli').config` |
| 代理 | 读 `HTTPS_PROXY`/`HTTP_PROXY`（大小写），用 undici `ProxyAgent` + `setGlobalDispatcher` 全局生效；未设则直连 |
| 输出格式 | `--format json\|text\|markdown`，默认 text |
| CJK 对齐 | text 表格用 `string-width` 计算显示宽度（全角字符对齐） |
| 交互模式 | 纯参数式，不引入交互选择 |
| 分发 | pnpm 管理，发布到 npm，`npm i -g` 安装 |

> 说明：`bangumi/api` GitHub 仓库是 API 文档仓库（含 `open-api/v0.yaml`），npm 上不存在官方 SDK 包 `@bangumi/api`。因此采用生成类型 + 手写 fetch 的方式。

## 架构

### 模块划分

```
src/
  index.ts            # 入口：注册根命令 + 全局选项（--format, --config）
  commands/
    search.ts         # bgm search <keyword>  + 过滤/排序/分页参数
    subject.ts        # bgm subject <id>       详情
    export.ts         # bgm export <subcommand> 数据导出
    config.ts         # bgm config get/set
  api/
    client.ts         # fetch 封装：baseURL、UA、token 注入、代理（undici）、超时、错误归一化、分页
    types.ts          # openapi-typescript 从 v0.yaml 生成（不手改）
  format/
    renderer.ts       # 三个渲染器 json/text/markdown，统一接口
    types.ts          # Renderable 描述符
  config/
    load.ts           # env-paths 解析路径 + 配置文件读写 + 环境变量合并（env 优先）
  __tests__/          # 测试目录（与命令/模块并列的分层测试）
```

### 依赖方向（单向，无环）

```
index → commands → api
                 ↘ format
       config ↗ (被 commands 和 api client 共用)
```

### 关键设计点

- **命令产出「描述符」而非直接打印**：每个 command 解析参数 → 调 api → 把结果转成 `Renderable`，再交给 `renderer` 按全局 `--format` 输出。三个命令共用一套渲染逻辑，新增格式只改 format 层。
- **类型生成不进版本库手改**：`api/types.ts` 由脚本从 yaml 生成，自定义展示类型放 format 层。
- **token 作为 client 构造参数**：`createClient({ token })`，token 来源是 config；MVP 不强制 token，公开接口匿名可调，为后续收藏管理留口。
- **client 懒加载**：`index.ts` 用 Proxy 包裹 client，`loadConfig + createClient` 延迟到 client 方法首次被调用（即 command action 执行）时才执行。这样 `--help`/`--format` 校验不依赖配置文件（损坏的配置不会阻塞 `--help`），且 `--config` 全局选项此时已能读到。

## 数据流

以 `bgm search "孤独摇滚" --sort rank --type anime --limit 5 --format markdown` 为例：

1. `index.ts` 解析全局选项 → `--format=markdown` 透传到 command context。client 为 Proxy 懒加载，此时未构造。
2. `search` command action 执行，首次访问 client 方法 → 触发 `config.load()` 合并 XDG 配置 + env → `{ token?, apiBase, ... }`。
3. `createClient({ token, apiBase })` 构造带 UA / baseURL / 代理的 fetch 封装（仅首次，后续复用缓存）。
4. `search` command 解析命令参数 → keyword / sort / type / limit。
5. `api.client.searchSubjects({ keyword, sort, filter:{type}, limit, offset })` → `POST /v0/search/subjects?limit=<n>&offset=<n>`。**limit/offset 作为 URL query 参数**（bangumi API 不读 request body 里的 limit/offset），body 只放 keyword/sort/filter。透传 UA +（token if present）。
6. 返回 `{ total, data: Subject[] }`（类型来自生成层）。
7. command 把 `data` 映射成 `Renderable`（search 动态列、subject 的 summary 分离见「组件与命令」）。
8. `renderer.render(renderable, "markdown")` → 输出 markdown 表格到 stdout（若有 summary 则在表格下方追加段落）。

### 分页与导出

- `search` 的 `--offset/--limit` 直接透传，不做自动翻页（保持参数式、可预测）。
- `export` 命令内部循环翻页（`offset += limit` 直到 `offset >= total`），逐页流式渲染而非全量缓存——导出大结果集时内存可控；text / markdown 输出每页一段，json 输出合并成单个数组。

### stdout / stderr 分离

错误走 stderr，stdout 只产出数据，保证 `bgm search x | jq` 这类管道干净。

### 渲染统一接口

```ts
interface Renderable {
  title?: string;
  columns: string[];
  rows: Record<string, unknown>[];  // key 对应 columns
  meta?: Record<string, unknown>;  // total 等附加信息
  summary?: string;  // 表格下方的独立段落（如条目简介），text/markdown 在表格后输出，json 作为字段
}
type Format = 'json' | 'text' | 'markdown';
function render(r: Renderable, fmt: Format): string;
```

## 组件与命令

### 命令清单

| 命令 | 用途 | 关键参数 |
|---|---|---|
| `bgm search <keyword>` | 搜索条目 | `--type`, `--tag`, `--sort`(match/heat/rank/score), `--nsfw`, `--limit`, `--offset`, `--format` |
| `bgm subject <id>` | 查看条目详情 | `--format` |
| `bgm export search <keyword>` | 批量导出搜索结果 | 同 search，去掉 `--limit`（全量翻页），可加 `--max` 上限保护 |
| `bgm config` | 查看/设置配置（含 token） | `get <key>`, `set <key> <value>` |

**search 输出列**：固定 `id / type(中文) / name / date / score`，按 `--sort` 动态追加：`sort=rank` 加 `rank` 列、`sort=heat` 加 `collection`（收藏总数）列、`sort=score`/`match` 不加。meta 含 `total / limit / offset / sort`。type 数字转中文（2→动画、1→书籍、3→音乐、4→游戏、6→三次元）。

**subject 输出**：key/value 字段表，字段含 `id / name / name_cn / date / type / score / rank / rating_count`；`summary` 不进表格，作为 `Renderable.summary` 在表格下方独立成段全文显示（text/markdown），json 中作为 `summary` 字段。

**export 输出列**：`id / name / date / score`（不加 type，批量导出保持简洁）。

### 全局选项（根命令）

- `--format <json|text|markdown>`（默认 text）
- `--config <path>` 覆盖配置文件路径（测试与脚本用）

### api/client.ts

```ts
interface ClientOptions { token?: string; userAgent?: string; apiBase?: string; timeoutMs?: number; }
interface SearchParams {
  keyword: string;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  filter?: { type?: SubjectType[]; tag?: string[]; nsfw?: boolean };
  limit?: number; offset?: number;
}
const createClient = (opts: ClientOptions) => ({
  searchSubjects(p: SearchParams): Promise<SearchResult>,  // POST /v0/search/subjects（limit/offset 走 query）
  getSubject(id: number): Promise<Subject>,                // GET /v0/subjects/:id
});
```

- `baseURL`：`https://api.bgm.tv/v0`
- `User-Agent`：固定 `bgm-cli/<version> (https://github.com/<owner>/bgm-cli)`，`<version>` 由 tsup `define` 从 package.json 注入为 `process.env.PACKAGE_VERSION`，`<owner>` 为发布者 GitHub 账号；遵循 bangumi UA 建议
- `Authorization`：有 token 时注入 `Bearer <token>`
- **代理**：模块初始化时读 `HTTPS_PROXY`/`HTTP_PROXY`（大小写），若有则 `setGlobalDispatcher(new ProxyAgent(url))`，全局生效一次；未设则直连
- **超时**：`fetchWithTimeout` 用 `AbortController`，默认 10s，超时归一化为 `ApiError { status: 0, message: '请求超时' }`
- 响应非 2xx → 抛 `ApiError { status, code?, message }`，由 command 层捕获转 stderr

### format/renderer.ts

- `json`：`JSON.stringify({ title, meta, rows }, null, 2)`
- `text`：等宽对齐表格，列宽用 `string-width` 计算显示宽度（正确处理中日韩全角字符与 emoji）
- `markdown`：标准 markdown 表格

### config/load.ts

- 路径解析：env-paths v3 无 `type` 选项，用 `envPaths('bgm-cli')`。`resolveConfigPath` 优先读 `XDG_CONFIG_HOME`（文件名统一 `bgm-cli-nodejs`，与 env-paths Linux 分支一致，避免设/不设 XDG 时读写不同文件），否则回退 `envPaths('bgm-cli').config`（macOS 为 `~/Library/Preferences/bgm-cli-nodejs`）
- env 覆盖：`BGM_ACCESS_TOKEN` 覆盖 `token`，`BGM_API_BASE` 覆盖 baseURL（测试用）
- 配置文件 schema（JSON）：
  ```json
  { "token": "string?", "apiBase": "string?" }
  ```
- `bgm config set token xxx` 写回文件（token 字段）；`bgm config get token` 读取（敏感字段输出时打码，仅显示前 4 + 末 4 位）
- 未知 key：`get` 宽松返回空，`set` 严格抛 `ConfigError`（写操作需防误写脏数据）
- `loadConfig` 与 `saveConfig` 读取损坏文件均归一化为 `ConfigError('配置文件解析失败')`

## 错误处理

### 错误分类与来源

- `ApiError`：HTTP 非 2xx。字段 `status`、`code`（API 返回的 error code）、`message`。
- `ConfigError`：配置文件解析失败或字段非法（如 token 格式错）。
- `CliError`：参数错误（commander 自身处理）或运行期逻辑错误。
- 网络错误：fetch 抛出的 `TypeError`/`DOMException`，归一化为 `ApiError { status: 0, message: '网络错误' }`。

### 处理策略

- 全局兜底：`index.ts` 包一层 try/catch，捕获 `ApiError` / `ConfigError`，统一输出到 **stderr**（stdout 不污染），格式为 `bgm: <message>`，并以非零退出码退出。
- 退出码映射：`ApiError` 按 status 映射（401→2、404→3、其他 4xx→4、5xx→5、网络错误 status=0→6）；`ConfigError`→7。
- 不静默吞错：每个错误必须有人可读的 message，禁止空 catch。
- 边界限定：只在 fetch 层（API 边界）和 config 读取（IO 边界）做 try/catch；command 内部不重复包裹，让错误冒泡到全局兜底。
- 参数校验交给 commander（如 `--format` 取值限定 enum），不自己写校验逻辑。

### 典型场景

- 搜索无结果（200 但 `data=[]`）：不算错误，正常输出空表格 + meta `{total:0}`。
- token 缺失调用需鉴权接口（MVP 暂无，预留）：返回 401 → stderr 提示「未配置 token，运行 `bgm config set token <value>`」。
- 速率限制（429）：不自动重试（YAGNI），stderr 提示并退出。

## 测试

### 分层测试策略

| 层 | 测试重点 | 方式 |
|---|---|---|
| `api/client.ts` | 请求构造（URL、body、UA、token 头）、响应解析、错误归一化 | 用 `msw` 拦截 fetch，覆盖 200/4xx/5xx/网络错误 |
| `format/renderer.ts` | 三种格式输出正确性、空结果、特殊字符转义（markdown 的 `\|`） | 纯函数单元测试，快照或断言字符串 |
| `config/load.ts` | XDG 路径解析、env 覆盖优先级、文件缺失/损坏容错 | 临时目录 + 临时 env |
| `commands/*` | 参数 → Renderable 映射、分页透传 | 注入 mock client，断言 Renderable 结构（不测渲染） |

### 关键原则

- **不真连 bangumi API**：CI 稳定、不受速率限制影响；真实连通性靠一个手动 `bgm search smoke` 的可选集成测试，默认跳过。
- **命令层测 Renderable 而非渲染输出**：command 与 renderer 解耦的回报——command 测试只断言中间结构，renderer 单独测，避免重复。
- **错误路径必须覆盖**：4xx/5xx/网络错误各至少一个用例，验证退出码与 stderr message。

### 工具链

- 构建：`tsup`（ESM 打包，`skipNodeModulesBundle: true`，依赖 external）
- 测试框架：`vitest`
- HTTP mock：`msw`
- 代理：`undici`（ProxyAgent），运行时依赖
- 类型生成脚本：`pnpm gen:types`（`openapi-typescript` 读取 `open-api/v0.yaml`），类型漂移靠 CI 跑 `gen:types && git diff --exit-code` 守护
- npm scripts：`build`(tsup) / `dev`(tsup --watch) / `test`(vitest run) / `typecheck`(tsc --noEmit) / `gen:types`

### 不测的（YAGNI）

- commander 自身的参数解析（库已测）
- 生成的 `types.ts`（生成器职责）
- `text` 表格的像素级对齐（断言结构即可）

## 后续扩展点（不在本次实现范围）

- 收藏与进度管理命令（依赖已预留的 token 配置）
- 交互式选择模式（如需可加 `--interactive`，引入 fuzzy 库）
- 更多输出格式（csv 等，扩展 format 层即可）
