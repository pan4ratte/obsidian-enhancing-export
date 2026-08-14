/* Typst's wasm build — the one typesetter the plugin can start where there is no process to start.
 *
 * Pandoc writes the typst source, this turns it into a PDF. Like pandoc's own build it is fetched on request rather
 * than shipped, and like it, it reads nothing it was not handed: the source, the note's images, and the fonts.
 */

import { requestUrl } from 'obsidian';
import { createTypstCompiler, type TypstCompiler } from '@myriaddreamin/typst.ts/compiler';
import { loadFonts } from '@myriaddreamin/typst.ts/options.init';
import * as wrapper from '@myriaddreamin/typst-ts-web-compiler';
import type PandocGuiPlugin from '../main';
import { WASM_DIR } from './install';

/** The build that is fetched, and the font release typst.ts pins to it. */
export const TYPST_VERSION = '0.7.0';
const FONT_RELEASE = 'v0.13.1';

const WASM_URL = `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@${TYPST_VERSION}/pkg/typst_ts_web_compiler_bg.wasm`;
const FONT_URL = `https://cdn.jsdelivr.net/gh/typst/typst-assets@${FONT_RELEASE}/files/fonts`;

export const TYPST_FILE = 'typst.wasm';
/** Where the fonts sit beside the binary. */
export const TYPST_FONT_DIR = 'fonts';

/**
 * The fonts typst sets a document in when nothing says otherwise: Libertinus for text, New Computer Modern for maths,
 * DejaVu for code. Between them they cover Latin and Cyrillic; a note in another script needs a font of its own, which
 * is what the font folder setting is for.
 */
const FONTS = [
  'DejaVuSansMono-Bold.ttf',
  'DejaVuSansMono-BoldOblique.ttf',
  'DejaVuSansMono-Oblique.ttf',
  'DejaVuSansMono.ttf',
  'LibertinusSerif-Bold.otf',
  'LibertinusSerif-BoldItalic.otf',
  'LibertinusSerif-Italic.otf',
  'LibertinusSerif-Regular.otf',
  'LibertinusSerif-Semibold.otf',
  'LibertinusSerif-SemiboldItalic.otf',
  'NewCM10-Bold.otf',
  'NewCM10-BoldItalic.otf',
  'NewCM10-Italic.otf',
  'NewCM10-Regular.otf',
  'NewCMMath-Bold.otf',
  'NewCMMath-Book.otf',
  'NewCMMath-Regular.otf',
];

/** What the whole install comes to, near enough to say before asking for it: 27 MB of binary and 8 MB of fonts. */
export const TYPST_SIZE = 36 * 1024 * 1024;

/** The extensions a font is recognised by, in the folder a vault points at. */
const FONT_TYPES = ['.ttf', '.otf', '.ttc', '.otc'];

/** Which part of an install is under way, and how far through the fonts it is. */
export type TypstInstallProgress = (stage: 'downloading' | 'fonts' | 'writing', done?: number, total?: number) => void;

export interface TypstResult {
  /** The PDF, where one was produced. */
  pdf?: Uint8Array;
  /** What typst said about the document, in the lines a command line would have printed. */
  diagnostics: string;
}

interface Diagnostic {
  severity: string;
  message: string;
  path?: string;
  range?: string;
}

/** Typst's own report of a document, put back into the one line of text the rest of the plugin reads. */
const asText = (diagnostics: Diagnostic[]): string =>
  diagnostics
    .map(({ severity, message, path, range }) => [severity, path && range ? `${path}:${range}` : path, message].filter(Boolean).join(': '))
    .join('\n');

export class TypstWasm {
  constructor(private compiler: TypstCompiler) {}

  /**
   * One document. `main` is where the source is put, which decides what the paths inside it are read against — pandoc
   * writes `image("a.png")` beside the file, so the source goes where the output would have.
   */
  async compile(main: string, source: string, files: Record<string, Uint8Array> = {}): Promise<TypstResult> {
    // Nothing of the last run is left behind: a stale shadow file is a document that compiles when it should not.
    await this.compiler.reset();
    const path = main.startsWith('/') ? main : `/${main}`;
    this.compiler.addSource(path, source);
    for (const [at, bytes] of Object.entries(files)) {
      this.compiler.mapShadow(at.startsWith('/') ? at : `/${at}`, bytes);
    }

    // `format` is the numeric enum: the string 'pdf' compiles quietly to typst's own vector format instead.
    const result = await this.compiler.compile({ mainFilePath: path, format: 1, diagnostics: 'full' });
    return { pdf: result.result ?? undefined, diagnostics: asText(result.diagnostics ?? []) };
  }
}

/** A compiler on a binary and the fonts it is to set with — what the manager brings up, and what a test can stand up. */
export async function loadTypst(binary: Uint8Array, fonts: Uint8Array[]): Promise<TypstWasm> {
  const compiler = createTypstCompiler();
  await compiler.init({
    getModule: () => binary,
    // The wasm-bindgen wrapper is handed over rather than imported by name: a bare import inside the bundle is a
    // module specifier the renderer has no resolver for.
    getWrapper: () => Promise.resolve(wrapper),
    // `assets: false` keeps typst.ts from fetching its own fonts from a CDN mid-export — everything a document is set
    // in is on disk before the export starts.
    beforeBuild: [loadFonts(fonts, { assets: false })],
  });
  return new TypstWasm(compiler);
}

export class TypstWasmManager {
  #instance?: TypstWasm;
  #loading?: Promise<TypstWasm>;

  constructor(private plugin: PandocGuiPlugin) {}

  /** The folder the binary is written into, beside pandoc's own — a vault path, always with forward slashes. */
  get directory(): string {
    return `${this.plugin.manifest.dir.replaceAll('\\', '/')}/${WASM_DIR}`;
  }

  get filePath(): string {
    return `${this.directory}/${TYPST_FILE}`;
  }

  get fontDirectory(): string {
    return `${this.directory}/${TYPST_FONT_DIR}`;
  }

  async isInstalled(): Promise<boolean> {
    return await this.plugin.app.vault.adapter.exists(this.filePath);
  }

  /**
   * Fetch the binary and the fonts and write them into the plugin folder. Answers the version now on disk, for the
   * caller to record — the settings are whoever owns them to write, as they are for pandoc's build.
   */
  async install(onProgress?: TypstInstallProgress): Promise<string> {
    const { adapter } = this.plugin.app.vault;
    await adapter.mkdir(this.directory);
    await adapter.mkdir(this.fontDirectory);

    onProgress?.('downloading');
    const { arrayBuffer } = await requestUrl({ url: WASM_URL });
    if (arrayBuffer.byteLength === 0) {
      throw new Error('The downloaded typst binary is empty');
    }

    let done = 0;
    onProgress?.('fonts', 0, FONTS.length);
    for (const font of FONTS) {
      const response = await requestUrl({ url: `${FONT_URL}/${font}` });
      await adapter.writeBinary(`${this.fontDirectory}/${font}`, response.arrayBuffer);
      onProgress?.('fonts', (done += 1), FONTS.length);
    }

    onProgress?.('writing');
    await adapter.writeBinary(this.filePath, arrayBuffer);

    this.forget();
    return TYPST_VERSION;
  }

  /** Delete the binary and the fonts that came with it. */
  async remove(): Promise<void> {
    const { adapter } = this.plugin.app.vault;
    if (await adapter.exists(this.filePath)) {
      await adapter.remove(this.filePath);
    }
    for (const font of FONTS) {
      const path = `${this.fontDirectory}/${font}`;
      if (await adapter.exists(path)) {
        await adapter.remove(path);
      }
    }
    this.forget();
  }

  /** Drop the loaded compiler, so the next export reads whatever is on disk now. */
  forget(): void {
    this.#instance = undefined;
    this.#loading = undefined;
  }

  async load(): Promise<TypstWasm> {
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

  async #load(): Promise<TypstWasm> {
    const { adapter } = this.plugin.app.vault;
    if (!(await adapter.exists(this.filePath))) {
      throw new Error('Typst is not installed');
    }
    const binary = await adapter.readBinary(this.filePath);
    this.#instance = await loadTypst(new Uint8Array(binary), await this.#fonts());
    return this.#instance;
  }

  /** Every font the compiler is to know: the ones installed beside it, and whatever the vault's own folder holds. */
  async #fonts(): Promise<Uint8Array[]> {
    const fonts: Uint8Array[] = [];
    for (const path of await this.#fontFiles()) {
      try {
        fonts.push(new Uint8Array(await this.plugin.app.vault.adapter.readBinary(path)));
      } catch (e) {
        // One unreadable font is not a reason to typeset nothing.
        console.warn(`Pandoc GUI: "${path}" could not be read as a font —`, e);
      }
    }
    return fonts;
  }

  async #fontFiles(): Promise<string[]> {
    const { adapter } = this.plugin.app.vault;
    const paths = FONTS.map(font => `${this.fontDirectory}/${font}`);

    const folder = this.plugin.settings.typstFontsDir?.trim();
    if (!folder || !(await adapter.exists(folder))) {
      return paths;
    }
    const { files } = await adapter.list(folder);
    return [...paths, ...files.filter(file => FONT_TYPES.includes(file.slice(file.lastIndexOf('.')).toLowerCase()))];
  }

  /** How many fonts an export would be typeset with, for the panel to say so. */
  async fontCount(): Promise<number> {
    return (await this.#fontFiles()).length;
  }
}
