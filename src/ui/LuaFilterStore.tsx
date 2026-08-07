import * as ct from 'electron';
import { Notice, Platform, type App } from 'obsidian';
import { For, Match, Show, Switch, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from 'solid-js';
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
 * The chips above the list: how a filter stands, then the shelf it sits on, in
 * one row. There are more of them than fit, which is what the row scrolling
 * sideways is for — the same filter row the Advanced Word Count extension store
 * uses, chevrons and all.
 */
type Chip = LuaFilterCategory | 'all' | 'installed' | 'updatable' | 'nosetup';

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
  const [chip, setChip] = createSignal<Chip>('all');
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

  const inChip = (e: LuaFilterEntry, value: Chip) =>
    value === 'all'
      ? true
      : value === 'installed'
        ? !!installedOf(e.id)
        : value === 'updatable'
          ? isUpdatable(e)
          : value === 'nosetup'
            ? // Nothing to install, set up or configure first — the chip to press
              // when a failed export is not worth the risk.
              !e.requires
            : e.category === value;

  /** Anything on disk that the catalogue has a newer copy of, whatever is being shown. */
  const updatableCount = createMemo(() => allEntries().filter(isUpdatable).length);

  /**
   * Each chip counts what it would show for the current search, so the number
   * answers "how many of these are there" independently of which chip is on.
   * Every shelf is always offered, so the row does not rearrange itself as the
   * search is typed — except the catch-all one, which is only a shelf when
   * something has actually landed on it.
   */
  const chips = createMemo(() => {
    const counted = (value: Chip) => matched().filter(e => inChip(e, value)).length;
    const shelves = LUA_FILTER_CATEGORIES.filter(c => c !== DEFAULT_LUA_FILTER_CATEGORY || allEntries().some(e => e.category === c));
    return [
      ['all', t.filterAll],
      ['installed', t.filterInstalled],
      // Offered only when there is something to update, and then regardless of
      // what is being shown: a chip that came and went as a search was typed
      // would be missed by whoever the news is for.
      ...(updatableCount() > 0 ? ([['updatable', t.filterUpdatable]] as const) : []),
      ['nosetup', t.filterNoSetup],
      ...shelves.map(c => [c, t.category[c]] as const),
    ].map(([value, label]: [Chip, string]) => ({ value, label, count: counted(value) }));
  });

  // ── The chip row's overflow ─────────────────────────────────────────────────

  let row!: HTMLDivElement;
  const [overflow, setOverflow] = createSignal({ left: false, right: false });

  /** Which edges are cut off. A pixel of slack absorbs sub-pixel rounding. */
  const syncOverflow = () =>
    setOverflow({
      left: row.scrollLeft > 1,
      right: row.scrollWidth - row.clientWidth - row.scrollLeft > 1,
    });

  /**
   * A mouse wheel emits vertical deltas, which the browser hands to the nearest
   * vertically scrollable ancestor — the modal, leaving this row unmoved however
   * long it is. Turn a predominantly vertical wheel sideways; a touchpad's
   * horizontal deltas already scroll the row and are left alone.
   */
  const wheelToHorizontal = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || row.scrollWidth <= row.clientWidth) {
      return;
    }
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  };

  onMount(() => {
    // The row's width follows the modal's, so what is cut off is worth watching
    // rather than working out once.
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(row);
    onCleanup(() => observer.disconnect());
  });

  // A chip appearing or disappearing changes what overflows just as a resize does.
  createEffect(() => {
    chips();
    syncOverflow();
  });

  const rows = createMemo(() =>
    matched()
      .filter(e => inChip(e, chip()))
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

      {/* One row that scrolls sideways rather than wrapping, so adding a chip
          never costs the list a line of height. */}
      <div class="ex-lua-filters-wrap">
        <div ref={row} class="ex-lua-filters" onScroll={syncOverflow} onWheel={wheelToHorizontal}>
          <For each={chips()}>
            {c => (
              <button class="ex-lua-filter" classList={{ 'is-active': chip() === c.value }} onClick={() => setChip(c.value)}>
                {c.label}
                <Show when={!catalogue.loading}>
                  <span class="ex-lua-filter-count">({c.count})</span>
                </Show>
              </button>
            )}
          </For>
        </div>

        {/* The scrollbar is hidden, so a cut-off edge needs something else to say
            there is more. Touch scrolls the row directly and needs neither. */}
        <Show when={Platform.isDesktop}>
          <button
            class="ex-lua-filters-less"
            classList={{ 'is-visible': overflow().left }}
            title={t.moreFilters}
            onClick={() => row.scrollTo({ left: 0, behavior: 'smooth' })}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            class="ex-lua-filters-more"
            classList={{ 'is-visible': overflow().right }}
            title={t.moreFilters}
            onClick={() => row.scrollTo({ left: row.scrollWidth, behavior: 'smooth' })}
          >
            <Icon name="chevron-right" />
          </button>
        </Show>
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
              {allEntries().length === 0 ? t.emptyCatalogue : chip() === 'installed' && !search() ? t.noneInstalled : t.noResults}
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
