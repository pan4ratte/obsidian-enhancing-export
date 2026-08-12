import * as fs from 'fs';
import path from 'path';
import process from 'process';
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { createEnv } from './settings';
import { exec, getPlatformValue } from './utils';
import { t } from './lang/helpers';
import { MessageBox } from './ui/message_box';
import { IMPORT_MESSAGES, PandocProgress } from './ui/progress';
import { describeExportFailure } from './export_error';
import type PandocGuiPlugin from './main';
import pandoc from './pandoc';
import { readerFor } from './import_format';
import { importCommand, type ImportOptions } from './import_args';

export interface ImportRequest {
  /** The file on disk, as the dialog was given it. */
  source: string;
  /** Where the note goes, as a vault path — empty for the root. */
  folder: string;
  /** Where the extracted images go, as a vault path. Unset leaves the document's images where they are. */
  mediaFolder?: string;
  options: ImportOptions;
}

/** The note a source file becomes: its own name, written as markdown, in the chosen folder. */
export const importedNotePath = (source: string, folder: string): string =>
  normalizePath(`${folder}/${path.basename(source, path.extname(source))}.md`);

/** A path as pandoc is to be handed it: from the folder the command runs in, with the separators a command line takes. */
const relativeTo = (from: string, to: string): string => (path.relative(from, to) || '.').replaceAll('\\', '/');

const confirmOverwrite = (app: App, note: string): Promise<boolean> =>
  new Promise(resolve => {
    const box = new MessageBox(app, {
      title: t.IMPORT_DIALOG_TITLE,
      message: t.OVERWRITE_TITLE(note),
      buttons: 'YesNo',
      callback: { yes: () => resolve(true), no: () => resolve(false) },
    });
    // Closed rather than answered is a no. The buttons answer first and close after, so this settles nothing then.
    const close = box.onClose.bind(box);
    box.onClose = () => {
      close();
      resolve(false);
    };
    box.open();
  });

/**
 * The note as Obsidian sees it, once it does.
 *
 * Pandoc writes the file itself, so the vault learns of it from the watcher rather than from this plugin — which
 * takes a moment on a folder it is only now looking at.
 */
const openImported = async (app: App, notePath: string): Promise<void> => {
  for (let attempt = 0; attempt < 25; attempt++) {
    const note = app.vault.getFileByPath(notePath);
    if (note instanceof TFile) {
      await app.workspace.getLeaf(false).openFile(note);
      return;
    }
    await new Promise(resolve => window.setTimeout(resolve, 200));
  }
};

/** Convert a file on disk into a note in the vault. Answers whether one was written. */
export async function importFile(plugin: PandocGuiPlugin, request: ImportRequest): Promise<boolean> {
  const {
    app,
    manifest,
    settings: globalSetting,
    app: {
      vault: { adapter },
    },
  } = plugin;

  const reader = readerFor(request.source);
  if (!reader) {
    new Notice(t.IMPORT_DIALOG_SOURCE_UNKNOWN, 2000);
    return false;
  }

  const notePath = importedNotePath(request.source, request.folder);
  const noteName = path.basename(notePath);
  const outputPath = adapter.getFullPath(notePath);
  const outputDir = path.dirname(outputPath);

  if (fs.existsSync(outputPath) && !(await confirmOverwrite(app, noteName))) {
    return false;
  }

  // The images are asked for as a vault folder and given to pandoc as a path from the note, which is how the note
  // will be linking to them.
  const options: ImportOptions = { ...request.options };
  if (request.mediaFolder !== undefined) {
    options.extractMedia = relativeTo(outputDir, adapter.getFullPath(normalizePath(request.mediaFolder)));
  }

  const pluginDir = `${adapter.getBasePath()}/${manifest.dir}`;
  const env = createEnv(getPlatformValue(globalSetting.env) ?? {}, { pluginDir });

  let pandocPath = pandoc.normalizePath(getPlatformValue(globalSetting.pandocPath));
  let source = request.source;
  if (process.platform === 'win32') {
    // https://github.com/mokeyish/obsidian-enhancing-export/issues/153
    pandocPath = pandocPath.replaceAll('\\', '/');
    source = source.replaceAll('\\', '/');
  }

  // Run from the folder the note is written in, so `-o` and the extracted images are both said as the note says them.
  const cmd = importCommand(pandocPath, source, reader, options, noteName);

  const progress = new PandocProgress(IMPORT_MESSAGES);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    progress.running(noteName);
    const { stderr } = await exec(cmd, { cwd: outputDir, env });

    // Pandoc warns here and writes the file all the same, so a warning is reported rather than thrown.
    const warnings = stderr.trim();
    if (warnings) {
      console.warn(cmd, warnings);
      progress.warn(noteName);
    } else {
      progress.succeed(noteName);
    }
    await openImported(app, notePath);
    return true;
  } catch (err) {
    progress.stop();
    const { detail, recommendation } = describeExportFailure(err, cmd);
    console.error(cmd, err);
    new MessageBox(app, {
      title: t.IMPORT_ERROR_TITLE,
      buttons: 'Ok',
      render: contentEl => {
        const root = contentEl.createDiv({ cls: 'ex-export-error' });
        const fact = (label: string, value: string, title?: string) =>
          root.createDiv({ cls: 'ex-export-error-fact' }, el => {
            el.createSpan({ cls: 'ex-export-error-label', text: label });
            el.createSpan({ cls: 'ex-export-error-value', text: value, title: title ?? value });
          });
        fact(t.IMPORT_ERROR_SOURCE, path.basename(request.source), request.source);
        fact(t.ERROR_FILE, noteName, outputPath);
        root.createDiv({ cls: 'ex-export-error-detail', text: detail });
        if (recommendation) {
          root.createDiv({ cls: 'ex-export-error-hint', text: recommendation });
        }
      },
    }).open();
    return false;
  }
}
