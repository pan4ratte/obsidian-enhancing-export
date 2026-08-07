/*
 * What a template writes, and what that writer can be asked to do.
 *
 * The output format is read back out of the arguments rather than taken from
 * the preset: the preset is only what the template started as, and the `-t` in
 * the arguments is what pandoc will actually be told. Later options win, so the
 * last one on the line is the answer — extra arguments included, since they are
 * appended after the arguments proper.
 */

/** The `-t`/`--to` a template ends up passing, without any `+extensions`. */
export const outputFormat = (...args: (string | undefined)[]): string | undefined => {
  let writer: string | undefined;
  for (const arg of args) {
    for (const [, found] of (arg ?? '').matchAll(/(?:^|\s)(?:-t|--to)[= ]"?([\w.+-]+)/g)) {
      writer = found;
    }
  }
  // `commonmark_x-attributes` is the commonmark_x writer; no writer's own name
  // carries a `+` or `-`, so the first one starts the extension list.
  return writer?.toLowerCase().split(/[+-]/)[0] || undefined;
};

/**
 * Writers that ignore `--toc`, measured against pandoc 3.10 by writing the same
 * document with and without it and comparing the results. Everything not named
 * here produces a table of contents, so a writer this list has never heard of
 * is given the benefit of the doubt.
 */
const TOC_UNSUPPORTED = new Set([
  'ansi',
  'asciidoc',
  'asciidoc_legacy',
  'asciidoctor',
  'bbcode',
  'bbcode_fluxbb',
  'bbcode_hubzilla',
  'bbcode_phpbb',
  'bbcode_steam',
  'bbcode_xenforo',
  'biblatex',
  'bibtex',
  'csljson',
  'djot',
  'docbook',
  'docbook4',
  'docbook5',
  'fb2',
  'haddock',
  'icml',
  'jats',
  'jats_archiving',
  'jats_articleauthoring',
  'jats_publishing',
  'jira',
  'json',
  'man',
  'muse',
  'native',
  'opml',
  'org',
  's5',
  'tei',
  'textile',
  'xml',
]);

/** Whether asking this writer for a table of contents would do anything. */
export const supportsToc = (writer?: string): boolean => !!writer && !TOC_UNSUPPORTED.has(writer);

/*
 * The families a filter can be written for. A filter that reaches for
 * `custom-style` is for the word processors whatever the exact writer is
 * called, and one that emits raw LaTeX is no use to any of them — so what a
 * filter declares is a family, not a list of writer names.
 */
export const FORMAT_FAMILIES = ['latex', 'docx', 'odt', 'html', 'slides', 'markdown', 'typst'] as const;

export type FormatFamily = (typeof FORMAT_FAMILIES)[number];

const FAMILY_MEMBERS: Record<FormatFamily, readonly string[]> = {
  // `pdf` is here because pandoc's PDF goes through LaTeX unless told otherwise.
  latex: ['latex', 'beamer', 'pdf'],
  docx: ['docx'],
  odt: ['odt', 'opendocument'],
  // EPUB is HTML in a wrapper, and a filter writing HTML works in both.
  html: ['html', 'html4', 'html5', 'chunkedhtml', 'epub', 'epub2', 'epub3'],
  slides: ['revealjs', 'slidy', 'slideous', 'dzslides', 's5', 'beamer', 'pptx'],
  markdown: [
    'markdown',
    'markdown_strict',
    'markdown_mmd',
    'markdown_phpextra',
    'markdown_github',
    'commonmark',
    'commonmark_x',
    'gfm',
    'djot',
    'markua',
  ],
  typst: ['typst'],
};

/** Every family a writer belongs to. A writer belongs to its own name as well. */
export const familiesOf = (writer?: string): string[] => {
  if (!writer) {
    return [];
  }
  const families = FORMAT_FAMILIES.filter(family => FAMILY_MEMBERS[family].includes(writer));
  return families.includes(writer as FormatFamily) ? families : [writer, ...families];
};

/**
 * Whether a filter declaring `formats` can do anything for this writer. A
 * filter that declares none works on the document rather than on the output,
 * so it is offered whatever is being written — and a template whose writer
 * cannot be made out is not narrowed down at all.
 */
export const runsInFormat = (formats: readonly string[] | undefined, writer?: string): boolean => {
  if (!formats?.length || !writer) {
    return true;
  }
  const families = familiesOf(writer);
  return formats.some(f => families.includes(f));
};
