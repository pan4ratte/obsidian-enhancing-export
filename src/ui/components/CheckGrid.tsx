import { For, Show } from 'solid-js';

/**
 * A bordered card holding a grid of checkboxes.
 *
 * Everything on offer is on screen at once, ticked or not — which a dropdown
 * cannot do: it hides what has not been chosen behind a click, and hides what
 * *has* been chosen behind its own prompt. The grid reflows to however many
 * columns the row is wide enough for.
 */
export default (props: {
  items: { value: string; label: string; checked: boolean; title?: string }[];
  onToggle: (value: string, checked: boolean) => void;
  /** Said in the card's place when there is nothing to tick. */
  empty?: string;
}) => (
  <div class="ex-check-grid">
    <Show when={props.items.length > 0} fallback={<span class="ex-check-empty">{props.empty}</span>}>
      <For each={props.items}>
        {item => (
          <label class="ex-check" classList={{ 'is-checked': item.checked }} title={item.title}>
            <input type="checkbox" checked={item.checked} onChange={e => props.onToggle(item.value, e.currentTarget.checked)} />
            <span class="ex-check-label">{item.label}</span>
          </label>
        )}
      </For>
    </Show>
  </div>
);
