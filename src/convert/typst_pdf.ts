/* A PDF made by the plugin's own typst, on a machine whose pandoc has none to run.
 *
 * The installed pandoc converts as it always does, but stops at the typst source instead of the PDF; the wasm build
 * that comes with the plugin sets that source. It is the same two steps the wasm engine takes — see
 * `src/wasm/convert.ts` — with the first of them done by the program on disk.
 */

import { withoutOutputArg } from '../args/output_arg';
import type { FileStore } from '../system/file_store';
import { basename, resolve } from '../system/paths';
import type { TypstWasm } from '../wasm/typst';

/** Reads a file by its path on the machine, or answers nothing where there is none. */
export type ReadFile = (path: string) => Promise<Uint8Array | undefined>;

/**
 * Everything a typst source reads from the disk around it. Pandoc's typst writer names a picture and nothing else:
 * whatever a note carries of its own is text in the document by the time it gets here.
 */
const IMAGES = /\bimage\(\s*"((?:[^"\\]|\\.)*)"/g;

/** A typst string as the path it stands for: pandoc escapes both, and a Windows path arrives full of the second. */
const unescape = (text: string): string => text.replace(/\\(.)/g, '$1');

/** What a file is called in the compiler's own file system — flat, so no path of the machine's has to survive it. */
const virtualPath = (path: string, index: number): string => `/assets/${index}-${basename(path).replace(/["\\]/g, '_')}`;

export interface TypstAssets {
  /** The source with every path it names rewritten to the file put beside it. */
  source: string;
  /** Those files, by the name the source now calls them. */
  files: Record<string, Uint8Array>;
}

/**
 * The pictures a source names, found where the export would have found them and renamed to something the compiler can
 * hold. A file that is nowhere to be found is left as it was written — typst names it in a diagnostic, which is the
 * one thing more useful than a name of ours.
 */
export async function gatherAssets(source: string, searchPaths: readonly string[], read: ReadFile): Promise<TypstAssets> {
  const files: Record<string, Uint8Array> = {};
  const renamed = new Map<string, string>();

  for (const [, reference] of source.matchAll(IMAGES)) {
    const path = unescape(reference);
    if (renamed.has(reference)) {
      continue;
    }
    for (const from of searchPaths) {
      const candidate = resolve(from, path);
      const bytes = await read(candidate);
      if (bytes) {
        const at = virtualPath(path, renamed.size);
        renamed.set(reference, at);
        files[at] = bytes;
        break;
      }
    }
  }

  return {
    source: source.replaceAll(IMAGES, (whole, reference: string) => {
      const at = renamed.get(reference);
      return at ? whole.replace(reference, at) : whole;
    }),
    files,
  };
}

/** The command that writes the source rather than the PDF — pandoc prints it where nothing names a file to put it in. */
export const sourceCommand = (cmd: string): string => withoutOutputArg(cmd);

export interface TypstPdfRequest {
  /** The command as the export rendered it, PDF and all. */
  command: string;
  /** Runs a command and answers what it printed, which is the export's own `exec`. */
  run: (command: string) => Promise<{ stdout: string; stderr: string }>;
  /** Where a path the source names is looked for: the note's own folder first, then wherever else the export points. */
  searchPaths: readonly string[];
  /** The PDF to write, as a path on the machine. */
  outputPath: string;
  typst: TypstWasm;
  files: FileStore;
}

/** Makes the PDF, and answers whatever pandoc and typst had to say about it — warnings, in the shape a run reports. */
export async function typesetTypstPdf(request: TypstPdfRequest): Promise<string> {
  const { stdout, stderr } = await request.run(sourceCommand(request.command));
  if (!stdout.trim()) {
    throw new Error(stderr.trim() || 'Pandoc wrote no typst source to set the PDF from');
  }

  const { source, files } = await gatherAssets(stdout, request.searchPaths, path => request.files.read(path));
  const { pdf, diagnostics } = await request.typst.compile('/main.typ', source, files);
  if (!pdf) {
    throw new Error([stderr.trim(), diagnostics].filter(Boolean).join('\n') || 'Typst wrote no PDF, and said nothing about why');
  }

  await request.files.write(request.outputPath, pdf);
  return [stderr.trim(), diagnostics.trim()].filter(Boolean).join('\n');
}
