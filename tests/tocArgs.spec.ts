import { TOC_DEFAULT_DEPTH, TOC_MAX_DEPTH, TOC_NONE, setTocDepth, tocDepth } from '../src/toc_args';

/*
 * The dropdown reads a depth out of a line of arguments and writes one back
 * into it, so what matters is that the two agree — and that neither disturbs
 * whatever else the user put in that line.
 */

const FILTER = '--lua-filter="${luaDir}/wordcount.lua"';

describe('reading a depth', () => {
  test('no arguments, or none asking for contents, is none', () => {
    expect(tocDepth(undefined)).toBe(TOC_NONE);
    expect(tocDepth('')).toBe(TOC_NONE);
    expect(tocDepth(FILTER)).toBe(TOC_NONE);
  });

  test('the flag on its own is as deep as pandoc takes it', () => {
    expect(tocDepth('--toc')).toBe(TOC_DEFAULT_DEPTH);
    expect(tocDepth('--table-of-contents')).toBe(TOC_DEFAULT_DEPTH);
    expect(tocDepth(`${FILTER} --toc`)).toBe(TOC_DEFAULT_DEPTH);
  });

  test('a depth is read whichever way it was written', () => {
    expect(tocDepth('--toc --toc-depth=5')).toBe(5);
    expect(tocDepth('--toc --toc-depth 5')).toBe(5);
    expect(tocDepth('--table-of-contents --toc-depth=2')).toBe(2);
  });

  test('a depth alone is not a table of contents — pandoc ignores it', () => {
    expect(tocDepth('--toc-depth=4')).toBe(TOC_NONE);
  });

  test('`--toc-depth` is not mistaken for the flag itself', () => {
    // `--toc` matching inside `--toc-depth=4` would report contents that the
    // export will not produce.
    expect(tocDepth('-s --toc-depth=4 -o out.pdf')).toBe(TOC_NONE);
  });

  test('a depth past the deepest level offered is that level', () => {
    // Six is not this plugin's limit but pandoc's: it refuses to run at all
    // above it, so nothing deeper may reach the command line.
    expect(TOC_MAX_DEPTH).toBe(6);
    expect(tocDepth('--toc --toc-depth=42')).toBe(TOC_MAX_DEPTH);
  });
});

describe('writing a depth', () => {
  test('a depth is written as both flags, in the form pandoc documents', () => {
    expect(setTocDepth(undefined, 3)).toBe('--toc --toc-depth=3');
    expect(setTocDepth('', 1)).toBe('--toc --toc-depth=1');
    expect(setTocDepth('   ', TOC_MAX_DEPTH)).toBe(`--toc --toc-depth=${TOC_MAX_DEPTH}`);
  });

  test('it is appended to what is already there', () => {
    expect(setTocDepth(FILTER, 2)).toBe(`${FILTER} --toc --toc-depth=2`);
  });

  test('changing the depth replaces it rather than adding a second one', () => {
    expect(setTocDepth('--toc --toc-depth=2', 6)).toBe('--toc --toc-depth=6');
    expect(setTocDepth('--table-of-contents --toc-depth 2', 6)).toBe('--toc --toc-depth=6');
  });

  test('none takes both flags back out, and closes the gap they leave', () => {
    expect(setTocDepth('--toc --toc-depth=2', TOC_NONE)).toBe('');
    expect(setTocDepth(`-s --toc --toc-depth=2 ${FILTER}`, TOC_NONE)).toBe(`-s ${FILTER}`);
    expect(setTocDepth(FILTER, TOC_NONE)).toBe(FILTER);
  });

  test('nothing else in the line is disturbed', () => {
    const args = `-s --resource-path="\${currentDir}" ${FILTER}`;
    expect(setTocDepth(args, 4)).toBe(`${args} --toc --toc-depth=4`);
    expect(setTocDepth(setTocDepth(args, 4), TOC_NONE)).toBe(args);
  });

  test('a depth deeper than is offered is written as the deepest that is', () => {
    expect(setTocDepth('', 99)).toBe(`--toc --toc-depth=${TOC_MAX_DEPTH}`);
  });

  test('what is written is what is read back', () => {
    for (let depth = 1; depth <= TOC_MAX_DEPTH; depth++) {
      expect(tocDepth(setTocDepth(FILTER, depth))).toBe(depth);
    }
    expect(tocDepth(setTocDepth(FILTER, TOC_NONE))).toBe(TOC_NONE);
  });
});
