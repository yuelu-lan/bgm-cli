import { defineConfig } from 'tsup';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  bundling: true,
  skipNodeModulesBundle: true,
  clean: true,
  sourcemap: false,
  define: {
    'process.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
  },
});
