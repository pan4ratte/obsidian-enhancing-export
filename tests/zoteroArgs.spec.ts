import { describe, expect, test } from 'vitest';
import {
  ZOTERO_FILTER,
  ZOTERO_REFERENCES_FILTER,
  noteBeforePunctuation,
  setNoteBeforePunctuation,
  setZoteroStyle,
  zoteroStyle,
} from '../src/filter_args';
import { addLuaFilterArg } from '../src/lua_filters';
import { bibliography, citeproc, csl, orderCiteproc, setBibliography } from '../src/writer_args';

const APA = { id: 'http://www.zotero.org/styles/apa', cslPath: '${pluginDir}/csl/apa.csl', locale: 'en-US' };

/** A template that already turns citations into live Zotero fields, which is where the row is offered. */
const running = () => addLuaFilterArg(undefined, ZOTERO_FILTER);

describe('setZoteroStyle', () => {
  test('writes everything the parts need of each other', () => {
    const args = setZoteroStyle(running(), APA);
    expect(args).toContain(ZOTERO_REFERENCES_FILTER);
    expect(citeproc(args)).toBe(true);
    expect(csl(args)).toBe(APA.cslPath);
    expect(args).toContain('-M zotero-csl-style=http://www.zotero.org/styles/apa');
    expect(args).toContain('-M zotero-rendered=true');
    expect(args).toContain('-M zotero-locale=en-US');
  });

  test('reads back what it wrote', () => {
    expect(zoteroStyle(setZoteroStyle(running(), APA))).toEqual(APA);
  });

  test('a style is only chosen where the citations are made live', () => {
    expect(zoteroStyle(setZoteroStyle(undefined, APA))).toBeDefined();
    expect(zoteroStyle('--citeproc --csl=apa.csl')).toBeUndefined();
  });

  test('choosing another style replaces the first', () => {
    const gost = { id: 'ab91f1f3', cslPath: '${pluginDir}/csl/gost.csl' };
    const args = setZoteroStyle(setZoteroStyle(running(), APA), gost);
    expect(zoteroStyle(args)).toEqual(gost);
    expect(args).not.toContain('apa');
    expect(args.match(/-M zotero-csl-style=/g)).toHaveLength(1);
  });

  test('clearing it takes back the style file this plugin put there', () => {
    const args = setZoteroStyle(setZoteroStyle(running(), APA), undefined);
    expect(zoteroStyle(args)).toBeUndefined();
    expect(args).not.toContain(ZOTERO_REFERENCES_FILTER);
    expect(args).not.toContain('zotero-rendered');
    expect(csl(args)).toBeUndefined();
    expect(citeproc(args)).toBe(false);
    // The filter itself is the row above, and stays for the reader to switch off.
    expect(args).toContain(ZOTERO_FILTER);
  });

  test('clearing it leaves citations that have sources of their own', () => {
    const withBib = setBibliography(running(), 'refs.bib');
    const args = setZoteroStyle(setZoteroStyle(withBib, APA), undefined);
    expect(citeproc(args)).toBe(true);
    expect(bibliography(args)).toBe('refs.bib');
  });

  test('a style the reader chose themselves is not taken away', () => {
    const own = '--csl="C:/styles/mine.csl" ' + running();
    expect(csl(setZoteroStyle(own, undefined))).toBe('C:/styles/mine.csl');
  });
});

describe('the note marker', () => {
  const GOST = { id: 'ab91f1f3', cslPath: '${pluginDir}/csl/gost.csl', locale: 'ru-RU' };

  test('stands before the punctuation for a Russian style, as the typography wants', () => {
    const args = setZoteroStyle(running(), GOST);
    expect(noteBeforePunctuation(args)).toBe(true);
    expect(args).toContain('-M notes-after-punctuation=false');
  });

  test('and after it everywhere else, which is what pandoc does anyway', () => {
    expect(noteBeforePunctuation(setZoteroStyle(running(), APA))).toBe(false);
  });

  test('an answer already given is not overruled by choosing another style', () => {
    const chosen = setNoteBeforePunctuation(setZoteroStyle(running(), APA), true);
    expect(noteBeforePunctuation(setZoteroStyle(chosen, GOST))).toBe(true);

    const declined = setNoteBeforePunctuation(setZoteroStyle(running(), GOST), false);
    expect(noteBeforePunctuation(setZoteroStyle(declined, GOST))).toBe(false);
  });

  test('clearing the style takes the answer with it', () => {
    const cleared = setZoteroStyle(setZoteroStyle(running(), GOST), undefined);
    expect(cleared).not.toContain('notes-after-punctuation');
  });
});

describe('orderCiteproc', () => {
  const REFS = '--lua-filter="${luaDir}/zotero-references.lua"';
  const LIVE = '--lua-filter="${luaDir}/zotero.lua"';

  test('moves citeproc in front of the filter that reads what it rendered', () => {
    expect(orderCiteproc(`pandoc ${REFS} ${LIVE} --citeproc -o out.docx`)).toBe(`pandoc ${REFS} --citeproc ${LIVE} -o out.docx`);
  });

  test('leaves a line that already runs them in order', () => {
    const ordered = `pandoc ${REFS} --citeproc ${LIVE} -o out.docx`;
    expect(orderCiteproc(ordered)).toBe(ordered);
  });

  // What a template looks like when the filter was switched on first and a style chosen after: the sources are
  // fetched after the citations they are wanted for, and citeproc would render every one of them as "citekey?".
  test('brings the sources in front of citeproc, wherever the rows left them', () => {
    expect(orderCiteproc(`pandoc ${LIVE} ${REFS} --citeproc --csl=a.csl -o out.docx`)).toBe(
      `pandoc ${REFS} --citeproc ${LIVE} --csl=a.csl -o out.docx`
    );
  });

  test('the whole chain, however the three were written down', () => {
    const ordered = `pandoc ${REFS} --citeproc ${LIVE}`;
    expect(orderCiteproc(`pandoc --citeproc ${LIVE} ${REFS}`)).toBe(ordered);
    expect(orderCiteproc(`pandoc ${LIVE} --citeproc ${REFS}`)).toBe(ordered);
    expect(orderCiteproc(`pandoc ${REFS} ${LIVE} --citeproc`)).toBe(ordered);
  });

  test('a filter named after another is not mistaken for it', () => {
    const other = '--lua-filter="${luaDir}/my-zotero.lua"';
    expect(orderCiteproc(`pandoc ${other} --citeproc`)).toBe(`pandoc ${other} --citeproc`);
  });

  test('the short spelling is the same flag', () => {
    expect(orderCiteproc(`pandoc ${LIVE} -C -o out.docx`)).toBe(`pandoc -C ${LIVE} -o out.docx`);
  });

  test('says nothing about a line with no Zotero filter on it', () => {
    const plain = 'pandoc --lua-filter="${luaDir}/figures.lua" --citeproc -o out.docx';
    expect(orderCiteproc(plain)).toBe(plain);
  });

  test('the filter that fetches the sources is not mistaken for the one that makes them live', () => {
    const fetchOnly = `pandoc ${REFS} --citeproc -o out.docx`;
    expect(orderCiteproc(fetchOnly)).toBe(fetchOnly);
  });
});
