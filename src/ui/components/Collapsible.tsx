import { createEffect, createMemo, on, JSX } from 'solid-js';

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

  /*
   * Whether the panel stands open, and nothing else.
   *
   * Through a memo rather than read straight off the prop: what the caller
   * hands in is worked out from something larger — a template's whole argument
   * line, say — and every rewrite of that reaches here, whether or not the
   * answer changed. The effect below would then run on a panel that was
   * already closed, and closing a closed panel means showing it first so its
   * height can be measured. Toggling any option in the template editor made
   * "Start numbering at" flash open and shut. A memo only tells its observers
   * when the value it holds is genuinely different.
   */
  const shown = createMemo(() => !!props.when);

  // Deferred: the first state is the one drawn by the ref below, which has
  // nothing to animate from.
  createEffect(on(shown, toggle, { defer: true }));

  return (
    <div
      class="ex-collapsible"
      ref={el => {
        panel = el;
        // Set on the element rather than bound to `class`: the class the panel
        // hides itself with is set the same way, and a re-assigned `class`
        // string would quietly take it back off.
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
