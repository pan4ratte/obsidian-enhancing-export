import {
  HIGHLIGHT_NONE,
  highlightStyle,
  listOfFigures,
  listOfTables,
  mathMethod,
  numberOffset,
  numberSections,
  pdfEngine,
  setHighlightStyle,
  setListOfFigures,
  setListOfTables,
  setMathMethod,
  setNumberOffset,
  setNumberSections,
  setPdfEngine,
  setTopLevelDivision,
  topLevelDivision,
} from '../src/writer_args';

/*
 * Every row in the template editor reads its answer out of a line of arguments
 * and writes it back into the same line, so what matters throughout is that the
 * two agree, that a line typed by hand is understood however it was spelled, and
 * that nothing else in the line is disturbed on the way past.
 */

const FILTER = '--lua-filter="${luaDir}/markdown.lua"';
const TOC = '--toc --toc-depth=3';

describe('numbered headings', () => {
  test('either spelling is numbering', () => {
    expect(numberSections('--number-sections')).toBe(true);
    expect(numberSections('-N')).toBe(true);
    expect(numberSections(`${FILTER} -N ${TOC}`)).toBe(true);
  });

  test('nothing that merely starts the same way is', () => {
    expect(numberSections(undefined)).toBe(false);
    expect(numberSections('--number-offset=5')).toBe(false);
    expect(numberSections('-Nx')).toBe(false);
  });

  test('the long form is what gets written, whichever was there', () => {
    expect(setNumberSections(undefined, true)).toBe('--number-sections');
    expect(setNumberSections('-N', true)).toBe('--number-sections');
    expect(setNumberSections(FILTER, true)).toBe(`${FILTER} --number-sections`);
  });

  test('switching it off takes the offset with it', () => {
    // Pandoc reads an offset as asking for numbering, so one left behind would
    // switch the numbering straight back on.
    expect(setNumberSections('--number-sections --number-offset=5', false)).toBe('');
    expect(setNumberSections(`${FILTER} -N --number-offset 1,4`, false)).toBe(FILTER);
  });

  test('an offset is read whichever way it was written', () => {
    expect(numberOffset('--number-sections --number-offset=5')).toBe('5');
    expect(numberOffset('--number-sections --number-offset 1,4')).toBe('1,4');
    expect(numberOffset(FILTER)).toBeUndefined();
  });

  test('an offset is written as digits and the commas between them, or not at all', () => {
    expect(setNumberOffset('', '5')).toBe('--number-offset=5');
    expect(setNumberOffset('', '1, 4')).toBe('--number-offset=1,4');
    expect(setNumberOffset('', 'six')).toBe('');
    expect(setNumberOffset('--number-offset=5', '')).toBe('');
  });

  test('changing an offset replaces it rather than adding a second one', () => {
    expect(setNumberOffset('--number-sections --number-offset=5', '2')).toBe('--number-sections --number-offset=2');
  });
});

describe('lists of figures and tables', () => {
  test('the short form pandoc also takes is understood', () => {
    expect(listOfFigures('--lof')).toBe(true);
    expect(listOfFigures('--list-of-figures')).toBe(true);
    expect(listOfTables('--lot')).toBe(true);
    expect(listOfTables('--list-of-tables')).toBe(true);
  });

  test('one is not the other', () => {
    expect(listOfTables('--lof')).toBe(false);
    expect(listOfFigures('--lot')).toBe(false);
  });

  test('both can be asked for at once, and taken back out one at a time', () => {
    const both = setListOfTables(setListOfFigures(TOC, true), true);
    expect(both).toBe(`${TOC} --list-of-figures --list-of-tables`);
    expect(setListOfFigures(both, false)).toBe(`${TOC} --list-of-tables`);
    expect(setListOfTables(setListOfFigures(both, false), false)).toBe(TOC);
  });
});

describe('top-level division', () => {
  test('what pandoc names is read, and nothing else is', () => {
    expect(topLevelDivision('--top-level-division=chapter')).toBe('chapter');
    expect(topLevelDivision('--top-level-division part')).toBe('part');
    // `default` is pandoc's own answer, which this row shows as no answer.
    expect(topLevelDivision('--top-level-division=default')).toBeUndefined();
    expect(topLevelDivision('--top-level-division=volume')).toBeUndefined();
  });

  test('choosing the default takes the option back out', () => {
    expect(setTopLevelDivision(`${FILTER} --top-level-division=chapter`, '')).toBe(FILTER);
    expect(setTopLevelDivision('--top-level-division=chapter', 'part')).toBe('--top-level-division=part');
  });
});

describe('code highlighting', () => {
  test('a style is read from either spelling of the option', () => {
    expect(highlightStyle('--highlight-style=kate')).toBe('kate');
    expect(highlightStyle('--highlight-style tango')).toBe('tango');
    expect(highlightStyle('--syntax-highlighting=zenburn')).toBe('zenburn');
  });

  test('both ways of saying no highlighting say the same thing', () => {
    expect(highlightStyle('--no-highlight')).toBe(HIGHLIGHT_NONE);
    expect(highlightStyle('--syntax-highlighting=none')).toBe(HIGHLIGHT_NONE);
  });

  test('a theme file of the user’s own is given back as it stands', () => {
    // The picker offers it back as its own entry rather than dropping it.
    expect(highlightStyle('--highlight-style="C:/My Themes/dracula.theme"')).toBe('C:/My Themes/dracula.theme');
  });

  test('what is written is what every version of pandoc takes', () => {
    expect(setHighlightStyle('', 'kate')).toBe('--highlight-style=kate');
    expect(setHighlightStyle('', HIGHLIGHT_NONE)).toBe('--no-highlight');
    // A value with a space in it has to come back the way it went in.
    expect(highlightStyle(setHighlightStyle('', 'C:/My Themes/dracula.theme'))).toBe('C:/My Themes/dracula.theme');
  });

  test('changing the answer replaces whichever spelling was there', () => {
    expect(setHighlightStyle('--no-highlight', 'kate')).toBe('--highlight-style=kate');
    expect(setHighlightStyle('--syntax-highlighting=zenburn', HIGHLIGHT_NONE)).toBe('--no-highlight');
    expect(setHighlightStyle(`${FILTER} --highlight-style kate`, '')).toBe(FILTER);
  });
});

describe('math', () => {
  test('a method is read past whatever script it pins', () => {
    // The shipped HTML template pins a MathJax build exactly like this.
    expect(mathMethod('--mathjax="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js"')).toBe('mathjax');
    expect(mathMethod('--katex')).toBe('katex');
    expect(mathMethod('--webtex=https://latex.codecogs.com/svg?')).toBe('webtex');
    expect(mathMethod(FILTER)).toBeUndefined();
  });

  test('the last one is the one pandoc takes', () => {
    expect(mathMethod('--mathjax --katex')).toBe('katex');
  });

  test('choosing a method replaces the one that was there, pinned URL and all', () => {
    expect(setMathMethod('--mathjax="https://example.com/mathjax.js"', 'katex')).toBe('--katex');
    expect(setMathMethod(`${FILTER} --katex`, '')).toBe(FILTER);
    expect(setMathMethod('--katex', 'mathml')).toBe('--mathml');
  });
});

describe('pdf engine', () => {
  test('the engine a shipped template names is read back', () => {
    expect(pdfEngine('--pdf-engine=pdflatex')).toBe('pdflatex');
    expect(pdfEngine('--pdf-engine xelatex')).toBe('xelatex');
    expect(pdfEngine(FILTER)).toBeUndefined();
  });

  test('an engine of the user’s own survives the round trip', () => {
    const own = 'C:/Program Files/MiKTeX/miktex/bin/xelatex.exe';
    expect(pdfEngine(setPdfEngine('', own))).toBe(own);
  });

  test('choosing the default takes the option back out', () => {
    expect(setPdfEngine('--pdf-engine=pdflatex', '')).toBe('');
    expect(setPdfEngine(`${FILTER} --pdf-engine=pdflatex`, 'lualatex')).toBe(`${FILTER} --pdf-engine=lualatex`);
  });
});

describe('the rest of the line', () => {
  const args = `-f \${fromFormat}+mark ${FILTER} ${TOC}`;

  test('every option leaves what it found alone', () => {
    let written = args;
    written = setNumberSections(written, true);
    written = setListOfFigures(written, true);
    written = setTopLevelDivision(written, 'chapter');
    written = setHighlightStyle(written, 'kate');
    written = setPdfEngine(written, 'xelatex');
    expect(written.startsWith(args)).toBe(true);

    // And taking them all back out leaves the line as it was found.
    written = setPdfEngine(written, '');
    written = setHighlightStyle(written, '');
    written = setTopLevelDivision(written, '');
    written = setListOfFigures(written, false);
    written = setNumberSections(written, false);
    expect(written).toBe(args);
  });

  test('an option asked for twice is written once', () => {
    expect(setPdfEngine(setPdfEngine('', 'xelatex'), 'lualatex')).toBe('--pdf-engine=lualatex');
    expect(setNumberSections(setNumberSections('', true), true)).toBe('--number-sections');
  });
});
