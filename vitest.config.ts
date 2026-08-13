import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // `describe`/`test`/`expect` stay global, as they were under jest. `vi` is imported where it is used.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // Pandoc's wasm build uses exception handling, which every browser has and node still keeps behind a flag. Only
    // the run that was pointed at a binary asks for it, so the flag goes away with the node that no longer needs it.
    execArgv: process.env['PANDOC_WASM'] ? ['--experimental-wasm-exnref'] : undefined,
  },
  resolve: {
    // The `obsidian` package ships types only, so anything importing it has no module to resolve outside Obsidian.
    alias: { obsidian: path.resolve(import.meta.dirname, 'tests/mocks/obsidian.ts') },
  },
});
