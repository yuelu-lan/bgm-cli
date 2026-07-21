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
