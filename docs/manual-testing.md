# bangumi CLI 手动测试文档

> 用于人工验证 `bgm` CLI 各功能与错误路径。所有命令均可在终端直接运行。

## 前置准备

### 1. 全局安装（开发期 link）

```bash
cd /Users/ywy/Desktop/my-project/temp-2
pnpm build
npm link
```

确认 `bgm` 可用：

```bash
which bgm
bgm --help
```

### 2. 代理配置（必需）

bangumi API 在国内需代理访问。**每个新开的终端都要设置**（或加到 `~/.zshrc`）：

```bash
export HTTPS_PROXY=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
```

快速验证代理 + CLI 链路是否通：

```bash
bgm search "test" --limit 1
```

- 能返回结果 → 链路正常
- `bgm: 网络错误` 或 `bgm: 请求超时` → 代理没通，检查 verge-mih 是否开启、节点是否可用

---

## 测试用例

### 一、搜索命令 `bgm search`

#### 1.1 基础搜索（默认 text 表格）

```bash
bgm search "孤独摇滚" --limit 5
```

**预期**：
- 输出表格，含 `id / type / name / date / score` 五列
- 返回 5 条结果（`--limit 5` 生效）
- 中日文全角字符列宽对齐正确（name 列对齐）
- 表尾有 `total: <总数>` / `limit: 5` / `offset: 0` 元信息
- 退出码 0

#### 1.2 JSON 格式（适合管道）

```bash
bgm search "孤独摇滚" --limit 3 --format json
```

**预期**：
- 输出合法 JSON，结构为 bangumi API 原始 payload `{ total, limit, offset, data: [...] }`
- `data` 含 3 条，每条含 `tags` / `infobox` / `images` / `platform` / `rating` 等完整字段
- 可管道：`bgm search "孤独摇滚" --limit 3 --format json | jq '.data[0].name'`

#### 1.3 Markdown 格式

```bash
bgm search "孤独摇滚" --limit 3 --format markdown
```

**预期**：
- 标准 markdown 表格：`| id | type | name | date | score |` + 分隔行 + 数据行

#### 1.4 排序

```bash
bgm search "孤独摇滚" --sort rank --limit 5
bgm search "孤独摇滚" --sort score --limit 5
bgm search "孤独摇滚" --sort heat --limit 5
```

**预期**：结果按对应规则排序（rank=排名、score=评分、heat=收藏数），与默认 `match`（相关度）顺序不同。

#### 1.5 按类型过滤

`--type` 接数字 ID：`1`=书籍, `2`=动画, `3`=音乐, `4`=游戏, `6`=三次元。

```bash
bgm search "孤独摇滚" --type 2 --limit 5
```

**预期**：只返回动画类型条目。

#### 1.6 翻页

```bash
bgm search "孤独摇滚" --limit 3 --offset 3
```

**预期**：返回第 2 页（跳过前 3 条），`offset: 3`。对比 `--offset 0` 结果不同。

#### 1.7 空结果

```bash
bgm search "zzzzz不存在的关键词zzzzz"
```

**预期**：
- 非错误，正常输出表头 + 空数据行
- meta 显示 `total: 0`
- 退出码 0

---

### 二、条目详情 `bgm subject`

#### 2.1 详情（字段表）

```bash
bgm subject 328609
```

**预期**：
- 输出字段表（`key / value` 两列），含 id / name / name_cn / date / type / rating / rating_count / summary
- 标题用 `name_cn`（「孤独摇滚！」），无 name_cn 时回退 name
- summary 为完整简介文本

#### 2.2 Markdown 格式

```bash
bgm subject 328609 --format markdown
```

**预期**：markdown 字段表。

#### 2.3 JSON 格式

```bash
bgm subject 328609 --format json
```

**预期**：输出单个完整 Subject 对象（`id` / `name` / `name_cn` / `date` / `type` / `rating` / `summary` / `tags` / `infobox` / `images` 等全部字段）。

---

### 三、批量导出 `bgm export search`

#### 3.1 全量翻页 + 上限保护

```bash
bgm export search "孤独摇滚" --limit 10 --max 25 --format json
```

**预期**：
- 内部自动翻页（limit=10，翻 3 页凑满 25 条）
- JSON 结构为 `{ total, data: [...] }`，`total` 是 API 真实总数（如 294），`data` 受 `--max` 截断恰好 25 条
- 每条 subject 含完整字段

#### 3.2 导出 text 格式

```bash
bgm export search "孤独摇滚" --limit 10 --max 15 --format text
```

**预期**：表格输出 15 条 + meta。

---

### 四、配置命令 `bgm config`

> 用 `XDG_CONFIG_HOME` 隔离测试，避免污染本机真实配置。

```bash
export TEST_CFG=$(mktemp -d)
```

#### 4.1 set / get apiBase

```bash
XDG_CONFIG_HOME=$TEST_CFG bgm config set apiBase https://api.bgm.tv/v0
XDG_CONFIG_HOME=$TEST_CFG bgm config get apiBase
```

**预期**：
- set 输出 `已设置 apiBase`
- get 输出 `https://api.bgm.tv/v0`

#### 4.2 set / get token（脱敏）

```bash
XDG_CONFIG_HOME=$TEST_CFG bgm config set token abcdefghijklmnop
XDG_CONFIG_HOME=$TEST_CFG bgm config get token
```

**预期**：
- get 输出 `abcd****mnop`（前 4 + 末 4，中间打码）
- 不会输出完整 token

#### 4.3 get 未知 key（宽松）

```bash
XDG_CONFIG_HOME=$TEST_CFG bgm config get typo
```

**预期**：输出空行，退出码 0（不报错）。

#### 4.4 set 未知 key（严格）

```bash
XDG_CONFIG_HOME=$TEST_CFG bgm config set bad value
```

**预期**：
- stderr 输出 `bgm: 未知配置项: bad`
- 退出码 7

#### 4.5 配置生效验证

```bash
XDG_CONFIG_HOME=$TEST_CFG bgm config set apiBase https://api.bgm.tv/v0
XDG_CONFIG_HOME=$TEST_CFG bgm search "test" --limit 1
```

**预期**：配置的 apiBase 生效，搜索正常返回。

清理：

```bash
rm -rf $TEST_CFG
```

---

### 五、全局选项与错误路径

#### 5.1 全局 `--format` 默认值

```bash
bgm search "test" --limit 1
```

**预期**：默认 text 格式（表格）。

#### 5.2 `--format` 校验

```bash
bgm --format xml search "test"
```

**预期**：
- stderr 输出 `bgm: 不支持的 format: xml`
- 退出码 7
- 不发起 API 请求（校验在 action 前拦截）

#### 5.3 `--help`

```bash
bgm --help
bgm search --help
bgm subject --help
```

**预期**：
- `bgm --help` 列出 search / subject / config / export 子命令
- 各子命令 `--help` 列出其选项

#### 5.4 404 错误

```bash
bgm subject 999999999
```

**预期**：
- stderr 输出 `bgm: <API 的 404 描述>`
- 退出码 3

#### 5.5 网络错误 / 超时

先取消代理环境变量：

```bash
unset HTTPS_PROXY HTTP_PROXY
bgm search "test" --limit 1
```

**预期**：
- stderr 输出 `bgm: 网络错误` 或 `bgm: 请求超时`
- 退出码 6

测完恢复代理：

```bash
export HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897
```

#### 5.6 stdout / stderr 分离

```bash
bgm search "孤独摇滚" --limit 2 --format json 2>/dev/null | jq '.data | length'
```

**预期**：
- `2>/dev/null` 丢弃 stderr，stdout 是纯净 JSON
- `jq` 能正常解析，输出 `2`
- 错误信息不会混入 stdout 污染管道

---

## 退出码速查

| 场景 | 退出码 |
|---|---|
| 正常成功 | 0 |
| 401 未授权（token 缺失/失效） | 2 |
| 404 未找到 | 3 |
| 其他 4xx 客户端错误 | 4 |
| 5xx 服务端错误 | 5 |
| 网络错误 / 请求超时 | 6 |
| 配置错误（解析失败 / 未知配置项 / format 非法） | 7 |
| 其他未捕获错误 | 1 |

可用 `echo $?` 查看上一条命令退出码。

---

## 常见问题

**Q: `--limit` 不生效？**
A: 已修复（v0.1.0+）。limit/offset 作为 URL query 参数发送。若仍不生效，确认 build 是最新：`pnpm build && npm link`。

**Q: 报 `bgm: 网络错误`？**
A: 代理没通。检查 `HTTPS_PROXY` 是否设置、verge-mih 是否运行、节点是否可用：`curl -x http://127.0.0.1:7897 https://api.bgm.tv/v0/subjects/1`。

**Q: macOS 下配置文件在哪？**
A: `~/Library/Preferences/bgm-cli-nodejs`（JSON）。损坏时 CLI 报 `配置文件解析失败`，删掉该文件即可重置。

**Q: `--type` 数字含义？**
A: 1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元（来自 bangumi SubjectType）。
