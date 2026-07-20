import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configGetAction, configSetAction } from '../commands/config.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bgm-cfg-'));
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.BGM_ACCESS_TOKEN;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('configSetAction / configGetAction', () => {
  it('set then get token (masked)', async () => {
    await configSetAction('token', 'abcdefghijklmnop');
    const out = await configGetAction('token');
    expect(out).toBe('abcd****mnop');
  });

  it('get apiBase returns resolved base', async () => {
    await configSetAction('apiBase', 'https://custom.local/v0');
    const out = await configGetAction('apiBase');
    expect(out).toBe('https://custom.local/v0');
  });

  it('get unknown key returns empty', async () => {
    const out = await configGetAction('nope');
    expect(out).toBe('');
  });

  it('set rejects unknown key', async () => {
    await expect(configSetAction('bad', 'x')).rejects.toThrow(/未知配置项/);
  });
});
