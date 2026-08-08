import {
  HIGHLIGHT_NONE,
  bibliography,
  citeproc,
  csl,
  css,
  highlightStyle,
  includeAfterBody,
  includeBeforeBody,
  includeInHeader,
  listOfFigures,
  listOfTables,
  mathMethod,
  metadata,
  numberOffset,
  numberSections,
  pairsFromText,
  pdfEngine,
  referenceDoc,
  setBibliography,
  setCiteproc,
  setCsl,
  setCss,
  setHighlightStyle,
  setIncludeAfterBody,
  setIncludeBeforeBody,
  setIncludeInHeader,
  setListOfFigures,
  setListOfTables,
  setMathMethod,
  setMetadata,
  setNumberOffset,
  setNumberSections,
  setPdfEngine,
  setReferenceDoc,
  setTopLevelDivision,
  setVariable,
  setVariables,
  textFromPairs,
  topLevelDivision,
  variable,
  variables,
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

describe('citations', () => {
  test('either spelling asks for citeproc', () => {
    expect(citeproc('--citeproc')).toBe(true);
    expect(citeproc('-C')).toBe(true);
    expect(citeproc(`${FILTER} -C ${TOC}`)).toBe(true);
    expect(citeproc(FILTER)).toBe(false);
    // The long form is what gets written, whichever was there.
    expect(setCiteproc('-C', true)).toBe('--citeproc');
  });

  test('the two files are read however they were written', () => {
    expect(bibliography('--bibliography=refs.bib')).toBe('refs.bib');
    expect(bibliography('--bibliography "C:/My Notes/refs.bib"')).toBe('C:/My Notes/refs.bib');
    expect(csl('--csl=chicago.csl')).toBe('chicago.csl');
    expect(csl(FILTER)).toBeUndefined();
  });

  test('a path with a space in it survives the round trip', () => {
    const own = 'C:/My Notes/references.bib';
    expect(bibliography(setBibliography('', own))).toBe(own);
  });

  test('switching citations off takes the files it was reading with it', () => {
    // Neither does anything on its own, and the rows they are typed into are
    // hidden with the toggle — left behind they would be invisible answers.
    const on = setCsl(setBibliography(setCiteproc(FILTER, true), 'refs.bib'), 'chicago.csl');
    expect(on).toBe(`${FILTER} --citeproc --bibliography=refs.bib --csl=chicago.csl`);
    expect(setCiteproc(on, false)).toBe(FILTER);
  });

  test('clearing a field takes only that option out', () => {
    expect(setBibliography('--citeproc --bibliography=refs.bib', '')).toBe('--citeproc');
  });
});

describe('reference document and stylesheet', () => {
  test('a reference document is read and replaced, never doubled', () => {
    expect(referenceDoc('--reference-doc=house.docx')).toBe('house.docx');
    expect(setReferenceDoc('--reference-doc=house.docx', 'other.docx')).toBe('--reference-doc=other.docx');
    expect(setReferenceDoc('--reference-doc=house.docx', '')).toBe('');
  });

  test('a stylesheet is read from either spelling of the option', () => {
    expect(css('--css=print.css')).toBe('print.css');
    expect(css('-c print.css')).toBe('print.css');
    expect(setCss('-c print.css', 'screen.css')).toBe('--css=screen.css');
  });

  test('a path written with the plugin’s own variables is left as it stands', () => {
    // These are resolved when the export runs, not here.
    const path = '${currentDir}/style.css';
    expect(css(setCss('', path))).toBe(path);
  });
});

describe('include files', () => {
  test('each is read under both of its names', () => {
    expect(includeInHeader('--include-in-header=preamble.tex')).toBe('preamble.tex');
    expect(includeInHeader('-H preamble.tex')).toBe('preamble.tex');
    expect(includeBeforeBody('-B header.html')).toBe('header.html');
    expect(includeAfterBody('-A footer.html')).toBe('footer.html');
  });

  test('one is not another', () => {
    expect(includeInHeader('-B header.html')).toBeUndefined();
    expect(includeAfterBody('-B header.html')).toBeUndefined();
  });

  test('all three can be given at once, and cleared one at a time', () => {
    let written = setIncludeInHeader(FILTER, 'preamble.tex');
    written = setIncludeBeforeBody(written, 'header.html');
    written = setIncludeAfterBody(written, 'footer.html');
    expect(written).toBe(`${FILTER} --include-in-header=preamble.tex --include-before-body=header.html --include-after-body=footer.html`);
    expect(includeInHeader(setIncludeBeforeBody(written, ''))).toBe('preamble.tex');
    expect(includeBeforeBody(setIncludeBeforeBody(written, ''))).toBeUndefined();
  });
});

describe('variables and metadata', () => {
  test('a variable is read under either spelling, and past the quotes', () => {
    expect(variable('-V fontsize=12pt', 'fontsize')).toBe('12pt');
    expect(variable('--variable=fontsize=12pt', 'fontsize')).toBe('12pt');
    expect(variable('--variable fontsize=12pt', 'fontsize')).toBe('12pt');
    // Quoted whole, or quoted around the part that needs it.
    expect(variable('-V "mainfont=PT Serif"', 'mainfont')).toBe('PT Serif');
    expect(variable('-V mainfont="PT Serif"', 'mainfont')).toBe('PT Serif');
  });

  test('a value carrying its own `=` is split where pandoc splits it', () => {
    expect(variable('-V geometry=margin=1in', 'geometry')).toBe('margin=1in');
    expect(variable(setVariable('', 'geometry', 'margin=1in'), 'geometry')).toBe('margin=1in');
  });

  test('the shipped TextBundle template is understood as it stands', () => {
    const args = '-V media_dir="${outputDir}/${outputFileName}.textbundle/assets"';
    expect(variable(args, 'media_dir')).toBe('${outputDir}/${outputFileName}.textbundle/assets');
  });

  test('setting one replaces it rather than adding a second', () => {
    expect(setVariable('-V fontsize=10pt', 'fontsize', '12pt')).toBe('-V fontsize=12pt');
    expect(setVariable('-V fontsize=12pt -V lang=fr', 'fontsize', '')).toBe('-V lang=fr');
    // A value with a space in it is written so that it comes back the same way.
    expect(setVariable('', 'mainfont', 'PT Serif')).toBe('-V "mainfont=PT Serif"');
  });

  test('the last one given is the one pandoc takes', () => {
    expect(variable('-V lang=en -V lang=fr', 'lang')).toBe('fr');
  });

  test('metadata is the same option under another name', () => {
    expect(metadata('-M author=Ada -M date=today')).toEqual([
      { key: 'author', value: 'Ada' },
      { key: 'date', value: 'today' },
    ]);
    expect(setMetadata('', [{ key: 'author', value: 'Ada Lovelace' }])).toBe('-M "author=Ada Lovelace"');
    // A variable is not metadata, and neither reads the other.
    expect(metadata('-V lang=fr')).toEqual([]);
    expect(variables('-M lang=fr')).toEqual([]);
  });

  test('a bare key is pandoc’s own way of saying true, and survives the trip', () => {
    expect(variables('-V draft')).toEqual([{ key: 'draft', value: '' }]);
    expect(textFromPairs(variables(setVariables('', pairsFromText('draft'))))).toBe('draft');
  });

  test('the typed list is read a line at a time, and blank lines are passed over', () => {
    expect(pairsFromText('fontfamily=libertinus\n\n  colorlinks = true  \n')).toEqual([
      { key: 'fontfamily', value: 'libertinus' },
      { key: 'colorlinks', value: 'true' },
    ]);
  });

  test('rewriting the list leaves the variables with rows of their own alone', () => {
    // `fontsize` is asked for by a row above the list, so the list neither
    // shows it nor writes over it.
    const args = '-V fontsize=12pt -V fontfamily=libertinus';
    expect(setVariables(args, pairsFromText('fontfamily=erewhon'), ['fontsize'])).toBe('-V fontsize=12pt -V fontfamily=erewhon');
    // And a variable the format has no row for is the list's to keep.
    expect(setVariables(args, pairsFromText('fontsize=11pt'), [])).toBe('-V fontsize=11pt');
  });

  test('emptying the list takes every variable out but the kept ones', () => {
    expect(setVariables(`${FILTER} -V fontsize=12pt -V lang=fr`, [], ['lang'])).toBe(`${FILTER} -V lang=fr`);
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
    written = setCiteproc(written, true);
    written = setBibliography(written, 'refs.bib');
    written = setReferenceDoc(written, 'house.docx');
    written = setCss(written, 'print.css');
    written = setIncludeInHeader(written, 'preamble.tex');
    written = setVariable(written, 'fontsize', '12pt');
    written = setMetadata(written, [{ key: 'author', value: 'Ada' }]);
    expect(written.startsWith(args)).toBe(true);

    // And taking them all back out leaves the line as it was found.
    written = setMetadata(written, []);
    written = setVariable(written, 'fontsize', '');
    written = setIncludeInHeader(written, '');
    written = setCss(written, '');
    written = setReferenceDoc(written, '');
    written = setCiteproc(written, false);
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
    expect(setCss(setCss('', 'a.css'), 'b.css')).toBe('--css=b.css');
    expect(setVariable(setVariable('', 'lang', 'en'), 'lang', 'fr')).toBe('-V lang=fr');
  });

  test('the lua filter’s own flag is not mistaken for anything here', () => {
    // `-A`, `-B`, `-C`, `-H` and `-V` are short flags in a line full of paths.
    expect(includeAfterBody(FILTER)).toBeUndefined();
    expect(citeproc(FILTER)).toBe(false);
    expect(variables(FILTER)).toEqual([]);
  });
});
