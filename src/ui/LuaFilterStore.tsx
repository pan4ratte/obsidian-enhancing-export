import * as ct from 'electron';
import { Notice, type App } from 'obsidian';
import { For, Match, Show, Switch, createMemo, createResource, createSignal } from 'solid-js';
import type { Lang } from '../lang';
import {
  DEFAULT_LUA_FILTER_CATEGORY,
  LUA_FILTER_CATEGORIES,
  LuaFilterManager,
  type InstalledLuaFilter,
  type LuaFilterCategory,
  type LuaFilterEntry,
} from '../lua_filters';
import Modal from './components/Modal';
import Icon from './components/Icon';

/**
 * The list is narrowed on two axes at once, because they answer different
 * questions and one row of chips could only ever answer one of them: "what of
 * mine is for Word?" needs a state *and* a shelf.
 */
type State = 'all' | 'installed' | 'updatable' | 'nosetup';
type Shelf = LuaFilterCategory | 'all';

/** What each shelf is drawn as. */
const CATEGORY_ICON: Record<LuaFilterCategory, string> = {
  structure: 'layers',
  citations: 'quote',
  figures: 'image',
  prose: 'type',
  word: 'file-text',
  latex: 'printer',
  tools: 'wrench',
  other: 'package',
};

const openExternal = (url: string) => {
  void ct.remote.shell.openExternal(url);
};

/** What went wrong, in the words of whatever threw — an object gets its shape, not `[object Object]`. */
const message = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e));

/**
 * The lua-filter store: the catalogue on shelves, and what is installed from it.
 * Installing puts a filter on disk; which templates *run* it is settled in the
 * template editor, so this list is only ever about what the vault has.
 *
 * The files are this component's to write — through the manager — but what is
 * installed is not: the records live in the settings, so every change goes back
 * out through a callback and comes back in as a prop.
 */
export default (props: {
  lang: Lang;
  app: App;
  manager: LuaFilterManager;
  installed: InstalledLuaFilter[];
  onInstalled: (filter: InstalledLuaFilter) => void;
  onUninstalled: (filter: InstalledLuaFilter) => void;
  onClose: () => void;
}) => {
  const { lang } = props;
  const t = lang.luaFilterStore;

  const [search, setSearch] = createSignal('');
  const [state, setState] = createSignal<State>('all');
  const [shelf, setShelf] = createSignal<Shelf>('all');
  // Ids with a request in flight, so a card's buttons go quiet while it runs
  // rather than the whole list.
  const [busy, setBusy] = createSignal<ReadonlySet<string>>(new Set());

  const [catalogue, { refetch }] = createResource(() => props.manager.fetchCatalogue());

  const withBusy = async (id: string, run: () => Promise<void>) => {
    setBusy(prev => new Set(prev).add(id));
    try {
      await run();
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const installedOf = (id: string) => props.installed.find(f => f.id === id);

  /**
   * Installed filters the catalogue no longer offers — an entry that was
   * withdrawn, or one from a catalogue this vault has since stopped pointing
   * at. They are still on disk and still running in whatever templates use
   * them, so they stay in the list on the record stored when they were
   * installed.
   */
  const orphans = createMemo<LuaFilterEntry[]>(() => {
    const known = new Set((catalogue() ?? []).map(e => e.id));
    return props.installed
      .filter(f => !known.has(f.id))
      .map(f => ({
        id: f.id,
        storeName: f.storeName,
        description: '',
        author: '',
        category: f.category ?? DEFAULT_LUA_FILTER_CATEGORY,
        updated: f.updated,
        fileName: f.fileName,
      }));
  });

  const allEntries = createMemo(() => [...(catalogue() ?? []), ...orphans()]);

  /** Whether an entry matches what has been typed. */
  const matchesSearch = (e: LuaFilterEntry) => {
    const f = search();
    if (!f) {
      return true;
    }
    const hit = (s?: string) => !!s && s.toLowerCase().includes(f);
    return hit(e.storeName) || hit(e.description) || hit(e.author) || hit(e.id);
  };

  const matched = createMemo(() => allEntries().filter(matchesSearch));

  /**
   * Whether the catalogue has moved on from the copy on disk. ISO dates compare
   * correctly as strings, and the catalogue records them to the day for exactly
   * that reason.
   */
  const isUpdatable = (e: LuaFilterEntry) => {
    const mine = installedOf(e.id);
    return !!mine && !!e.updated && !!mine.updated && e.updated > mine.updated;
  };

  const inState = (e: LuaFilterEntry, value: State) =>
    value === 'all'
      ? true
      : value === 'installed'
        ? !!installedOf(e.id)
        : value === 'updatable'
          ? isUpdatable(e)
          : // Nothing to install, set up or configure first — the shelf to browse
            // when a failed export is not worth the risk.
            !e.requires;

  const inShelf = (e: LuaFilterEntry, value: Shelf) => value === 'all' || e.category === value;

  /** Anything on disk that the catalogue has a newer copy of, whatever is being shown. */
  const updatableCount = createMemo(() => allEntries().filter(isUpdatable).length);

  /**
   * A chip counts what clicking it would show — so it is counted against the
   * *other* row's selection, and "Structure (2)" under "Installed" means two
   * installed structure filters rather than two in the catalogue.
   *
   * Every shelf is always offered, so the row does not rearrange itself as the
   * search is typed — except the catch-all one, which is only a shelf when
   * something has actually landed on it.
   */
  const count = (s: State, sh: Shelf) => matched().filter(e => inState(e, s) && inShelf(e, sh)).length;

  const stateChips = createMemo(() =>
    (
      [
        ['all', t.filterAll],
        ['installed', t.filterInstalled],
        // Offered only when there is something to update, and then regardless of
        // what is being shown: a chip that came and went as a search was typed
        // would be missed by whoever the news is for.
        ...(updatableCount() > 0 ? ([['updatable', t.filterUpdatable]] as const) : []),
        ['nosetup', t.filterNoSetup],
      ] as const
    ).map(([value, label]) => ({ value, label, count: count(value, shelf()) }))
  );

  const shelfChips = createMemo(() =>
    ([['all', t.filterAll], ...LUA_FILTER_CATEGORIES.map(c => [c, t.category[c]] as const)] as const)
      .filter(([value]) => value !== DEFAULT_LUA_FILTER_CATEGORY || allEntries().some(e => e.category === value))
      .map(([value, label]) => ({ value, label, count: count(state(), value) }))
  );

  const rows = createMemo(() =>
    matched()
      .filter(e => inState(e, state()) && inShelf(e, shelf()))
      // Installed first, then by name: what is already in use is what the list
      // is most often reopened for.
      .sort((a, b) => {
        const mine = Number(!!installedOf(b.id)) - Number(!!installedOf(a.id));
        return mine || a.storeName.localeCompare(b.storeName);
      })
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const install = (entry: LuaFilterEntry) =>
    withBusy(entry.id, async () => {
      try {
        const filter = await props.manager.install(entry, props.installed);
        props.onInstalled(filter);
        new Notice(t.installedNotice(filter.storeName));
      } catch (e) {
        new Notice(t.installFailed(message(e)));
      }
    });

  const uninstall = (entry: LuaFilterEntry) =>
    withBusy(entry.id, async () => {
      const filter = installedOf(entry.id);
      if (!filter) {
        return;
      }
      try {
        await props.manager.uninstall(filter);
        // Whoever owns the records also takes it back out of the templates that
        // run it: nothing may be left pointing at a file that is gone.
        props.onUninstalled(filter);
        new Notice(t.uninstalledNotice(filter.storeName));
      } catch (e) {
        new Notice(t.uninstallFailed(message(e)));
      }
    });

  // ── Card ────────────────────────────────────────────────────────────────────

  const Card = (cardProps: { entry: LuaFilterEntry }) => {
    const entry = () => cardProps.entry;
    const filter = () => installedOf(entry().id);
    const updatable = () => isUpdatable(entry());
    const isBusy = () => busy().has(entry().id);
    // An orphan has nothing left to fetch, so it can only be removed.
    const installable = () => !!entry().url || !!entry().path;
    // Whose work this is, and on what terms it may be used.
    const credit = () => (entry().license ? t.byAuthorUnder(entry().author, entry().license) : t.byAuthor(entry().author));

    return (
      <div class="ex-lua-card" classList={{ 'is-installed': !!filter() }}>
        <div class="ex-lua-card-main">
          <div class="ex-lua-card-head">
            <span class="ex-lua-name">{entry().storeName}</span>
            <Icon class="ex-lua-category-icon" name={CATEGORY_ICON[entry().category]} title={t.category[entry().category]} />
          </div>
          <Show when={entry().author}>
            <span class="ex-lua-author">{credit()}</span>
          </Show>
          <Show when={entry().description}>
            <p class="ex-lua-desc">{entry().description}</p>
          </Show>

          {/* What the filter needs before it can work is said before it is
              installed, not discovered in a failed export. */}
          <Show when={entry().requires}>
            <p class="ex-lua-requires">{t.requires(entry().requires)}</p>
          </Show>

          {/* Installing a filter only puts it on disk. Saying so here is what
              stops the store looking like it did nothing. */}
          <Show when={filter()}>
            <p class="ex-lua-installed-hint">{t.installedHint}</p>
          </Show>
        </div>

        <div class="ex-lua-actions">
          <Show when={entry().homepage}>
            <button class="ex-lua-readme" title={t.readme} onClick={() => openExternal(entry().homepage)}>
              <Icon name="book-open" />
            </button>
          </Show>
          <Show when={installable() && (!filter() || updatable())}>
            <button
              class="ex-lua-install"
              title={isBusy() ? t.installing : updatable() ? t.update : t.install}
              disabled={isBusy()}
              onClick={() => void install(entry())}
            >
              <Icon name={updatable() ? 'refresh-cw' : 'download'} />
            </button>
          </Show>
          <Show when={filter()}>
            <button class="ex-lua-uninstall" title={t.uninstall} disabled={isBusy()} onClick={() => void uninstall(entry())}>
              <Icon name="trash-2" />
            </button>
          </Show>
        </div>
      </div>
    );
  };

  return (
    <Modal app={props.app} title={t.title} classList={{ 'ex-lua-modal': true }} onClose={props.onClose}>
      <input
        type="text"
        class="ex-lua-search"
        placeholder={t.searchPlaceholder}
        spellcheck={false}
        onInput={e => setSearch(e.currentTarget.value.trim().toLowerCase())}
      />

      {/* Two rows, narrowing the list together. A chip with nothing behind it is
          dimmed and dead rather than a click that empties the list — except the
          one that is on, which must always stay clickable to get back out of. */}
      <div class="ex-lua-filters">
        <span class="ex-lua-filter-label">{t.rowShow}</span>
        <div class="ex-lua-filter-row">
          <For each={stateChips()}>
            {c => (
              <button
                class="ex-lua-filter"
                classList={{ 'is-active': state() === c.value, 'is-empty': c.count === 0 }}
                disabled={c.count === 0 && state() !== c.value}
                onClick={() => setState(c.value)}
              >
                {c.label}
                <Show when={!catalogue.loading}>
                  <span class="ex-lua-filter-count">({c.count})</span>
                </Show>
              </button>
            )}
          </For>
        </div>

        <span class="ex-lua-filter-label">{t.rowShelf}</span>
        <div class="ex-lua-filter-row">
          <For each={shelfChips()}>
            {c => (
              <button
                class="ex-lua-filter"
                classList={{ 'is-active': shelf() === c.value, 'is-empty': c.count === 0 }}
                disabled={c.count === 0 && shelf() !== c.value}
                onClick={() => setShelf(c.value)}
              >
                {c.label}
                <Show when={!catalogue.loading}>
                  <span class="ex-lua-filter-count">({c.count})</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="ex-lua-list">
        <Switch>
          <Match when={catalogue.loading}>
            <p class="ex-lua-status">{t.loading}</p>
          </Match>
          <Match when={catalogue.error}>
            <p class="ex-lua-status">{t.loadError}</p>
            <button class="mod-cta ex-lua-retry" onClick={() => void refetch()}>
              {t.retry}
            </button>
          </Match>
          <Match when={rows().length === 0}>
            <p class="ex-lua-status">
              {allEntries().length === 0
                ? t.emptyCatalogue
                : state() === 'installed' && shelf() === 'all' && !search()
                  ? t.noneInstalled
                  : t.noResults}
            </p>
          </Match>
          <Match when={rows().length > 0}>
            <For each={rows()}>{entry => <Card entry={entry} />}</For>
          </Match>
        </Switch>
      </div>
    </Modal>
  );
};
