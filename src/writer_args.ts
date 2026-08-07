/*
 * The writer options a template carries, read out of and written into its extra
 * arguments.
 *
 * The extra arguments, not the arguments proper: those are rewritten wholesale
 * whenever the template's output format changes, and would take these options
 * with them — the same reason the table-of-contents flags and the lua-filter
 * flags live there. `toc_args.ts` is this same idea for `--toc`; it was written
 * first and is left where it is.
 *
 * Reading is deliberately more forgiving than writing. A template may have been
 * typed by hand, so every spelling pandoc accepts is understood — `-N`, `--lof`,
 * a space-separated `--highlight-style kate`, a `--mathjax=URL` naming a build
 * of its own — while what is written back is always one settled form. Where an
 * option can be given twice pandoc takes the last, and so do these readers.
 */

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A value as it appears after an option, quoted or bare. */
const VALUE = String.raw`("[^"]*"|[^\s"]+)`;

/**
 * Flags with nothing after them, as one alternation. The lookahead is what
 * keeps `--lof` from matching the front of a longer flag — the same trick
 * `toc_args` plays to keep `--toc` out of `--toc-depth`.
 */
const flagsPattern = (names: readonly string[]) => String.raw`(?:^|\s)(?:${names.map(escapeRegExp).join('|')})(?=\s|$)`;

/** A flag carrying a value: `--pdf-engine=xelatex`, `--highlight-style kate`. */
const optionPattern = (name: string) => String.raw`(?:^|\s)${escapeRegExp(name)}[= ]${VALUE}(?=\s|$)`;

/** `args` without anything `pattern` matches, tidied up after. */
const without = (args: string | undefined, pattern: string) =>
  (args ?? '')
    .replace(new RegExp(pattern, 'g'), ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const append = (args: string, flag: string) => (args ? `${args} ${flag}` : flag);

const unquote = (value: string) => (value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value);

/** Only a value that would not survive the round trip needs the quotes. */
const quote = (value: string) => (/\s/.test(value) ? `"${value}"` : value);

/** The last match of `pattern`, since the last option given is the one pandoc takes. */
const lastMatch = (args: string | undefined, pattern: string): RegExpMatchArray | undefined => {
  let last: RegExpMatchArray | undefined;
  for (const match of (args ?? '').matchAll(new RegExp(pattern, 'g'))) {
    last = match;
  }
  return last;
};

/** The value `args` gives `name`, or undefined where it does not give one. */
const valueOf = (args: string | undefined, name: string): string | undefined => {
  const found = lastMatch(args, optionPattern(name))?.[1];
  return found === undefined ? undefined : unquote(found);
};

/**
 * `args` with `name` set to `value`, or taken back out at undefined. Whatever
 * was there before is replaced rather than added to, so the option can never
 * end up in the line twice.
 */
const setValue = (args: string | undefined, name: string, value?: string): string => {
  const stripped = without(args, optionPattern(name));
  return value ? append(stripped, `${name}=${quote(value)}`) : stripped;
};

const has = (args: string | undefined, names: readonly string[]) => new RegExp(flagsPattern(names)).test(args ?? '');

/** `args` carrying the first of `names`, or none of them. */
const setPresence = (args: string | undefined, names: readonly string[], on: boolean): string => {
  const stripped = without(args, flagsPattern(names));
  return on ? append(stripped, names[0]) : stripped;
};

/* -- Numbered headings ---------------------------------------------------- */

/** `-N` is pandoc's short form; the long one is what gets written. */
const NUMBER_SECTIONS = ['--number-sections', '-N'] as const;
const NUMBER_OFFSET = '--number-offset';

export const numberSections = (args?: string): boolean => has(args, NUMBER_SECTIONS);

export const setNumberSections = (args: string | undefined, on: boolean): string => {
  const next = setPresence(args, NUMBER_SECTIONS, on);
  // An offset is only ever an offset into numbering, and pandoc reads one as
  // asking for numbering — left behind, it would switch straight back on.
  return on ? next : setValue(next, NUMBER_OFFSET);
};

/**
 * Where the numbering starts: pandoc's comma-separated list of per-level
 * offsets, `5` for a first heading numbered 6, `1,4` for one numbered 1.5.
 */
export const numberOffset = (args?: string): string | undefined => valueOf(args, NUMBER_OFFSET);

export const setNumberOffset = (args: string | undefined, offset: string): string => {
  // Digits and the commas between them, which is all pandoc accepts. An empty
  // field takes the option out rather than writing `--number-offset=`.
  const cleaned = offset
    .replace(/[^\d,]/g, '')
    .replace(/,{2,}/g, ',')
    .replace(/^,+|,+$/g, '');
  return setValue(args, NUMBER_OFFSET, cleaned || undefined);
};

/* -- Lists of figures and tables ------------------------------------------ */

const LIST_OF_FIGURES = ['--list-of-figures', '--lof'] as const;
const LIST_OF_TABLES = ['--list-of-tables', '--lot'] as const;

export const listOfFigures = (args?: string): boolean => has(args, LIST_OF_FIGURES);
export const setListOfFigures = (args: string | undefined, on: boolean): string => setPresence(args, LIST_OF_FIGURES, on);

export const listOfTables = (args?: string): boolean => has(args, LIST_OF_TABLES);
export const setListOfTables = (args: string | undefined, on: boolean): string => setPresence(args, LIST_OF_TABLES, on);

/* -- Top-level division --------------------------------------------------- */

/**
 * What a level-1 heading becomes. Pandoc's own answer is spelled `default`, and
 * is written as no option at all — the same thing, and one less thing in a line
 * the user reads.
 */
export const TOP_LEVEL_DIVISIONS = ['section', 'chapter', 'part'] as const;
export type TopLevelDivision = (typeof TOP_LEVEL_DIVISIONS)[number];

const TOP_LEVEL_DIVISION = '--top-level-division';

const isDivision = (value?: string): value is TopLevelDivision => TOP_LEVEL_DIVISIONS.includes(value as TopLevelDivision);

export const topLevelDivision = (args?: string): TopLevelDivision | undefined => {
  const value = valueOf(args, TOP_LEVEL_DIVISION);
  return isDivision(value) ? value : undefined;
};

export const setTopLevelDivision = (args: string | undefined, division: string): string =>
  setValue(args, TOP_LEVEL_DIVISION, isDivision(division) ? division : undefined);

/* -- Code highlighting ---------------------------------------------------- */

/**
 * The styles pandoc ships, `pygments` — its own default — first.
 *
 * Pandoc now spells this option `--syntax-highlighting=STYLE|none` and calls
 * the older pair deprecated, but deprecated is not gone, and the older pair is
 * all a pandoc before 3.7 understands. So both spellings are read, and the ones
 * every version takes are what get written.
 */
export const HIGHLIGHT_STYLES = ['pygments', 'tango', 'espresso', 'zenburn', 'kate', 'monochrome', 'breezedark', 'haddock'] as const;

/** Highlighting switched off, as against left to pandoc — that is `undefined`. */
export const HIGHLIGHT_NONE = 'none';

const HIGHLIGHT = String.raw`(?:^|\s)(?:(--no-highlight)|(?:--highlight-style|--syntax-highlighting)[= ]${VALUE})(?=\s|$)`;

/**
 * The style asked for, `HIGHLIGHT_NONE`, or undefined where pandoc is left to
 * itself. A value none of `HIGHLIGHT_STYLES` names is a theme file of the
 * user's own, and is given back as it stands rather than thrown away.
 */
export const highlightStyle = (args?: string): string | undefined => {
  const found = lastMatch(args, HIGHLIGHT);
  if (!found) {
    return undefined;
  }
  // `--syntax-highlighting=none` says what `--no-highlight` says.
  return found[1] ? HIGHLIGHT_NONE : unquote(found[2]);
};

export const setHighlightStyle = (args: string | undefined, style: string): string => {
  const stripped = without(args, HIGHLIGHT);
  if (!style) {
    return stripped;
  }
  return append(stripped, style === HIGHLIGHT_NONE ? '--no-highlight' : `--highlight-style=${quote(style)}`);
};

/* -- Math ----------------------------------------------------------------- */

/**
 * How TeX math reaches HTML.
 *
 * Each of these may carry a URL of its own — the HTML preset pins a MathJax
 * build that way — so the URL is read past rather than tripped over. Choosing a
 * method writes the bare flag, which is pandoc's own script for it: a pinned
 * URL is replaced, and plainly so, since the line is on screen above.
 */
export const MATH_METHODS = ['mathjax', 'katex', 'mathml', 'webtex', 'gladtex'] as const;
export type MathMethod = (typeof MATH_METHODS)[number];

const MATH = String.raw`(?:^|\s)--(${MATH_METHODS.join('|')})(?:=${VALUE})?(?=\s|$)`;

export const mathMethod = (args?: string): MathMethod | undefined => lastMatch(args, MATH)?.[1] as MathMethod | undefined;

export const setMathMethod = (args: string | undefined, method: string): string => {
  const stripped = without(args, MATH);
  return MATH_METHODS.includes(method as MathMethod) ? append(stripped, `--${method}`) : stripped;
};

/* -- PDF engine ----------------------------------------------------------- */

/**
 * The engines pandoc names, likeliest first. Anything else is a program of the
 * user's own — a path, or an engine newer than this list — and is kept.
 */
export const PDF_ENGINES = [
  'pdflatex',
  'xelatex',
  'lualatex',
  'tectonic',
  'latexmk',
  'typst',
  'context',
  'weasyprint',
  'pagedjs-cli',
  'prince',
  'wkhtmltopdf',
  'groff',
  'pdfroff',
] as const;

const PDF_ENGINE = '--pdf-engine';

export const pdfEngine = (args?: string): string | undefined => valueOf(args, PDF_ENGINE);

export const setPdfEngine = (args: string | undefined, engine: string): string => setValue(args, PDF_ENGINE, engine || undefined);
