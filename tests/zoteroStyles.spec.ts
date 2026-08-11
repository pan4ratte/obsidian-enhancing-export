import { describe, expect, test } from 'vitest';
import { readStyle, withoutLocaleLayouts } from '../src/zotero_styles';

/** A style as Zotero installs it, cut down to what is read off it. */
const style = (info: string, layouts: string) =>
  `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" default-locale="ru-RU" version="1.0">
  <info>${info}</info>
  <citation>${layouts}</citation>
</style>`;

const ONE_LAYOUT = '<layout prefix="[" suffix="]"><text variable="citation-number"/></layout>';
const PER_LANGUAGE = `<layout locale="en" prefix="[" suffix="]"><text variable="title"/></layout>${ONE_LAYOUT}`;

describe('readStyle', () => {
  test('reads the id a document has to record, and the title a reader picks from', () => {
    const xml = style('<title>ГОСТ Р 7.0.100-2018</title><id>http://www.zotero.org/styles/gost</id>', ONE_LAYOUT);
    expect(readStyle('/z/gost.csl', xml)).toMatchObject({
      id: 'http://www.zotero.org/styles/gost',
      title: 'ГОСТ Р 7.0.100-2018',
      locale: 'ru-RU',
      multilingual: false,
    });
  });

  test('an id is not always one of zotero.org’s', () => {
    const uuid = style('<title>GOST footnotes</title><id>ab91f1f3-21ac-5238-b2f1-6ef3ec74c680</id>', ONE_LAYOUT);
    expect(readStyle('/z/gost.csl', uuid)?.id).toBe('ab91f1f3-21ac-5238-b2f1-6ef3ec74c680');
  });

  test('the title is the style’s own, not the short form that follows it', () => {
    const xml = style('<title>Nature</title><title-short>Nat</title-short><id>x</id>', ONE_LAYOUT);
    expect(readStyle('/z/nature.csl', xml)?.title).toBe('Nature');
  });

  test('a file that names no style is not one', () => {
    expect(readStyle('/z/notes.txt', '<html><title>Nope</title></html>')).toBeUndefined();
  });

  test('falls back to the file name where the style gives no title', () => {
    expect(readStyle('/z/my-house-style.csl', style('<id>x</id>', ONE_LAYOUT))?.title).toBe('my-house-style');
  });

  test('a layout per language is what pandoc cannot read', () => {
    expect(readStyle('/z/a.csl', style('<id>a</id>', PER_LANGUAGE))?.multilingual).toBe(true);
  });

  // The pattern is a /g one, and a shared /g pattern answers every other call from where the last one stopped.
  test('says the same thing every time it is asked', () => {
    const multilingual = style('<id>a</id>', PER_LANGUAGE);
    const answers = [1, 2, 3, 4].map(() => readStyle('/z/a.csl', multilingual)?.multilingual);
    expect(answers).toEqual([true, true, true, true]);
  });
});

describe('withoutLocaleLayouts', () => {
  test('takes the language-specific layouts out and leaves the one pandoc reads', () => {
    const stripped = withoutLocaleLayouts(style('<id>a</id>', PER_LANGUAGE));
    expect(stripped).not.toContain('locale="en"');
    expect(stripped).toContain('<text variable="citation-number"/>');
    expect(stripped.match(/<layout/g)).toHaveLength(1);
  });

  test('leaves a style that has only the one layout alone', () => {
    const plain = style('<id>a</id>', ONE_LAYOUT);
    expect(withoutLocaleLayouts(plain)).toBe(plain);
  });
});
