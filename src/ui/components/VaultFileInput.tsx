import { AbstractInputSuggest, type App, TFile } from 'obsidian';
import { onCleanup } from 'solid-js';

/** The files of the vault with one of these extensions, offered as a name is typed. */
class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    input: HTMLInputElement,
    private readonly extensions: readonly string[],
    private readonly onPick: (path: string) => void
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): TFile[] {
    const wanted = query.toLowerCase();
    return this.app.vault
      .getFiles()
      .filter(file => this.extensions.includes(file.extension.toLowerCase()) && file.path.toLowerCase().includes(wanted));
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    this.onPick(file.path);
    this.close();
  }
}

/**
 * A file of the vault, typed or picked off the list the typing narrows.
 *
 * What the desktop's file dialog is for on a phone, which has none: the document to convert has to be in the vault to
 * be reachable at all, and this is how it is named.
 */
export default (props: {
  app: App;
  value?: string;
  extensions: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) => {
  let suggest: FileSuggest | undefined;
  onCleanup(() => suggest?.close());

  return (
    <input
      ref={el => (suggest = new FileSuggest(props.app, el, props.extensions, props.onChange))}
      type="text"
      spellcheck={false}
      value={props.value ?? ''}
      placeholder={props.placeholder}
      onChange={e => props.onChange(e.target.value)}
    />
  );
};
