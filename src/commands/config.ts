import type { Command } from 'commander';
import { loadConfig, saveConfig, maskToken, ConfigError } from '../config/load.js';

const KEYS = new Set(['token', 'apiBase']);

export async function configGetAction(key: string): Promise<string> {
  if (!KEYS.has(key)) return '';
  const cfg = loadConfig();
  if (key === 'token') return maskToken(cfg.token) ?? '';
  return (cfg.apiBase as string) ?? '';
}

export async function configSetAction(key: string, value: string): Promise<void> {
  if (!KEYS.has(key)) throw new ConfigError(`未知配置项: ${key}`);
  saveConfig({ [key]: value });
}

export function registerConfig(program: Command): void {
  const cmd = program.command('config').description('view or set config');
  cmd
    .command('get <key>')
    .action(async (key: string) => {
      const out = await configGetAction(key);
      process.stdout.write(out + '\n');
    });
  cmd
    .command('set <key> <value>')
    .action(async (key: string, value: string) => {
      await configSetAction(key, value);
      process.stdout.write(`已设置 ${key}\n`);
    });
}
