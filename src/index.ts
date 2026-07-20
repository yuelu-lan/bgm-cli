#!/usr/bin/env node
import { Command } from 'commander';
import { createClient, ApiError, type Client } from './api/client.js';
import { ConfigError, loadConfig } from './config/load.js';
import { registerSearch } from './commands/search.js';
import { registerSubject } from './commands/subject.js';
import { registerConfig } from './commands/config.js';
import { registerExport } from './commands/export.js';

const FORMAT_CHOICES = ['json', 'text', 'markdown'] as const;

function exitCodeFor(err: unknown): number {
  if (err instanceof ApiError) {
    if (err.status === 0) return 6;
    if (err.status === 401) return 2;
    if (err.status === 404) return 3;
    if (err.status >= 400 && err.status < 500) return 4;
    if (err.status >= 500) return 5;
  }
  if (err instanceof ConfigError) return 7;
  return 1;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('bgm')
    .description('Bangumi CLI')
    .option('-f, --format <format>', 'json | text | markdown', 'text')
    .option('-c, --config <path>', 'config file path')
    .hook('preAction', (cmd) => {
      const fmt = cmd.opts().format;
      if (!FORMAT_CHOICES.includes(fmt)) {
        throw new ConfigError(`不支持的 format: ${fmt}`);
      }
    });

  let cached: Client | undefined;
  const client = new Proxy({} as Client, {
    get: (_t, prop: string | symbol) => {
      if (typeof prop !== 'string') return undefined;
      if (!cached) {
        const cfg = loadConfig(program.opts().config);
        cached = createClient({ token: cfg.token, apiBase: cfg.apiBase });
      }
      const c = cached as Record<string, unknown>;
      const v = c[prop];
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(cached) : v;
    },
  }) as Client;

  registerSearch(program, client);
  registerSubject(program, client);
  registerConfig(program);
  registerExport(program, client);

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`bgm: ${msg}\n`);
  process.exit(exitCodeFor(err));
});
