import { Show, createEffect, createMemo, createResource, onCleanup } from 'solid-js';
import type { SemVer } from 'semver';
import { t } from '../lang/helpers';
import pandoc, { type PandocRelease } from '../pandoc';
import Button from './components/Button';
import Icon from './components/Icon';
import type { PanelNotice } from './PandocNotices';
import { openExternal } from '../platform';

/** Green / yellow / grey dot next to the version. */
type Status = 'ok' | 'outdated' | 'checking' | 'absent';

/** A lookup that could not be made is the same as "no newer release known". */
const fetchLatestRelease = async (): Promise<PandocRelease | undefined> => {
  try {
    return await pandoc.getLatestRelease();
  } catch {
    return undefined;
  }
};

/** Installed Pandoc at a glance: which version is there, and whether it is the newest release. */
export default (props: {
  version?: SemVer;
  /** Whether the vault writes Markdown links rather than wikilinks. */
  markdownLinks?: boolean;
  /** What this half has to say at length, which the card says under both of them. */
  onNotices: (notices: PanelNotice[]) => void;
}) => {
  const [latest] = createResource(fetchLatestRelease);

  const updateAvailable = createMemo(() => {
    const installed = props.version;
    const release = latest();
    return !!installed && !!release && release.version.compare(installed) === 1;
  });

  const status = createMemo<Status>(() => {
    // Not a fault, and not read as one: exporting with the wasm build alone is an answer someone can have chosen,
    // and the installed program is then simply not there to report on.
    if (!props.version) {
      return 'absent';
    }
    if (latest.loading) {
      return 'checking';
    }
    return updateAvailable() ? 'outdated' : 'ok';
  });

  const versionText = createMemo(() => (props.version ? t.PANDOC_VERSION(props.version.version) : t.PANDOC_NOT_INSTALLED));

  /** The short of it, beside the dot. What is longer than a line goes below the card's halves instead. */
  const statusText = createMemo(() => {
    switch (status()) {
      case 'absent':
        return undefined;
      case 'checking':
        return t.PANDOC_CHECKING;
      case 'outdated':
        return t.PANDOC_UPDATE_AVAILABLE(latest().version.version);
      default:
        return latest() ? t.PANDOC_UP_TO_DATE : t.PANDOC_UPDATE_CHECK_FAILED;
    }
  });

  // Pandoc below the required version cannot resolve this vault's link style.
  const warning = createMemo(() =>
    props.version && props.markdownLinks && props.version.compare(pandoc.requiredVersion) === -1
      ? t.PANDOC_UPGRADE_REQUIRED(pandoc.requiredVersion)
      : undefined
  );

  const notices = createMemo<PanelNotice[]>(() => {
    const said: PanelNotice[] = [];
    if (status() === 'absent') {
      said.push({ text: t.PANDOC_NOT_FOUND, tone: 'muted' });
    }
    if (warning()) {
      said.push({ text: warning(), tone: 'warning' });
    }
    return said;
  });

  createEffect(() => props.onNotices(notices()));
  // A half that is no longer shown has nothing left to say — the wasm build is the one running.
  onCleanup(() => props.onNotices([]));

  return (
    <div class="ex-pandoc-dashboard-half">
      <div class="ex-pandoc-dashboard-version">{versionText()}</div>

      {/* Nothing to say and nothing to press is no line at all: the version above has already said it. */}
      <Show when={statusText() || updateAvailable()}>
        <div class="ex-pandoc-dashboard-status" classList={{ [`is-${status()}`]: true }}>
          <span class="ex-pandoc-dashboard-indicator" />
          <Show when={statusText()}>
            <span>{statusText()}</span>
          </Show>

          {/* Beside the line that says there is one: it is only ever there when that line is, and it is what to do
              about what the line just said. */}
          <Show when={updateAvailable()}>
            <Button class="ex-pandoc-dashboard-inline" tooltip={t.PANDOC_UPDATE} onClick={() => openExternal(latest().url)}>
              <Icon name="download" />
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
};
