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

/** Every spelling of one option, as one alternation. */
const alternation = (names: Names) => (typeof names === 'string' ? [names] : names).map(escapeRegExp).join('|');

/** The spelling written back, which is always the first one named. */
const written = (names: Names) => (typeof names === 'string' ? names : names[0]);

/** An option under all the names pandoc answers to for it, longest form first. */
type Names = string | readonly string[];

/**
 * Flags with nothing after them, as one alternation. The lookahead is what
 * keeps `--lof` from matching the front of a longer flag — the same trick
 * `toc_args` plays to keep `--toc` out of `--toc-depth`.
 */
const flagsPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})(?=\s|$)`;

/** A flag carrying a value: `--pdf-engine=xelatex`, `--highlight-style kate`. */
const optionPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})[= ]${VALUE}(?=\s|$)`;

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
const valueOf = (args: string | undefined, name: Names): string | undefined => {
  const found = lastMatch(args, optionPattern(name))?.[1];
  return found === undefined ? undefined : unquote(found);
};

/**
 * `args` with `name` set to `value`, or taken back out at undefined. Whatever
 * was there before is replaced rather than added to, so the option can never
 * end up in the line twice.
 */
const setValue = (args: string | undefined, name: Names, value?: string): string => {
  const stripped = without(args, optionPattern(name));
  return value ? append(stripped, `${written(name)}=${quote(value)}`) : stripped;
};

const has = (args: string | undefined, names: Names) => new RegExp(flagsPattern(names)).test(args ?? '');

/** `args` carrying the first of `names`, or none of them. */
const setPresence = (args: string | undefined, names: Names, on: boolean): string => {
  const stripped = without(args, flagsPattern(names));
  return on ? append(stripped, written(names)) : stripped;
};

/**
 * A switch in all three spellings pandoc 3 takes: `--section-divs`, and the
 * `=true` and `=false` that let a later option undo an earlier one.
 */
const switchPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})(?:=(true|false))?(?=\s|$)`;

/** What `args` says about a switch, or undefined where it says nothing. */
const switchValue = (args: string | undefined, names: Names): boolean | undefined => {
  const found = lastMatch(args, switchPattern(names));
  return found ? found[1] !== 'false' : undefined;
};

/**
 * `args` saying a switch is `on`, against a default of `byDefault`.
 *
 * Agreeing with the default is written as nothing at all: pandoc does that
 * already, and a line says more when it holds only what was asked for. The
 * default is not always pandoc's own — where the arguments proper already ask
 * for the option, theirs is the default this one has to differ from.
 */
const setSwitch = (args: string | undefined, names: Names, on: boolean, byDefault = false): string => {
  const stripped = without(args, switchPattern(names));
  return on === byDefault ? stripped : append(stripped, on ? written(names) : `${written(names)}=false`);
};

/** Both lines as pandoc sees them, the extra arguments last, since they win. */
const joined = (args: readonly (string | undefined)[]) => args.filter(Boolean).join(' ');

/** A count, as a count: what a field meant for one is allowed to hold. */
const digits = (value: string) => value.replace(/\D/g, '');

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

/* -- Citations ------------------------------------------------------------ */

/** `-C` is pandoc's short form; the long one is what gets written. */
const CITEPROC = ['--citeproc', '-C'] as const;
const BIBLIOGRAPHY = '--bibliography';
const CSL = '--csl';

export const citeproc = (args?: string): boolean => has(args, CITEPROC);

export const setCiteproc = (args: string | undefined, on: boolean): string => {
  const next = setPresence(args, CITEPROC, on);
  // Neither file does anything by itself — both only set a metadata field that
  // citeproc goes on to read — and the rows they are typed into are hidden
  // along with the toggle. Left behind they would be answers nobody can see.
  return on ? next : setValue(setValue(next, CSL), BIBLIOGRAPHY);
};

/**
 * The references citeproc reads. Pandoc takes this option more than once and
 * reads every file named; the modal asks for one, so a line naming several is
 * read as the last of them and settles to that one when the row is changed.
 */
export const bibliography = (args?: string): string | undefined => valueOf(args, BIBLIOGRAPHY);

export const setBibliography = (args: string | undefined, file: string): string => setValue(args, BIBLIOGRAPHY, file || undefined);

/** The style file the citations and the bibliography are formatted to. */
export const csl = (args?: string): string | undefined => valueOf(args, CSL);

export const setCsl = (args: string | undefined, file: string): string => setValue(args, CSL, file || undefined);

/* -- Reference document --------------------------------------------------- */

/** The document a docx, odt or pptx export takes its styles from. */
const REFERENCE_DOC = '--reference-doc';

export const referenceDoc = (args?: string): string | undefined => valueOf(args, REFERENCE_DOC);

export const setReferenceDoc = (args: string | undefined, file: string): string => setValue(args, REFERENCE_DOC, file || undefined);

/* -- Stylesheet ----------------------------------------------------------- */

/** `--css` is repeatable as well, and is read and written as the one file. */
const CSS = ['--css', '-c'] as const;

export const css = (args?: string): string | undefined => valueOf(args, CSS);

export const setCss = (args: string | undefined, file: string): string => setValue(args, CSS, file || undefined);

/* -- Include files -------------------------------------------------------- */

/**
 * Files copied into the written document verbatim — a LaTeX preamble, a script
 * in an HTML head, a footer under the body. Each implies `--standalone`, which
 * every shipped template already asks for.
 */
const INCLUDE_IN_HEADER = ['--include-in-header', '-H'] as const;
const INCLUDE_BEFORE_BODY = ['--include-before-body', '-B'] as const;
const INCLUDE_AFTER_BODY = ['--include-after-body', '-A'] as const;

export const includeInHeader = (args?: string): string | undefined => valueOf(args, INCLUDE_IN_HEADER);
export const setIncludeInHeader = (args: string | undefined, file: string): string => setValue(args, INCLUDE_IN_HEADER, file || undefined);

export const includeBeforeBody = (args?: string): string | undefined => valueOf(args, INCLUDE_BEFORE_BODY);
export const setIncludeBeforeBody = (args: string | undefined, file: string): string =>
  setValue(args, INCLUDE_BEFORE_BODY, file || undefined);

export const includeAfterBody = (args?: string): string | undefined => valueOf(args, INCLUDE_AFTER_BODY);
export const setIncludeAfterBody = (args: string | undefined, file: string): string =>
  setValue(args, INCLUDE_AFTER_BODY, file || undefined);

/* -- Variables and metadata ----------------------------------------------- */

/** One `key=value`. A value of `''` is pandoc's bare `-V key`, which is true. */
export type Pair = { key: string; value: string };

/**
 * A `key=value` after `-V`, quoted whole (`-V "mainfont=PT Serif"`), quoted in
 * part (`-V mainfont="PT Serif"`) or not at all. Unlike every other value here
 * it is one token made of several, since the quotes may fall anywhere in it.
 */
const PAIR = String.raw`((?:"[^"]*"|[^\s"])+)`;

const pairPattern = (names: Names) => String.raw`(?:^|\s)(?:${alternation(names)})[= ]${PAIR}(?=\s|$)`;

/** `key=value` split at the first `=`, which is where pandoc splits it. */
const readPair = (token: string): Pair => {
  const bare = token.replace(/"/g, '');
  const at = bare.indexOf('=');
  return at === -1 ? { key: bare, value: '' } : { key: bare.slice(0, at), value: bare.slice(at + 1) };
};

const writePair = ({ key, value }: Pair) => quote(value ? `${key}=${value}` : key);

/**
 * The readers and writers a repeatable `KEY=VALUE` option needs.
 *
 * `-V` and `-M` are what get written, against the long forms every other option
 * here settles to: `--variable=fontsize=12pt` carries two `=` and reads as a
 * puzzle, and the short form is what pandoc's own documentation uses.
 */
const pairOption = (names: readonly string[]) => {
  const pattern = pairPattern(names);

  /** Every pair in the line, in the order pandoc reads them. */
  const all = (args?: string): Pair[] => [...(args ?? '').matchAll(new RegExp(pattern, 'g'))].map(m => readPair(m[1]));

  /** The line without the pairs `drop` names, the rest left where they were. */
  const strip = (args: string | undefined, drop: (key: string) => boolean) =>
    (args ?? '')
      .replace(new RegExp(pattern, 'g'), (whole, token: string) => (drop(readPair(token).key) ? ' ' : whole))
      .replace(/\s{2,}/g, ' ')
      .trim();

  const add = (args: string, pairs: readonly Pair[]) => pairs.reduce((line, pair) => append(line, `${names[0]} ${writePair(pair)}`), args);

  return {
    all,
    /** The value the line gives `key` — the last, since that is the one pandoc takes. */
    valueOf: (args: string | undefined, key: string): string | undefined =>
      all(args)
        .filter(p => p.key === key)
        .pop()?.value,
    /** The line with `key` set, or taken back out at an empty value. */
    set: (args: string | undefined, key: string, value: string): string => {
      const stripped = strip(args, k => k === key);
      return value ? add(stripped, [{ key, value }]) : stripped;
    },
    /** The line rewritten to `pairs`, less the keys `keep` names — those are
        written by rows of their own and are left exactly as they were found. */
    setAll: (args: string | undefined, pairs: readonly Pair[], keep: readonly string[] = []): string => {
      const stripped = strip(args, k => !keep.includes(k));
      return add(
        stripped,
        pairs.filter(p => p.key && !keep.includes(p.key))
      );
    },
  };
};

const VARIABLES = pairOption(['-V', '--variable']);
const METADATA = pairOption(['-M', '--metadata']);

export const variables = VARIABLES.all;
export const variable = VARIABLES.valueOf;
export const setVariable = VARIABLES.set;
export const setVariables = VARIABLES.setAll;

export const metadata = METADATA.all;
export const metadataValue = METADATA.valueOf;
export const setMetadataValue = METADATA.set;
export const setMetadata = METADATA.setAll;

/**
 * The variables the modal asks for by name, each with a row of its own. Every
 * other one is typed into the list, which leaves these alone — see `setAll`.
 *
 * Which writers read which of them is `pandoc_format`'s to say.
 */
export const CURATED_VARIABLES = ['papersize', 'fontsize', 'mainfont', 'geometry', 'linkcolor', 'lang'] as const;

export type CuratedVariable = (typeof CURATED_VARIABLES)[number];

/** The list as it is typed: one `key=value` a line, blank lines passed over. */
export const pairsFromText = (text: string): Pair[] =>
  text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const at = line.indexOf('=');
      return at === -1 ? { key: line, value: '' } : { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
    })
    .filter(pair => pair.key.length > 0);

/** The same list as it is shown. A pair with no value is pandoc's bare `-V key`. */
export const textFromPairs = (pairs: readonly Pair[]): string =>
  pairs.map(({ key, value }) => (value ? `${key}=${value}` : key)).join('\n');

/** The sizes pandoc's own documentation names, in the spelling LaTeX takes. */
export const PAPER_SIZES = ['a4', 'letter', 'a5', 'b5', 'legal', 'executive'] as const;

/** What a LaTeX document class accepts; other writers take any CSS length. */
export const FONT_SIZES = ['10pt', '11pt', '12pt'] as const;

/* -- The written source --------------------------------------------------- */

/**
 * How the lines of the written file are broken.
 *
 * Pandoc's own answer is `auto`, written as no option at all. `none` puts each
 * paragraph on one line, which is what a document kept under version control
 * usually wants; `preserve` keeps the breaks the note itself had.
 */
export const WRAP_MODES = ['none', 'preserve'] as const;

const WRAP = '--wrap';
const COLUMNS = '--columns';

/** Whatever the line asks for, `auto` and anything hand-written included. */
export const wrap = (args?: string): string | undefined => valueOf(args, WRAP);

export const setWrap = (args: string | undefined, mode: string): string => setValue(args, WRAP, mode || undefined);

/** Where `--wrap=auto` breaks a line. Pandoc's own answer is 72. */
export const columns = (args?: string): string | undefined => valueOf(args, COLUMNS);

export const setColumns = (args: string | undefined, count: string): string => setValue(args, COLUMNS, digits(count) || undefined);

/** How a heading is written in markdown. Pandoc's own answer is `atx`. */
export const MARKDOWN_HEADINGS = ['atx', 'setext'] as const;

const MARKDOWN_HEADING = '--markdown-headings';

export const markdownHeadings = (args?: string): string | undefined => valueOf(args, MARKDOWN_HEADING);

export const setMarkdownHeadings = (args: string | undefined, style: string): string =>
  setValue(args, MARKDOWN_HEADING, MARKDOWN_HEADINGS.includes(style as (typeof MARKDOWN_HEADINGS)[number]) ? style : undefined);

/** Links written as `[text][ref]` with the URLs collected below, not inline. */
const REFERENCE_LINKS = '--reference-links';

export const referenceLinks = (args?: string): boolean => switchValue(args, REFERENCE_LINKS) ?? false;

export const setReferenceLinks = (args: string | undefined, on: boolean): string => setSwitch(args, REFERENCE_LINKS, on);

/** Where the footnotes — and the link references, once they are collected — go. */
export const REFERENCE_LOCATIONS = ['block', 'section', 'document'] as const;

const REFERENCE_LOCATION = '--reference-location';

export const referenceLocation = (args?: string): string | undefined => valueOf(args, REFERENCE_LOCATION);

export const setReferenceLocation = (args: string | undefined, where: string): string =>
  setValue(args, REFERENCE_LOCATION, REFERENCE_LOCATIONS.includes(where as (typeof REFERENCE_LOCATIONS)[number]) ? where : undefined);

/* -- Slides --------------------------------------------------------------- */

/** `-i` is pandoc's short form; the long one is what gets written. */
const INCREMENTAL = ['--incremental', '-i'] as const;

export const incremental = (args?: string): boolean => switchValue(args, INCREMENTAL) ?? false;

export const setIncremental = (args: string | undefined, on: boolean): string => setSwitch(args, INCREMENTAL, on);

/**
 * The heading level that starts a new slide. Pandoc works one out from the
 * document unless told, and `0` says that no heading starts one.
 */
export const SLIDE_LEVELS = ['0', '1', '2', '3'] as const;

const SLIDE_LEVEL = '--slide-level';

export const slideLevel = (args?: string): string | undefined => valueOf(args, SLIDE_LEVEL);

export const setSlideLevel = (args: string | undefined, level: string): string => setValue(args, SLIDE_LEVEL, digits(level) || undefined);

/* -- EPUB ----------------------------------------------------------------- */

const EPUB_COVER_IMAGE = '--epub-cover-image';
const EPUB_EMBED_FONT = '--epub-embed-font';
const EPUB_TITLE_PAGE = '--epub-title-page';

/** The heading level a new file is started at — a chapter, in an EPUB. */
export const SPLIT_LEVELS = ['1', '2', '3'] as const;

/** Pandoc calls this `--epub-chapter-level` as well, and still reads the older name. */
const SPLIT_LEVEL = ['--split-level', '--epub-chapter-level'] as const;

export const epubCoverImage = (args?: string): string | undefined => valueOf(args, EPUB_COVER_IMAGE);

export const setEpubCoverImage = (args: string | undefined, file: string): string => setValue(args, EPUB_COVER_IMAGE, file || undefined);

/** Repeatable, like the bibliography; the modal asks for the one font. */
export const epubEmbedFont = (args?: string): string | undefined => valueOf(args, EPUB_EMBED_FONT);

export const setEpubEmbedFont = (args: string | undefined, file: string): string => setValue(args, EPUB_EMBED_FONT, file || undefined);

/** A title page is what pandoc writes unless it is told not to. */
export const epubTitlePage = (args?: string): boolean => switchValue(args, EPUB_TITLE_PAGE) ?? true;

export const setEpubTitlePage = (args: string | undefined, on: boolean): string => setSwitch(args, EPUB_TITLE_PAGE, on, true);

export const splitLevel = (args?: string): string | undefined => valueOf(args, SPLIT_LEVEL);

export const setSplitLevel = (args: string | undefined, level: string): string => setValue(args, SPLIT_LEVEL, digits(level) || undefined);

/* -- The written page ----------------------------------------------------- */

const EMBED_RESOURCES = '--embed-resources';
const SECTION_DIVS = '--section-divs';
const ID_PREFIX = '--id-prefix';

/** What is done with an address so that it is not read straight off the page. */
export const EMAIL_OBFUSCATIONS = ['none', 'javascript', 'references'] as const;

const EMAIL_OBFUSCATION = '--email-obfuscation';

/**
 * Whether the page carries its own images, styles and scripts.
 *
 * Read across both lines rather than out of the extra arguments alone: the
 * shipped Html template asks for this in the arguments proper, and a row that
 * could not see it would report a self-contained page as a page of loose
 * files. Writing is `setEmbedResources`, which is told the same thing.
 */
export const embedResources = (...args: (string | undefined)[]): boolean => switchValue(joined(args), EMBED_RESOURCES) ?? false;

/**
 * `inherited` is what the arguments proper already say, so a template whose
 * preset embeds resources writes nothing to say so — and writes
 * `--embed-resources=false` to say otherwise, which is how pandoc is told to
 * undo an option given earlier in the same line.
 */
export const setEmbedResources = (args: string | undefined, on: boolean, inherited = false): string =>
  setSwitch(args, EMBED_RESOURCES, on, inherited);

/** Each section wrapped in a `<div>`, so a stylesheet can reach one. */
export const sectionDivs = (args?: string): boolean => switchValue(args, SECTION_DIVS) ?? false;

export const setSectionDivs = (args: string | undefined, on: boolean): string => setSwitch(args, SECTION_DIVS, on);

export const emailObfuscation = (args?: string): string | undefined => valueOf(args, EMAIL_OBFUSCATION);

export const setEmailObfuscation = (args: string | undefined, method: string): string =>
  setValue(args, EMAIL_OBFUSCATION, EMAIL_OBFUSCATIONS.includes(method as (typeof EMAIL_OBFUSCATIONS)[number]) ? method : undefined);

/** Put in front of every identifier, so a page can hold two of these documents. */
export const idPrefix = (args?: string): string | undefined => valueOf(args, ID_PREFIX);

export const setIdPrefix = (args: string | undefined, prefix: string): string => setValue(args, ID_PREFIX, prefix || undefined);

/* -- Media ---------------------------------------------------------------- */

const EXTRACT_MEDIA = '--extract-media';
const DPI = '--dpi';

/**
 * The folder the images are written out to. Read across both lines, as
 * `embedResources` is: the shipped Latex template extracts media in the
 * arguments proper.
 */
export const extractMedia = (...args: (string | undefined)[]): string | undefined => valueOf(joined(args), EXTRACT_MEDIA);

export const setExtractMedia = (args: string | undefined, dir: string): string => setValue(args, EXTRACT_MEDIA, dir || undefined);

/** What a pixel is worth where the writer has to put a real size on an image. */
export const dpi = (args?: string): string | undefined => valueOf(args, DPI);

export const setDpi = (args: string | undefined, value: string): string => setValue(args, DPI, digits(value) || undefined);
