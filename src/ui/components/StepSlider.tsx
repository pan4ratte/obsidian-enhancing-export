import { For } from 'solid-js';

/**
 * One answer picked along a track of named steps.
 *
 * For a setting whose answers are ordered and few, and where each one takes in
 * the ones before it — the depth a table of contents reaches, where asking for
 * level three asks for one and two as well. A row of checkboxes can say the
 * same thing, but only by leaving combinations on screen that the setting has
 * no way to hold; a slider says "this far" and nothing else.
 *
 * The labels are drawn under the track at the positions they stand for. A
 * range input insets its thumb by half its own width at either end, so the
 * ticks are placed across what is left rather than across the whole width —
 * otherwise the labels drift from the thumb as it nears an edge.
 */
export default (props: {
  /** One label per step, in order. The first is the value at `min`. */
  labels: string[];
  /** What the first label stands for; each label after it is one more. */
  min?: number;
  value: number;
  onChange: (value: number) => void;
}) => {
  const min = () => props.min ?? 0;
  const max = () => min() + Math.max(props.labels.length - 1, 0);
  // Clamped rather than trusted: the value is read back out of arguments a
  // template may have been given by hand, which can name a step off the track.
  const value = () => Math.min(Math.max(props.value, min()), max());

  /** Where a step's label sits: along the track the thumb can actually reach. */
  const at = (index: number) => {
    const fraction = max() > min() ? index / (max() - min()) : 0;
    return `calc(var(--ex-step-slider-thumb) / 2 + ${fraction} * (100% - var(--ex-step-slider-thumb)))`;
  };

  return (
    <div class="ex-step-slider">
      <input
        class="slider"
        type="range"
        min={min()}
        max={max()}
        step={1}
        value={value()}
        onInput={e => props.onChange(Number(e.currentTarget.value))}
      />
      <div class="ex-step-slider-ticks">
        <For each={props.labels}>
          {(label, index) => (
            <span class="ex-step-slider-tick" classList={{ 'is-current': min() + index() === value() }} style={{ left: at(index()) }}>
              {label}
            </span>
          )}
        </For>
      </div>
    </div>
  );
};
