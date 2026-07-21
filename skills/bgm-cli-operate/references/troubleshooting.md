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
