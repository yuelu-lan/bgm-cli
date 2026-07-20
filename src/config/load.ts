import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';

const paths = envPaths('bgm-cli');

export interface ConfigFile {
  token?: string;
  apiBase?: string;
}

export interface ResolvedConfig extends ConfigFile {
  apiBase: string;
  configPath: string;
}

const DEFAULT_API_BASE = 'https://api.bgm.tv/v0';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function resolveConfigPath(overridePath?: string): string {
  if (overridePath) return overridePath;
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, 'bgm-cli-nodejs');
  }
  return paths.config;
}

export function loadConfig(overridePath?: string): ResolvedConfig {
  const configPath = resolveConfigPath(overridePath);
  let file: ConfigFile = {};
  if (existsSync(configPath)) {
    try {
      file = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      throw new ConfigError('配置文件解析失败');
    }
  }
  const token = process.env.BGM_ACCESS_TOKEN ?? file.token;
  const apiBase = process.env.BGM_API_BASE ?? file.apiBase ?? DEFAULT_API_BASE;
  return { token, apiBase, configPath };
}

export function saveConfig(partial: ConfigFile, overridePath?: string): void {
  const configPath = resolveConfigPath(overridePath);
  let existing: ConfigFile = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, 'utf8')) as ConfigFile;
    } catch {
      throw new ConfigError('配置文件解析失败');
    }
  }
  const merged = { ...existing, ...partial };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

export function maskToken(token?: string): string | undefined {
  if (!token) return undefined;
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}
