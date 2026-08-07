import { For, Show, createMemo } from 'solid-js';
import type { Lang } from '../lang';
import { hasLuaFilterArg, type InstalledLuaFilter } from '../lua_filters';
import Icon from './components/Icon';

/**
 * Which installed lua filters this template runs.
 *
 * A filter is installed once, in the store, and switched on per template here —
 * which is the only place that knows which template is being edited. The filters
 * already running are listed as chips; the dropdown offers the rest and goes
 * straight back to its prompt, because it asks a question rather than holding an
 * answer.
 */
export default (props: {
  lang: Lang;
  /** Every filter on disk. */
  installed: InstalledLuaFilter[];
  /** The template's extra arguments, which is where the flags live. */
  args?: string;
  onAdd: (fileName: string) => void;
  onRemove: (fileName: string) => void;
}) => {
  const { lang } = props;

  const byName = (a: InstalledLuaFilter, b: InstalledLuaFilter) => a.storeName.localeCompare(b.storeName);
  const running = createMemo(() => props.installed.filter(f => hasLuaFilterArg(props.args, f.fileName)).sort(byName));
  const available = createMemo(() => props.installed.filter(f => !hasLuaFilterArg(props.args, f.fileName)).sort(byName));

  let select!: HTMLSelectElement;

  return (
    <div class="ex-template-lua">
      <Show when={running().length > 0}>
        <div class="ex-template-lua-running">
          <For each={running()}>
            {filter => (
              <span class="ex-template-lua-chip">
                {filter.storeName}
                <Icon name="x" title={lang.settingTab.removeLuaFilter(filter.storeName)} onClick={() => props.onRemove(filter.fileName)} />
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.installed.length > 0} fallback={<span class="ex-template-lua-empty">{lang.settingTab.noLuaFiltersInstalled}</span>}>
        <select
          ref={select}
          class="dropdown ex-template-lua-select"
          disabled={available().length === 0}
          onChange={e => {
            const fileName = e.currentTarget.value;
            select.value = '';
            if (fileName) {
              props.onAdd(fileName);
            }
          }}
        >
          <option value="">{lang.settingTab.addLuaFilter}</option>
          <For each={available()}>{filter => <option value={filter.fileName}>{filter.storeName}</option>}</For>
        </select>
      </Show>
    </div>
  );
};
