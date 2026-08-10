import { For, createMemo } from 'solid-js';
import { t } from '../lang/helpers';
import { extractDefaultExtension, type ExportSetting } from '../settings';
import Icon from './components/Icon';

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

/** Every export template in one table. The order is the caller's to keep, defaulting to name ascending. */
export default (props: {
  templates: ExportSetting[];
  sort?: { column: Column; ascending: boolean };
  onSort?: (sort: { column: Column; ascending: boolean }) => void;
  onEdit?: (name: string) => void;
  onRemove?: (name: string) => void;
}) => {
  const column = () => props.sort?.column ?? 'name';
  const ascending = () => props.sort?.ascending ?? true;

  // A second click on the column already sorted turns it around.
  const sortBy = (next: Column) =>
    props.onSort?.(column() === next ? { column: next, ascending: !ascending() } : { column: next, ascending: true });

  const rows = createMemo(() => {
    const key = column();
    const direction = ascending() ? 1 : -1;
    return (
      props.templates
        .map(item => ({ name: item.name ?? '', output: describeOutput(extractDefaultExtension(item)) }))
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
    <table class="ex-template-table">
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
            <tr>
              <td class="ex-template-table-name">{row.name}</td>
              <td class="ex-template-table-output">{row.output}</td>
              <td class="ex-template-table-actions">
                <div class="ex-template-table-row-actions">
                  <Icon name="pencil" tooltip={t.ACTION_EDIT} onClick={() => props.onEdit?.(row.name)} />
                  <Icon name="trash" tooltip={t.ACTION_REMOVE} onClick={() => props.onRemove?.(row.name)} />
                </div>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
};
