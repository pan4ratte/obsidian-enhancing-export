import { Notice, type App } from 'obsidian';
import { Show, createMemo, createResource, createSignal } from 'solid-js';
import { t } from '../../lang/helpers';
import { isMobileUi } from '../../system/platform';
import type { TypstWasmManager } from '../../wasm/typst';
import { MessageBox } from '../message_box';
import Button from '../components/Button';
import Icon from '../components/Icon';

/**
 * Typst: whether it is here, and how to get it.
 *
 * The half beside pandoc's own build, and the same bargain — a download that only a vault exporting PDFs ever asks
 * for. There is no release to look up: the build is pinned to a version the plugin was tested against.
 */
export default (props: {
  app: App;
  manager: TypstWasmManager;
  /** The version on disk, as the settings recorded it. */
  version?: string;
  /** The version now on disk, or nothing where it has just been removed. */
  onInstalled: (version?: string) => void;
}) => {
  const [busy, setBusy] = createSignal<string>();
  const [onDisk, { refetch: lookAgain }] = createResource(() => props.manager.isInstalled());
  const installed = () => !!props.version && onDisk() !== false;

  /**
   * How many fonts a document would be set in — the bundled ones, and whatever the vault's folder adds. Counted from
   * whether there is anything installed to count, so the answer arrives with it: the look on disk is itself a lookup,
   * and the first render is made before it has come back.
   */
  const [fonts, { refetch: countFonts }] = createResource(
    () => installed() || undefined,
    () => props.manager.fontCount()
  );

  const hint = `${t.TYPST_HINT} ${t.TYPST_SIZE}`;

  const statusText = createMemo(() => {
    if (busy()) {
      return busy();
    }
    if (!installed()) {
      return t.WASM_ABSENT;
    }
    return t.TYPST_FONTS_FOUND(fonts() ?? 0);
  });

  const install = async () => {
    const said = { downloading: t.TYPST_DOWNLOADING, fonts: t.TYPST_FONTS, writing: t.TYPST_WRITING };
    setBusy(said.downloading);
    try {
      const version = await props.manager.install((stage, done, total) =>
        setBusy(stage === 'fonts' ? said.fonts(done ?? 0, total ?? 0) : said[stage])
      );
      void lookAgain();
      void countFonts();
      props.onInstalled(version);
      new Notice(t.TYPST_INSTALLED(version));
    } catch (e) {
      console.error(e);
      new Notice(t.TYPST_INSTALL_FAILED);
    } finally {
      setBusy(undefined);
    }
  };

  const remove = () => {
    new MessageBox(props.app, {
      title: t.TYPST_REMOVE,
      message: t.TYPST_REMOVE_CONFIRM,
      buttons: 'YesNo',
      callback: {
        yes: () =>
          void props.manager.remove().then(() => {
            void lookAgain();
            props.onInstalled(undefined);
          }),
      },
    }).open();
  };

  return (
    <div class="ex-pandoc-dashboard-half">
      <div class="ex-pandoc-dashboard-version">
        {installed() ? t.TYPST_VERSION(props.version) : t.TYPST_TITLE}

        <Show when={!installed()}>
          <Icon
            class="ex-pandoc-dashboard-hint"
            name="circle-question-mark"
            tooltip={hint}
            onClick={isMobileUi() ? () => new Notice(hint) : undefined}
          />
        </Show>
      </div>

      <div class="ex-pandoc-dashboard-status" classList={{ [`is-${installed() ? 'ok' : 'absent'}`]: true }}>
        <span class="ex-pandoc-dashboard-indicator" />
        <span>{statusText()}</span>

        <Show when={!installed()}>
          <Button
            class="ex-pandoc-dashboard-inline is-cta"
            tooltip={`${t.TYPST_INSTALL}. ${t.TYPST_SIZE}`}
            disabled={!!busy()}
            onClick={() => void install()}
          >
            <Icon name="download" />
          </Button>
        </Show>
        <Show when={installed()}>
          <Button class="ex-pandoc-dashboard-inline is-quiet" tooltip={t.TYPST_REMOVE} disabled={!!busy()} onClick={remove}>
            <Icon name="trash-2" />
          </Button>
        </Show>
      </div>
    </div>
  );
};
