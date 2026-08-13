/*
 * What the manager owns, and what it does not.
 *
 * It owns the file. What is installed is recorded in the settings by whoever holds them — the settings tab keeps them
 * in a solid store, and a second writer reaching past that store leaves the panel showing what was true a moment ago,
 * which is how "Not installed" survived an install.
 */

import { PandocWasmManager, WASM_FILE } from '../../src/wasm/install';

/** What this vault happens to call its config folder — a fixture, not a lookup. */
const CONFIG = '.config';

/** A vault that is a map, and settings nobody but the test writes. */
const plugin = () => {
  const files = new Map<string, ArrayBuffer>();
  const settings: { wasmVersion?: string } = {};
  const made: string[] = [];
  const saves: number[] = [];
  return {
    files,
    settings,
    made,
    saves,
    manifest: { dir: `${CONFIG}/plugins/pandoc-gui` },
    app: {
      vault: {
        adapter: {
          exists: (path: string) => Promise.resolve(files.has(path)),
          mkdir: (path: string) => {
            made.push(path);
            return Promise.resolve();
          },
          writeBinary: (path: string, data: ArrayBuffer) => {
            files.set(path, data);
            return Promise.resolve();
          },
          remove: (path: string) => {
            files.delete(path);
            return Promise.resolve();
          },
        },
      },
    },
    saveSettings: () => {
      saves.push(1);
      return Promise.resolve();
    },
  };
};

describe('PandocWasmManager', () => {
  test('puts the binary where the plugin folder keeps it', () => {
    const host = plugin();
    const manager = new PandocWasmManager(host as never);
    expect(manager.filePath).toBe(`${CONFIG}/plugins/pandoc-gui/wasm/${WASM_FILE}`);
  });

  test('a windows plugin folder is still written with forward slashes, as the adapter takes them', () => {
    const host = plugin();
    host.manifest.dir = `${CONFIG}\\plugins\\pandoc-gui`;
    const manager = new PandocWasmManager(host as never);
    expect(manager.filePath).toBe(`${CONFIG}/plugins/pandoc-gui/wasm/pandoc.wasm`);
  });

  test('answers whether the file is there, rather than what the settings claim', async () => {
    const host = plugin();
    const manager = new PandocWasmManager(host as never);
    host.settings.wasmVersion = '3.10.2';
    // A version recorded for a file that is gone is not an installation.
    expect(await manager.isInstalled()).toBe(false);
    host.files.set(manager.filePath, new ArrayBuffer(1));
    expect(await manager.isInstalled()).toBe(true);
  });

  test('removing takes the file and leaves the settings to their owner', async () => {
    const host = plugin();
    const manager = new PandocWasmManager(host as never);
    host.files.set(manager.filePath, new ArrayBuffer(1));
    host.settings.wasmVersion = '3.10.2';

    await manager.remove();

    expect(await manager.isInstalled()).toBe(false);
    // Untouched: the panel writes this through its store, and two writers is the bug this guards.
    expect(host.settings.wasmVersion).toBe('3.10.2');
    expect(host.saves).toEqual([]);
  });
});
