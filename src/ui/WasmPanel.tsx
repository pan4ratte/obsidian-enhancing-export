import { Notice, type App } from 'obsidian';
import { Show, createMemo, createResource, createSignal } from 'solid-js';
import { t } from '../lang/helpers';
import type { EngineMode } from '../engine';
import type { PandocWasmManager, WasmRelease } from '../wasm/install';
import { supportsPandocWasm } from '../wasm/support';
import { MessageBox } from './message_box';
import Button from './components/Button';
import Icon from './components/Icon';
import Setting, { DropDown } from './components/Setting';

const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * The wasm build: whether it is here, how to get it, and which pandoc an export goes to.
 *
 * It is a 56 MB download, so nothing happens until it is asked for — and once it is, the one button does the whole
 * thing: fetch the release, unpack it, put it in place.
 */
export default (props: {
  app: App;
  manager: PandocWasmManager;
  /** The version on disk, as the settings recorded it. */
  version?: string;
  mode?: EngineMode;
  onModeChange: (mode: EngineMode) => void;
  onInstalled: () => void;
}) => {
  const [supported] = createResource(supportsPandocWasm);
  const [latest] = createResource(async () => {
    try {
      return await props.manager.latest();
    } catch {
      return undefined;
    }
  });
  /** What the panel is doing, while it is doing it — the buttons stand down until it is finished. */
  const [busy, setBusy] = createSignal<string>();

  const installed = () => !!props.version;

  const updatable = createMemo(() => {
    const release = latest();
    return installed() && !!release && release.version !== props.version;
  });

  const status = createMemo(() => {
    if (supported() === false) {
      return 'missing';
    }
    return installed() ? (updatable() ? 'outdated' : 'ok') : 'missing';
  });

  const statusText = createMemo(() => {
    if (supported() === false) {
      return t.WASM_UNAVAILABLE;
    }
    if (busy()) {
      return busy();
    }
    if (!installed()) {
      return latest() ? t.WASM_SIZE(megabytes(latest().size)) : t.WASM_DESC;
    }
    return updatable() ? t.PANDOC_UPDATE_AVAILABLE(latest().version) : t.WASM_SYNC_WARNING;
  });

  const install = async (release: WasmRelease) => {
    const said = { downloading: t.WASM_DOWNLOADING(megabytes(release.size)), extracting: t.WASM_EXTRACTING, writing: t.WASM_WRITING };
    setBusy(said.downloading);
    try {
      await props.manager.install(release, stage => setBusy(said[stage]));
      new Notice(t.WASM_INSTALLED(release.version));
      props.onInstalled();
    } catch (e) {
      console.error(e);
      new Notice(t.WASM_INSTALL_FAILED);
    } finally {
      setBusy(undefined);
    }
  };

  const remove = () => {
    new MessageBox(props.app, {
      title: t.WASM_REMOVE,
      message: t.WASM_REMOVE_CONFIRM,
      buttons: 'YesNo',
      callback: {
        yes: () => {
          void props.manager.remove().then(props.onInstalled);
        },
      },
    }).open();
  };

  const modes = [
    { name: t.WASM_ENGINE_AUTO, value: 'auto' },
    { name: t.WASM_ENGINE_NATIVE, value: 'native' },
    { name: t.WASM_ENGINE_WASM, value: 'wasm' },
  ];

  return (
    <>
      <Setting name={t.WASM_TITLE} heading={true} />

      <div class="ex-pandoc-dashboard ex-wasm-panel">
        <div class="ex-pandoc-dashboard-info">
          <div class="ex-pandoc-dashboard-version">{installed() ? t.WASM_VERSION(props.version) : t.WASM_ABSENT}</div>

          <div class="ex-pandoc-dashboard-status" classList={{ [`is-${status()}`]: true }}>
            <span class="ex-pandoc-dashboard-indicator" />
            <span>{statusText()}</span>
          </div>
        </div>

        {/* Nothing to offer on a device that cannot run it — the notice above says why. */}
        <Show when={supported() !== false}>
          <div class="ex-pandoc-dashboard-actions">
            <Show when={latest()}>
              <Button
                class={`ex-pandoc-dashboard-button${updatable() ? ' is-outdated' : ''}`}
                disabled={!!busy()}
                onClick={() => void install(latest())}
              >
                <Icon name="download" />
                {installed() ? t.WASM_UPDATE : t.WASM_INSTALL}
              </Button>
            </Show>
            <Show when={installed()}>
              <Button class="ex-pandoc-dashboard-button" disabled={!!busy()} onClick={remove}>
                <Icon name="trash-2" />
                {t.WASM_REMOVE}
              </Button>
            </Show>
          </div>
        </Show>
      </div>

      {/* Asked whether or not it is installed: it is the answer that says what to install for. */}
      <div class="ex-settings-card">
        <Setting name={t.WASM_ENGINE} description={t.WASM_DESC}>
          <DropDown options={modes} selected={props.mode ?? 'auto'} autofocus={false} onChange={(v: EngineMode) => props.onModeChange(v)} />
        </Setting>
      </div>
    </>
  );
};
