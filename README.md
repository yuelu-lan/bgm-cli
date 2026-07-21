# bgm-cli

[![npm version](https://img.shields.io/npm/v/bgm-cli)](https://www.npmjs.com/package/bgm-cli)

Bangumi（番组计划）命令行工具。搜索条目、查看详情、批量导出，支持 `json` / `text` / `markdown` 三种输出格式，适合交互查询与脚本管道。

## 特性

- 🔍 **搜索条目**：按关键词、类型、标签、排序搜索
- 📋 **条目详情**：查看评分、排名、简介等完整信息
- 📤 **批量导出**：自动翻页导出搜索结果，支持上限保护
- 🎨 **三种输出**：`text`（默认，CJK 自动对齐表格）/ `json`（管道友好）/ `markdown`
- 🌐 **代理支持**：读取 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量
- 🔧 **配置管理**：XDG 标准配置路径，token 脱敏显示

## 安装

```bash
npm install -g bgm-cli
```

需要 Node.js >= 20。

## 代理配置

bangumi API 在部分地区需代理访问。设置环境变量后 CLI 会自动走代理：

```bash
export HTTPS_PROXY=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
```

可加到 `~/.zshrc` 或 `~/.bashrc` 持久生效。未设置则直连。

## 快速开始

```bash
# 搜索（默认 text 表格，中日韩全角字符自动对齐）
bgm search "孤独摇滚" --limit 5

# 查看条目详情
bgm subject 328609

# 批量导出（自动翻页，--max 限制条数）
bgm export search "孤独摇滚" --limit 10 --max 30 --format json
```

## 命令参考

### `bgm search <keyword>`

搜索条目。

```bash
bgm search "孤独摇滚" --sort rank --type 2 --limit 5
```

**选项：**

| 选项 | 说明 |
|---|---|
| `-s, --sort <sort>` | 排序规则：`match`（默认，相关度）/ `rank`（排名）/ `score`（评分）/ `heat`（收藏数） |
| `-t, --type <type...>` | 条目类型 ID，多值（见下表） |
| `--tag <tag...>` | 标签筛选（且关系） |
| `--nsfw [bool]` | 是否包含 NSFW 内容 |
| `-l, --limit <n>` | 每页数量（默认 10） |
| `-o, --offset <n>` | 偏移量（默认 0，用于翻页） |
| `-f, --format <format>` | 输出格式：`text` / `json` / `markdown`（默认 text） |

**输出列**：`id / type / name / date / score`，按 `--sort` 动态追加：

- `sort=rank` → 加 `rank` 列
- `sort=heat` → 加 `collection` 列（收藏总数）
- `sort=score` / `match` → 不追加

**条目类型：**

| ID | 类型 |
|---|---|
| 1 | 书籍 |
| 2 | 动画 |
| 3 | 音乐 |
| 4 | 游戏 |
| 6 | 三次元 |

### `bgm subject <id>`

查看条目详情。

```bash
bgm subject 328609 --format markdown
```

输出字段表（`id / name / name_cn / date / type / score / rank / rating_count`），`summary` 在表格下方独立成段全文显示。

### `bgm export search <keyword>`

批量导出搜索结果（自动翻页）。

```bash
bgm export search "孤独摇滚" --limit 10 --max 30 --format json
```

与 `search` 相同的筛选/排序选项，外加：

| 选项 | 说明 |
|---|---|
| `-l, --limit <n>` | 每页数量（用于翻页，非总量） |
| `--max <n>` | 导出总数上限 |

输出列：`id / name / date / score`，meta 含 `total`（总匹配数）和 `exported`（实际导出数）。

### `bgm config`

查看或设置配置。

```bash
bgm config get apiBase
bgm config set token <your-access-token>
bgm config get token        # 脱敏显示：abcd****mnop
```

**配置项：**

| key | 说明 |
|---|---|
| `token` | bangumi access token（显示时脱敏，前 4 + 末 4） |
| `apiBase` | API 基址（默认 `https://api.bgm.tv/v0`） |

- `get` 未知 key 返回空（宽松）
- `set` 未知 key 报错（严格）

## 全局选项

```bash
bgm --format json search "test"
bgm --config /path/to/config.json search "test"
```

| 选项 | 说明 |
|---|---|
| `-f, --format <format>` | 全局输出格式：`text` / `json` / `markdown`（默认 text） |
| `-c, --config <path>` | 指定配置文件路径 |

## 输出格式

### text（默认）

等宽对齐表格，列宽用 [`string-width`](https://www.npmjs.com/package/string-width) 计算显示宽度，正确处理中日韩全角字符：

```
id      type  name                  date        score
------  ----  --------------------  ----------  -----
328609  动画  ぼっち・ざ・ろっく！  2022-10-08  8.4
```

### json

输出 bangumi API 的完整原始 payload（含 `tags` / `infobox` / `images` / `platform` / `rating` 等全部字段），适合管道处理：

```bash
bgm search "孤独摇滚" --limit 3 --format json | jq '.data[0].name'
```

### markdown

标准 markdown 表格，适合粘贴到文档。

## stdout / stderr 分离

数据输出走 stdout，错误信息走 stderr，保证管道干净：

```bash
# stderr 丢弃，stdout 是纯净 JSON
bgm search "孤独摇滚" --format json 2>/dev/null | jq '.data | length'
```

## 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 成功 |
| 2 | 401 未授权（token 缺失或失效） |
| 3 | 404 未找到 |
| 4 | 其他 4xx 客户端错误 |
| 5 | 5xx 服务端错误 |
| 6 | 网络错误或请求超时 |
| 7 | 配置错误（解析失败 / 未知配置项 / format 非法） |
| 1 | 其他未捕获错误 |

```bash
bgm subject 999999999
echo $?   # 3
```

## 配置文件

- **路径**：遵循 XDG 规范。macOS 为 `~/Library/Preferences/bgm-cli-nodejs`，Linux 为 `$XDG_CONFIG_HOME/bgm-cli-nodejs`
- **格式**：JSON

```json
{
  "token": "your-access-token",
  "apiBase": "https://api.bgm.tv/v0"
}
```

**环境变量覆盖**（优先级高于配置文件）：

| 变量 | 说明 |
|---|---|
| `BGM_ACCESS_TOKEN` | 覆盖 `token` |
| `BGM_API_BASE` | 覆盖 `apiBase`（测试用） |
| `HTTPS_PROXY` / `HTTP_PROXY` | 代理地址 |

## 开发

```bash
pnpm install          # 安装依赖
pnpm gen:types        # 从 open-api/v0.yaml 重新生成类型
pnpm test             # 运行测试
pnpm typecheck        # 类型检查
pnpm build            # 构建 dist/
pnpm dev              # watch 模式构建
```

本地调试：

```bash
pnpm build
npm link              # 全局链接 bgm 命令
bgm --help
```

类型基于 [bangumi/api](https://github.com/bangumi/api) 的 OpenAPI 规范，由 [`openapi-typescript`](https://www.npmjs.com/package/openapi-typescript) 生成。

## 技术栈

- [TypeScript](https://www.typescriptlang.org/) + [commander](https://www.npmjs.com/package/commander)
- [tsup](https://www.npmjs.com/package/tsup) 构建（ESM）
- [vitest](https://www.npmjs.com/package/vitest) + [msw](https://www.npmjs.com/package/msw) 测试
- [undici](https://www.npmjs.com/package/undici) 代理支持
- [string-width](https://www.npmjs.com/package/string-width) CJK 对齐
- [env-paths](https://www.npmjs.com/package/env-paths) 跨平台配置路径

## Agent / Skills

`bgm-cli` ships an agent skill under `skills/bgm-cli-operate/` for AI agents that need to install and operate the CLI. Install it with:

```bash
npx skills add yuelu-lan/bgm-cli
```

The skill covers executable detection, installation, auth configuration, command reference, and troubleshooting. Agents should prefer `--format json` to get complete API payloads (the `json` format outputs the raw bangumi API response with all fields).

## License

MIT
