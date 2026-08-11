import * as fs from 'fs';
import path from 'path';
import process from 'process';
import type PandocGuiPlugin from './main';

/* The citation styles installed in Zotero, read off disk: Zotero's own server has no route that lists them. */

/** One `.csl` file in Zotero's styles folder. */
export interface ZoteroStyle {
  /** The `<id>` the file gives itself — a URI, and what a document records to say which style it uses. */
  id: string;
  title: string;
  /** Where the file is, in Zotero's folder. */
  filePath: string;
  /**
   * Whether the style writes a separate layout per language. Zotero renders those; pandoc refuses the file outright,
   * so a copy with the extra layouts taken out is what gets exported with.
   */
  multilingual: boolean;
  /** The language the style writes in, where it names one. */
  locale?: string;
  /** Whether it writes each citation as a footnote rather than in the text. */
  note: boolean;
}

/** Zotero's data folder, where it has not been moved. */
export const defaultZoteroDataDir = (home = process.env.USERPROFILE || process.env.HOME || ''): string => path.join(home, 'Zotero');

/** The tag itself, not every tag it is the start of the name of: `<title>` is not `<title-short>`. */
const tag = (xml: string, name: string): string | undefined =>
  new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(xml)?.[1]?.trim() || undefined;

/**
 * A layout per language is CSL-M, which only Zotero's own renderer reads. Pandoc stops at the second layout —
 * "Multiple layout elements present in citation" — and takes the whole style with it.
 *
 * Written fresh each time it is used: a `/g` pattern remembers where it left off, and a shared one would answer every
 * other file wrongly.
 */
const localeLayouts = () => /<layout\s+locale="[^"]*"[\s\S]*?<\/layout>\s*/g;

/** What a `.csl` file says about itself. Undefined where it is not a style file at all. */
export const readStyle = (filePath: string, xml: string): ZoteroStyle | undefined => {
  const id = tag(xml, 'id');
  if (!id) {
    return undefined;
  }
  return {
    id,
    title: tag(xml, 'title') ?? path.basename(filePath, '.csl'),
    filePath,
    multilingual: localeLayouts().test(xml),
    note: /<style[^>]*\sclass="note"/.test(xml),
    locale: /<style[^>]*\sdefault-locale="([^"]*)"/.exec(xml)?.[1],
  };
};

/** The same style with its language-specific layouts removed, which is what leaves a file pandoc can read. */
export const withoutLocaleLayouts = (xml: string): string => xml.replace(localeLayouts(), '');

/** Every style installed in Zotero, by title. A folder that is not there is no styles rather than an error. */
export const readZoteroStyles = async (dataDir: string): Promise<ZoteroStyle[]> => {
  const dir = path.join(dataDir, 'styles');
  let names: string[];
  try {
    names = await fs.promises.readdir(dir);
  } catch {
    return [];
  }

  const styles: ZoteroStyle[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.csl')) {
      continue;
    }
    const filePath = path.join(dir, name);
    try {
      const style = readStyle(filePath, await fs.promises.readFile(filePath, 'utf8'));
      if (style) {
        styles.push(style);
      }
    } catch (e) {
      // One unreadable file is not the folder.
      console.warn(`Could not read the citation style ${name}`, e);
    }
  }
  return styles.sort((a, b) => a.title.localeCompare(b.title));
};

/**
 * The locale a document records, which is the one Zotero reformats it in: the style's own where it names one, and
 * otherwise the language Obsidian is read in. A CSL locale carries a region, so `ru` is asked for as `ru-RU`.
 */
export const cslLocale = (style: ZoteroStyle, uiLocale: string): string => {
  if (style.locale) {
    return style.locale;
  }
  const [language, region] = uiLocale.split('-');
  return region ? `${language}-${region.toUpperCase()}` : `${language}-${language.toUpperCase()}`;
};

/** Where a style is copied to, as the template writes it — filled in at export time, like a filter's folder. */
export const styleArgPath = (fileName: string) => '${pluginDir}/csl/' + fileName;

/** A file name that survives being written down and read back: pandoc reads `--csl` as a URI and decodes `%20`. */
const copyName = (style: ZoteroStyle) =>
  `${
    path
      .basename(style.filePath, '.csl')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'style'
  }.csl`;

/**
 * Copies the style into the plugin's own folder and answers with the path a template names it by.
 *
 * The copy is what gets exported with, rather than the file in Zotero's folder: it is the one chance to take the
 * language-specific layouts out of a multilingual style, it keeps a template working on a machine where Zotero lives
 * somewhere else, and it spares pandoc a file name it would read as a URL.
 */
export const installStyle = async (plugin: PandocGuiPlugin, style: ZoteroStyle): Promise<string> => {
  const xml = await fs.promises.readFile(style.filePath, 'utf8');
  const fileName = copyName(style);
  const folder = path.posix.join(plugin.manifest.dir, 'csl');
  const { adapter } = plugin.app.vault;

  if (!(await adapter.exists(folder))) {
    await adapter.mkdir(folder);
  }
  await adapter.write(path.posix.join(folder, fileName), style.multilingual ? withoutLocaleLayouts(xml) : xml);
  return styleArgPath(fileName);
};
