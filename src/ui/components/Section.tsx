import { JSX, Show, createSignal } from 'solid-js';
import Collapsible from './Collapsible';
import Icon from './Icon';

/** A named group of settings that folds away. */
export default (props: {
  name: string;
  description?: string;
  /** What this section is, for a rule that means to reach only this one. */
  class?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /**
   * Controls in the header, beside the chevron — for something the section is about that is worth doing without
   * opening it.
   */
  actions?: JSX.Element;
  children?: JSX.Element;
}) => {
  // Its own, for a section given no state to keep: without this one it would answer a click by asking to be
  // opened and nobody would open it.
  const [ownOpen, setOwnOpen] = createSignal(false);
  const open = () => props.open ?? ownOpen();

  const toggle = () => {
    const next = !open();
    setOwnOpen(next);
    props.onToggle?.(next);
  };

  return (
    // `class` before `classList`: the two are applied in that order, so the string cannot take `is-open` back off.
    <div class={`ex-section ex-card ${props.class ?? ''}`.trimEnd()} classList={{ 'is-open': open() }}>
      <div
        class="setting-item setting-item-heading ex-section-header"
        role="button"
        tabIndex={0}
        aria-expanded={open() ? 'true' : 'false'}
        onClick={toggle}
        onKeyDown={e => {
          // The two keys a button answers to, since this one only looks like one.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <div class="setting-item-info">
          <div class="setting-item-name">{props.name}</div>
          <div class="setting-item-description">{props.description}</div>
        </div>
        <div class="setting-item-control">
          <Show when={props.actions}>
            {/* Its own click, not the header's: a button here is for the section,
                not for opening it. `keydown` too, or Enter and Space on a focused
                action would fold the section under it. */}
            <div class="ex-section-actions" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              {props.actions}
            </div>
          </Show>
          <Icon name="chevron-down" class="ex-section-chevron" />
        </div>
      </div>
      <Collapsible when={open()}>{props.children}</Collapsible>
    </div>
  );
};
