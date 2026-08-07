import * as ct from 'electron';
import { Notice } from 'obsidian';
import { For, Match, Show, Switch, createMemo, createResource, createSignal } from 'solid-js';
import type { Lang } from '../lang';
import type { ExportSetting, PandocExportSetting } from '../settings';
import {
  LuaFilterManager,
  hasLuaFilterArg,
  type InstalledLuaFilter,
  type LuaFilterEntry,
  type LuaFilterSource,
} from '../lua_filters';
import Modal from './components/Modal';
import Icon from './components/Icon';

/** The chips above the list. `all` is every catalogue, not every state. */
type Chip = 'all' | 'curated' | 'upstream' | 'installed';

/** What each source is drawn as, and what the icon's tooltip calls it. */
const SOURCE_ICON: Record<LuaFilterSource, string> = {
  curated: 'bookmark',
  upstream: 'github',
};

const openExternal = (url: string) => {
  ct.remote.shell.openExternal(url);
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The lua-filter store: both catalogues in one list, with what is installed and
 * which templates run it.
 *
 * The files are this component's to write — through the manager — but what is
 * installed is not: the records live in the settings, so every change goes back
 * out through a callback and comes back in as a prop. That is what keeps the
 * list's install states in step with the templates table behind it.
 */
export default (props: {
  lang: Lang;
  manager: LuaFilterManager;
  installed: InstalledLuaFilter[];
  templates: ExportSetting[];
  onInstalled: (filter: InstalledLuaFilter) => void;
  onUninstalled: (filter: InstalledLuaFilter) => void;
  onAddToTemplate: (templateName: string, fileName: string) => void;
  onRemoveFromTemplate: (templateName: string, fileName: string) => void;
  onClose: () => void;
}) => {
  const { lang } = props;
  const t = lang.luaFilterStore;

  const [search, setSearch] = createSignal('');
  const [chip, setChip] = createSignal<Chip>('all');
  // Ids with a request in flight, so a card's buttons go quiet while it runs
  // rather than the whole list.
  const [busy, setBusy] = createSignal<ReadonlySet<string>>(new Set());

  const [catalogue, { refetch }] = createResource(() => props.manager.fetchAll());

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
   * Installed filters the catalogues no longer offer — a repository that moved
   * or a curated entry that was withdrawn. They are still on disk and still
   * running in whatever templates use them, so they stay in the list on the
   * record that was stored when they were installed.
   */
  const orphans = createMemo<LuaFilterEntry[]>(() => {
    const known = new Set((catalogue()?.entries ?? []).map(e => e.id));
    return props.installed
      .filter(f => !known.has(f.id))
      .map(f => ({
        id: f.id,
        storeName: f.storeName,
        description: '',
        author: '',
        updated: f.updated,
        fileName: f.fileName,
        source: f.source,
      }));
  });

  const allEntries = createMemo(() => [...(catalogue()?.entries ?? []), ...orphans()]);

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

  const inChip = (e: LuaFilterEntry, value: Chip) =>
    value === 'all' ? true : value === 'installed' ? !!installedOf(e.id) : e.source === value;

  /**
   * Each chip counts what it would show for the current search, so the number
   * answers "how many of these are there" independently of which chip is on.
   */
  const chips = createMemo(() =>
    ([
      ['all', t.filterAll],
      ['curated', t.filterCurated],
      ['upstream', t.filterUpstream],
      ['installed', t.filterInstalled],
    ] as const).map(([value, label]) => ({
      value,
      label,
      count: matched().filter(e => inChip(e, value)).length,
    }))
  );

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

  /** Both catalogues down is the only state with nothing at all to show. */
  const failedAll = createMemo(() => (catalogue()?.failed.length ?? 0) === 2);

  // ── Templates a filter can be added to ──────────────────────────────────────

  const pandocTemplates = createMemo(() => props.templates.filter((v): v is PandocExportSetting => v.type === 'pandoc'));
  const usedBy = (fileName: string) => pandocTemplates().filter(v => hasLuaFilterArg(v.customArguments, fileName));
  const notUsedBy = (fileName: string) => pandocTemplates().filter(v => !hasLuaFilterArg(v.customArguments, fileName));

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
        // Nothing may be left running a filter that is no longer on disk.
        for (const template of usedBy(filter.fileName)) {
          props.onRemoveFromTemplate(template.name, filter.fileName);
        }
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
    const fileName = () => filter()?.fileName ?? props.manager.fileNameOf(entry());
    // ISO dates compare correctly as strings, and both catalogues record them
    // to the day for exactly that reason.
    const updatable = () => {
      const mine = filter();
      return !!mine && !!entry().updated && !!mine.updated && entry().updated > mine.updated;
    };
    const isBusy = () => busy().has(entry().id);
    // An orphan has nothing left to fetch, so it can only be removed.
    const installable = () => !!entry().url || !!entry().path;

    let select!: HTMLSelectElement;

    return (
      <div class="ex-lua-card" classList={{ 'is-installed': !!filter() }}>
        <div class="ex-lua-card-main">
          <div class="ex-lua-card-head">
            <span class="ex-lua-name">{entry().storeName}</span>
            <Icon class="ex-lua-source-icon" name={SOURCE_ICON[entry().source]} title={
              entry().source === 'curated' ? t.filterCurated : t.filterUpstream
            } />
          </div>
          <Show when={entry().author}>
            <span class="ex-lua-author">{t.byAuthor(entry().author)}</span>
          </Show>
          <Show when={entry().description}>
            <p class="ex-lua-desc">{entry().description}</p>
          </Show>

          {/* Installing a filter does not run it — a template has to ask for it,
              and this is where that is said. */}
          <Show when={filter()}>
            <div class="ex-lua-templates">
              <Show when={usedBy(fileName()).length > 0}>
                <div class="ex-lua-used-by">
                  <span class="ex-lua-used-by-label">{t.usedBy}</span>
                  <For each={usedBy(fileName())}>
                    {template => (
                      <span class="ex-lua-used-by-item">
                        {template.name}
                        <Icon
                          name="x"
                          title={t.removeFromTemplate(template.name)}
                          onClick={() => {
                            props.onRemoveFromTemplate(template.name, fileName());
                            new Notice(t.removedFromTemplate(entry().storeName, template.name));
                          }}
                        />
                      </span>
                    )}
                  </For>
                </div>
              </Show>

              <Show
                when={notUsedBy(fileName()).length > 0}
                fallback={
                  <Show when={pandocTemplates().length === 0}>
                    <span class="ex-lua-no-templates">{t.noPandocTemplates}</span>
                  </Show>
                }>
                <select
                  ref={select}
                  class="dropdown ex-lua-add-select"
                  onChange={e => {
                    const name = e.currentTarget.value;
                    // Back to the prompt: the control asks a question, it does
                    // not hold an answer.
                    select.value = '';
                    if (!name) {
                      return;
                    }
                    props.onAddToTemplate(name, fileName());
                    new Notice(t.addedToTemplate(entry().storeName, name));
                  }}>
                  <option value="">{t.addToTemplate}</option>
                  <For each={notUsedBy(fileName())}>{template => <option value={template.name}>{template.name}</option>}</For>
                </select>
              </Show>
            </div>
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
              onClick={() => void install(entry())}>
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
    <Modal app={app} title={t.title} classList={{ 'ex-lua-modal': true }} onClose={props.onClose}>
      <input
        type="text"
        class="ex-lua-search"
        placeholder={t.searchPlaceholder}
        spellcheck={false}
        onInput={e => setSearch(e.currentTarget.value.trim().toLowerCase())}
      />

      <div class="ex-lua-filters">
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

      {/* One catalogue down still leaves the other worth showing, so it is said
          above the list rather than instead of it. */}
      <Show when={!catalogue.loading && !failedAll() && catalogue()?.failed.length > 0}>
        <p class="ex-lua-notice">
          {t.sourceUnavailable(catalogue().failed[0] === 'curated' ? t.filterCurated : t.filterUpstream)}
        </p>
      </Show>

      <div class="ex-lua-list">
        <Switch>
          <Match when={catalogue.loading}>
            <p class="ex-lua-status">{t.loading}</p>
          </Match>
          <Match when={failedAll()}>
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
