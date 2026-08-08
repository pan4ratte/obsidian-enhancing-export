import type { Lang } from './lang';

/**
 * A failed export, as it is worth showing.
 *
 * What comes back from a failed command is the command line followed by
 * whatever pandoc, the shell or a PDF engine had to say. The command line is
 * the part nobody can act on — it is a screenful of options the template
 * already holds — so it is taken out here, and what is left is put in front of
 * the reader with a suggestion where the error is one of the handful that has
 * a known answer.
 */
export interface ExportFailure {
  /** The error as it was reported, with the command line taken out. */
  detail: string;
  /** What to try, for the errors that come up again and again. */
  recommendation?: string;
}

type Hints = Lang['exportError']['hint'];

/**
 * The errors worth recognising, most specific first: the first pattern to match
 * wins, so a missing PDF engine is read as that rather than as a missing pandoc.
 */
const RECOMMENDATIONS: ReadonlyArray<readonly [RegExp, keyof Hints]> = [
  // Everything that means "the file is not yours to write". Windows locks an
  // open PDF outright, and pdflatex says it in its own words.
  [
    /\b(EBUSY|EPERM|EACCES)\b|permission denied|access is denied|being used by another process|resource busy or locked|can'?t write on file|cannot open [^\n]{0,80} for writing/i,
    'fileInUse',
  ],
  // The plugin's own `mkdir` before the command runs.
  [/no such file or directory, (mkdir|open)|ENOTDIR/i, 'outputFolder'],
  // Pandoc names the engine it could not run, and says so twice over.
  [
    /select a different --pdf-engine|\b(pdflatex|xelatex|lualatex|tectonic|context|wkhtmltopdf|weasyprint|prince|typst|pdfroff)(\.exe)?\b[^\n]{0,60}(not found|is not recognized|no such file|does not exist|cannot be found)/i,
    'pdfEngine',
  ],
  // Nothing ran at all: the shell could not find what it was asked to run.
  [
    /is not recognized as an internal or external command|command not found|the system cannot find the (file|path) specified|\bspawn\b[^\n]*ENOENT/i,
    'pandocNotFound',
  ],
  // pdfLaTeX's 8-bit fonts meet a character the note is written with.
  [/unicode character[^\n]{0,60}not set up for use with latex|inputenc error/i, 'latexUnicode'],
  [/file `?[^\n`']{1,80}\.(sty|cls)'? not found|latex error: file/i, 'latexPackage'],
  [/error running filter|\.lua:\d+:|attempt to (call|index)[^\n]{0,40}\(a nil value\)/i, 'luaFilter'],
  // A path the template names — layout template, reference document, syntax file.
  [/could not find data file|could not find template|could not read file/i, 'missingDataFile'],
  // A path the note names — an embedded image, an attachment.
  [/could not fetch resource|not found in resource path|openbinaryfile: does not exist|could not load image/i, 'missingResource'],
  [/yaml parse (exception|error)|could not parse yaml/i, 'frontMatter'],
  [/citeproc|bibliography|\.bib\b|\.csl\b/i, 'citations'],
  [/unrecognized option|unknown option|unknown (input|output|reader|writer) format|unknown extension|invalid argument/i, 'unknownOption'],
];

/** Whatever the thrown thing had to say, preferring the program's own output. */
function errorText(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err instanceof Error) {
    // `child_process` hands back an `ExecException`, which carries the streams
    // on some paths and folds stderr into the message on the rest.
    const { stderr } = err as Error & { stderr?: string };
    return [stderr, err.message].map(text => text?.trim()).find(Boolean) ?? '';
  }
  if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
    return String(err);
  }
  if (err == null) {
    return '';
  }
  // Something thrown that is neither text nor an `Error`. Its fields are all
  // there is to go on, and they beat `[object Object]`.
  try {
    return JSON.stringify(err) || '';
  } catch {
    return '';
  }
}

/**
 * The error with the command line dropped: node opens its message with
 * `Command failed: <the whole thing>`, and a shell will sometimes echo the line
 * back on its own.
 */
function extractDetail(err: unknown, cmd: string): string {
  const command = cmd?.trim();
  return errorText(err)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => {
      const text = line.trim();
      return !text.startsWith('Command failed:') && !(command && text.includes(command));
    })
    .join('\n')
    .trim();
}

export function describeExportFailure(err: unknown, cmd: string, lang: Lang): ExportFailure {
  const detail = extractDetail(err, cmd) || lang.exportError.noOutput;
  const matched = RECOMMENDATIONS.find(([pattern]) => pattern.test(detail));
  return { detail, recommendation: matched && lang.exportError.hint[matched[1]] };
}
