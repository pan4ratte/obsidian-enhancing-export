import export_templates from './export_templates';
import { setPlatformValue, PlatformValue, renderTemplate, getPlatformValue } from './utils';
import type { PropertyGridMeta } from './ui/components/PropertyGrid';
import type { InstalledLuaFilter } from './lua_filters';
import type { TodayFormat } from './filter_args';

/*
 * Variables
 *   /User/aaa/Documents/test.pdf
 * - ${outputDir}             --> /User/aaa/Documents/
 * - ${outputPath}            --> /User/aaa/Documents/test.pdf
 * - ${outputFileName}        --> test
 * - ${outputFileFullName}    --> test.pdf
 *
 *   /User/aaa/Documents/test.pdf
 * - ${currentDir}            --> /User/aaa/Documents/
 * - ${currentPath}           --> /User/aaa/Documents/test.pdf
 * - ${CurrentFileName}       --> test
 * - ${CurrentFileFullName}   --> test.pdf
 */
export interface Variables extends Record<string, unknown> {
  attachmentFolderPath: string;
  pluginDir: string;
  luaDir: string;
  outputDir: string;
  outputPath: string;
  outputFileName: string;
  outputFileFullName: string;
  currentDir: string;
  currentPath: string;
  currentFileName: string;
  currentFileFullName: string;
  vaultDir: string;
  metadata?: unknown;
  embedDirs: string;
  options?: unknown;
  env?: Record<string, string>;
  /** Today's date, written out in the language Obsidian is set to. */
  today: Record<TodayFormat, string>;
}

/**
 * Today's date in each of the forms a template can ask for, in the language
 * Obsidian is set to — which is the point of writing it here rather than in a
 * filter, where every language has to be spelled out by hand.
 */
export function today(locale: string, now = new Date()): Record<TodayFormat, string> {
  const write = (dateStyle: 'long' | 'medium' | 'short') => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle }).format(now);
    } catch {
      // A locale the runtime does not know is not worth failing an export over.
      return new Intl.DateTimeFormat(undefined, { dateStyle }).format(now);
    }
  };
  return {
    long: write('long'),
    medium: write('medium'),
    short: write('short'),
    // Not a locale's business: the one form that means the same everywhere.
    iso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  };
}

export interface UniversalExportPluginSettings {
  pandocPath?: PlatformValue<string>;
  showOverwriteConfirmation?: boolean;
  defaultExportDirectoryMode: 'Same' | 'Custom';
  customDefaultExportDirectory?: PlatformValue<string>;
  env: PlatformValue<Record<string, string>>;
  items: ExportSetting[];

  openExportedFile?: boolean; // open exported file after export
  openExportedFileLocation?: boolean; // open exported file location after export

  lastEditName?: string;

  lastExportDirectory?: PlatformValue<string>;
  lastExportType?: string;

  /**
   * How the templates table was last ordered.
   *
   * A view of the settings rather than one of them, which is why it took a
   * while to end up here — but a table that forgets goes back to being sorted
   * by name every time the tab is opened, and someone who works by output
   * format has to say so again each time. Kept beside the other `last…` fields,
   * which are the same kind of thing: not what the plugin does, but where the
   * person using it left off.
   */
  lastTemplateSort?: { column: 'name' | 'output'; ascending: boolean };

  /**
   * Lua filters downloaded through the store, in `lua/` beside the bundled ones.
   * Absent until the first install; treated as empty and never mutated in place,
   * so the value in `DEFAULT_SETTINGS` can never be written through.
   */
  installedLuaFilters?: InstalledLuaFilter[];
  /** Base URL of the lua-filter catalogue. Unset means the default repo. */
  luaFilterRepoUrl?: string;
}

export type OptionsMeta = {
  [optionsName: string]: PropertyGridMeta[string] | `preset:${keyof typeof PRESET_OPTIONS_META}`;
};

interface CommonExportSetting {
  name: string;
  /**
   * Key in `export_templates` the format fields were taken from — what the
   * template writes, kept as a choice rather than guessed back out of the
   * arguments. Set on every template in the settings; the presets themselves
   * carry none, having no preset they are a copy of.
   */
  preset?: string;

  openExportedFileLocation?: boolean; // open exported file location after export
  openExportedFile?: boolean; // open exported file after export
  optionsMeta?: OptionsMeta;
}

export interface PandocExportSetting extends CommonExportSetting {
  type: 'pandoc';
  /** The preset's own plumbing: the reader, the resource paths, `-o` and `-t`. */
  arguments: string;
  /** What the template editor's rows write. Theirs alone — nothing types here. */
  customArguments?: string;
  /**
   * Options typed by hand, kept apart from the rows' own line.
   *
   * Two fields rather than one because the rows rewrite what they own: an option
   * typed into the same line could not be told from one a row had written, and
   * would be moved or dropped the next time a row was changed. Written last, so
   * whatever is here is pandoc's final word on any option it names twice.
   */
  userArguments?: string;
  extension: string;
}

export interface CustomExportSetting extends CommonExportSetting {
  type: 'custom';
  command: string;
  targetFileExtensions?: string;

  showCommandOutput?: boolean; // show command output in console after export
}

export type ExportSetting = PandocExportSetting | CustomExportSetting;

export const PRESET_OPTIONS_META: PropertyGridMeta = {
  'textemplate': {
    title: 'Latex Template',
    type: 'dropdown',
    options: [
      { name: 'None', value: null },
      { name: 'Dissertation', value: 'dissertation.tex' },
      { name: 'Academic Paper', value: 'neurips.tex' },
    ],
  },
};

export const DEFAULT_ENV = (() => {
  let env: PlatformValue<Record<string, string>> = {};
  env = setPlatformValue(
    env,
    {
      'HOME': '${HOME}',
      'PATH': '${PATH}',
      'TEXINPUTS': '${pluginDir}/textemplate/:', // It is necessary to **append** to the current TEXINPUTS wtih ":" - NOT REPLACE. TEXINPUTS contains the basic latex classes.
    },
    '*' // available for all platforms.
  );

  env = setPlatformValue(
    env,
    {
      'TEXINPUTS': '${pluginDir}/textemplate/;', // Windows uses ; rather than : for appending
      'PATH': '${HOME}\\AppData\\Local\\Pandoc;${PATH}',
    },
    'win32' // available for windows only.
  );

  env = setPlatformValue(
    env,
    {
      'PATH': '/opt/homebrew/bin:/usr/local/bin:/Library/TeX/texbin:${PATH}', // Add HomebrewBin and TexBin. see: https://docs.brew.sh/Installation
    },
    'darwin' // for MacOS only.
  );

  return env;
})();

/**
 * The templates a vault starts with — the formats a note is actually exported
 * to, rather than every format pandoc can write.
 *
 * Every preset is still one click away: *New template* offers the whole list
 * under *Output format*, and picking one there builds the same template this
 * would have seeded. What is here is only what an export dropdown opens with,
 * and a dropdown of twenty formats answers nobody's question — Textile, OPML,
 * MediaWiki, reStructuredText, RTF and TextBundle were each one line of that
 * list for every user who has never written one.
 */
export const DEFAULT_TEMPLATE_PRESETS: readonly string[] = [
  'Markdown',
  'Markdown (Hugo)',
  'Html',
  'Typst',
  'PDF',
  'Word (.docx)',
  'OpenOffice',
  'Epub',
  'Latex',
  'Bibliography (.bib)',
  'PowerPoint (.pptx)',
];

export const DEFAULT_SETTINGS: UniversalExportPluginSettings = {
  // Each default is an instance of the preset it is named for, so it carries the
  // key it came from. Taking that from the key rather than the name matters:
  // `Bibliography (.bib)` holds a template called `Bibliography`, and the two
  // being different is exactly what a name could not tell us.
  items: DEFAULT_TEMPLATE_PRESETS.filter(preset => export_templates[preset]).map(preset => ({ ...export_templates[preset], preset })),
  pandocPath: undefined,
  defaultExportDirectoryMode: 'Same',
  openExportedFile: true,
  env: DEFAULT_ENV,
};

export function extractDefaultExtension(s: ExportSetting): string {
  if (s.type === 'pandoc') {
    return s.extension;
  } else if (s.type === 'custom') {
    return s.targetFileExtensions?.split(',')[0];
  }
  return '';
}

export function createEnv(env: Record<string, string>, envVars?: Record<string, unknown>) {
  env = Object.assign({}, getPlatformValue(DEFAULT_ENV), env);
  envVars = Object.assign({ HOME: process.env['HOME'] ?? process.env['USERPROFILE'] }, process.env, envVars ?? {});
  return Object.fromEntries(Object.entries(env).map(([n, v]) => [n, renderTemplate(v, envVars)]));
}

export function finalizeOptionsMeta(meta?: OptionsMeta): PropertyGridMeta {
  if (meta) {
    return Object.fromEntries(
      Object.entries(meta).map(([optionsName, optionsMetaOrPresetName]) => [
        optionsName,
        typeof optionsMetaOrPresetName === 'string'
          ? PRESET_OPTIONS_META[optionsMetaOrPresetName.startsWith('preset:') ? optionsMetaOrPresetName.substring(7) : '']
          : optionsMetaOrPresetName,
      ])
    );
  }
  return {};
}
