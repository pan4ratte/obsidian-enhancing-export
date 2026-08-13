import { App, Component, MarkdownRenderer, Modal } from 'obsidian';
import { t, userGuide } from '../lang/helpers';

/** The guide that ships with the plugin, rendered as the note it is written as. */
export class UserGuideModal extends Modal {
  // Scoped to the modal rather than the plugin: `Modal` is no `Component`, and what the renderer
  // builds has to be unloaded when the modal closes, not when the plugin does.
  private readonly renderComponent = new Component();

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    titleEl.setText(t.USER_GUIDE);
    contentEl.addClass('ex-user-guide-modal');
    this.renderComponent.load();
    void MarkdownRenderer.render(this.app, userGuide(), contentEl, '', this.renderComponent);
  }

  onClose(): void {
    this.renderComponent.unload();
    this.contentEl.empty();
  }
}
