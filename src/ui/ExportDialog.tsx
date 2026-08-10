import * as ct from 'electron';
import { Notice, TFile } from 'obsidian';
import { createSignal, createRoot, onCleanup, createMemo, untrack } from 'solid-js';
import { insert } from 'solid-js/web';
import type PandocGuiPlugin from '../main';
import { t } from '../lang/helpers';
import { extractDefaultExtension as extractExtension } from '../settings';
import { setPlatformValue, getPlatformValue } from '../utils';
import { exportNote } from '../export';
import Modal from './components/Modal';
import Button from './components/Button';
import Setting, { Text, DropDown, ExtraButton, Toggle } from './components/Setting';

const Dialog = (props: { plugin: PandocGuiPlugin; currentFile: TFile; onClose?: () => void }) => {
  const {
    plugin: { app, settings: globalSetting },
    currentFile,
  } = props;

  const [hidden, setHidden] = createSignal(false);
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = createSignal(globalSetting.showOverwriteConfirmation);
  // The template last exported with, where it is still a template: it is remembered by name, and a deleted or renamed
  // one would leave this pointing at nothing.
  const [exportType, setExportType] = createSignal(
    globalSetting.items.find(o => o.name === globalSetting.lastExportType)?.name ?? globalSetting.items.first()?.name
  );
  const setting = createMemo(() => globalSetting.items.find(o => o.name === exportType()) ?? globalSetting.items.first());
  const extension = createMemo(() => (setting() ? extractExtension(setting()) : ''));

  const [candidateOutputDirectory, setCandidateOutputDirectory] = createSignal(
    `${getPlatformValue(globalSetting.lastExportDirectory) ?? ct.remote.app.getPath('documents')}`
  );
  // The name only — the extension is the template's, and is put back on at export.
  const [candidateOutputFileName, setCandidateOutputFileName] = createSignal(currentFile.basename);

  /** The name as it will be written, extension and all. */
  const outputFileFullName = () => `${candidateOutputFileName().trim() || currentFile.basename}${extension()}`;

  const exportTypes = globalSetting.items.map(o => ({ name: o.name, value: o.name })).sort((a, b) => a.name.localeCompare(b.name));

  if (globalSetting.defaultExportDirectoryMode === 'Same') {
    const path = currentFile.vault.adapter.getBasePath() + '/' + currentFile.parent.path;
    setCandidateOutputDirectory(path);
  } else if (globalSetting.defaultExportDirectoryMode === 'Custom') {
    setCandidateOutputDirectory(getPlatformValue(globalSetting.customDefaultExportDirectory));
  }

  const chooseFolder = async () => {
    const retval = await ct.remote.dialog.showOpenDialog(ct.remote.getCurrentWindow(), {
      title: t.EXPORT_DIALOG_SELECT_FOLDER,
      defaultPath: candidateOutputDirectory(),
      properties: ['createDirectory', 'openDirectory'],
    });
    if (!retval.canceled && retval.filePaths?.length > 0) {
      setCandidateOutputDirectory(retval.filePaths[0]);
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
      new Notice(t.TEMPLATES_EMPTY, 2000);
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

        <Setting name={t.EXPORT_DIALOG_FILE_NAME} description={t.EXPORT_DIALOG_FILE_NAME_DESC(extension())}>
          <Text tooltip={outputFileFullName()} value={candidateOutputFileName()} onChange={value => setCandidateOutputFileName(value)} />
        </Setting>

        <Setting name={t.EXPORT_DIALOG_LOCATION}>
          <Text tooltip={candidateOutputDirectory()} value={candidateOutputDirectory()} disabled />
          <ExtraButton icon="folder" onClick={() => void chooseFolder()} />
        </Setting>

        <Setting name={t.EXPORT_DIALOG_OVERWRITE} class="mod-toggle">
          <Toggle checked={showOverwriteConfirmation()} onChange={setShowOverwriteConfirmation} />
        </Setting>

        <div class="modal-button-container">
          <Button cta={true} onClick={() => void doExport()}>
            {t.EXPORT_DIALOG_SUBMIT}
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
