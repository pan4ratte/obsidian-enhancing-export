import { For, createMemo, createSignal } from 'solid-js';
import type { Lang } from '../lang';
import { extractDefaultExtension, type ExportSetting } from '../settings';
import Icon from './components/Icon';

/** The columns worth ordering by, which are also the ones carrying a value. */
type Column = 'name' | 'output';

/**
 * What each extension is called outside a file manager. Every format the
 * bundled templates write is here; anything else falls back to its own
 * extension, which is all that is known about it.
 */
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
 * Every export template in one table: what it is called, what it writes, and
 * the two things to do with it. Ordering lives here — it is a view of the
 * settings, not part of them, so it is not saved. Making a template is not one
 * of the table's jobs; that lives in the card above it.
 */
export default (props: {
  lang: Lang;
  templates: ExportSetting[];
  onEdit?: (name: string) => void;
  onRemove?: (name: string) => void;
}) => {
  const { lang } = props;
  const [column, setColumn] = createSignal<Column>('name');
  const [ascending, setAscending] = createSignal(true);

  // A second click on the column already sorted turns it around.
  const sortBy = (next: Column) => {
    if (column() === next) {
      setAscending(v => !v);
      return;
    }
    setColumn(next);
    setAscending(true);
  };

  const rows = createMemo(() => {
    const key = column();
    const direction = ascending() ? 1 : -1;
    return props.templates
      .map(t => ({ name: t.name ?? '', output: describeOutput(extractDefaultExtension(t)) }))
      // Name breaks a tie on output, so the order never falls back to where a
      // template happens to sit in the settings file.
      .sort((a, b) => direction * (a[key].localeCompare(b[key]) || a.name.localeCompare(b.name)));
  });

  const Heading = (headingProps: { column: Column; label: string }) => (
    <th
      class="ex-template-table-heading"
      classList={{ 'is-sorted': column() === headingProps.column }}
      onClick={() => sortBy(headingProps.column)}>
      <span class="ex-template-table-label">
        <span>{headingProps.label}</span>
        {/* Always drawn, so turning the order around moves nothing but the arrow. */}
        <Icon
          class="ex-template-table-sort"
          name={column() === headingProps.column && !ascending() ? 'arrow-down' : 'arrow-up'}
        />
      </span>
    </th>
  );

  return (
    <table class="ex-template-table">
      <thead>
        <tr>
          <Heading column="name" label={lang.settingTab.name} />
          <Heading column="output" label={lang.settingTab.templateOutput} />
          {/* The row actions' column. It has no heading of its own — what the
              icons do is said by the icons. */}
          <th class="ex-template-table-actions" />
        </tr>
      </thead>
      <tbody>
        <For
          each={rows()}
          fallback={
            <tr class="ex-template-table-empty">
              <td colSpan={3}>{lang.settingTab.noTemplates}</td>
            </tr>
          }>
          {row => (
            <tr>
              <td class="ex-template-table-name">{row.name}</td>
              <td class="ex-template-table-output">{row.output}</td>
              <td class="ex-template-table-actions">
                <div class="ex-template-table-row-actions">
                  <Icon name="pencil" title={lang.settingTab.edit} onClick={() => props.onEdit?.(row.name)} />
                  <Icon name="trash" title={lang.settingTab.remove} onClick={() => props.onRemove?.(row.name)} />
                </div>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
};
