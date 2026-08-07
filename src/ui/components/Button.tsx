import type { ParentProps } from 'solid-js';

export default (props: ParentProps<{ cta?: boolean, onClick?: () => void}> ) => {
  return <button classList={{'mod-cta': props.cta}} onClick={props.onClick}>{props.children}</button>;
};