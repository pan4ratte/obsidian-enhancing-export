import * as ct from 'electron';
import { Notice, TFile } from 'obsidian';
import { createSignal, createRoot, onCleanup, createMemo, untrack, createEffect, Show } from 'solid-js';
import { insert } from 'solid-js/web';
import type UniversalExportPlugin from '../main';
import { extractDefaultExtension as extractExtension, finalizeOptionsMeta } from '../settings';
import { setPlatformValue, getPlatformValue } from '../utils';
import { exportToOo } from '../exporto0o';
import Modal from './components/Modal';
import Button from './components/Button';
import PropertyGrid, { createDefaultObject } from './components/PropertyGrid';
import Setting, { Text, DropDown, ExtraButton, Toggle } from './components/Setting';

const Dialog = (props: { plugin: UniversalExportPlugin; currentFile: TFile; onClose?: () => void }) => {
  const {
    plugin: { app, settings: globalSetting, lang },
    currentFile,
  } = props;

  const [hidden, setHidden] = createSignal(false);
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = createSignal(globalSetting.showOverwriteConfirmation);
  /*
   * The template last exported with, where it is still a template. It is
   * remembered by name, and a name outlives the thing it names — a deleted or
   * renamed template left this pointing at nothing, and the dialog opened on
   * nothing rather than opening at all.
   */
  const [exportType, setExportType] = createSignal(
    globalSetting.items.find(o => o.name === globalSetting.lastExportType)?.name ?? globalSetting.items.first()?.name
  );
  const [options, setOptions] = createSignal({});
  const setting = createMemo(() => globalSetting.items.find(o => o.name === exportType()) ?? globalSetting.items.first());
  const extension = createMemo(() => (setting() ? extractExtension(setting()) : ''));
  const title = createMemo(() => lang.exportDialog.title(setting()?.name));
  const optionsMeta = createMemo(() => finalizeOptionsMeta(setting()?.optionsMeta));

  const [candidateOutputDirectory, setCandidateOutputDirectory] = createSignal(
    `${getPlatformValue(globalSetting.lastExportDirectory) ?? ct.remote.app.getPath('documents')}`
  );
  /*
   * The name only. What it is written as is the template's business — the
   * format picker above is where that is chosen, and an extension typed into a
   * name that the picker then changed was a contradiction the dialog had to
   * keep quietly rewriting. It is put back on at export, where the exporter
   * expects a full file name.
   */
  const [candidateOutputFileName, setCandidateOutputFileName] = createSignal(currentFile.basename);

  /** The name as it will be written, extension and all. */
  const outputFileFullName = () => `${candidateOutputFileName().trim() || currentFile.basename}${extension()}`;

  createEffect(() => {
    const meta = optionsMeta();
    setOptions(meta ? createDefaultObject(meta) : {});
  });

  const exportTypes = globalSetting.items.map(o => ({ name: o.name, value: o.name })).sort((a, b) => a.name.localeCompare(b.name));

  if (globalSetting.defaultExportDirectoryMode === 'Same') {
    const path = currentFile.vault.adapter.getBasePath() + '/' + currentFile.parent.path;
    setCandidateOutputDirectory(path);
  } else if (globalSetting.defaultExportDirectoryMode === 'Custom') {
    setCandidateOutputDirectory(getPlatformValue(globalSetting.customDefaultExportDirectory));
  }

  const chooseFolder = async () => {
    const retval = await ct.remote.dialog.showOpenDialog({
      title: lang.exportDialog.selectExportFolder,
      defaultPath: candidateOutputDirectory(),
      properties: ['createDirectory', 'openDirectory'],
    });
    if (!retval.canceled && retval.filePaths?.length > 0) {
      setCandidateOutputDirectory(retval.filePaths[0]);
    }
  };

  const doExport = async () => {
    const plugin = props.plugin;
    // Every template can be deleted, and then there is nothing to export with.
    if (!untrack(setting)) {
      new Notice(lang.settingTab.noTemplates, 2000);
      return;
    }
    setHidden(true);
    await exportToOo(
      plugin,
      currentFile,
      untrack(candidateOutputDirectory),
      untrack(outputFileFullName),
      untrack(setting),
      untrack(showOverwriteConfirmation),
      options(),
      async () => {
        globalSetting.showOverwriteConfirmation = untrack(showOverwriteConfirmation);
        globalSetting.lastExportDirectory = setPlatformValue(globalSetting.lastExportDirectory, untrack(candidateOutputDirectory));

        globalSetting.lastExportType = untrack(setting).name;
        await plugin.saveSettings();
        props.onClose?.();
      },
      () => {
        setHidden(false);
      }
    );
  };

  return (
    <>
      <Modal app={app} title={title()} hidden={hidden()} classList={{ 'ex-export-modal': true }} onClose={props.onClose}>
        <Setting name={lang.exportDialog.type}>
          <DropDown options={exportTypes} onChange={typ => setExportType(typ)} selected={exportType()} />
        </Setting>

        <Setting name={lang.exportDialog.fileName} description={lang.exportDialog.fileNameDesc(extension())}>
          <Text title={outputFileFullName()} value={candidateOutputFileName()} onChange={value => setCandidateOutputFileName(value)} />
        </Setting>

        <Show when={optionsMeta()}>
          <PropertyGrid meta={optionsMeta()} value={options()} onChange={o => setOptions(o)} />
        </Show>

        <Setting name={lang.exportDialog.exportTo}>
          <Text title={candidateOutputDirectory()} value={candidateOutputDirectory()} disabled />
          <ExtraButton icon="folder" onClick={chooseFolder} />
        </Setting>

        <Setting name={lang.exportDialog.overwriteConfirmation} class="mod-toggle">
          <Toggle checked={showOverwriteConfirmation()} onChange={setShowOverwriteConfirmation} />
        </Setting>

        <div class="modal-button-container">
          <Button cta={true} onClick={doExport}>
            {lang.exportDialog.export}
          </Button>
        </div>
      </Modal>
    </>
  );
};

const show = (plugin: UniversalExportPlugin, currentFile: TFile) =>
  createRoot(dispose => {
    let disposed = false;
    const cleanup = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      dispose();
    };
    // `insert` is typed as returning anything solid can render; the guard below is
    // what actually establishes this is a node, so the cast only gets tsc that far.
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
