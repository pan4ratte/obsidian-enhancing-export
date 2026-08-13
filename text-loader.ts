import type { Plugin } from 'vite';
import { extname } from 'path';
import * as fsp from 'fs/promises';

/**
 * The embedded resources are all UTF-8 text, so they go in as string literals: base64 would cost a third again in
 * bundle size, plus an atob pass on every load.
 *
 * Shared by the build and the tests: `src/lang/helpers.ts` imports the user guide, so a test that reaches any
 * localised string reaches a markdown file too.
 */
export const textLoader = (config: { [extension: string]: 'text' }): Plugin => ({
  name: 'text-loader',
  enforce: 'pre',
  async load(id) {
    if (config[extname(id)] === 'text') {
      const text = await fsp.readFile(id, 'utf-8');
      return { code: `export default ${JSON.stringify(text)};` };
    }
  },
});

/** What the plugin inlines: the bundled lua filters, the LaTeX template, and the user guide. */
export const TEXT_FILES: Record<string, 'text'> = {
  '.lua': 'text',
  '.tex': 'text',
  '.sty': 'text',
  '.md': 'text',
};
