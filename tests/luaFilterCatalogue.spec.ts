/*
 * The store reads one catalogue, and every filter it offers is vendored beside
 * it in `lua-filters/`. Two things are worth holding: what the manager makes of
 * a catalogue it is handed, and that the catalogue in this repository actually
 * points at files that are in it.
 */

const requestUrlMock = jest.fn<Promise<{ json: unknown }>, [{ url: string }]>();

jest.mock('obsidian', () => ({
  requestUrl: (options: { url: string }) => requestUrlMock(options),
}));

import { existsSync } from 'fs';
import path from 'path';
import { DEFAULT_LUA_FILTER_REPO_URL, LUA_FILTER_CATEGORIES, LuaFilterManager, type LuaFilterEntry } from '../src/lua_filters';
import type UniversalExportPlugin from '../src/main';
import catalogue from '../lua-filters/index.json';

const plugin = { settings: {}, manifest: { dir: 'plugins/x' } } as unknown as UniversalExportPlugin;
const manager = (bundled: string[] = []) => new LuaFilterManager(plugin, bundled);

const serve = (filters: unknown[]) => {
  requestUrlMock.mockReset();
  requestUrlMock.mockImplementation(() => Promise.resolve({ json: { filters } }));
};

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

describe('the catalogue in this repository', () => {
  const entries = catalogue.filters as LuaFilterEntry[];

  test('every entry points at a file that is actually vendored here', () => {
    const missing = entries.filter(e => !existsSync(path.join(__dirname, '..', 'lua-filters', e.path)));
    expect(missing.map(e => e.path)).toEqual([]);
  });

  test('ids and file names are unique — the file name is what --lua-filter names', () => {
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);
    expect(dupes(entries.map(e => e.id))).toEqual([]);
    expect(dupes(entries.map(e => e.fileName))).toEqual([]);
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

  test('the file name matches the path it is served from', () => {
    for (const entry of entries) {
      expect(entry.fileName).toBe(entry.path.substring(entry.path.lastIndexOf('/') + 1));
    }
  });

  test('the default base URL is the folder the catalogue is committed to', () => {
    expect(DEFAULT_LUA_FILTER_REPO_URL).toMatch(/\/lua-filters\/$/);
  });
});
