import { familiesOf, outputFormat, runsInFormat, supportsToc } from '../src/pandoc_format';

/*
 * What a template writes decides which rows the editor shows, so reading the
 * writer back out of the arguments has to survive the shapes the shipped
 * templates actually use.
 */

const DOCX = '-f ${fromFormat} --resource-path="${currentDir}" -o "${outputPath}" -t docx';
const MARKDOWN = '-f ${fromFormat} --lua-filter="${luaDir}/markdown.lua" -s -o "${outputPath}" -t commonmark_x-attributes';
const BIB = '-f ${fromFormat} -o "${outputPath}" --to=bibtex "${currentPath}"';

describe('reading the writer', () => {
  test('it is the `-t` of a shipped template', () => {
    expect(outputFormat(DOCX)).toBe('docx');
    expect(outputFormat('-s -o "x.tex" -t latex')).toBe('latex');
  });

  test('`--to=` is read as well as `-t`', () => {
    expect(outputFormat(BIB)).toBe('bibtex');
    expect(outputFormat('--to html5')).toBe('html5');
  });

  test('the extensions on a writer are not part of its name', () => {
    expect(outputFormat(MARKDOWN)).toBe('commonmark_x');
    expect(outputFormat('-t markdown+hard_line_breaks')).toBe('markdown');
  });

  test('the last one wins, extra arguments included — as pandoc reads them', () => {
    expect(outputFormat('-t docx', '-t html')).toBe('html');
    expect(outputFormat('-t docx -t odt')).toBe('odt');
  });

  test('`--toc` is not mistaken for a `--to`', () => {
    // The two rows share a field, so this is a line that really occurs.
    expect(outputFormat('-t docx --toc --toc-depth=3')).toBe('docx');
    expect(outputFormat('--toc --toc-depth=3')).toBeUndefined();
  });

  test('nothing to read is nobody‘s writer', () => {
    expect(outputFormat(undefined, '')).toBeUndefined();
    // `-f` says what is read, not what is written.
    expect(outputFormat('-f markdown -o out.pdf')).toBeUndefined();
  });
});

describe('what a writer supports', () => {
  test('the shipped templates that produce contents', () => {
    for (const writer of ['docx', 'odt', 'html', 'latex', 'pdf', 'epub', 'rtf', 'rst', 'mediawiki', 'typst', 'pptx', 'commonmark_x']) {
      expect(supportsToc(writer)).toBe(true);
    }
  });

  test('the ones that ignore `--toc`, measured against pandoc', () => {
    for (const writer of ['textile', 'opml', 'bibtex', 'man', 'org', 'json', 'docbook5', 'jats']) {
      expect(supportsToc(writer)).toBe(false);
    }
  });

  test('a writer that cannot be made out asks for no row at all', () => {
    expect(supportsToc(undefined)).toBe(false);
  });
});

describe('which filters a writer can use', () => {
  test('a writer belongs to its own name and to its family', () => {
    expect(familiesOf('pdf')).toEqual(expect.arrayContaining(['pdf', 'latex']));
    expect(familiesOf('epub')).toEqual(expect.arrayContaining(['epub', 'html']));
    expect(familiesOf('beamer')).toEqual(expect.arrayContaining(['latex', 'slides']));
    // A family's own name is not repeated when the writer *is* the family.
    expect(familiesOf('docx')).toEqual(['docx']);
  });

  test('a filter with no formats is offered whatever is being written', () => {
    expect(runsInFormat(undefined, 'docx')).toBe(true);
    expect(runsInFormat([], 'docx')).toBe(true);
  });

  test('a filter is offered to its own family and to no other', () => {
    expect(runsInFormat(['latex'], 'pdf')).toBe(true);
    expect(runsInFormat(['latex'], 'latex')).toBe(true);
    expect(runsInFormat(['latex'], 'docx')).toBe(false);
    expect(runsInFormat(['docx', 'odt'], 'odt')).toBe(true);
    expect(runsInFormat(['html'], 'epub3')).toBe(true);
    expect(runsInFormat(['slides'], 'revealjs')).toBe(true);
    expect(runsInFormat(['slides'], 'html')).toBe(false);
  });

  test('a template whose writer cannot be made out is not narrowed down', () => {
    expect(runsInFormat(['latex'], undefined)).toBe(true);
  });
});
