import { For, Show, createMemo } from 'solid-js';
import { t } from '../../lang/helpers';
import { extractDefaultExtension, type ExportSetting } from '../../settings';
import { droppedBy, unsupportedBy, type Engine } from '../../pandoc/engine';
import { isMobileUi, isPhoneUi } from '../../system/platform';
import Icon from '../components/Icon';

type Column = 'name' | 'output';

/** What each extension is called outside a file manager; anything else falls back to itself. */
const OUTPUT_FORMATS: Record<string, string> = {
  '.bib': 'BibTeX',
  '.docx': 'Word',
  '.epub': 'EPUB',
  '.html': 'HTML',
  '.md': 'Markdown',
  '.mediawiki': 'MediaWiki',
  '.odt': 'OpenDocument',
  '.opml': 'OPML',
  '.pdf': 'PDF',
  '.pptx': 'PowerPoint',
  '.rst': 'reStructuredText',
  '.rtf': 'Rich Text',
  '.tex': 'LaTeX',
  '.textile': 'Textile',
  '.typ': 'Typst',
};

/** `.docx` reads as `Word (.docx)`. */
const describeOutput = (extension?: string) => {
  if (!extension) {
    return '';
  }
  const format = OUTPUT_FORMATS[extension.toLowerCase()] ?? extension.replace(/^\./, '').toUpperCase();
  return `${format} (${extension})`;
};

/**
 * What the engine will not do with this template, or nothing where it will do all of it. Said here rather than at the
 * export, which is too late to change the template it is about.
 */
const shortfall = (setting: ExportSetting, engine: Engine): string | undefined => {
  if (unsupportedBy(setting, engine)) {
    return t.WASM_TEMPLATE_UNAVAILABLE;
  }
  const dropped = droppedBy(setting, engine);
  return dropped.length > 0 ? t.WASM_TEMPLATE_DROPPED(dropped.join(' ')) : undefined;
};

/** Every export template in one table. The order is the caller's to keep, defaulting to name ascending. */
export default (props: {
  templates: ExportSetting[];
  /** The one that will run these templates, so the table can say which of them it will not run as written. */
  engine?: Engine;
  sort?: { column: Column; ascending: boolean };
  onSort?: (sort: { column: Column; ascending: boolean }) => void;
  onEdit?: (name: string) => void;
  onDuplicate?: (name: string) => void;
  onRemove?: (name: string) => void;
}) => {
  const column = () => props.sort?.column ?? 'name';
  const ascending = () => props.sort?.ascending ?? true;

  /* A touch screen has no pointer to reveal the row actions with, so they are shown from the start there. */
  const touch = isMobileUi();
  /* And a phone has no room for three of them: the row itself opens the editor, and the pencil goes. */
  const tapToEdit = isPhoneUi();

  // A second click on the column already sorted turns it around.
  const sortBy = (next: Column) =>
    props.onSort?.(column() === next ? { column: next, ascending: !ascending() } : { column: next, ascending: true });

  const rows = createMemo(() => {
    const key = column();
    const direction = ascending() ? 1 : -1;
    const engine = props.engine ?? 'native';
    return (
      props.templates
        .map(item => ({
          name: item.name ?? '',
          output: describeOutput(extractDefaultExtension(item)),
          warning: shortfall(item, engine),
        }))
        // Name breaks a tie on output, so the order never depends on settings-file position.
        .sort((a, b) => direction * (a[key].localeCompare(b[key]) || a.name.localeCompare(b.name)))
    );
  });

  const Heading = (headingProps: { column: Column; label: string }) => (
    <th
      class="ex-template-table-heading"
      classList={{ 'is-sorted': column() === headingProps.column }}
      onClick={() => sortBy(headingProps.column)}
    >
      <span class="ex-template-table-label">
        <span>{headingProps.label}</span>
        {/* Always drawn, so reversing the order moves nothing but the arrow. */}
        <Icon class="ex-template-table-sort" name={column() === headingProps.column && !ascending() ? 'arrow-down' : 'arrow-up'} />
      </span>
    </th>
  );

  return (
    <table class="ex-template-table" classList={{ 'is-touch': touch }}>
      <thead>
        <tr>
          <Heading column="name" label={t.TEMPLATE_NAME} />
          <Heading column="output" label={t.TEMPLATE_OUTPUT} />
          {/* The row actions' column, unlabelled — the icons say what they do. */}
          <th class="ex-template-table-actions" />
        </tr>
      </thead>
      <tbody>
        <For
          each={rows()}
          fallback={
            <tr class="ex-template-table-empty">
              <td colSpan={3}>{t.TEMPLATES_EMPTY}</td>
            </tr>
          }
        >
          {row => (
            <tr classList={{ 'is-tappable': tapToEdit }} onClick={tapToEdit ? () => props.onEdit?.(row.name) : undefined}>
              <td class="ex-template-table-name">
                <span class="ex-template-table-label">
                  <span>{row.name}</span>
                  <Show when={row.warning}>
                    <Icon class="ex-template-table-warning" name="alert-triangle" tooltip={row.warning} />
                  </Show>
                </span>
              </td>
              <td class="ex-template-table-output">{row.output}</td>
              <td class="ex-template-table-actions">
                {/* Kept from the row's own handler, so a tap on the trash is not also a tap on the template. */}
                <div class="ex-template-table-row-actions" onClick={e => e.stopPropagation()}>
                  <Show when={!tapToEdit}>
                    <Icon class="ex-template-table-edit" name="pencil" tooltip={t.ACTION_EDIT} onClick={() => props.onEdit?.(row.name)} />
                  </Show>
                  <Icon
                    class="ex-template-table-duplicate"
                    name="copy"
                    tooltip={t.ACTION_DUPLICATE}
                    onClick={() => props.onDuplicate?.(row.name)}
                  />
                  <Icon
                    class="ex-template-table-remove"
                    name="trash"
                    tooltip={t.ACTION_REMOVE}
                    onClick={() => props.onRemove?.(row.name)}
                  />
                </div>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
};
