import * as ct from 'electron';
import * as fs from 'fs';
import process from 'process';
import path from 'path';
import argsParser from 'yargs-parser';
import { Variables, ExportSetting, extractDefaultExtension as extractExtension, createEnv, today } from './settings';
import { MessageBox } from './ui/message_box';
import { Notice, TFile, getLinkpath, moment, type EmbedCache } from 'obsidian';
import { exec, renderTemplate, getPlatformValue, trimQuotes } from './utils';
import ProgressBar from './ui/components/ProgressBar';
import { describeExportFailure } from './export_error';
import type ExportPlugin from './main';
import pandoc from './pandoc';

export async function exportToOo(
  plugin: ExportPlugin,
  currentFile: TFile,
  candidateOutputDirectory: string,
  candidateOutputFileName: string | undefined,
  setting: ExportSetting,
  showOverwriteConfirmation?: boolean,
  options?: unknown,
  onSuccess?: () => void,
  onFailure?: () => void,
  beforeExport?: () => void
) {
  const {
    settings: globalSetting,
    lang,
    manifest,
    app: {
      vault: { adapter, config: obsidianConfig },
      metadataCache,
    },
  } = plugin;

  if (!candidateOutputFileName) {
    const extension = extractExtension(setting);
    candidateOutputFileName = `${currentFile.basename}${extension}`;
  }
  if (showOverwriteConfirmation == undefined) {
    showOverwriteConfirmation = globalSetting.showOverwriteConfirmation;
  }

  /* Variables
   *   /User/aaa/Documents/test.pdf
   * - ${outputDir}             --> /User/aaa/Documents/
   * - ${outputPath}            --> /User/aaa/Documents/test.pdf
   * - ${outputFileName}        --> test
   * - ${outputFileFullName}    --> test.pdf
   *
   *   /User/aaa/Documents/test.pdf
   * - ${currentDir}            --> /User/aaa/Documents/
   * - ${currentPath}           --> /User/aaa/Documents/test.pdf
   * - ${CurrentFileName}       --> test
   * - ${CurrentFileFullName}   --> test.pdf
   */
  const vaultDir = adapter.getBasePath();
  const pluginDir = `${vaultDir}/${manifest.dir}`;
  const luaDir = `${pluginDir}/lua`;
  const outputDir = candidateOutputDirectory;
  const outputPath = `${outputDir}/${candidateOutputFileName}`;
  const outputFileName = candidateOutputFileName.substring(0, candidateOutputFileName.lastIndexOf('.'));
  const outputFileFullName = candidateOutputFileName;

  const currentPath = adapter.getFullPath(currentFile.path);
  const currentDir = path.dirname(currentPath);
  const currentFileName = currentFile.basename;
  const currentFileFullName = currentFile.name;

  let attachmentFolderPath = obsidianConfig.attachmentFolderPath ?? '/';
  if (attachmentFolderPath === '/') {
    attachmentFolderPath = vaultDir;
  } else if (attachmentFolderPath.startsWith('.')) {
    attachmentFolderPath = path.join(currentDir, attachmentFolderPath.substring(1));
  } else {
    attachmentFolderPath = path.join(vaultDir, attachmentFolderPath);
  }

  let frontMatter: unknown = null;
  try {
    frontMatter = metadataCache.getCache(currentFile.path).frontmatter;
  } catch (e) {
    console.error(e);
  }

  let embedArray: EmbedCache[] | undefined;
  try {
    embedArray = metadataCache.getCache(currentFile.path).embeds;
  } catch (e) {
    console.error(e);
  }
  let targetDirArray: string[] = [];
  for (const embed of embedArray ?? []) {
    const linkPath = embed.link;
    const targetFile = metadataCache.getFirstLinkpathDest(getLinkpath(linkPath), currentFile.path);
    if (targetFile instanceof TFile) {
      targetDirArray.push(path.join(vaultDir, path.dirname(targetFile.path)));
    } else if (targetFile === null) {
      console.warn(`Could not resolve embedded file: ${linkPath}`);
    }
  }
  targetDirArray = [...new Set(targetDirArray)];
  const embedDirs = targetDirArray.join(path.delimiter);

  /*
   * Every note the note embeds, and every note those embed, as the link that
   * was written against the file it stands for.
   *
   * Resolving a link is Obsidian's to do and nobody else's: which note
   * `![[Methods]]` means depends on the vault's index, on where the note doing
   * the embedding sits, and on the shortest-path rule — none of which is
   * visible from a folder on disk, and all of which is one call away here. So
   * the plugin resolves and the filter substitutes.
   *
   * Notes only. An embedded image is pandoc's business and always was, and it
   * finds it through the resource path above.
   */
  const noteEmbeds = new Map<string, string>();
  const walkedForEmbeds = new Set<string>([currentFile.path]);
  const collectNoteEmbeds = (file: TFile, depth: number) => {
    if (depth > 8) {
      return;
    }
    for (const embed of metadataCache.getCache(file.path)?.embeds ?? []) {
      const target = metadataCache.getFirstLinkpathDest(getLinkpath(embed.link), file.path);
      if (!(target instanceof TFile) || target.extension !== 'md') {
        continue;
      }
      // Keyed by the link as it was written, `#section` and all, because that
      // is what the filter reads off the document.
      noteEmbeds.set(embed.link, adapter.getFullPath(target.path));
      if (!walkedForEmbeds.has(target.path)) {
        walkedForEmbeds.add(target.path);
        collectNoteEmbeds(target, depth + 1);
      }
    }
  };
  try {
    collectNoteEmbeds(currentFile, 1);
  } catch (e) {
    console.error(e);
  }

  const variables: Variables = {
    pluginDir,
    luaDir,
    outputDir,
    outputPath,
    outputFileName,
    outputFileFullName,
    currentDir,
    currentPath,
    currentFileName,
    currentFileFullName,
    attachmentFolderPath,
    vaultDir,
    // date: new Date(currentFile.stat.ctime),
    // lastMod: new Date(currentFile.stat.mtime),
    // now: new Date()
    metadata: frontMatter,
    embedDirs,
    // In Obsidian's own language rather than the machine's: someone writing in
    // Russian in a Russian-language Obsidian wants a Russian date, whatever the
    // operating system was installed as.
    today: today(moment.locale()),
    // Always an object: a template asking for `${options.something}` is asking
    // a question nothing puts to the user any more, and reading a field off
    // nothing would throw while the command was still being built.
    options: options ?? {},
    fromFormat: obsidianConfig.useMarkdownLinks ? 'markdown' : 'markdown+wikilinks_title_after_pipe',
  };

  const showCommandLineOutput = setting.type === 'custom' && setting.showCommandOutput;
  const openExportedFileLocation = setting.openExportedFileLocation ?? globalSetting.openExportedFileLocation;
  const openExportedFile = setting.openExportedFile ?? globalSetting.openExportedFile;

  if (showOverwriteConfirmation && fs.existsSync(outputPath)) {
    const result = await ct.remote.dialog.showSaveDialog({
      title: lang.overwriteConfirmationDialog.title(outputFileFullName),
      defaultPath: outputPath,
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    });

    if (result.canceled) {
      return;
    }

    variables.outputPath = result.filePath;
    variables.outputDir = path.dirname(variables.outputPath);
    variables.outputFileFullName = path.basename(variables.outputPath);
    variables.outputFileName = path.basename(variables.outputFileFullName, path.extname(variables.outputFileFullName));
  }

  // An export takes as long as pandoc takes, which on a long note with a PDF
  // engine behind it is long enough to look like nothing happened. The bar is
  // shown for every export rather than asked about: a setting for whether the
  // plugin says it is working is a setting for whether it seems broken.
  beforeExport?.();
  const progressBarHide = ProgressBar.show(lang.preparing(variables.outputFileFullName));

  // process Environment variables..
  const env = (variables.env = createEnv(getPlatformValue(globalSetting.env) ?? {}, variables));

  /*
   * The embed map, handed to `embeds.lua` in the environment rather than on the
   * command line: a link is whatever someone typed into a note — quotes,
   * backslashes, semicolons, a `$` — and a command line is the wrong place to
   * find that out. Set after `createEnv` so it is not run through the template
   * renderer either, for the same reason.
   *
   * Windows caps an environment variable at 32k. A note reaching that has some
   * thousands of embedded notes; the ones that do not fit are left as they are
   * rather than truncating a path and reading the wrong file.
   */
  const EMBED_ENV_LIMIT = 30000;
  let embedLines = '';
  for (const [link, file] of noteEmbeds) {
    const line = `${link}\t${file}\n`;
    if (embedLines.length + line.length > EMBED_ENV_LIMIT) {
      console.warn(`Too many embedded notes to pass to pandoc; ${link} and any after it are left as they are.`);
      break;
    }
    embedLines += line;
  }
  env['OBSIDIAN_EMBEDS'] = embedLines;

  let pandocPath = pandoc.normalizePath(getPlatformValue(globalSetting.pandocPath));

  if (process.platform === 'win32') {
    // https://github.com/mokeyish/obsidian-enhancing-export/issues/153
    pandocPath = pandocPath.replaceAll('\\', '/');
    const pathKeys: Array<keyof Variables> = [
      'pluginDir',
      'luaDir',
      'outputDir',
      'outputPath',
      'currentDir',
      'currentPath',
      'attachmentFolderPath',
      'vaultDir',
      'embedDirs',
    ];

    for (const pathKey of pathKeys) {
      const path = variables[pathKey] as string;
      variables[pathKey] = path.replaceAll('\\', '/');
    }
  }

  // Later options win, so the order is least specific first: the preset's
  // plumbing, the template editor's rows, and last what the template's author
  // typed by hand.
  const cmdTpl =
    setting.type === 'pandoc'
      ? [pandocPath, '"${currentPath}"', setting.arguments, setting.customArguments, setting.userArguments]
          .map(part => part?.trim())
          .filter(Boolean)
          .join(' ')
      : setting.command;

  const cmd = renderTemplate(cmdTpl, variables);
  const args = argsParser(cmd.match(/(?:[^\s"]+|"[^"]*")+/g), {
    alias: {
      output: ['o'],
    },
  });

  try {
    const actualOutputPath = path.normalize(trimQuotes(args.output));

    const actualOutputDir = path.dirname(actualOutputPath);
    if (!fs.existsSync(actualOutputDir)) {
      fs.mkdirSync(actualOutputDir);
    }

    await exec(cmd, { cwd: variables.currentDir, env });
    progressBarHide();

    const next = async () => {
      if (openExportedFileLocation) {
        window.setTimeout(() => {
          ct.remote.shell.showItemInFolder(actualOutputPath);
        }, 1000);
      }
      if (openExportedFile) {
        await ct.remote.shell.openPath(actualOutputPath);
      }
      // success
      onSuccess?.();
    };

    if (showCommandLineOutput) {
      const box = new MessageBox(plugin.app, lang.exportCommandOutputMessage(cmd));
      box.onClose = next;
      box.open();
    } else {
      new Notice(lang.exportSuccessNotice(variables.outputFileFullName), 1500);
      await next();
    }
  } catch (err) {
    progressBarHide();
    const { detail, recommendation } = describeExportFailure(err, cmd, lang);
    // What the reader can act on: which template was run, which file it was
    // writing, what went wrong, and what to try. The command line itself stays
    // in the console — it is long, and none of it is the error.
    console.error(cmd, err);
    new MessageBox(plugin.app, {
      title: lang.exportError.title,
      buttons: 'Ok',
      render: contentEl => {
        const root = contentEl.createDiv({ cls: 'ex-export-error' });
        const fact = (label: string, value: string, title?: string) =>
          root.createDiv({ cls: 'ex-export-error-fact' }, el => {
            el.createSpan({ cls: 'ex-export-error-label', text: label });
            el.createSpan({ cls: 'ex-export-error-value', text: value, title: title ?? value });
          });
        fact(lang.exportError.template, setting.name);
        fact(lang.exportError.file, variables.outputFileFullName, variables.outputPath);
        root.createDiv({ cls: 'ex-export-error-detail', text: detail });
        if (recommendation) {
          root.createDiv({ cls: 'ex-export-error-hint', text: recommendation });
        }
      },
    }).open();
    onFailure?.();
  }
}
