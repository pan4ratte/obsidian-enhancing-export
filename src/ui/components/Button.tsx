import type { ParentProps } from 'solid-js';
import { tooltip } from './tooltip';

export default (props: ParentProps<{ cta?: boolean; class?: string; tooltip?: string; onClick?: () => void }>) => {
  return (
    <button ref={el => tooltip(el, () => props.tooltip)} class={props.class} classList={{ 'mod-cta': props.cta }} onClick={props.onClick}>
      {props.children}
    </button>
  );
};
