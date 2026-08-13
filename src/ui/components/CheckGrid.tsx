import { For, Show } from 'solid-js';
import { tooltip } from './tooltip';

/** A bordered card holding a grid of checkboxes. */
export default (props: {
  items: { value: string; label: string; checked: boolean; tooltip?: string }[];
  onToggle: (value: string, checked: boolean) => void;
  /** One to a line, for names too long to share a line with anything. */
  single?: boolean;
  /** Said in the card's place when there is nothing to tick. */
  empty?: string;
}) => (
  <div class="ex-check-grid" classList={{ 'is-single-column': props.single }}>
    <Show when={props.items.length > 0} fallback={<span class="ex-check-empty">{props.empty}</span>}>
      <For each={props.items}>
        {item => (
          <label ref={el => tooltip(el, () => item.tooltip)} class="ex-check" classList={{ 'is-checked': item.checked }}>
            <input type="checkbox" checked={item.checked} onChange={e => props.onToggle(item.value, e.currentTarget.checked)} />
            <span class="ex-check-label">{item.label}</span>
          </label>
        )}
      </For>
    </Show>
  </div>
);
