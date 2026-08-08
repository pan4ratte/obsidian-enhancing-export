import { addLuaFilterArg, hasLuaFilterArg, removeLuaFilterArg } from './lua_filters';

/*
 * The filters the plugin ships with, read out of and written into a template's
 * extra arguments.
 *
 * Each of these solves a problem that belongs to exporting an Obsidian note
 * rather than to pandoc — a picture that lands in body text, a table whose
 * cells ignore the table style, a list whose bullets ignore Word's list style,
 * an embedded note that arrives as a broken image. Pandoc has no option for any
 * of them: only a filter can rewrite the document that far. So the filters are
 * the plugin's own, shipped in `lua-filters/bundled` and written to `lua/` on
 * load, and this module is what the template editor's rows read and write —
 * exactly as `toc_args` is for `--toc` and `writer_args` for the rest.
 *
 * A row is two things on the command line: the `--lua-filter` that runs the
 * filter, and a `-M` field or two that configures it. Both are written here so
 * a row is one answer, and a filter's own default is written as nothing at all
 * — it is what the filter does anyway, and the line says more when it holds
 * only what was asked for.
 */

/** The bundled filters a row can run, by the name they are written under. */
export const FILTERS = {
  figures: 'figures.lua',
  tableStyles: 'table-styles.lua',
  listStyles: 'list-styles.lua',
  keywords: 'keywords.lua',
  today: 'today.lua',
  embeds: 'embeds.lua',
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

/**
 * `args` with `key` set to `value`, or taken back out at undefined. Whatever
 * was there before is replaced rather than added to, so the field can never end
 * up in the line twice.
 *
 * `always` quotes a value that does not look as though it needs it — for a
 * `${…}` that is a date by the time pandoc reads it, and dates have spaces.
 */
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
 * `args` running `filter` or not, with every field `keys` names cleared when it
 * is switched off — a field configuring a filter that is not running is an
 * answer to a question nobody can see.
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

/**
 * The paragraph style `args` gives captionless images, or undefined where it
 * leaves them alone.
 *
 * The filter is what does the styling, so the filter is what says whether this
 * is on at all; a style named without it is a metadata field nothing reads.
 */
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

/**
 * The style header cells take, where they are to differ from the rest. Empty
 * means what the filter does on its own: the same style as the body cells.
 */
export const tableHeadStyle = (args?: string): string | undefined =>
  runs(args, FILTERS.tableStyles) ? metadata(args, TABLE_HEAD_STYLE) : undefined;

export const setTableHeadStyle = (args: string | undefined, style?: string): string =>
  setMetadata(args, TABLE_HEAD_STYLE, style?.trim() || undefined);

/* -- Word list styles ----------------------------------------------------- */

const FLATTEN_ORDERED = 'list-flatten-ordered';

/** Whether `args` hands lists over to the reference document's list styles. */
export const listStyles = (args?: string): boolean => runs(args, FILTERS.listStyles);

export const setListStyles = (args: string | undefined, on: boolean): string => setRuns(args, FILTERS.listStyles, on, [FLATTEN_ORDERED]);

/**
 * Whether numbered lists are styled the same way as bullets.
 *
 * They cannot both take their look from the style and restart at 1 — the
 * numbering that restarts them is pandoc's own, and it is what overrides the
 * style. So this is a choice, and the row that offers it says so.
 */
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

/**
 * The forms today's date can take. Not pandoc's business and not the filter's:
 * `exporto0o` writes the date itself, in the language Obsidian is set to, and
 * offers each form as a variable. The row picks which variable to write, so the
 * command shown in the editor says exactly what will be substituted, and a
 * language the plugin has never heard of costs nothing.
 */
export const TODAY_FORMATS = ['long', 'medium', 'short', 'iso'] as const;

export type TodayFormat = (typeof TODAY_FORMATS)[number];

export const TODAY_DEFAULT_FORMAT: TodayFormat = 'long';

const TODAY = 'today';

/**
 * Written without a template literal so the `$` is plainly not this file's to
 * interpolate: it is filled in at export time, like `${luaDir}` in a filter flag.
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

/* -- Embedded notes ------------------------------------------------------- */

/** Whether `args` writes embedded notes into the document. */
export const embedNotes = (args?: string): boolean => runs(args, FILTERS.embeds);

export const setEmbedNotes = (args: string | undefined, on: boolean): string => setRuns(args, FILTERS.embeds, on);
