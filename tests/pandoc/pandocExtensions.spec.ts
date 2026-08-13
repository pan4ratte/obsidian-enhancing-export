import { PANDOC_EXTENSIONS, enabledExtensions, setExtensions } from '../../src/pandoc/pandoc_extensions';

/*
 * The extensions ride on a second `-f`, whose format is the literal text
 * `${fromFormat}` — the export fills it in. Every character of `${...}` means
 * something to a regular expression, so rewriting the flag is the case most
 * worth pinning down.
 */

const FROM = '-f ${fromFormat}';
const FILTER = '--lua-filter="${luaDir}/wordcount.lua"';

test('every extension offered is one pandoc leaves off by default', () => {
  // Ticked has to mean "on" and cleared "as pandoc does it"; an extension that
  // was on already could never be shown cleared. Checked against
  // `pandoc --list-extensions=markdown`.
  expect(PANDOC_EXTENSIONS).toEqual([
    'alerts',
    'mark',
    'hard_line_breaks',
    'lists_without_preceding_blankline',
    'rebase_relative_paths',
    'emoji',
    'autolink_bare_uris',
    'tex_math_single_backslash',
    'east_asian_line_breaks',
    'short_subsuperscripts',
  ]);
});

describe('reading what is switched on', () => {
  test('nothing is switched on by nothing at all', () => {
    expect(enabledExtensions(undefined)).toEqual([]);
    expect(enabledExtensions('')).toEqual([]);
    expect(enabledExtensions(FILTER)).toEqual([]);
  });

  test('the flag with no extensions switches nothing on', () => {
    expect(enabledExtensions(FROM)).toEqual([]);
  });

  test('what the flag carries is what is on', () => {
    expect(enabledExtensions(`${FROM}+mark`)).toEqual(['mark']);
    expect(enabledExtensions(`${FILTER} ${FROM}+alerts+emoji`)).toEqual(['alerts', 'emoji']);
  });

  test('something this plugin does not offer is not reported as on', () => {
    expect(enabledExtensions(`${FROM}+mark+not_an_extension`)).toEqual(['mark']);
  });
});

describe('writing what is switched on', () => {
  test('a chosen extension becomes the flag', () => {
    expect(setExtensions(undefined, ['mark'])).toBe(`${FROM}+mark`);
    expect(setExtensions('', ['alerts', 'emoji'])).toBe(`${FROM}+alerts+emoji`);
  });

  test('the flag goes last, so it is the `-f` pandoc keeps', () => {
    expect(setExtensions(FILTER, ['mark'])).toBe(`${FILTER} ${FROM}+mark`);
  });

  test('the same set always reads the same way, whatever order it was ticked in', () => {
    expect(setExtensions('', ['emoji', 'alerts'])).toBe(setExtensions('', ['alerts', 'emoji']));
  });

  test('the flag is rewritten rather than added to', () => {
    expect(setExtensions(`${FROM}+mark`, ['mark', 'emoji'])).toBe(`${FROM}+mark+emoji`);
    expect(setExtensions(`${FROM}+mark+emoji`, ['emoji'])).toBe(`${FROM}+emoji`);
  });

  test('the last one cleared takes the flag out, rather than leaving a bare one', () => {
    expect(setExtensions(`${FROM}+mark`, [])).toBe('');
    expect(setExtensions(`-s ${FROM}+mark ${FILTER}`, [])).toBe(`-s ${FILTER}`);
  });

  test('nothing else in the line is disturbed', () => {
    const args = `-s --resource-path="\${currentDir}" ${FILTER}`;
    expect(setExtensions(setExtensions(args, ['mark', 'alerts']), [])).toBe(args);
  });

  test('what is written is what is read back', () => {
    for (const extension of PANDOC_EXTENSIONS) {
      expect(enabledExtensions(setExtensions(FILTER, [extension]))).toEqual([extension]);
    }
    expect(enabledExtensions(setExtensions(FILTER, [...PANDOC_EXTENSIONS]))).toEqual([...PANDOC_EXTENSIONS]);
  });
});
