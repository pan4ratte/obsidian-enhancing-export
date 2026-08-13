import { Notice, type App } from 'obsidian';
import { Show, createMemo, createResource, createSignal } from 'solid-js';
import { t } from '../lang/helpers';
import { isNewerRelease, type PandocWasmManager, type WasmRelease } from '../wasm/install';
import { pandocWasmSupport } from '../wasm/support';
import { MessageBox } from './message_box';
import Button from './components/Button';
import Icon from './components/Icon';

const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * The wasm build: whether it is here, and how to get it.
 *
 * It is a 56 MB download, so nothing happens until it is asked for — and once it is, the one button does the whole
 * thing: fetch the release, unpack it, put it in place.
 */
export default (props: {
  app: App;
  manager: PandocWasmManager;
  /** The version on disk, as the settings recorded it. */
  version?: string;
  /** The version now on disk, or nothing where it has just been removed. */
  onInstalled: (version?: string) => void;
}) => {
  const [supported] = createResource(pandocWasmSupport);
  const [latest] = createResource(async () => {
    try {
      return await props.manager.latest();
    } catch {
      return undefined;
    }
  });
  /** What the panel is doing, while it is doing it — the buttons stand down until it is finished. */
  const [busy, setBusy] = createSignal<string>();
  /** Why the installed binary would not start, in the engine's own words. */
  const [failed, setFailed] = createSignal<string>();

  /**
   * Whether the binary is on disk. The recorded version says which one it is, but a file deleted from outside
   * Obsidian would otherwise leave the panel offering to remove something that is not there — and, worse, nothing to
   * install.
   */
  const [onDisk, { refetch: lookAgain }] = createResource(() => props.manager.isInstalled());
  const installed = () => !!props.version && onDisk() !== false;

  const updatable = createMemo(() => {
    const release = latest();
    return installed() && !!release && isNewerRelease(release, props.version);
  });

  const status = createMemo(() => {
    if (supported()?.ok === false || failed()) {
      return 'missing';
    }
    if (!installed()) {
      return 'absent';
    }
    return updatable() ? 'outdated' : 'ok';
  });

  const statusText = createMemo(() => {
    if (busy()) {
      return busy();
    }
    // What the binary said when it would not start beats what the probe guessed before it was ever downloaded.
    if (failed()) {
      return t.WASM_LOAD_FAILED(failed());
    }
    if (supported()?.ok === false) {
      return t.WASM_UNAVAILABLE;
    }
    if (!installed()) {
      return t.WASM_ABSENT;
    }
    return updatable() ? t.PANDOC_UPDATE_AVAILABLE(latest().version) : t.WASM_SYNC_WARNING;
  });

  const install = async (release: WasmRelease) => {
    const said = { downloading: t.WASM_DOWNLOADING(megabytes(release.size)), extracting: t.WASM_EXTRACTING, writing: t.WASM_WRITING };
    setBusy(said.downloading);
    try {
      const version = await props.manager.install(release, stage => setBusy(said[stage]));
      void lookAgain();
      props.onInstalled(version);

      // The probe only guessed; this is the binary actually starting, which is the answer that counts.
      setBusy(t.WASM_PREPARING);
      await props.manager.load();
      setFailed(undefined);
      new Notice(t.WASM_INSTALLED(release.version));
    } catch (e) {
      console.error(e);
      // Downloaded but unable to start is a different thing from a download that failed, and says so.
      const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      if (await props.manager.isInstalled()) {
        setFailed(reason);
        new Notice(t.WASM_LOAD_FAILED(reason));
      } else {
        new Notice(t.WASM_INSTALL_FAILED);
      }
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
          setFailed(undefined);
          void props.manager.remove().then(() => {
            void lookAgain();
            props.onInstalled(undefined);
          });
        },
      },
    }).open();
  };

  return (
    <div class="ex-pandoc-dashboard-half">
      <div class="ex-pandoc-dashboard-version">{installed() ? t.WASM_VERSION(props.version) : t.WASM_TITLE}</div>

      <div class="ex-pandoc-dashboard-status" classList={{ [`is-${status()}`]: true }}>
        <span class="ex-pandoc-dashboard-indicator" />
        <span>{statusText()}</span>

        {/* What to do about what the line says, beside it. Nothing here yet is the one worth a word of its own;
            a newer build and the copy already installed are what the line has just named.

            Offered whatever the probe thought: it is a guess, and being wrong about it must not be what stops
            someone installing. The binary itself answers on this same line, once it has been asked. */}
        <Show when={latest() && (!installed() || failed())}>
          <Button
            class="ex-pandoc-dashboard-inline is-cta"
            tooltip={`${installed() ? t.WASM_UPDATE : t.WASM_INSTALL}. ${t.WASM_SIZE(megabytes(latest().size))}`}
            disabled={!!busy()}
            onClick={() => void install(latest())}
          >
            <Icon name="download" />
          </Button>
        </Show>
        <Show when={updatable() && !failed()}>
          <Button class="ex-pandoc-dashboard-inline" tooltip={t.WASM_UPDATE} disabled={!!busy()} onClick={() => void install(latest())}>
            <Icon name="download" />
          </Button>
        </Show>
        <Show when={installed()}>
          <Button class="ex-pandoc-dashboard-inline is-quiet" tooltip={t.WASM_REMOVE} disabled={!!busy()} onClick={remove}>
            <Icon name="trash-2" />
          </Button>
        </Show>
      </div>
    </div>
  );
};
