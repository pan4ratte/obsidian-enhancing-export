import type { Plugin } from 'vite';
import { extname } from './src/paths';

/**
 * The embedded resources are all UTF-8 text, so they go in as string literals: base64 would cost a third again in
 * bundle size, plus an atob pass on every load.
 *
 * Shared by the build and the tests: `src/lang/helpers.ts` imports the user guide, so a test that reaches any
 * localised string reaches a markdown file too.
 *
 * The file is read by whoever reads every other one — rollup hands `transform` the text it loaded, so there is no
 * `load` here and nothing for this plugin to open a file with. It is a build-time module either way, but a plugin's
 * repository is read as one thing, and a node import in it is a node import wherever it stands.
 */
export const textLoader = (config: { [extension: string]: 'text' }): Plugin => ({
  name: 'text-loader',
  enforce: 'pre',
  transform(code, id) {
    if (config[extname(id)] === 'text') {
      return { code: `export default ${JSON.stringify(code)};`, map: null };
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
