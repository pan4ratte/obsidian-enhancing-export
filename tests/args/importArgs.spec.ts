import { importArguments, importCommand, type ImportOptions } from '../../src/args/import_args';

/*
 * The rows of the import dialog come and go as another file is chosen, so an option can outlive the reader it was
 * asked of. What the command line carries is decided here rather than by whatever row happened to be on screen.
 */

const options = (extra: Partial<ImportOptions> = {}): ImportOptions => ({ flavour: 'gfm', ...extra });

describe('the reader and the writer', () => {
  test('are named, and are the whole of a conversion asked nothing else', () => {
    // GitHub's own maths is turned off: Obsidian reads `$x$`, not `$`x`$`.
    expect(importArguments('docx', options())).toEqual(['-f', 'docx', '-t', 'gfm-tex_math_gfm']);
  });

  test('the flavour is whichever markdown was picked', () => {
    expect(importArguments('epub', options({ flavour: 'commonmark_x' }))).toEqual(['-f', 'epub', '-t', 'commonmark_x']);
  });
});

describe('what the reader is asked', () => {
  test('tracked changes reach a docx and nothing else', () => {
    expect(importArguments('docx', options({ trackChanges: 'reject' }))).toContain('--track-changes=reject');
    expect(importArguments('odt', options({ trackChanges: 'reject' })).join(' ')).not.toContain('--track-changes');
  });

  test('an answer pandoc does not know is not passed on', () => {
    expect(importArguments('docx', options({ trackChanges: 'maybe' })).join(' ')).not.toContain('--track-changes');
  });

  test('the images folder is quoted, since it is a path someone typed', () => {
    expect(importArguments('docx', options({ extractMedia: 'attachments/from word' }))).toContain(
      '--extract-media="attachments/from word"'
    );
  });

  test('a tab stop is the digits of it, and only where a tab was ever typed', () => {
    expect(importArguments('markdown', options({ tabStop: '2' }))).toContain('--tab-stop=2');
    expect(importArguments('markdown', options({ tabStop: '4 spaces' }))).toContain('--tab-stop=4');
    expect(importArguments('docx', options({ tabStop: '2' })).join(' ')).not.toContain('--tab-stop');
  });

  test('comments are stripped where there are comments to strip', () => {
    expect(importArguments('html', options({ stripComments: true }))).toContain('--strip-comments');
    expect(importArguments('docx', options({ stripComments: true }))).not.toContain('--strip-comments');
  });

  test('the document’s details are kept by standing the note alone', () => {
    expect(importArguments('docx', options({ standalone: true }))).toContain('-s');
    expect(importArguments('csv', options({ standalone: true }))).not.toContain('-s');
  });

  test('headings are shifted by a level pandoc offers, and by nothing else', () => {
    expect(importArguments('docx', options({ shiftHeadingLevelBy: '-1' }))).toContain('--shift-heading-level-by=-1');
    expect(importArguments('docx', options({ shiftHeadingLevelBy: '0' })).join(' ')).not.toContain('--shift-heading-level-by');
    expect(importArguments('docx', options({ shiftHeadingLevelBy: '' })).join(' ')).not.toContain('--shift-heading-level-by');
  });
});

describe('what the writer is asked', () => {
  test('the wrapping, and the column it wraps at', () => {
    expect(importArguments('docx', options({ wrap: 'preserve', columns: '80' }))).toEqual(
      expect.arrayContaining(['--wrap=preserve', '--columns=80'])
    );
  });

  test('no column where nothing is wrapped', () => {
    expect(importArguments('docx', options({ wrap: 'none', columns: '80' })).join(' ')).not.toContain('--columns');
  });

  test('the heading style and reference links, which every flavour offered writes', () => {
    const args = importArguments('docx', options({ markdownHeadings: 'setext', referenceLinks: true }));
    expect(args).toContain('--markdown-headings=setext');
    expect(args).toContain('--reference-links');
  });
});

describe('the command', () => {
  test('reads the file it was given and writes the note beside it', () => {
    expect(importCommand('pandoc', '/home/mark/Thesis.docx', 'docx', options(), 'Thesis.md')).toBe(
      'pandoc "/home/mark/Thesis.docx" -f docx -t gfm-tex_math_gfm -o "Thesis.md"'
    );
  });

  test('a pandoc whose own path has a space in it is left as it was quoted', () => {
    expect(importCommand('"C:/Program Files/Pandoc/pandoc"', 'C:/Docs/a.docx', 'docx', options(), 'a.md')).toBe(
      '"C:/Program Files/Pandoc/pandoc" "C:/Docs/a.docx" -f docx -t gfm-tex_math_gfm -o "a.md"'
    );
  });
});
