import { For } from 'solid-js';

/** How loudly a notice reads: what is merely so, what wants doing, what is wrong. */
export type NoticeTone = 'muted' | 'warning' | 'error';

export interface PanelNotice {
  text: string;
  tone: NoticeTone;
}

/**
 * The lines too long to stand in a half of the card beside a version and a button — what pandoc is not found, what a
 * device will not run, what syncing the wasm build costs. Each takes the whole width between the two pandocs above
 * and the pages to read below, and a row of the card is drawn with a line above it.
 */
export default (props: { notices: PanelNotice[] }) => (
  <For each={props.notices}>{notice => <div class={`ex-pandoc-panel-row ex-pandoc-notice is-${notice.tone}`}>{notice.text}</div>}</For>
);
