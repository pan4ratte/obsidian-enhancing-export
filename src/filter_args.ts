import { EMBEDS_FILTER, addLuaFilterArg, hasLuaFilterArg, removeLuaFilterArg } from './lua_filters';
import { bibliography, csl, setCiteproc, setCsl } from './writer_args';

/* The filters the plugin ships with, read out of and written into a template's extra arguments. */

/** The bundled filters a row can run, by the name they are written under. */
export const FILTERS = {
  figures: 'figures.lua',
  tableStyles: 'table-styles.lua',
  listStyles: 'list-styles.lua',
  keywords: 'keywords.lua',
  today: 'today.lua',
  embeds: EMBEDS_FILTER,
} as const;

/* -- The primitives ------------------------------------------------------- */

/** A `-M key=…` in every spelling pandoc takes for it. */
const metaPattern = (key: string) => String.raw`(?:^|\s)(?:-M|--metadata)[= ]${key}[=:]("[^"]*"|[^\s"]+)(?=\s|$)`;

const unquote = (value: string) => (value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value);

/** Only a value that would not survive the round trip needs the quotes. */
const quote = (value: string) => (/\s/.test(value) ? `"${value}"` : value);

const tidy = (args: string) => args.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');

/** The value `args` gives `key`, or undefined where it gives none. */
const metadata = (args: string | undefined, key: string): string | undefined => {
  let last: RegExpMatchArray | undefined;
  for (const match of (args ?? '').matchAll(new RegExp(metaPattern(key), 'g'))) {
    last = match;
  }
  return last ? unquote(last[1]) : undefined;
};

/** `args` with `key` set to `value`, or taken back out at undefined. */
const setMetadata = (args: string | undefined, key: string, value?: string, always = false): string => {
  const stripped = tidy((args ?? '').replace(new RegExp(metaPattern(key), 'g'), ' '));
  if (value === undefined) {
    return stripped;
  }
  const field = `-M ${key}=${always ? `"${value}"` : quote(value)}`;
  return stripped ? `${stripped} ${field}` : field;
};

/** Whether `args` runs one of the bundled filters. */
const runs = (args: string | undefined, filter: string) => hasLuaFilterArg(args, filter);

/**
 * `args` running `filter` or not, with every field `keys` names cleared when it is switched off — a field configuring
 * a filter that is not running is an answer to a question nobody can see.
 */
const setRuns = (args: string | undefined, filter: string, on: boolean, keys: readonly string[] = []): string => {
  if (on) {
    return addLuaFilterArg(args, filter);
  }
  return removeLuaFilterArg(
    keys.reduce((line, key) => setMetadata(line, key), args),
    filter
  );
};

/* -- Figure style for images ---------------------------------------------- */

/** What the figure filter styles with when nothing says otherwise. */
export const FIGURE_DEFAULT_STYLE = 'Figure';

const FIGURE_STYLE = 'figure-style';

/** The paragraph style `args` gives captionless images, or undefined where it leaves them alone. */
export const figureStyle = (args?: string): string | undefined =>
  runs(args, FILTERS.figures) ? (metadata(args, FIGURE_STYLE) ?? FIGURE_DEFAULT_STYLE) : undefined;

export const setFigureStyle = (args: string | undefined, style?: string): string => {
  const name = style?.trim();
  if (!name) {
    return setRuns(args, FILTERS.figures, false, [FIGURE_STYLE]);
  }
  return setMetadata(setRuns(args, FILTERS.figures, true), FIGURE_STYLE, name === FIGURE_DEFAULT_STYLE ? undefined : name);
};

/* -- Table cell styles ---------------------------------------------------- */

export const TABLE_DEFAULT_STYLE = 'Table Text';

const TABLE_STYLE = 'table-text-style';
const TABLE_HEAD_STYLE = 'table-head-style';

/** The paragraph style `args` gives table cells, or undefined for none. */
export const tableStyle = (args?: string): string | undefined =>
  runs(args, FILTERS.tableStyles) ? (metadata(args, TABLE_STYLE) ?? TABLE_DEFAULT_STYLE) : undefined;

export const setTableStyle = (args: string | undefined, style?: string): string => {
  const name = style?.trim();
  if (!name) {
    return setRuns(args, FILTERS.tableStyles, false, [TABLE_STYLE, TABLE_HEAD_STYLE]);
  }
  return setMetadata(setRuns(args, FILTERS.tableStyles, true), TABLE_STYLE, name === TABLE_DEFAULT_STYLE ? undefined : name);
};

/** The style header cells take, where they are to differ from the rest. */
export const tableHeadStyle = (args?: string): string | undefined =>
  runs(args, FILTERS.tableStyles) ? metadata(args, TABLE_HEAD_STYLE) : undefined;

export const setTableHeadStyle = (args: string | undefined, style?: string): string =>
  setMetadata(args, TABLE_HEAD_STYLE, style?.trim() || undefined);

/* -- Word list styles ----------------------------------------------------- */

const FLATTEN_ORDERED = 'list-flatten-ordered';

/** Whether `args` hands lists over to the reference document's list styles. */
export const listStyles = (args?: string): boolean => runs(args, FILTERS.listStyles);

export const setListStyles = (args: string | undefined, on: boolean): string => setRuns(args, FILTERS.listStyles, on, [FLATTEN_ORDERED]);

/** Whether numbered lists are styled the same way as bullets. */
export const flattenOrdered = (args?: string): boolean => listStyles(args) && metadata(args, FLATTEN_ORDERED) === 'true';

export const setFlattenOrdered = (args: string | undefined, on: boolean): string =>
  setMetadata(args, FLATTEN_ORDERED, on ? 'true' : undefined);

/* -- Keywords line -------------------------------------------------------- */

const KEYWORDS_TITLE = 'keywords-title';

/** Whether `args` writes the note's keywords property into the document. */
export const keywords = (args?: string): boolean => runs(args, FILTERS.keywords);

export const setKeywords = (args: string | undefined, on: boolean): string => setRuns(args, FILTERS.keywords, on, [KEYWORDS_TITLE]);

/** The label the line is written under. Empty is the filter's own "Keywords:". */
export const keywordsTitle = (args?: string): string | undefined => (keywords(args) ? metadata(args, KEYWORDS_TITLE) : undefined);

export const setKeywordsTitle = (args: string | undefined, title?: string): string =>
  setMetadata(args, KEYWORDS_TITLE, title?.trim() || undefined);

/* -- Today's date --------------------------------------------------------- */

/** The forms today's date can take. */
export const TODAY_FORMATS = ['long', 'medium', 'short', 'iso'] as const;

export type TodayFormat = (typeof TODAY_FORMATS)[number];

export const TODAY_DEFAULT_FORMAT: TodayFormat = 'long';

const TODAY = 'today';

/**
 * Written without a template literal so the `$` is plainly not this file's to interpolate: it is filled in at export
 * time, like `${luaDir}` in a filter flag.
 */
const todayVariable = (format: TodayFormat) => '${today.' + format + '}';

const isTodayFormat = (value?: string): value is TodayFormat => TODAY_FORMATS.includes(value as TodayFormat);

/** How `args` writes today's date, or undefined where it does not write one. */
export const todayFormat = (args?: string): TodayFormat | undefined => {
  if (!runs(args, FILTERS.today)) {
    return undefined;
  }
  const written = /^\$\{today\.(\w+)\}$/.exec(metadata(args, TODAY) ?? '')?.[1];
  return isTodayFormat(written) ? written : TODAY_DEFAULT_FORMAT;
};

export const setTodayFormat = (args: string | undefined, format?: TodayFormat): string => {
  if (!format) {
    return setRuns(args, FILTERS.today, false, [TODAY]);
  }
  // Always quoted: what this stands for is a date, and dates have spaces in them.
  return setMetadata(setRuns(args, FILTERS.today, true), TODAY, todayVariable(format), true);
};

/* -- Zotero citations ----------------------------------------------------- */

/** The filter that turns citations into live Zotero fields, and the one that reads the sources for citeproc. */
export const ZOTERO_FILTER = 'zotero.lua';
export const ZOTERO_REFERENCES_FILTER = 'zotero-references.lua';

const ZOTERO_STYLE = 'zotero-csl-style';
const ZOTERO_RENDERED = 'zotero-rendered';
const ZOTERO_LOCALE = 'zotero-locale';
/** Pandoc's own fields, read by citeproc and — for the first — by the Zotero filter after it. */
const SUPPRESS_BIBLIOGRAPHY = 'suppress-bibliography';
const NOTES_AFTER_PUNCTUATION = 'notes-after-punctuation';

/** A style as a template records it: what Zotero calls it, and the copy pandoc renders with. */
export interface ZoteroStyleArgs {
  /** The style's own id, which is what the exported document records to say how it was written. */
  id: string;
  /** The `--csl` file, as `zotero_styles` wrote it down. */
  cslPath: string;
  locale?: string;
}

/** Whether a `--csl` names one of the copies this plugin keeps, rather than a file someone chose themselves. */
const ownStyle = (file?: string) => !!file && file.includes('${pluginDir}/csl/');

/** The style `args` renders Zotero citations in, or undefined where it leaves them for Zotero to render. */
export const zoteroStyle = (args?: string): ZoteroStyleArgs | undefined => {
  if (!runs(args, ZOTERO_FILTER) || metadata(args, ZOTERO_RENDERED) !== 'true') {
    return undefined;
  }
  const id = metadata(args, ZOTERO_STYLE);
  const cslPath = csl(args);
  return id && cslPath ? { id, cslPath, locale: metadata(args, ZOTERO_LOCALE) } : undefined;
};

/**
 * `args` exporting live Zotero citations in `style`, or back to leaving them unrendered at undefined.
 *
 * One row writes the lot, because the parts only work together: the sources have to be read before citeproc renders
 * them, citeproc has to run before the citations are made live, and the document has to record the same style
 * Zotero will reformat it with.
 */
export const setZoteroStyle = (args: string | undefined, style?: ZoteroStyleArgs): string => {
  if (!style) {
    const keys = [ZOTERO_STYLE, ZOTERO_RENDERED, ZOTERO_LOCALE, SUPPRESS_BIBLIOGRAPHY, NOTES_AFTER_PUNCTUATION];
    const cleared = keys.reduce((line, key) => setMetadata(line, key), args);
    const withoutFilter = removeLuaFilterArg(cleared, ZOTERO_REFERENCES_FILTER);
    // The style file was this plugin's copy and means nothing now. Citeproc stays where it still has something to
    // work from — switching it off takes the references and the style file with it.
    const withoutStyle = ownStyle(csl(withoutFilter)) ? setCsl(withoutFilter, '') : withoutFilter;
    return bibliography(withoutStyle) || csl(withoutStyle) ? withoutStyle : setCiteproc(withoutStyle, false);
  }

  const filters = addLuaFilterArg(addLuaFilterArg(args, ZOTERO_REFERENCES_FILTER), ZOTERO_FILTER);
  const rendering = setCsl(setCiteproc(filters, true), style.cslPath);
  const named = setMetadata(setMetadata(rendering, ZOTERO_STYLE, style.id), ZOTERO_RENDERED, 'true');
  const located = setMetadata(named, ZOTERO_LOCALE, style.locale);

  // Where the marker goes is a matter of the language rather than of the style, and only the first choice is made
  // here: an answer already on the line is the reader's, and choosing another style does not overrule it.
  if (metadata(located, NOTES_AFTER_PUNCTUATION) !== undefined) {
    return located;
  }
  return setNoteBeforePunctuation(located, !!style.locale?.startsWith('ru'));
};

/**
 * Whether a footnote marker stands before the punctuation — `работе[1].` — rather than after it. Russian typography
 * sets it before, and pandoc puts it after unless told otherwise.
 */
export const noteBeforePunctuation = (args?: string): boolean => metadata(args, NOTES_AFTER_PUNCTUATION) === 'false';

export const setNoteBeforePunctuation = (args: string | undefined, on: boolean): string =>
  setMetadata(args, NOTES_AFTER_PUNCTUATION, on ? 'false' : 'true');

/**
 * Whether the document is to end with a bibliography. A footnote style writes the whole source in the note, and the
 * list after it is a second copy of everything — so this is a row of its own rather than the style's business.
 */
export const zoteroBibliography = (args?: string): boolean => metadata(args, SUPPRESS_BIBLIOGRAPHY) !== 'true';

export const setZoteroBibliography = (args: string | undefined, on: boolean): string =>
  setMetadata(args, SUPPRESS_BIBLIOGRAPHY, on ? undefined : 'true');

/* -- Embedded notes ------------------------------------------------------- */

/** Whether `args` writes embedded notes into the document. */
export const embedNotes = (args?: string): boolean => runs(args, FILTERS.embeds);

export const setEmbedNotes = (args: string | undefined, on: boolean): string => setRuns(args, FILTERS.embeds, on);
