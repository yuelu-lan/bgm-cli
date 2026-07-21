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
