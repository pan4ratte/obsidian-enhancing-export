import { requestUrl } from 'obsidian';
import path from 'path';
import type UniversalExportPlugin from './main';

/*
 * The lua-filter store.
 *
 * There is one catalogue: `lua-filters/index.json` in this plugin's own
 * repository, where every filter it offers is also kept. Nothing is read from
 * the GitHub API, from the pandoc-ext organisation or from anyone else's
 * repository at browse time — a filter that moves, is renamed or is rate
 * limited cannot empty the store, and what a card says is what the file beside
 * it actually does rather than whatever a repository description happened to
 * say.
 *
 * Every entry names its author and licence, and the vendored copy keeps the
 * original headers: the catalogue is a shelf of other people's work, and it
 * says whose.
 *
 * Entries are grouped by `category` — what a user is trying to fix — because a
 * flat list of forty filters answers nobody's question. Where a filter came
 * from is recorded in `homepage`, which is a link, not a way to sort a list.
 *
 * Nothing here executes what it downloads: a filter is text written into `lua/`,
 * and only pandoc ever reads it.
 */

/** The shelves the store is divided into, in the order they are shown. */
export const LUA_FILTER_CATEGORIES = ['structure', 'citations', 'figures', 'prose', 'word', 'latex', 'tools', 'other'] as const;

export type LuaFilterCategory = (typeof LUA_FILTER_CATEGORIES)[number];

/** Where an entry with no category of its own — a third-party catalogue's — lands. */
export const DEFAULT_LUA_FILTER_CATEGORY: LuaFilterCategory = 'other';

const isCategory = (value: unknown): value is LuaFilterCategory => LUA_FILTER_CATEGORIES.includes(value as LuaFilterCategory);

/** One row of the catalogue — everything a card shows, plus where to fetch it. */
export interface LuaFilterEntry {
  id: string;
  storeName: string;
  description: string;
  /** Who wrote it. Shown on the card, alongside the licence it is used under. */
  author: string;
  license?: string;
  category: LuaFilterCategory;
  /**
   * The output formats the filter is written for, as families from
   * `pandoc_format`. Absent means it works on the document rather than on the
   * output, and so is offered whatever a template writes.
   */
  formats?: string[];
  /** What has to be installed or set up for the filter to work at all. */
  requires?: string;
  /** Compared against the installed copy's to offer an update. */
  updated?: string;
  /** What the filter is called in `lua/`. Defaults to `<id>.lua`. */
  fileName?: string;
  /** Relative to the catalogue's base URL. */
  path?: string;
  /** Absolute URL, which wins over `path`. */
  url?: string;
  /** Where to read about it. */
  homepage?: string;
}

/** What is recorded in the settings once a filter is on disk. */
export interface InstalledLuaFilter {
  id: string;
  fileName: string;
  storeName: string;
  updated?: string;
  category: LuaFilterCategory;
  /**
   * Recorded alongside the file so a template editor can tell whether the
   * filter is any use to what it writes without the catalogue in front of it.
   */
  formats?: string[];
}

/** The catalogue, unless a vault points `luaFilterRepoUrl` elsewhere. */
export const DEFAULT_LUA_FILTER_REPO_URL = 'https://raw.githubusercontent.com/pan4ratte/obsidian-enhancing-export/main/lua-filters/';

// ── The pandoc argument a filter is used through ──────────────────────────────

/**
 * `${luaDir}` is a variable `exporto0o` fills in at export time, so what is
 * stored is the literal text — written without a template literal so the `$` is
 * plainly not this file's to interpolate.
 */
export const luaFilterArg = (fileName: string) => '--lua-filter="${luaDir}/' + fileName + '"';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `args` already runs the filter. */
export const hasLuaFilterArg = (args: string | undefined, fileName: string) => !!args && args.includes(luaFilterArg(fileName));

/** `args` with the filter appended, or unchanged if it is already there. */
export const addLuaFilterArg = (args: string | undefined, fileName: string) => {
  const arg = luaFilterArg(fileName);
  const current = args?.trim() ?? '';
  if (!current) {
    return arg;
  }
  return current.includes(arg) ? current : `${current} ${arg}`;
};

/** `args` with the filter taken out, and the gap it left closed up. */
export const removeLuaFilterArg = (args: string | undefined, fileName: string) => {
  if (!args) {
    return args ?? '';
  }
  return args
    .replace(new RegExp(`\\s*${escapeRegExp(luaFilterArg(fileName))}`, 'g'), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ── Manager ───────────────────────────────────────────────────────────────────

/**
 * Fetches the catalogue and owns the files in `lua/`. It deliberately does not
 * touch the settings: what is installed is recorded by the caller, so the store
 * UI's view of it stays reactive.
 */
export class LuaFilterManager {
  /**
   * `bundled` is the list of filters the plugin ships with. It is handed in
   * rather than read from `resources`, whose glob only exists once Vite has
   * resolved it — this way the module is plain TypeScript and can be tested.
   */
  constructor(
    private plugin: UniversalExportPlugin,
    private bundled: readonly string[] = []
  ) {}

  /** Base URL of the catalogue, always ending in "/". */
  private baseUrl(): string {
    const raw = (this.plugin.settings.luaFilterRepoUrl || '').trim() || DEFAULT_LUA_FILTER_REPO_URL;
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  /** Where a filter is written, vault-relative. */
  private filePath(fileName: string): string {
    return path.join(this.plugin.manifest.dir, 'lua', fileName);
  }

  /** The filters this plugin ships with, which a download must never replace. */
  isBundled(fileName: string): boolean {
    return this.bundled.includes(fileName);
  }

  /** What a catalogue entry is called on disk. */
  fileNameOf(entry: LuaFilterEntry): string {
    return entry.fileName ?? `${entry.id.substring(entry.id.indexOf(':') + 1)}.lua`;
  }

  // ── Catalogue ───────────────────────────────────────────────────────────────

  /**
   * The catalogue, as entries.
   *
   * A file name is only offered once, and anything the plugin already ships
   * takes precedence over the lot — the name is what the `--lua-filter`
   * argument names, so two filters answering to it would make which one runs a
   * matter of install order.
   */
  async fetchCatalogue(): Promise<LuaFilterEntry[]> {
    const res = await requestUrl({ url: `${this.baseUrl()}index.json` });
    const data = res.json as { filters?: unknown };
    if (!data || !Array.isArray(data.filters)) {
      throw new Error('Malformed catalogue (missing "filters" array)');
    }

    const entries: LuaFilterEntry[] = [];
    const taken = new Set<string>(this.bundled);

    for (const f of data.filters as Partial<LuaFilterEntry>[]) {
      // A row with nothing to fetch, or nothing to call it, is not a row — and
      // one malformed row does not take the catalogue down with it.
      if (typeof f?.id !== 'string' || (typeof f.path !== 'string' && typeof f.url !== 'string')) {
        continue;
      }
      const entry: LuaFilterEntry = {
        id: f.id,
        storeName: f.storeName ?? f.id,
        description: f.description ?? '',
        author: f.author ?? '',
        license: f.license,
        category: isCategory(f.category) ? f.category : DEFAULT_LUA_FILTER_CATEGORY,
        formats: Array.isArray(f.formats) ? f.formats.filter(v => typeof v === 'string') : undefined,
        requires: f.requires,
        updated: f.updated,
        fileName: f.fileName,
        path: f.path,
        url: f.url,
        homepage: f.homepage,
      };
      const fileName = this.fileNameOf(entry);
      if (taken.has(fileName)) {
        continue;
      }
      taken.add(fileName);
      entries.push(entry);
    }
    return entries;
  }

  // ── Install / uninstall ─────────────────────────────────────────────────────

  /**
   * Download an entry and write it into `lua/`, returning the record to store.
   * `installed` is what is already there, so a filter cannot take the name of a
   * different one — the argument that runs it is the file name, and two filters
   * answering to it would make which one runs a matter of install order.
   */
  async install(entry: LuaFilterEntry, installed: readonly InstalledLuaFilter[]): Promise<InstalledLuaFilter> {
    const fileName = this.fileNameOf(entry);
    if (!/^[\w.@+-]+\.lua$/.test(fileName)) {
      throw new Error(`"${fileName}" is not a usable file name`);
    }
    if (this.isBundled(fileName)) {
      throw new Error(`"${fileName}" is one of the filters this plugin ships with`);
    }
    const clash = installed.find(f => f.fileName === fileName && f.id !== entry.id);
    if (clash) {
      throw new Error(`"${fileName}" is already taken by "${clash.storeName}"`);
    }

    const url = entry.url ?? this.baseUrl() + entry.path;
    const res = await requestUrl({ url });
    const text = res.text;
    if (!text?.trim()) {
      throw new Error('The downloaded filter is empty');
    }

    await this.plugin.app.vault.adapter.write(this.filePath(fileName), text);
    return {
      id: entry.id,
      fileName,
      storeName: entry.storeName,
      updated: entry.updated,
      category: entry.category,
      formats: entry.formats,
    };
  }

  /** Delete a filter's file. A file already gone is the state that was wanted. */
  async uninstall(filter: InstalledLuaFilter): Promise<void> {
    const { adapter } = this.plugin.app.vault;
    const filePath = this.filePath(filter.fileName);
    if (await adapter.exists(filePath)) {
      await adapter.remove(filePath);
    }
  }
}
