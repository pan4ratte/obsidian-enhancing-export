import { createEffect, createMemo, on, JSX } from 'solid-js';

/** Panel that grows in and out over 180ms of height and opacity, borrowed from the Classy PDF Extractor. */
export default (props: { when?: boolean; class?: string; children?: JSX.Element }) => {
  let panel!: HTMLDivElement;
  let animation: Animation | null = null;

  const toggle = (shown: boolean) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation?.cancel();
      animation = null;
      panel.toggleClass('ex-collapsed', !shown);
      return;
    }

    // Measured while it is still the height on screen, not the natural one.
    const interrupted = animation !== null;
    const onScreen = interrupted ? panel.getBoundingClientRect().height : 0;
    animation?.cancel();

    // Shown before measuring: `display: none` has no height.
    panel.removeClass('ex-collapsed');
    const full = panel.scrollHeight;

    animation = panel.animate(
      {
        height: [`${interrupted ? onScreen : shown ? 0 : full}px`, `${shown ? full : 0}px`],
        opacity: shown ? [0, 1] : [1, 0],
      },
      { duration: 180, easing: 'ease-in-out' }
    );
    animation.onfinish = () => {
      animation = null;
      if (!shown) panel.addClass('ex-collapsed');
    };
  };

  /* Whether the panel stands open, and nothing else. */
  const shown = createMemo(() => !!props.when);

  // Deferred: the first state is the one drawn by the ref below, which has nothing to animate from.
  createEffect(on(shown, toggle, { defer: true }));

  return (
    <div
      class="ex-collapsible"
      ref={el => {
        panel = el;
        // Set on the element rather than bound to `class`: the class the panel hides itself with is set the same way,
        // and a re-assigned `class` string would quietly take it back off.
        if (props.class) {
          el.addClass(props.class);
        }
        if (!props.when) {
          el.addClass('ex-collapsed');
        }
      }}
    >
      {props.children}
    </div>
  );
};
