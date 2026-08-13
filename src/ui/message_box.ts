import { App, Modal } from 'obsidian';
import { t } from '../lang/helpers';

export interface MessageBoxOptions {
  /** The whole body of the box, where one run of text is the whole of it. */
  message?: string;
  /** Draws the body instead, for a box that is more than one run of text. */
  render?: (contentEl: HTMLElement) => void;
  title?: string;
  buttons: 'Yes' | 'YesNo' | 'Ok' | 'OkCancel';
  buttonsLabel?: {
    yes?: string;
    no?: string;
    ok?: string;
    cancel?: string;
  };
  buttonsClass?: {
    yes?: string;
    no?: string;
    ok?: string;
    cancel?: string;
  };
  callback?: {
    yes?: () => void;
    no?: () => void;
    ok?: () => void;
    cancel?: () => void;
  };
}

/**
 * A yes-or-no question, answered before anything else happens.
 *
 * Closed rather than answered is a no: the buttons answer first and close after, so by the time the close is seen the
 * question has already been settled.
 */
export const confirm = (app: App, message: string, title?: string): Promise<boolean> =>
  new Promise(resolve => {
    const box = new MessageBox(app, {
      title,
      message,
      buttons: 'YesNo',
      callback: { yes: () => resolve(true), no: () => resolve(false) },
    });
    const close = box.onClose.bind(box);
    box.onClose = () => {
      close();
      resolve(false);
    };
    box.open();
  });

export class MessageBox extends Modal {
  readonly options: MessageBoxOptions;

  constructor(app: App, message: string);
  constructor(app: App, message: string, title?: string);
  constructor(app: App, options: MessageBoxOptions);
  constructor(app: App, options: MessageBoxOptions | string, title?: string) {
    super(app);
    this.options = typeof options === 'string' ? { message: options, buttons: 'Ok', title } : options;
  }
  onOpen(): void {
    const {
      titleEl,
      contentEl,
      options: { message, render, title, buttons, callback, buttonsLabel: label, buttonsClass },
    } = this;
    if (title) {
      titleEl.setText(title);
    }
    if (render) {
      render(contentEl);
    } else {
      contentEl.createDiv({ text: message });
    }
    switch (buttons) {
      case 'Yes':
        contentEl.createDiv({ cls: ['modal-button-container'], parent: contentEl }, el => {
          el.createEl('button', {
            text: label?.yes ?? t.BUTTON_YES,
            cls: ['mod-cta', buttonsClass?.yes],
            parent: el,
          }).onclick = () => this.call(callback?.yes);
        });
        break;
      case 'YesNo':
        contentEl.createDiv({ cls: ['modal-button-container'], parent: contentEl }, el => {
          el.createEl('button', {
            text: label?.yes ?? t.BUTTON_YES,
            cls: ['mod-cta', buttonsClass?.yes],
            parent: el,
          }).onclick = () => this.call(callback?.yes);
          el.createEl('button', {
            text: label?.no ?? t.BUTTON_NO,
            cls: ['mod-cta', buttonsClass?.no],
            parent: el,
          }).onclick = () => this.call(callback?.no);
        });
        break;
      case 'Ok':
        contentEl.createDiv({ cls: ['modal-button-container'], parent: contentEl }, el => {
          el.createEl('button', {
            text: label?.ok ?? t.BUTTON_OK,
            cls: ['mod-cta', buttonsClass?.no],
            parent: el,
          }).onclick = () => this.call(callback?.ok);
        });
        break;
      case 'OkCancel':
        contentEl.createDiv({ cls: ['modal-button-container'], parent: contentEl }, el => {
          el.createEl('button', {
            text: label?.ok ?? t.BUTTON_OK,
            cls: ['mod-cta', buttonsClass?.ok],
            parent: el,
          }).onclick = () => this.call(callback?.ok);
          el.createEl('button', {
            text: label?.cancel ?? t.BUTTON_CANCEL,
            cls: ['mod-cta', buttonsClass?.cancel],
            parent: el,
          }).onclick = () => this.call(callback?.cancel);
        });
        break;
    }
  }
  private call(callback?: () => void): void {
    if (callback) {
      callback();
    }
    this.close();
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
