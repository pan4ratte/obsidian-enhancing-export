/* Which pandoc runs an export, and what that one can be asked to do.
 *
 * There are two: the program installed on the machine, and the wasm build running inside Obsidian. The first can do
 * everything and only exists on a desktop; the second runs anywhere but is sealed off from the system — no PDF engine,
 * no shell, no network. Every feature the plugin gates on the difference is named here, so nothing has to guess.
 */

import { extractDefaultExtension, type ExportSetting } from './settings';
import { isPdfOutput, outputFormat } from './pandoc_format';
import { commandToDefaults } from './wasm/defaults';

export type Engine = 'native' | 'wasm';

/** What the settings hold: when the wasm build is used — everywhere, or only where nothing else can run. */
export type EngineMode = 'auto' | 'wasm';

export const ENGINE_MODES: readonly EngineMode[] = ['auto', 'wasm'];

/**
 * The engine a mode comes down to. `auto` is the answer for someone who wants it to work everywhere: the installed
 * pandoc on a desktop, where it is faster and complete, and the wasm build on a phone, where nothing else can run.
 *
 * Anything else read from the settings is `auto` — which is what the `native` these once held now means, since a
 * phone has no installed pandoc to name.
 */
export const resolveEngine = (mode: EngineMode | undefined, mobile: boolean): Engine => (mode === 'wasm' || mobile ? 'wasm' : 'native');

export interface Capabilities {
  /** Producing PDF, which needs a typesetter the wasm build cannot start. */
  pdf: boolean;
  /** Running a command of the user's own — what a `custom` template is. */
  commands: boolean;
  /** Fetching an image or a stylesheet named by URL while converting. */
  network: boolean;
  /** Filters that are programs rather than lua scripts. */
  jsonFilters: boolean;
  /** Reading files from anywhere on the machine rather than out of the vault. */
  wholeFileSystem: boolean;
}

const NATIVE: Capabilities = { pdf: true, commands: true, network: true, jsonFilters: true, wholeFileSystem: true };
const WASM: Capabilities = { pdf: false, commands: false, network: false, jsonFilters: false, wholeFileSystem: false };

/**
 * What an engine can do on this platform. The wasm build reads only what it is handed, and on a desktop that can be
 * handed a file from anywhere; on a phone there is nothing outside the vault to hand it.
 */
export const capabilities = (engine: Engine, mobile = false): Capabilities =>
  engine === 'native' ? NATIVE : { ...WASM, wholeFileSystem: !mobile };

/** Whether a template's output is a PDF — either asked for by name, or implied by the file it writes. */
export const writesPdf = (setting: ExportSetting): boolean => {
  if (setting.type !== 'pandoc') {
    return false;
  }
  // `-t beamer -o slides.pdf` names no pdf writer: pandoc reads the extension and runs the typesetter anyway.
  return (
    isPdfOutput(outputFormat(setting.arguments, setting.customArguments, setting.userArguments)) ||
    extractDefaultExtension(setting).toLowerCase() === '.pdf'
  );
};

/** Why an engine cannot run a template, or nothing when it can. */
export type Unsupported = 'pdf' | 'command';

export const unsupportedBy = (setting: ExportSetting, engine: Engine): Unsupported | undefined => {
  const can = capabilities(engine);
  if (!can.commands && setting.type === 'custom') {
    return 'command';
  }
  if (!can.pdf && writesPdf(setting)) {
    return 'pdf';
  }
  return undefined;
};

/**
 * The options an engine would quietly leave out of a template. None of them stops an export: the document is simply
 * written without whatever they would have done, which is the worst way to be wrong about it — so they are named
 * where the template is edited, and again when the file is written.
 *
 * The arguments are read as they are stored, `${...}` and all. A variable stands where a value goes and never where
 * an option does, so every flag is still there to be found.
 */
export const droppedBy = (setting: ExportSetting, engine: Engine): string[] => {
  if (engine !== 'wasm' || setting.type !== 'pandoc') {
    return [];
  }
  const args = [setting.arguments, setting.customArguments, setting.userArguments].map(part => part?.trim()).filter(Boolean);
  // The first token is read as the name the program was called by, so there has to be one.
  return commandToDefaults(['pandoc', ...args].join(' ')).unsupported;
};
