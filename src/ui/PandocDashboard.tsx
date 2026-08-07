import * as ct from 'electron';
import { Show, createMemo, createResource } from 'solid-js';
import type { SemVer } from 'semver';
import type { Lang } from '../lang';
import pandoc, { type PandocRelease } from '../pandoc';
import Button from './components/Button';
import Icon from './components/Icon';
import { ExtraButton } from './components/Setting';

/** Green / yellow / grey dot next to the version. */
type Status = 'ok' | 'outdated' | 'checking' | 'missing';

const openExternal = (url: string) => {
  void ct.remote.shell.openExternal(url);
};

/** A lookup that could not be made is the same as "no newer release known". */
const fetchLatestRelease = async (): Promise<PandocRelease | undefined> => {
  try {
    return await pandoc.getLatestRelease();
  } catch {
    return undefined;
  }
};

/**
 * Installed Pandoc at a glance: version, whether it is the newest release, and
 * the two links worth having close by.
 */
export default (props: {
  lang: Lang;
  version?: SemVer;
  path?: string;
  /** Whether the vault writes Markdown links rather than wikilinks. */
  markdownLinks?: boolean;
  onPathChange?: (path: string) => void;
  onChoosePath?: () => void;
}) => {
  const { lang } = props;

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

  const versionText = createMemo(() => (props.version ? lang.settingTab.pandocVersion(props.version) : lang.settingTab.pandocNotInstalled));

  const statusText = createMemo(() => {
    switch (status()) {
      case 'missing':
        return lang.settingTab.pandocNotFound;
      case 'checking':
        return lang.settingTab.pandocCheckingForUpdates;
      case 'outdated':
        return lang.settingTab.pandocUpdateAvailable(latest().version);
      default:
        return latest() ? lang.settingTab.pandocUpToDate : lang.settingTab.pandocUpdateCheckFailed;
    }
  });

  // Pandoc below the required version cannot resolve this vault's link style.
  const warning = createMemo(() =>
    props.version && props.markdownLinks && props.version.compare(pandoc.requiredVersion) === -1
      ? lang.settingTab.pandocUpgradeRequired(pandoc.requiredVersion)
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
          class="ex-pandoc-dashboard-button"
          cta={updateAvailable()}
          onClick={() => openExternal(latest()?.url ?? pandoc.latestReleaseUrl)}
        >
          <Icon name={updateAvailable() ? 'download' : 'scroll-text'} />
          {updateAvailable() ? lang.settingTab.pandocUpdate : lang.settingTab.pandocChangelog}
        </Button>
        <Button class="ex-pandoc-dashboard-button" onClick={() => openExternal(pandoc.manualUrl)}>
          <Icon name="book-open" />
          {lang.settingTab.pandocOpenManual}
        </Button>
        <Button class="ex-pandoc-dashboard-button" title={props.path || lang.settingTab.pandocPathPlaceholder} onClick={props.onChoosePath}>
          <Icon name="folder" />
          {lang.settingTab.pandocFolder}
        </Button>
        {/* The dialog cannot pick "nothing", so clearing needs its own control. */}
        <Show when={props.path}>
          <ExtraButton icon="rotate-ccw" tooltip={lang.settingTab.pandocPathReset} onClick={() => props.onPathChange?.('')} />
        </Show>
      </div>
    </div>
  );
};
