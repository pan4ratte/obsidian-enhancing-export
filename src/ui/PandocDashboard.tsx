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

/** Installed Pandoc at a glance: which version is there, and whether it is the newest release. */
export default (props: {
  version?: SemVer;
  /** Whether the vault writes Markdown links rather than wikilinks. */
  markdownLinks?: boolean;
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
    <div class="ex-pandoc-dashboard-half">
      <div class="ex-pandoc-dashboard-version">{versionText()}</div>

      <div class="ex-pandoc-dashboard-status" classList={{ [`is-${status()}`]: true }}>
        <span class="ex-pandoc-dashboard-indicator" />
        <span>{statusText()}</span>

        {/* Beside the line that says there is one: it is only ever there when that line is, and it is what to do
            about what the line just said. */}
        <Show when={updateAvailable()}>
          <Button class="ex-pandoc-dashboard-inline" tooltip={t.PANDOC_UPDATE} onClick={() => openExternal(latest().url)}>
            <Icon name="download" />
          </Button>
        </Show>
      </div>

      <Show when={warning()}>
        <div class="ex-pandoc-dashboard-warning">{warning()}</div>
      </Show>
    </div>
  );
};
