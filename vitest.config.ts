import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // `describe`/`test`/`expect` stay global, as they were under jest. `vi` is imported where it is used.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    // The `obsidian` package ships types only, so anything importing it has no module to resolve outside Obsidian.
    alias: { obsidian: path.resolve(import.meta.dirname, 'tests/mocks/obsidian.ts') },
  },
});
