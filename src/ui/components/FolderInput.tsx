import { AbstractInputSuggest, App, TFolder } from 'obsidian';
import { onCleanup } from 'solid-js';

/** The vault's own root, which Obsidian keeps as `/` and a path is written as nothing at all. */
const ROOT = '/';

const asPath = (folder: TFolder): string => (folder.path === ROOT ? '' : folder.path);

/** The folders of the vault, offered as one is typed. */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly onPick: (path: string) => void,
    private readonly rootLabel: string
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): TFolder[] {
    const wanted = query.toLowerCase();
    return this.app.vault.getAllFolders(true).filter(folder => folder.path.toLowerCase().includes(wanted));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path === ROOT ? this.rootLabel : folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(asPath(folder));
    this.onPick(asPath(folder));
    this.close();
  }
}

/** A folder of the vault, typed or picked off the list the typing narrows. */
export default (props: { app: App; value?: string; placeholder?: string; onChange: (value: string) => void }) => {
  let suggest: FolderSuggest | undefined;
  onCleanup(() => suggest?.close());

  return (
    <input
      ref={el => (suggest = new FolderSuggest(props.app, el, props.onChange, props.placeholder ?? ROOT))}
      type="text"
      spellcheck={false}
      value={props.value ?? ''}
      placeholder={props.placeholder}
      onChange={e => props.onChange(e.target.value)}
    />
  );
};
