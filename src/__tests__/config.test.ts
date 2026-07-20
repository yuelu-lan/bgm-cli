import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, maskToken } from '../config/load.js';

let dir: string;
const origEnv = { ...process.env };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bgm-cfg-'));
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.BGM_ACCESS_TOKEN;
  delete process.env.BGM_API_BASE;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const k of ['XDG_CONFIG_HOME', 'BGM_ACCESS_TOKEN', 'BGM_API_BASE']) {
    if (k in origEnv) process.env[k] = origEnv[k];
    else delete process.env[k];
  }
});

describe('loadConfig', () => {
  it('returns defaults when no file', () => {
    const cfg = loadConfig();
    expect(cfg.token).toBeUndefined();
    expect(cfg.apiBase).toBe('https://api.bgm.tv/v0');
  });

  it('reads token from file', () => {
    const path = loadConfig().configPath;
    writeFileSync(path, JSON.stringify({ token: 'file-token' }));
    const cfg = loadConfig();
    expect(cfg.token).toBe('file-token');
  });

  it('env BGM_ACCESS_TOKEN overrides file', () => {
    const path = loadConfig().configPath;
    writeFileSync(path, JSON.stringify({ token: 'file-token' }));
    process.env.BGM_ACCESS_TOKEN = 'env-token';
    expect(loadConfig().token).toBe('env-token');
  });

  it('env BGM_API_BASE overrides default', () => {
    process.env.BGM_API_BASE = 'https://test.local/v0';
    expect(loadConfig().apiBase).toBe('https://test.local/v0');
  });

  it('throws ConfigError on corrupt file', async () => {
    const path = loadConfig().configPath;
    writeFileSync(path, '{ not json');
    await expect(() => loadConfig()).toThrow(/配置文件解析失败/);
  });
});

describe('saveConfig', () => {
  it('writes token to file and round-trips', () => {
    saveConfig({ token: 'new-token' });
    expect(loadConfig().token).toBe('new-token');
  });

  it('merges with existing keys', () => {
    saveConfig({ token: 'a' });
    saveConfig({ apiBase: 'https://x.local/v0' });
    const cfg = loadConfig();
    expect(cfg.token).toBe('a');
    expect(cfg.apiBase).toBe('https://x.local/v0');
  });
});

describe('maskToken', () => {
  it('masks middle of long token', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('abcd****ijkl');
  });
  it('fully masks short token', () => {
    expect(maskToken('abc')).toBe('****');
  });
  it('returns undefined for undefined', () => {
    expect(maskToken(undefined)).toBeUndefined();
  });
});
