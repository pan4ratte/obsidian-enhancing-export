import type { App } from 'obsidian';
import { Show, createSignal, untrack } from 'solid-js';
import { t } from '../../lang/helpers';
import Icon from '../components/Icon';
import { ChangelogModal } from '../changelog';

/**
 * What is new in the version now running, at the head of the dashboard until it is dismissed — borrowed from Publish
 * to Telegram, where the same card stands at the top of the settings.
 */
export default (props: {
  app: App;
  /** The version this build is, which is also what dismissing it remembers. */
  version: string;
  /** The version already dismissed, so a release is only announced once. */
  dismissed?: string;
  onDismiss: () => void;
}) => {
  // Read once: dismissing writes this version back, and the row has an animation to see out before it goes.
  const [shown, setShown] = createSignal(untrack(() => props.dismissed !== props.version));
  let row!: HTMLDivElement;

  const dismiss = () => {
    props.onDismiss();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(false);
      return;
    }
    // The row closes the card up behind it rather than blinking out of a gap, as the collapsible panels do.
    const animation = row.animate(
      { height: [`${row.getBoundingClientRect().height}px`, '0px'], opacity: [1, 0] },
      { duration: 180, easing: 'ease-in-out' }
    );
    animation.onfinish = () => setShown(false);
  };

  return (
    <Show when={shown()}>
      <div class="ex-pandoc-panel-row ex-changelog-notice" ref={row}>
        <span class="ex-changelog-notice-text">
          {t.CHANGELOG_BANNER_PREFIX}
          <button class="ex-changelog-version" onClick={() => new ChangelogModal(props.app).open()}>
            {props.version}
          </button>
        </span>

        <Icon class="ex-changelog-dismiss" name="x" tooltip={t.CHANGELOG_BANNER_DISMISS} onClick={dismiss} />
      </div>
    </Show>
  );
};
