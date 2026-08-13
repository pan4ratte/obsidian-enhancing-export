import { Show, createMemo, createResource } from 'solid-js';
import type { SemVer } from 'semver';
import { t } from '../lang/helpers';
import pandoc, { type PandocRelease } from '../pandoc';
import Button from './components/Button';
import Icon from './components/Icon';
import { openExternal } from '../platform';

/** Green / yellow / grey dot next to the version. */
type Status = 'ok' | 'outdated' | 'checking' | 'missing';

/** A lookup that could not be made is the same as "no newer release known". */
const fetchLatestRelease = async (): Promise<PandocRelease | undefined> => {
  try {
    return await pandoc.getLatestRelease();
  } catch {
    return undefined;
  }
};

/** Installed Pandoc at a glance: version, whether it is the newest release, and the links worth having close by. */
export default (props: {
  version?: SemVer;
  path?: string;
  /** Whether the vault writes Markdown links rather than wikilinks. */
  markdownLinks?: boolean;
  onPathChange?: (path: string) => void;
  onChoosePath?: () => void;
}) => {
  const [latest] = createResource(fetchLatestRelease);

  const updateAvailable = createMemo(() => {
    const installed = props.version;
    const release = latest();
    return !!installed && !!release && release.version.compare(installed) === 1;
  });

  const status = createMemo<Status>(() => {
    if (!props.version) {
      return 'missing';
    }
    if (latest.loading) {
      return 'checking';
    }
    return updateAvailable() ? 'outdated' : 'ok';
  });

  const versionText = createMemo(() => (props.version ? t.PANDOC_VERSION(props.version.version) : t.PANDOC_NOT_INSTALLED));

  const statusText = createMemo(() => {
    switch (status()) {
      case 'missing':
        return t.PANDOC_NOT_FOUND;
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

  return (
    <div class="ex-pandoc-dashboard">
      <div class="ex-pandoc-dashboard-info">
        <div class="ex-pandoc-dashboard-version">{versionText()}</div>

        <div class="ex-pandoc-dashboard-status" classList={{ [`is-${status()}`]: true }}>
          <span class="ex-pandoc-dashboard-indicator" />
          <span>{statusText()}</span>
        </div>

        <Show when={warning()}>
          <div class="ex-pandoc-dashboard-warning">{warning()}</div>
        </Show>
      </div>

      <div class="ex-pandoc-dashboard-actions">
        <Button
          class={`ex-pandoc-dashboard-button${updateAvailable() ? ' is-outdated' : ''}`}
          onClick={() => openExternal(latest()?.url ?? pandoc.latestReleaseUrl)}
        >
          <Icon name={updateAvailable() ? 'download' : 'scroll-text'} />
          {updateAvailable() ? t.PANDOC_UPDATE : t.PANDOC_CHANGELOG}
        </Button>
        <Button class="ex-pandoc-dashboard-button" onClick={() => openExternal(pandoc.manualUrl)}>
          <Icon name="book-open" />
          {t.PANDOC_OPEN_MANUAL}
        </Button>
        <Button class="ex-pandoc-dashboard-button" tooltip={props.path || t.PANDOC_PATH_PLACEHOLDER} onClick={props.onChoosePath}>
          <Icon name="folder" />
          {t.PANDOC_FOLDER}
        </Button>
        {/* The dialog cannot pick "nothing", so clearing needs its own control. */}
        <Show when={props.path}>
          <Button class="ex-pandoc-dashboard-button is-icon" tooltip={t.PANDOC_PATH_RESET} onClick={() => props.onPathChange?.('')}>
            <Icon name="rotate-ccw" />
          </Button>
        </Show>
      </div>
    </div>
  );
};
