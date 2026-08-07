/*
 * The catalogues are read in order and a file name is only offered once — the
 * name is what `--lua-filter` names, so two filters answering to it would make
 * which one runs a matter of install order.
 */

const requestUrlMock = jest.fn<Promise<{ json: unknown }>, [{ url: string }]>();

jest.mock('obsidian', () => ({
  requestUrl: (options: { url: string }) => requestUrlMock(options),
}));

import { LuaFilterManager } from '../src/lua_filters';
import type UniversalExportPlugin from '../src/main';

const plugin = { settings: {}, manifest: { dir: 'plugins/x' } } as unknown as UniversalExportPlugin;

/** The curated catalogue offers one filter; pandoc-ext offers `pagebreak`. */
const curated = { filters: [{ id: 'wordcount', storeName: 'Word count', path: 'f/wordcount.lua' }] };
const upstreamRepos = [
  { name: 'pagebreak', description: 'Manual page breaks', default_branch: 'main', pushed_at: '2025-05-20T09:00:56Z' },
  { name: '.github', description: 'profile', default_branch: 'main', pushed_at: '2025-01-01T00:00:00Z' },
];
const courseRepo = { default_branch: 'main', pushed_at: '2026-08-03T23:33:09Z' };
const courseFiles = [
  { name: 'figures.lua', type: 'file', download_url: 'https://x/figures.lua' },
  // Already offered by pandoc-ext, so it must not appear twice.
  { name: 'pagebreak.lua', type: 'file', download_url: 'https://x/pagebreak.lua' },
  // Ships with the plugin, so it can never be installed anyway.
  { name: 'markdown.lua', type: 'file', download_url: 'https://x/markdown.lua' },
  { name: 'notes.md', type: 'file', download_url: 'https://x/notes.md' },
];

const route = (url: string): unknown => {
  if (url.includes('index.json')) return curated;
  if (url.includes('/orgs/pandoc-ext/repos')) return upstreamRepos;
  if (url.includes('/contents/')) return courseFiles;
  if (url.includes('/repos/pan4ratte/course-it-in-science')) return courseRepo;
  throw new Error(`unexpected url ${url}`);
};

beforeEach(() => {
  requestUrlMock.mockReset();
  requestUrlMock.mockImplementation(({ url }) => Promise.resolve({ json: route(url) }));
});

const manager = () => new LuaFilterManager(plugin, ['markdown.lua']);

test('every source contributes, and non-filters are left out', async () => {
  const { entries, failed } = await manager().fetchAll();
  expect(failed).toEqual([]);
  expect(entries.map(e => e.id)).toEqual(['wordcount', 'pandoc-ext:pagebreak', 'course:figures']);
});

test('a file name already offered by an earlier source is not offered again', async () => {
  const { entries } = await manager().fetchAll();
  const pagebreaks = entries.filter(e => e.fileName === 'pagebreak.lua');
  expect(pagebreaks).toHaveLength(1);
  // pandoc-ext is read before the course vault, so it is the one that keeps it.
  expect(pagebreaks[0].source).toBe('upstream');
});

test('a filter the plugin already ships is never offered', async () => {
  const { entries } = await manager().fetchAll();
  expect(entries.some(e => e.fileName === 'markdown.lua')).toBe(false);
});

test('course entries carry a download url and the repository as author', async () => {
  const { entries } = await manager().fetchAll();
  const figures = entries.find(e => e.id === 'course:figures');
  expect(figures).toMatchObject({
    storeName: 'figures',
    fileName: 'figures.lua',
    url: 'https://x/figures.lua',
    author: 'pan4ratte/course-it-in-science',
    source: 'course',
    updated: '2026-08-03',
  });
});

test('one source failing leaves the others showing', async () => {
  requestUrlMock.mockImplementation(({ url }) =>
    url.includes('index.json') ? Promise.reject(new Error('offline')) : Promise.resolve({ json: route(url) })
  );
  const { entries, failed } = await manager().fetchAll();
  expect(failed).toEqual(['curated']);
  expect(entries.map(e => e.id)).toEqual(['pandoc-ext:pagebreak', 'course:figures']);
});

test('with the earlier source gone, the course copy is offered instead', async () => {
  requestUrlMock.mockImplementation(({ url }) =>
    url.includes('/orgs/pandoc-ext/repos') ? Promise.reject(new Error('rate limited')) : Promise.resolve({ json: route(url) })
  );
  const { entries, failed } = await manager().fetchAll();
  expect(failed).toEqual(['upstream']);
  expect(entries.find(e => e.fileName === 'pagebreak.lua')?.source).toBe('course');
});
