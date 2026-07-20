# Task 12: API Client 代理支持

## Fix: 代理支持

### 背景
`src/api/client.ts` 使用 Node 原生 `fetch`，不读取 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量。用户环境必须走代理（`http://127.0.0.1:7897`）才能访问 bangumi API，否则 10s 超时（exit 6）。

### 方案
在 `src/api/client.ts` 中通过 undici 的 `ProxyAgent` + `setGlobalDispatcher` 注入全局代理 dispatcher：

1. 模块顶层引入 `import { ProxyAgent, setGlobalDispatcher } from 'undici'`
2. 新增 `ensureProxyDispatcher()`，读取 `process.env.HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy`（大小写兼容）
3. 若存在代理 URL，调用 `setGlobalDispatcher(new ProxyAgent(proxyUrl))`；否则保持直连
4. 用 `proxyConfigured` 模块级 flag 保证全局副作用只执行一次
5. 在 `request()` 入口调用 `ensureProxyDispatcher()`
6. 保持 `fetchWithTimeout` 的 AbortController 超时逻辑不变

### 与任务背景的偏差
任务背景称"undici 是 Node 内置模块，无需新增依赖"。实际验证（Node v24.14.0）：Node 内部虽基于 undici 实现全局 `fetch`，但 `undici` 并非可导入的内置模块名，`import 'undici'` 会报 `Cannot find package 'undici'`。因此将 `undici` 作为正式 dependency 安装（`pnpm add undici`，版本 8.7.0）。这是 Node 生态标准方案，且 `package.json` engines 要求 `node>=20`，undici 作为依赖轻量合理。

### 测试结果
- `pnpm test -- client`：7 文件 33 测试全过（含超时测试，msw 未受影响，因为测试环境未设 HTTPS_PROXY，`ensureProxyDispatcher` 仅置 flag 不设 dispatcher）
- `pnpm typecheck`：通过
- `pnpm build`：成功

### 修改文件
- `src/api/client.ts`：新增代理 dispatcher 初始化逻辑
- `package.json` / `pnpm-lock.yaml`：新增 `undici` 依赖

## Smoke 验证

### 真实代理验证
命令：
```
export HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897
node dist/index.js search "孤独摇滚" --limit 3 --format text
```

输出（摘要）：
```
id      name                                           date        rating
------  ---------------------------------------------  ----------  ------
241088  ぼっち・ざ・ろっく！                           2019-02-27  7.4
328609  ぼっち・ざ・ろっく！                           2022-10-08  8.4
436747  ぼっち・ざ・ろっく！外伝 廣井きくりの深酒日記  2024-02-01  7.6
...（共 10 条）
total: 294
limit: 10
offset: 0
```

结果：成功返回搜索结果表格，未超时。代理支持生效。

## Final Review Fix

针对 whole-branch review 提出的 3 个 Important 项的修复。

### 修复项 1：XDG 分支文件名不一致

**实测决策**：在 macOS 上实测 env-paths v3 对 `XDG_CONFIG_HOME` 的行为：
```
XDG_CONFIG_HOME=/tmp/test node -e "import('env-paths').then(m=>console.log(m.default('bgm-cli').config)"
# 输出：/Users/ywy/Library/Preferences/bgm-cli-nodejs（无视 XDG）
```
env-paths v3 在 macOS 上**不读 XDG_CONFIG_HOME**，始终走 `~/Library/Preferences/<name>-nodejs`。因此若删除 resolveConfigPath 的 XDG 特判，现有测试（靠设 `XDG_CONFIG_HOME` 做隔离）会写到真实 `~/Library/Preferences/bgm-cli-nodejs` 污染本机。

故采用方案 B：**保留 XDG 特判，但把文件名从 `'bgm-cli'` 改为 `'bgm-cli-nodejs'`**，与 env-paths 的 Linux 分支文件名一致。这样：
- macOS 设 XDG（测试场景）：`$XDG_CONFIG_HOME/bgm-cli-nodejs`（特判路径）
- macOS 不设 XDG：`~/Library/Preferences/bgm-cli-nodejs`（env-paths）
- Linux 设 XDG：`$XDG_CONFIG_HOME/bgm-cli-nodejs`（特判）== env-paths 路径
- Linux 不设 XDG：`$HOME/.config/bgm-cli-nodejs`（env-paths）

set 和 get 在所有平台都读写同一文件。测试隔离性不变。

**改动文件**：`src/config/load.ts`（`resolveConfigPath` 一行）。

### 修复项 2：saveConfig 读损坏文件未包 ConfigError

`saveConfig` 的 `JSON.parse(readFileSync(...))` 未 try/catch，文件损坏时抛裸 `SyntaxError`，退出码变 1 而非 7。

**修法**：与 `loadConfig` 对称，包 try/catch 抛 `ConfigError('配置文件解析失败')`。

**改动文件**：`src/config/load.ts`（`saveConfig` 函数体）。

### 修复项 3：UA 硬编码版本

`DEFAULT_UA = 'bgm-cli/0.1.0 (...)'` 硬编码，spec 要求取 package.json。

**修法**：用 tsup `define` 在构建时注入版本号：
- `tsup.config.ts`：`import pkg from './package.json' with { type: 'json' }`（tsconfig 已启用 `resolveJsonModule`），加 `define: { 'process.env.PACKAGE_VERSION': JSON.stringify(pkg.version) }`
- `src/api/client.ts`：`const PKG_VERSION = process.env.PACKAGE_VERSION ?? '0.0.0-dev';`，UA 模板 `bgm-cli/${PKG_VERSION} (...)`

构建后 dist 中 `PKG_VERSION = "0.1.0"` 被正确注入。client.test.ts 只校验 `/^bgm-cli\//` 前缀，不受影响。

**改动文件**：`tsup.config.ts`、`src/api/client.ts`。

### 验证结果

| 验证项 | 结果 |
|---|---|
| `pnpm test` | 33/33 通过（config 10、commands-config 4、client 7 等全过） |
| `pnpm typecheck` | 通过 |
| `pnpm build` | 成功，dist/index.js 11.20 KB |
| 代理验证 `HTTPS_PROXY=http://127.0.0.1:7897 node dist/index.js search "孤独摇滚" --limit 1` | 正常返回 10 条结果（API 未拒绝 UA） |
| dist 中 UA 版本 | `var PKG_VERSION = "0.1.0";` 注入成功，运行时 UA = `bgm-cli/0.1.0 (https://github.com/yuelu-lan/bgm-cli)` |

三项全部修好。
