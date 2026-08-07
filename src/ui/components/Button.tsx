import type { ParentProps } from 'solid-js';

export default (props: ParentProps<{ cta?: boolean, class?: string, title?: string, onClick?: () => void}> ) => {
  return <button class={props.class} title={props.title} classList={{'mod-cta': props.cta}} onClick={props.onClick}>{props.children}</button>;
};
