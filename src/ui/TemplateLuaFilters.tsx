import { createMemo } from 'solid-js';
import type { Lang } from '../lang';
import { hasLuaFilterArg, type InstalledLuaFilter } from '../lua_filters';
import CheckGrid from './components/CheckGrid';

/**
 * Which installed lua filters this template runs.
 *
 * A filter is installed once, in the store, and switched on per template here —
 * which is the only place that knows which template is being edited. Everything
 * on disk is listed, ticked or not, so what a template runs and what it *could*
 * run are one glance rather than a list plus a dropdown holding the rest.
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

  const items = createMemo(() =>
    [...props.installed]
      .sort((a, b) => a.storeName.localeCompare(b.storeName))
      .map(filter => ({
        value: filter.fileName,
        label: filter.storeName,
        // The file name is what the flag actually carries, and two filters can
        // share a store name only until one of them is renamed.
        title: filter.fileName,
        checked: hasLuaFilterArg(props.args, filter.fileName),
      }))
  );

  return (
    <CheckGrid
      items={items()}
      empty={lang.settingTab.noLuaFiltersInstalled}
      onToggle={(fileName, running) => (running ? props.onAdd(fileName) : props.onRemove(fileName))}
    />
  );
};
