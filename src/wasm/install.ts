/* Getting pandoc's wasm build onto the device, and keeping track of the copy that is there.
 *
 * The binary is not shipped with the plugin: it is 56 MB, it is pandoc's own release, and it is only wanted by the
 * vaults that ask for it. So it is fetched from pandoc's releases on request and written into the plugin folder.
 */

import { requestUrl } from 'obsidian';
import type PandocGuiPlugin from '../main';
import { extractFromZip } from './zip';
import { PandocWasm } from './runtime';

/** Where the binary lives inside the plugin folder. */
export const WASM_DIR = 'wasm';
export const WASM_FILE = 'pandoc.wasm';

/** The name of the asset in a pandoc release, and of the file inside it. */
const ASSET = /^pandoc-wasm-([\d.]+)\.zip$/;

const RELEASES_API = 'https://api.github.com/repos/jgm/pandoc/releases';

export interface WasmRelease {
  version: string;
  url: string;
  /** Bytes of the archive, as the release lists them — what the panel says before asking for it. */
  size: number;
}

/**
 * Which part of an install is under way.
 *
 * There is no number to go with it: the download goes through Obsidian rather than the renderer — GitHub's asset host
 * sends no CORS headers, so `fetch` is refused before it starts — and that hands the body back in one piece.
 */
export type InstallProgress = (stage: 'downloading' | 'extracting' | 'writing') => void;

interface Asset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  assets?: Asset[];
}

/** The wasm archive a release carries, if it has one — pandoc only started publishing one with 3.9. */
const assetOf = (release: Release): WasmRelease | undefined => {
  for (const asset of release.assets ?? []) {
    const matched = ASSET.exec(asset.name);
    if (matched) {
      return { version: matched[1], url: asset.browser_download_url, size: asset.size };
    }
  }
  return undefined;
};

export class PandocWasmManager {
  #module?: WebAssembly.Module;
  #instance?: PandocWasm;
  #loading?: Promise<PandocWasm>;

  constructor(private plugin: PandocGuiPlugin) {}

  /** The folder the binary is written into, as a vault path — always with forward slashes, as the adapter takes them. */
  get directory(): string {
    return `${this.plugin.manifest.dir.replaceAll('\\', '/')}/${WASM_DIR}`;
  }

  /** Where the binary is, as a vault path. */
  get filePath(): string {
    return `${this.directory}/${WASM_FILE}`;
  }

  /** Whether a binary is on disk. The recorded version says which, and is only trustworthy alongside this. */
  async isInstalled(): Promise<boolean> {
    return await this.plugin.app.vault.adapter.exists(this.filePath);
  }

  /** The newest release that publishes a wasm build, or nothing when the lookup cannot be made. */
  async latest(): Promise<WasmRelease | undefined> {
    const response = await requestUrl({
      url: `${RELEASES_API}?per_page=10`,
      headers: { Accept: 'application/vnd.github+json' },
      throw: false,
    });
    if (response.status !== 200) {
      return undefined;
    }
    for (const release of (response.json ?? []) as Release[]) {
      const asset = assetOf(release);
      if (asset) {
        return asset;
      }
    }
    return undefined;
  }

  /**
   * Download the archive, take the binary out of it and write it into the plugin folder.
   *
   * The whole archive is held in memory while it is unpacked — 16 MB of it, and 56 MB once unpacked, which is the
   * price of not having a real file system to stream through.
   */
  async install(release: WasmRelease, onProgress?: InstallProgress): Promise<void> {
    onProgress?.('downloading');
    const { arrayBuffer: archive } = await requestUrl({ url: release.url });

    onProgress?.('extracting');
    const binary = await extractFromZip(archive, WASM_FILE);
    if (binary.length === 0) {
      throw new Error('The downloaded archive holds an empty binary');
    }

    onProgress?.('writing');
    const { adapter } = this.plugin.app.vault;
    await adapter.mkdir(this.directory);
    await adapter.writeBinary(this.filePath, binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer);

    // A newly written binary replaces whatever was loaded from the old one.
    this.forget();
    this.plugin.settings.wasmVersion = release.version;
    await this.plugin.saveSettings();
  }

  /** Delete the binary and forget the version it was. */
  async remove(): Promise<void> {
    const { adapter } = this.plugin.app.vault;
    if (await adapter.exists(this.filePath)) {
      await adapter.remove(this.filePath);
    }
    this.forget();
    delete this.plugin.settings.wasmVersion;
    await this.plugin.saveSettings();
  }

  /** Drop the loaded binary, so the next run reads whatever is on disk now. */
  forget(): void {
    this.#module = undefined;
    this.#instance = undefined;
    this.#loading = undefined;
  }

  /**
   * The running binary, brought up on first use and kept for the session.
   *
   * Compiling 56 MB takes a moment and the first conversion after it takes several seconds more, while the Haskell
   * runtime settles; every conversion after that is quick. That is the whole reason this is held onto.
   */
  async load(): Promise<PandocWasm> {
    if (this.#instance) {
      return this.#instance;
    }
    this.#loading ??= this.#load();
    try {
      return await this.#loading;
    } catch (e) {
      this.#loading = undefined;
      throw e;
    }
  }

  async #load(): Promise<PandocWasm> {
    const { adapter } = this.plugin.app.vault;
    if (!(await adapter.exists(this.filePath))) {
      throw new Error('Pandoc for mobile is not installed');
    }
    const binary = await adapter.readBinary(this.filePath);
    this.#module ??= await WebAssembly.compile(binary);
    this.#instance = await PandocWasm.load(this.#module);
    return this.#instance;
  }
}
