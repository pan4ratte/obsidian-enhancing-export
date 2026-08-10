import { setIcon } from 'obsidian';
import { createEffect } from 'solid-js';
import type { JSX } from 'solid-js/jsx-runtime';
import { tooltip } from './tooltip';

export default (props: { name: string; tooltip?: string; class?: string; onClick?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> }) => {
  let el: HTMLDivElement;
  // `setIcon` replaces the element's content, so it can simply run again whenever the name changes.
  createEffect(() => setIcon(el, props.name));
  return (
    <div
      ref={e => {
        el = e;
        tooltip(e, () => props.tooltip);
      }}
      class={props.class}
      classList={{ 'clickable-icon': !!props.onClick }}
      onClick={props.onClick}
    />
  );
};
