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
