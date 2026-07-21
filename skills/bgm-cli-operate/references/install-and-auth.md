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
