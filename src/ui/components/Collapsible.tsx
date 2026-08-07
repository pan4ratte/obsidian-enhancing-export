import { createEffect, on, JSX } from 'solid-js';

/**
 * Panel that grows in and out over 180ms of height and opacity, borrowed from
 * the Classy PDF Extractor.
 *
 * Hidden is `display: none` rather than zero height, so a closed panel leaves
 * no gap and nothing for a tab key to land in. Children stay mounted — a
 * `<Show>` would take them away before there was anything to animate out.
 *
 * The children must set no `display` of their own on the panel: `ex-collapsed`
 * is a plain class and would lose to it. The layout goes on a child instead.
 */
export default (props: { when?: boolean, children?: JSX.Element }) => {
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

  // Deferred: the first state is the one drawn by the ref below, which has
  // nothing to animate from.
  createEffect(on(() => !!props.when, toggle, { defer: true }));

  return <div
    class="ex-collapsible"
    ref={(el) => {
      panel = el;
      if (!props.when) {
        el.addClass('ex-collapsed');
      }
    }}
  >
    {props.children}
  </div>;
};
