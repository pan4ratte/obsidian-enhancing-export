import { Notice, TFile } from 'obsidian';
import { createSignal, createRoot, onCleanup, createMemo, untrack, Show } from 'solid-js';
import { insert } from 'solid-js/web';
import type PandocGuiPlugin from '../main';
import { t } from '../lang/helpers';
import { extractDefaultExtension as extractExtension } from '../settings';
import { setPlatformValue, getPlatformValue } from '../utils';
import { exportNote } from '../export';
import { droppedBy, resolveEngine, unsupportedBy } from '../engine';
import { chooseFile, documentsFolder, isMobile, isMobileUi, vaultRoot } from '../platform';
import FolderInput from './components/FolderInput';
import Modal from './components/Modal';
import Button from './components/Button';
import Icon from './components/Icon';
import Setting, { Text, DropDown, ExtraButton, Toggle } from './components/Setting';

const Dialog = (props: { plugin: PandocGuiPlugin; currentFile: TFile; onClose?: () => void }) => {
  const {
    plugin: { app, settings: globalSetting },
    currentFile,
  } = props;

  const [hidden, setHidden] = createSignal(false);
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = createSignal(globalSetting.showOverwriteConfirmation);

  // Only the templates this engine can actually run: a PDF has no answer where there is no typesetter to make one.
  const engine = resolveEngine(globalSetting.engineMode, isMobile());
  const available = globalSetting.items.filter(o => !unsupportedBy(o, engine));
  /** Templates were written, and this engine runs none of them — which is not the same as having written none. */
  const allHidden = globalSetting.items.length > 0 && available.length === 0;

  // The template last exported with, where it is still a template this engine runs: it is remembered by name, and a
  // deleted or renamed one would leave this pointing at nothing.
  const [exportType, setExportType] = createSignal(
    available.find(o => o.name === globalSetting.lastExportType)?.name ?? available.first()?.name
  );
  const setting = createMemo(() => available.find(o => o.name === exportType()) ?? available.first());
  const extension = createMemo(() => (setting() ? extractExtension(setting()) : ''));

  // What this template asks for that the engine will not do. It is not a reason to stop — the file is written, just
  // without them — so it is said here, where the template can still be changed, and the button says what it is agreeing to.
  const dropped = createMemo(() => (setting() ? droppedBy(setting(), engine) : []));

  // Where the file goes, as a path on the device. A phone has nowhere outside the vault to write to, so there it is
  // always one of the vault's own folders — held as a vault path, and turned into a real one at export.
  const vaultDir = vaultRoot(currentFile.vault.adapter);
  const [candidateOutputDirectory, setCandidateOutputDirectory] = createSignal(
    getPlatformValue(globalSetting.lastExportDirectory) ?? vaultDir
  );
  const vaultFolder = createMemo(() => {
    const inside = candidateOutputDirectory()?.startsWith(`${vaultDir}/`);
    return inside ? candidateOutputDirectory().substring(vaultDir.length + 1) : '';
  });
  const setVaultFolder = (folder: string) => setCandidateOutputDirectory(folder ? `${vaultDir}/${folder}` : vaultDir);
  // The name only — the extension is the template's, and is put back on at export.
  const [candidateOutputFileName, setCandidateOutputFileName] = createSignal(currentFile.basename);

  /** The name as it will be written, extension and all. */
  const outputFileFullName = () => `${candidateOutputFileName().trim() || currentFile.basename}${extension()}`;

  const exportTypes = available.map(o => ({ name: o.name, value: o.name })).sort((a, b) => a.name.localeCompare(b.name));

  if (globalSetting.defaultExportDirectoryMode === 'Same') {
    setCandidateOutputDirectory(currentFile.vault.adapter.getFullPath(currentFile.parent.path));
  } else if (globalSetting.defaultExportDirectoryMode === 'Custom') {
    setCandidateOutputDirectory(getPlatformValue(globalSetting.customDefaultExportDirectory) ?? vaultDir);
  }

  const chooseFolder = async () => {
    const chosen = await chooseFile({ folder: true, defaultPath: candidateOutputDirectory() ?? (await documentsFolder()) });
    if (chosen) {
      setCandidateOutputDirectory(chosen);
    }
  };

  const doExport = async () => {
    const plugin = props.plugin;
    // What the dialog remembers of an export that worked, saved before it closes.
    const remember = async () => {
      globalSetting.showOverwriteConfirmation = untrack(showOverwriteConfirmation);
      globalSetting.lastExportDirectory = setPlatformValue(globalSetting.lastExportDirectory, untrack(candidateOutputDirectory));

      globalSetting.lastExportType = untrack(setting).name;
      await plugin.saveSettings();
      props.onClose?.();
    };
    // Every template can be deleted, and then there is nothing to export with.
    if (!untrack(setting)) {
      new Notice(allHidden ? t.EXPORT_DIALOG_NO_TEMPLATES : t.TEMPLATES_EMPTY, 5000);
      return;
    }
    setHidden(true);
    await exportNote(
      plugin,
      currentFile,
      untrack(candidateOutputDirectory),
      untrack(outputFileFullName),
      untrack(setting),
      untrack(showOverwriteConfirmation),
      // The dialog asks for no options of its own, so `${options.…}` reads as unset.
      {},
      () => void remember(),
      () => {
        setHidden(false);
      }
    );
  };

  return (
    <>
      <Modal app={app} title={t.EXPORT_DIALOG_TITLE} hidden={hidden()} classList={{ 'ex-export-modal': true }} onClose={props.onClose}>
        <Setting name={t.EXPORT_DIALOG_TEMPLATE}>
          <DropDown options={exportTypes} onChange={typ => setExportType(typ)} selected={exportType()} />
        </Setting>

        <Show when={allHidden}>
          <div class="ex-export-modal-warning">
            <Icon name="alert-triangle" />
            <span>{t.EXPORT_DIALOG_NO_TEMPLATES}</span>
          </div>
        </Show>

        <Show when={dropped().length > 0}>
          <div class="ex-export-modal-warning">
            <Icon name="alert-triangle" />
            <span>{t.EXPORT_DIALOG_DROPPED(dropped().join(' '))}</span>
          </div>
        </Show>

        <Setting name={t.EXPORT_DIALOG_FILE_NAME} description={t.EXPORT_DIALOG_FILE_NAME_DESC(extension())}>
          <Text tooltip={outputFileFullName()} value={candidateOutputFileName()} onChange={value => setCandidateOutputFileName(value)} />
        </Setting>

        <Setting name={t.EXPORT_DIALOG_LOCATION} class={isMobileUi() ? 'ex-export-modal-folder' : undefined}>
          {/* The system's folder dialog where there is one; the vault's own folders where there is not — and where a
              desktop is drawing a phone's UI, which the vault's own folders are the honest answer for. */}
          <Show
            when={isMobileUi()}
            fallback={
              <>
                <Text tooltip={candidateOutputDirectory()} value={candidateOutputDirectory()} disabled />
                <ExtraButton icon="folder" onClick={() => void chooseFolder()} />
              </>
            }
          >
            <FolderInput app={app} value={vaultFolder()} placeholder={t.IMPORT_DIALOG_FOLDER_PLACEHOLDER} onChange={setVaultFolder} />
          </Show>
        </Setting>

        <Setting name={t.EXPORT_DIALOG_OVERWRITE} class="mod-toggle">
          <Toggle checked={showOverwriteConfirmation()} onChange={setShowOverwriteConfirmation} />
        </Setting>

        <div class="modal-button-container">
          <Button cta={true} onClick={() => void doExport()}>
            {dropped().length > 0 ? t.EXPORT_DIALOG_SUBMIT_ANYWAY : t.EXPORT_DIALOG_SUBMIT}
          </Button>
        </div>
      </Modal>
    </>
  );
};

const show = (plugin: PandocGuiPlugin, currentFile: TFile) =>
  createRoot(dispose => {
    let disposed = false;
    const cleanup = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      dispose();
    };
    // `insert` returns anything solid can render; the guard below establishes it is a node.
    const el = insert(document.body, () => <Dialog onClose={cleanup} plugin={plugin} currentFile={currentFile} />) as Node;
    onCleanup(() => {
      if (el?.instanceOf(Node) && document.body.contains(el)) {
        document.body.removeChild(el);
      }
    });
    return cleanup;
  });

export default {
  show,
};
