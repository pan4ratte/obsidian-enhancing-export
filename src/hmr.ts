import type { Plugin } from 'obsidian';
import { debounce, Platform } from 'obsidian';
import { resolve } from './system/paths';

declare global {
  interface HmrOptions {
    watchFiles?: Array<'main.js' | 'manifest.json' | 'styles.css'> | string[];
  }
  interface Window {
    hmr(plugin: Plugin, options?: HmrOptions): void;
  }
}

Window.prototype.hmr = function (plugin: Plugin, options?: HmrOptions): void {
  if (Platform.isMobile) {
    return;
  }

  options ??= {};
  options.watchFiles ??= ['main.js', 'manifest.json', 'styles.css'];
  const { watchFiles } = options;

  const {
    app: {
      vault: { adapter },
      plugins,
    },
    manifest: { dir: pluginDir, id },
  } = plugin;
  const {
    app: { vault },
  } = plugin;

  // The reload used to switch Obsidian's own `debug-plugin` flag on around it, to keep a plugin that throws on load
  // from failing quietly. That is a one-off setting rather than something a reload should write, so it is set by hand
  // now — see CONTRIBUTING.md.
  const restartPlugin = async () => {
    await plugins.disablePlugin(id);
    await plugins.enablePlugin(id);
  };

  // The plugin's own joining rather than node's: this is a vault path, which is spelled the same way on every
  // platform, and node is one import a file loaded on a phone cannot make.
  const entry = resolve(pluginDir, 'main.js');
  const onChange = debounce(
    async (file: string) => {
      if (file.startsWith(pluginDir)) {
        if (!(await adapter.exists(entry))) {
          return;
        }
        if (file === pluginDir) {
          // reload
        } else if (watchFiles?.length > 0) {
          if (!watchFiles.some(o => file.endsWith(o))) {
            return;
          }
        }
        await restartPlugin();
      }
    },
    500,
    true
  );

  plugin.registerEvent(vault.on('raw', onChange));

  plugin.register(() => adapter.stopWatchPath(pluginDir));
  adapter.startWatchPath(pluginDir);
};

export {};
