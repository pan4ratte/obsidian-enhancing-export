import { requestUrl } from 'obsidian';
import path from 'path';
import type UniversalExportPlugin from './main';

/*
 * The lua-filter store.
 *
 * Three catalogues feed it, and only the first is a list kept by hand:
 *
 * - `curated`  — an index.json in this plugin's own repo, for filters worth
 *                pointing at that live nowhere else. Entries may carry a path
 *                relative to the catalogue or an absolute URL to any host.
 * - `upstream` — the pandoc-ext organisation, which is where the filters from
 *                the retired pandoc/lua-filters repo now live. One API call
 *                returns every repository with the description and default
 *                branch a card needs, so the catalogue is the org itself.
 * - `course`   — the filters kept in the course-it-in-science vault, read
 *                straight out of the folder they live in.
 *
 * They are read in that order and a file name is only taken once, so a filter
 * already offered by an earlier source — or shipped with the plugin — is not
 * offered again by a later one.
 *
 * Nothing here executes what it downloads: a filter is text written into `lua/`,
 * and only pandoc ever reads it.
 */

export type LuaFilterSource = 'curated' | 'upstream' | 'course';

/** Every catalogue, in the order they get first claim on a file name. */
export const LUA_FILTER_SOURCES = ['curated', 'upstream', 'course'] as const;

/** One row of a catalogue — everything a card shows, plus where to fetch it. */
export interface LuaFilterEntry {
  id: string;
  storeName: string;
  description: string;
  author: string;
  /** Compared against the installed copy's to offer an update. */
  updated?: string;
  /** What the filter is called in `lua/`. Defaults to `<id>.lua`. */
  fileName?: string;
  /** Relative to the curated catalogue's base URL. */
  path?: string;
  /** Absolute URL, which wins over `path`. */
  url?: string;
  /** Where to read about it. */
  homepage?: string;
  source: LuaFilterSource;
}

/** What is recorded in the settings once a filter is on disk. */
export interface InstalledLuaFilter {
  id: string;
  fileName: string;
  storeName: string;
  updated?: string;
  source: LuaFilterSource;
}

/** The curated catalogue, unless a vault points `luaFilterRepoUrl` elsewhere. */
export const DEFAULT_LUA_FILTER_REPO_URL = 'https://raw.githubusercontent.com/pan4ratte/obsidian-enhancing-export/main/lua-filters/';

/** The organisation the pandoc project publishes its filters under. */
const UPSTREAM_ORG = 'pandoc-ext';
const UPSTREAM_API = `https://api.github.com/orgs/${UPSTREAM_ORG}/repos?per_page=100&sort=full_name`;

/** The vault whose pandoc filters are offered alongside the published ones. */
const COURSE_REPO = 'pan4ratte/course-it-in-science';
/** Where in that repository the filters sit. */
const COURSE_DIR = 'Obsidian/Pandoc/filters';

const GITHUB_HEADERS = { Accept: 'application/vnd.github+json' };

/**
 * Repositories in the organisation that are not filters — the org's profile
 * README and the notes about the move away from pandoc/lua-filters.
 */
const UPSTREAM_NOT_FILTERS = new Set(['.github', 'info']);

/** Shape of the one field of the GitHub response this reads. */
interface GitHubRepo {
  name: string;
  description: string | null;
  default_branch: string;
  pushed_at: string | null;
  html_url: string;
  archived: boolean;
}

/** One row of a GitHub directory listing. */
interface GitHubContent {
  name: string;
  type: string;
  download_url: string | null;
}

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
 * Fetches the catalogues and owns the files in `lua/`. It deliberately does not
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

  /** Base URL of the curated catalogue, always ending in "/". */
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

  // ── Catalogues ──────────────────────────────────────────────────────────────

  /** The curated index.json, as entries. */
  async fetchCurated(): Promise<LuaFilterEntry[]> {
    const res = await requestUrl({ url: `${this.baseUrl()}index.json` });
    const data = res.json as { filters?: unknown };
    if (!data || !Array.isArray(data.filters)) {
      throw new Error('Malformed catalogue (missing "filters" array)');
    }
    return (
      (data.filters as Partial<LuaFilterEntry>[])
        // An entry with nothing to fetch, or nothing to call it, is not a row.
        .filter(f => typeof f?.id === 'string' && (typeof f.path === 'string' || typeof f.url === 'string'))
        .map(f => ({
          id: f.id,
          storeName: f.storeName ?? f.id,
          description: f.description ?? '',
          author: f.author ?? '',
          updated: f.updated,
          fileName: f.fileName,
          path: f.path,
          url: f.url,
          homepage: f.homepage,
          source: 'curated' as const,
        }))
    );
  }

  /**
   * Every filter published by the pandoc-ext organisation. The repository list
   * carries the name, description and default branch, so one request builds the
   * whole catalogue — the per-filter files are only fetched on install.
   */
  async fetchUpstream(): Promise<LuaFilterEntry[]> {
    const res = await requestUrl({ url: UPSTREAM_API, headers: GITHUB_HEADERS });
    const repos = res.json as GitHubRepo[];
    if (!Array.isArray(repos)) {
      throw new Error('Malformed repository list');
    }
    return repos
      .filter(r => r && typeof r.name === 'string' && !UPSTREAM_NOT_FILTERS.has(r.name))
      .map(r => ({
        // Namespaced, so a curated entry for the same filter stays a separate row
        // with its own install state rather than colliding with this one.
        id: `${UPSTREAM_ORG}:${r.name}`,
        storeName: r.name,
        description: r.description ?? '',
        author: UPSTREAM_ORG,
        // Dates only: comparing an installed copy against the catalogue has to
        // compare like with like, and the time of day says nothing here.
        updated: r.pushed_at?.substring(0, 10),
        fileName: `${r.name}.lua`,
        url: `https://raw.githubusercontent.com/${UPSTREAM_ORG}/${r.name}/${r.default_branch}/${r.name}.lua`,
        homepage: r.html_url,
        source: 'upstream' as const,
      }));
  }

  /**
   * The lua filters kept in the course-it-in-science vault. There is no manifest
   * to read, so the folder listing is the catalogue: two requests, one to learn
   * the default branch and when the repository last moved, one for the files.
   * Nothing there describes a filter, so the cards carry names only.
   */
  async fetchCourse(): Promise<LuaFilterEntry[]> {
    const repo = (await requestUrl({ url: `https://api.github.com/repos/${COURSE_REPO}`, headers: GITHUB_HEADERS })).json as GitHubRepo;
    const branch = repo?.default_branch ?? 'main';
    // One date for the lot: a directory listing does not say when each file
    // changed, and the repository's own last push is the closest thing to it.
    const updated = repo?.pushed_at?.substring(0, 10);

    const res = await requestUrl({
      url: `https://api.github.com/repos/${COURSE_REPO}/contents/${COURSE_DIR}?ref=${branch}`,
      headers: GITHUB_HEADERS,
    });
    const files = res.json as GitHubContent[];
    if (!Array.isArray(files)) {
      throw new Error('Malformed directory listing');
    }
    return files
      .filter(f => f?.type === 'file' && f.name?.endsWith('.lua') && !!f.download_url)
      .map(f => ({
        id: `course:${f.name.replace(/\.lua$/, '')}`,
        storeName: f.name.replace(/\.lua$/, ''),
        description: '',
        author: COURSE_REPO,
        updated,
        fileName: f.name,
        url: f.download_url,
        homepage: `https://github.com/${COURSE_REPO}/blob/${branch}/${COURSE_DIR}/${f.name}`,
        source: 'course' as const,
      }));
  }

  /**
   * Every catalogue at once. A source failing is reported rather than thrown:
   * the others' filters are still worth showing, and the GitHub API is rate
   * limited per address in a way the curated catalogue is not.
   *
   * A file name is only offered once. The sources are read in the order they are
   * declared, and anything the plugin already ships takes precedence over all of
   * them — the name is what the `--lua-filter` argument names, so two filters
   * answering to it would make which one runs a matter of install order.
   */
  async fetchAll(): Promise<{ entries: LuaFilterEntry[]; failed: LuaFilterSource[] }> {
    const results = await Promise.allSettled([this.fetchCurated(), this.fetchUpstream(), this.fetchCourse()]);

    const entries: LuaFilterEntry[] = [];
    const failed: LuaFilterSource[] = [];
    const taken = new Set<string>(this.bundled);

    for (const [i, source] of LUA_FILTER_SOURCES.entries()) {
      const result = results[i];
      if (result.status === 'rejected') {
        failed.push(source);
        console.error(`[obsidian-enhancing-export] ${source} lua-filter catalogue failed`, result.reason);
        continue;
      }
      for (const entry of result.value) {
        const fileName = this.fileNameOf(entry);
        if (taken.has(fileName)) {
          continue;
        }
        taken.add(fileName);
        entries.push(entry);
      }
    }
    return { entries, failed };
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
      source: entry.source,
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
