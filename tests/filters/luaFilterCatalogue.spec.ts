/* The store reads one catalogue, and every filter it offers is vendored beside it in `lua-filters/`. */

import { vi } from 'vitest';

const requestUrlMock = vi.fn<(options: { url: string }) => Promise<{ json: unknown }>>();

/** What the vault is set to; the cards are read in it. */
let locale = 'en';

vi.mock('obsidian', () => ({
  requestUrl: (options: { url: string }) => requestUrlMock(options),
  moment: { locale: () => locale },
}));

import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { DEFAULT_LUA_FILTER_REPO_URL, LUA_FILTER_CATEGORIES, LuaFilterManager, type RawLuaFilterEntry } from '../src/lua_filters';
import { FORMAT_FAMILIES } from '../src/pandoc_format';
import type PandocGuiPlugin from '../src/main';
import catalogue from '../lua-filters/index.json';

const plugin = { settings: {}, manifest: { dir: 'plugins/x' } } as unknown as PandocGuiPlugin;
const manager = (bundled: string[] = []) => new LuaFilterManager(plugin, bundled);

const serve = (filters: unknown[]) => {
  requestUrlMock.mockReset();
  requestUrlMock.mockImplementation(() => Promise.resolve({ json: { filters } }));
};

beforeEach(() => {
  locale = 'en';
});

describe('reading a catalogue', () => {
  test('an entry keeps what it carries, and defaults the rest', async () => {
    serve([
      {
        id: 'wordcount',
        storeName: 'Word count',
        description: 'Counts words.',
        author: 'JM',
        license: 'MIT',
        category: 'tools',
        path: 'pandoc/wordcount.lua',
      },
    ]);
    const [entry] = await manager().fetchCatalogue();
    expect(entry).toMatchObject({ id: 'wordcount', storeName: 'Word count', author: 'JM', license: 'MIT', category: 'tools' });
  });

  test('an unknown or missing category becomes the catch-all shelf', async () => {
    serve([
      { id: 'a', path: 'a.lua' },
      { id: 'b', category: 'nonsense', path: 'b.lua' },
    ]);
    const entries = await manager().fetchCatalogue();
    expect(entries.map(e => e.category)).toEqual(['other', 'other']);
    // A row with no name of its own is still a row, under its id.
    expect(entries[0].storeName).toBe('a');
  });

  test('a row with nothing to fetch, or nothing to call it, is skipped rather than fatal', async () => {
    serve([{ id: 'nowhere' }, { path: 'nameless.lua' }, { id: 'fine', path: 'fine.lua' }]);
    expect((await manager().fetchCatalogue()).map(e => e.id)).toEqual(['fine']);
  });

  test('a filter the plugin already ships is never offered', async () => {
    serve([
      { id: 'markdown', path: 'markdown.lua' },
      { id: 'wordcount', path: 'pandoc/wordcount.lua' },
    ]);
    expect((await manager(['markdown.lua']).fetchCatalogue()).map(e => e.id)).toEqual(['wordcount']);
  });

  test('a file name is only offered once — the first row keeps it', async () => {
    serve([
      { id: 'pagebreak', fileName: 'pagebreak.lua', path: 'pandoc-ext/pagebreak.lua' },
      { id: 'other:pagebreak', fileName: 'pagebreak.lua', path: 'somewhere/pagebreak.lua' },
    ]);
    const entries = await manager().fetchCatalogue();
    expect(entries.map(e => e.id)).toEqual(['pagebreak']);
  });

  test('a catalogue that is not one is an error, not an empty list', async () => {
    requestUrlMock.mockReset();
    requestUrlMock.mockImplementation(() => Promise.resolve({ json: { nope: [] } }));
    await expect(manager().fetchCatalogue()).rejects.toThrow(/Malformed catalogue/);
  });
});

describe('reading a catalogue in the vault’s language', () => {
  const translated = [
    {
      id: 'wordcount',
      storeName: 'Word count',
      description: 'Counts words.',
      requires: 'Nothing at all.',
      author: 'JM',
      category: 'tools',
      path: 'pandoc/wordcount.lua',
      i18n: { ru: { storeName: 'Подсчёт слов', description: 'Считает слова.', requires: 'Ничего.' } },
    },
  ];

  test('the three fields a card reads come from the translation', async () => {
    locale = 'ru';
    serve(translated);
    const [entry] = await manager().fetchCatalogue();
    expect(entry).toMatchObject({ storeName: 'Подсчёт слов', description: 'Считает слова.', requires: 'Ничего.' });
  });

  test('a locale spelled out in full is answered by its language', async () => {
    locale = 'ru-RU';
    serve(translated);
    expect((await manager().fetchCatalogue())[0].storeName).toBe('Подсчёт слов');
  });

  test('what the catalogue is written in needs no translation', async () => {
    serve(translated);
    expect((await manager().fetchCatalogue())[0].storeName).toBe('Word count');
  });

  test('a language the catalogue has never been translated into reads as it was written', async () => {
    locale = 'ja';
    serve(translated);
    expect((await manager().fetchCatalogue())[0]).toMatchObject({ storeName: 'Word count', description: 'Counts words.' });
  });

  test('a half-translated entry keeps the English of the rest', async () => {
    locale = 'ru';
    serve([{ ...translated[0], i18n: { ru: { storeName: 'Подсчёт слов' } } }]);
    const [entry] = await manager().fetchCatalogue();
    expect(entry).toMatchObject({ storeName: 'Подсчёт слов', description: 'Counts words.', requires: 'Nothing at all.' });
  });

  test('nothing but what a card says is translated — what is fetched, and where it lands, are not', async () => {
    locale = 'ru';
    serve([{ ...translated[0], i18n: { ru: { storeName: 'Подсчёт слов', path: 'nowhere.lua', category: 'other' } } }]);
    const [entry] = await manager().fetchCatalogue();
    expect(entry).toMatchObject({ path: 'pandoc/wordcount.lua', category: 'tools' });
  });
});

describe('the catalogue in this repository', () => {
  const entries = catalogue.filters as RawLuaFilterEntry[];

  test('every entry points at a file that is actually vendored here', () => {
    const missing = entries.filter(e => !existsSync(path.join(import.meta.dirname, '..', 'lua-filters', e.path)));
    expect(missing.map(e => e.path)).toEqual([]);
  });

  test('ids and file names are unique — the file name is what --lua-filter names', () => {
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    expect(dupes(entries.map(e => e.id))).toEqual([]);
    expect(dupes(entries.map(e => e.fileName))).toEqual([]);
  });

  test('every entry says what it is in every language the plugin is read in', () => {
    // The three fields a card reads, translated exactly where there is English to translate: a `requires` in one
    // language only would be a condition some readers are never told about. `npm run docs:catalogue` refuses the
    // rest; this is the one that fails a build.
    for (const entry of entries) {
      const ru = entry.i18n?.ru;
      expect(ru, entry.id).toBeDefined();
      for (const key of ['storeName', 'description', 'requires'] as const) {
        expect(typeof ru[key], `${entry.id}.${key}`).toBe(typeof entry[key]);
      }
      expect(ru.storeName.length, entry.id).toBeGreaterThan(0);
      expect(ru.description.length, entry.id).toBeGreaterThan(0);
      // A translation that is the English again is one nobody wrote.
      expect(ru.description, entry.id).not.toBe(entry.description);
    }
  });

  test('every entry says what it is, whose it is, and where it belongs', () => {
    for (const entry of entries) {
      expect(entry.storeName?.length).toBeGreaterThan(0);
      expect(entry.description?.length).toBeGreaterThan(0);
      expect(entry.author?.length).toBeGreaterThan(0);
      expect(entry.license?.length).toBeGreaterThan(0);
      expect(entry.homepage).toMatch(/^https:\/\//);
      expect(LUA_FILTER_CATEGORIES).toContain(entry.category);
    }
  });

  test('a filter written for particular outputs names families the editor knows', () => {
    const restricted = entries.filter(e => e.formats);
    // A typo here would not fail anything — it would quietly hide the filter from every template, since no writer
    // would ever match it.
    for (const entry of restricted) {
      expect(entry.formats.length).toBeGreaterThan(0);
      for (const family of entry.formats) {
        expect(FORMAT_FAMILIES).toContain(family);
      }
    }
    // The rest work on the document rather than the output; if that ever fell to nothing, the whole idea of narrowing
    // by format would have gone wrong.
    expect(entries.length - restricted.length).toBeGreaterThan(restricted.length);
  });

  test('the file name matches the path it is served from', () => {
    for (const entry of entries) {
      expect(entry.fileName).toBe(entry.path.substring(entry.path.lastIndexOf('/') + 1));
    }
  });

  test('the default base URL is the folder the catalogue is committed to', () => {
    expect(DEFAULT_LUA_FILTER_REPO_URL).toMatch(/\/lua-filters\/$/);
  });

  test('nothing offered answers to the name of a filter the plugin ships', () => {
    // `bundled/` is written over the plugin's `lua/` on every load, so an entry taking one of those names could never
    // stay installed.
    const bundled = readdirSync(path.join(import.meta.dirname, '..', 'lua-filters', 'bundled')).filter(f => f.endsWith('.lua'));
    expect(bundled.length).toBeGreaterThan(0);
    const clashing = entries.filter(e => bundled.includes(e.fileName));
    expect(clashing.map(e => e.id)).toEqual([]);
    // And the catalogue never serves a file out of that folder either.
    expect(entries.filter(e => e.path.startsWith('bundled/'))).toEqual([]);
  });
});
