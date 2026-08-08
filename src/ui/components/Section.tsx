import { JSX } from 'solid-js';
import Collapsible from './Collapsible';
import Icon from './Icon';

/**
 * A named group of settings that folds away.
 *
 * The heading is Obsidian's own, made into a button: the whole row is the hit
 * area, and the chevron turns to say which way the section is about to go. What
 * it holds is a `Collapsible`, so a section grows and shrinks rather than making
 * the rows below it jump.
 *
 * Whether it is open is the caller's to keep. A section is not a setting — it is
 * where someone happens to be looking — so nothing here writes to `data.json`.
 */
export default (props: {
  name: string;
  description?: string;
  /** What this section is, for a rule that means to reach only this one. */
  class?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children?: JSX.Element;
}) => {
  const toggle = () => props.onToggle?.(!props.open);

  return (
    // `class` before `classList`: the two are applied in that order, so the
    // string cannot take `is-open` back off.
    <div class={`ex-section ex-card ${props.class ?? ''}`.trimEnd()} classList={{ 'is-open': props.open }}>
      <div
        class="setting-item setting-item-heading ex-section-header"
        role="button"
        tabIndex={0}
        aria-expanded={props.open ? 'true' : 'false'}
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
          <Icon name="chevron-down" class="ex-section-chevron" />
        </div>
      </div>
      <Collapsible when={props.open}>{props.children}</Collapsible>
    </div>
  );
};
