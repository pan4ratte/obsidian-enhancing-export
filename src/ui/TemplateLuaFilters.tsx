import { createMemo } from 'solid-js';
import type { Lang } from '../lang';
import { hasLuaFilterArg, type InstalledLuaFilter } from '../lua_filters';
import { runsInFormat } from '../pandoc_format';
import CheckGrid from './components/CheckGrid';

/**
 * Which installed lua filters this template runs.
 *
 * A filter is installed once, in the store, and switched on per template here —
 * which is the only place that knows which template is being edited. Everything
 * on disk is listed, ticked or not, so what a template runs and what it *could*
 * run are one glance rather than a list plus a dropdown holding the rest.
 *
 * Everything that can do something for what this template writes, that is: a
 * filter setting Word styles has nothing to say to a LaTeX export, and offering
 * it there is offering a switch that does nothing.
 */
export default (props: {
  lang: Lang;
  /** Every filter on disk. */
  installed: InstalledLuaFilter[];
  /** What the template writes, which decides which filters are any use to it. */
  format?: string;
  /** The template's extra arguments, which is where the flags live. */
  args?: string;
  onAdd: (fileName: string) => void;
  onRemove: (fileName: string) => void;
}) => {
  const { lang } = props;

  const items = createMemo(() =>
    props.installed
      .filter(filter => runsInFormat(filter.formats, props.format) || hasLuaFilterArg(props.args, filter.fileName))
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
      empty={props.installed.length === 0 ? lang.settingTab.noLuaFiltersInstalled : lang.settingTab.noLuaFiltersForFormat}
      onToggle={(fileName, running) => (running ? props.onAdd(fileName) : props.onRemove(fileName))}
    />
  );
};
