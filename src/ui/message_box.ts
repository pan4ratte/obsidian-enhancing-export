import { App, Modal } from 'obsidian';
import { t } from '../lang/helpers';
import { isMobileUi } from '../system/platform';

export interface MessageBoxOptions {
  /** The whole body of the box, where one run of text is the whole of it. */
  message?: string;
  /** Draws the body instead, for a box that is more than one run of text. */
  render?: (contentEl: HTMLElement) => void;
  title?: string;
  buttons: 'Ok' | 'OkCancel';
  buttonsLabel?: {
    ok?: string;
    cancel?: string;
  };
  /** What Obsidian's own delete dialogs do with the button that goes through with it. */
  destructive?: boolean;
  callback?: {
    ok?: () => void;
    cancel?: () => void;
  };
}

export interface ConfirmOptions {
  message: string;
  title?: string;
  /** Names the action rather than answering yes, as every Obsidian confirmation does. */
  accept?: string;
  destructive?: boolean;
}

/**
 * A question answered before anything else happens.
 *
 * Closed rather than answered is a no: the buttons answer first and close after, so by the time the close is seen the
 * question has already been settled.
 */
export const confirm = (app: App, options: ConfirmOptions): Promise<boolean> =>
  new Promise(resolve => {
    const box = new MessageBox(app, {
      title: options.title,
      message: options.message,
      buttons: 'OkCancel',
      buttonsLabel: { ok: options.accept },
      destructive: options.destructive,
      callback: { ok: () => resolve(true), cancel: () => resolve(false) },
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
  private buttonContainerEl?: HTMLElement;
  private acceptEl?: HTMLButtonElement;

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
      options: { message, render, title, buttons, callback, buttonsLabel: label, destructive },
    } = this;
    this.containerEl.addClass('mod-confirmation');
    if (title) {
      titleEl.setText(title);
    }
    if (render) {
      render(contentEl);
    } else {
      contentEl.createEl('p', { text: message });
    }
    // As Obsidian builds its own: the buttons hang off the modal rather than sit in its content, and read from the
    // left as the way out and the way on.
    this.buttonContainerEl = this.modalEl.createDiv('modal-button-container', el => {
      if (buttons === 'OkCancel') {
        el.createEl('button', {
          text: label?.cancel ?? t.BUTTON_CANCEL,
          cls: ['mod-cancel'],
        }).onclick = () => this.call(callback?.cancel);
      }
      this.acceptEl = el.createEl('button', {
        text: label?.ok ?? t.BUTTON_OK,
        cls: destructive ? ['mod-cta', 'mod-destructive'] : ['mod-cta'],
      });
      this.acceptEl.onclick = () => this.call(callback?.ok);
    });
  }
  open(): void {
    super.open();
    // After the opening, which lands the focus on the modal itself. Where there is a keyboard, Enter then answers.
    if (!isMobileUi()) {
      this.acceptEl?.focus({ preventScroll: true });
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
    this.buttonContainerEl?.detach();
  }
}
