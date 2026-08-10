import * as ct from 'electron';
import * as fs from 'fs';
import process from 'process';
import path from 'path';
import { Variables, ExportSetting, extractDefaultExtension as extractExtension, createEnv, today } from './settings';
import { MessageBox } from './ui/message_box';
import { TFile, getLinkpath, moment, type EmbedCache } from 'obsidian';
import type { SemVer } from 'semver';
import { exec, renderTemplate, getPlatformValue, trimQuotes } from './utils';
import { t } from './lang/helpers';
import { ExportProgress } from './ui/progress';
import { describeExportFailure } from './export_error';
import type PandocGuiPlugin from './main';
import pandoc from './pandoc';
import { orderLuaFilters } from './lua_filters';
import { renameHighlightFlags } from './writer_args';
import { outputArg } from './output_arg';
import { dialogWindow } from './dialog';

export async function exportNote(
  plugin: PandocGuiPlugin,
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

  // The `${...}` a template can use — see the `Variables` interface in settings.ts.
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

  // Every embedded note, transitively, as the written link against the file it means.
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
      // Keyed by the link as written, `#section` and all — that is what the filter reads.
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
    metadata: frontMatter,
    embedDirs,
    // In Obsidian's language rather than the machine's.
    today: today(moment.locale()),
    // Always an object: reading `${options.x}` off nothing would throw while building the command.
    options: options ?? {},
    fromFormat: obsidianConfig.useMarkdownLinks ? 'markdown' : 'markdown+wikilinks_title_after_pipe',
  };

  const showCommandLineOutput = setting.type === 'custom' && setting.showCommandOutput;
  const openExportedFileLocation = setting.openExportedFileLocation ?? globalSetting.openExportedFileLocation;
  const openExportedFile = setting.openExportedFile ?? globalSetting.openExportedFile;

  if (showOverwriteConfirmation && fs.existsSync(outputPath)) {
    const result = await ct.remote.dialog.showSaveDialog(dialogWindow(), {
      title: t.OVERWRITE_TITLE(outputFileFullName),
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

  // Shown for every export: a PDF engine on a long note takes long enough to look stuck.
  beforeExport?.();
  const progress = new ExportProgress();

  // Rendering a `${...}` can fail on a template the editor let through, and the notice is already up by here — so
  // everything from the environment onwards reports through the one handler rather than escaping past it.
  let cmd = '';

  try {
    const env = (variables.env = createEnv(getPlatformValue(globalSetting.env) ?? {}, variables));

    // The embed map goes to `embeds.lua` in the environment, not on the command line: a link is whatever someone typed.
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

    // Later options win, so least specific first: preset, editor rows, then hand-typed. Filters are the exception —
    // they run where they stand, so `orderLuaFilters` has the last word on the one whose place is not negotiable.
    let cmdTpl =
      setting.type === 'pandoc'
        ? orderLuaFilters(
            [pandocPath, '"${currentPath}"', setting.arguments, setting.customArguments, setting.userArguments]
              .map(part => part?.trim())
              .filter(Boolean)
              .join(' ')
          )
        : setting.command;

    if (setting.type === 'pandoc') {
      // A pandoc that has renamed the highlighting options warns about the old names on every single run.
      let installed: SemVer;
      try {
        installed = await pandoc.getCachedVersion(getPlatformValue(globalSetting.pandocPath), env);
      } catch (e) {
        // Not knowing the version is no reason to stop: the old spelling is the one every version takes.
        console.warn(e);
      }
      if (pandoc.takesSyntaxHighlighting(installed)) {
        cmdTpl = renameHighlightFlags(cmdTpl);
      }
    }

    cmd = renderTemplate(cmdTpl, variables);
    const output = outputArg(cmd);
    if (output === undefined) {
      throw new Error('The command names no output file — check -o in the template.');
    }
    const actualOutputPath = path.normalize(trimQuotes(output));

    const actualOutputDir = path.dirname(actualOutputPath);
    if (!fs.existsSync(actualOutputDir)) {
      fs.mkdirSync(actualOutputDir);
    }

    progress.running(variables.outputFileFullName);
    const { stderr } = await exec(cmd, { cwd: variables.currentDir, env });

    // Pandoc writes its warnings here and exports the file all the same, so they are reported rather than thrown.
    const warnings = stderr.trim();
    if (warnings) {
      console.warn(cmd, warnings);
    }

    const next = async () => {
      if (openExportedFileLocation) {
        window.setTimeout(() => {
          ct.remote.shell.showItemInFolder(actualOutputPath);
        }, 1000);
      }
      if (openExportedFile) {
        await ct.remote.shell.openPath(actualOutputPath);
      }
      onSuccess?.();
    };

    if (showCommandLineOutput) {
      // The box says everything the notice would, and says it until it is closed.
      progress.stop();
      const message = [t.EXPORT_COMMAND_OUTPUT(cmd), warnings].filter(Boolean).join('\n\n');
      const box = new MessageBox(plugin.app, message);
      box.onClose = () => void next();
      box.open();
    } else if (warnings) {
      progress.warn(variables.outputFileFullName);
      await next();
    } else {
      progress.succeed(variables.outputFileFullName);
      await next();
    }
  } catch (err) {
    progress.stop();
    const { detail, recommendation } = describeExportFailure(err, cmd);
    // Only what the reader can act on. The command line stays in the console.
    console.error(cmd, err);
    new MessageBox(plugin.app, {
      title: t.ERROR_TITLE,
      buttons: 'Ok',
      render: contentEl => {
        const root = contentEl.createDiv({ cls: 'ex-export-error' });
        const fact = (label: string, value: string, title?: string) =>
          root.createDiv({ cls: 'ex-export-error-fact' }, el => {
            el.createSpan({ cls: 'ex-export-error-label', text: label });
            el.createSpan({ cls: 'ex-export-error-value', text: value, title: title ?? value });
          });
        fact(t.ERROR_TEMPLATE, setting.name);
        fact(t.ERROR_FILE, variables.outputFileFullName, variables.outputPath);
        root.createDiv({ cls: 'ex-export-error-detail', text: detail });
        if (recommendation) {
          root.createDiv({ cls: 'ex-export-error-hint', text: recommendation });
        }
      },
    }).open();
    onFailure?.();
  }
}
