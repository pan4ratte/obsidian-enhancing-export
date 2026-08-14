/* The images a note names by URL, fetched before the conversion starts.
 *
 * Pandoc downloads those itself; its wasm build has no network to do it with, so an image named by URL would simply be
 * missing from the export. The plugin can reach the network, so it does it first: every URL the note writes an image
 * with is fetched, written into the file system the run will use, and handed to `remote.lua`, which is what puts the
 * local path into the document.
 */

import filter from '../../lua-filters/internal/remote.lua';
import { extname } from '../system/paths';
import type { PandocDefaults } from './defaults';
import type { WasmFiles } from './runtime';

/** Where the fetched files go, and the two files the run is handed to find them by. */
const REMOTE_DIR = '_remote';
export const REMOTE_LIST = '.obsidian-remote';
export const REMOTE_FILTER = '.obsidian-remote.lua';

/** An image written as markdown, and one written as HTML — the two ways a note names a picture it does not hold. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?(https?:\/\/[^\s)>]+)/g;
const HTML_IMAGE = /<img\b[^>]*\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi;

/** As many as one export will fetch. A note that names more than this is not one waiting on a download to finish. */
const LIMIT = 64;

/** The text files a run was handed — the note, and the notes it embeds. Anything else is not read for links. */
const TEXT = ['.md', '.markdown', '.txt', '.html', '.htm'];

const decoder = new TextDecoder('utf-8');

/** Fetches a URL, or nothing where it cannot be had — a download that failed is not an export that fails. */
export type Download = (url: string) => Promise<Uint8Array | undefined>;

export interface Remote {
  /** The files to add to the run: the fetched images, the list, and the filter that reads it. */
  files: WasmFiles;
  /** What could not be fetched, in the words the rest of the plugin reports warnings with. */
  warnings: string[];
}

/** Every image URL the given text names, in the order they are written. */
export const imageUrls = (text: string): string[] => {
  const urls = new Set<string>();
  for (const pattern of [MARKDOWN_IMAGE, HTML_IMAGE]) {
    for (const [, url] of text.matchAll(pattern)) {
      // A trailing `)` or punctuation belongs to the markdown around the link, not to the link.
      urls.add(url.replace(/[).,;]+$/, ''));
    }
  }
  return [...urls];
};

/**
 * Fetch what the run's own text names, and answer the files that go with it.
 *
 * The paths written into the list are absolute: the document that names them is read from one folder and, where the
 * export ends in typst, set from another — a relative path would mean two different files.
 */
export async function fetchRemote(files: WasmFiles, download: Download): Promise<Remote> {
  const urls = new Set<string>();
  for (const [path, data] of Object.entries(files)) {
    if (!TEXT.includes(extname(path).toLowerCase())) {
      continue;
    }
    for (const url of imageUrls(typeof data === 'string' ? data : decoder.decode(data))) {
      urls.add(url);
    }
  }
  if (urls.size === 0) {
    return { files: {}, warnings: [] };
  }

  const wanted = [...urls].slice(0, LIMIT);
  const fetched = await Promise.all(wanted.map(async url => [url, await download(url)] as const));

  const added: WasmFiles = {};
  const lines: string[] = [];
  const warnings: string[] = [];
  fetched.forEach(([url, bytes], i) => {
    if (!bytes) {
      warnings.push(`Could not fetch ${url}`);
      return;
    }
    // Numbered rather than named: two URLs can end in the same file name, and one of them would win.
    const path = `/${REMOTE_DIR}/${i}${extension(url)}`;
    added[path] = bytes;
    lines.push(`${url}\t${path}`);
  });

  if (urls.size > LIMIT) {
    warnings.push(`Only the first ${LIMIT} images named by URL were fetched`);
  }
  if (lines.length === 0) {
    return { files: {}, warnings };
  }

  return { files: { ...added, [REMOTE_LIST]: `${lines.join('\n')}\n`, [REMOTE_FILTER]: filter }, warnings };
}

/** The extension a URL ends in, where it ends in one that could be a picture's. */
const extension = (url: string): string => {
  const path = url.split(/[?#]/)[0];
  const found = extname(path);
  return /^\.[a-z0-9]{1,5}$/i.test(found) ? found : '';
};

/** `remote.lua` runs after the filters the template names, so an image inside an embedded note is rewritten too. */
export const withRemoteFilter = (defaults: PandocDefaults): void => {
  defaults.filters = [...(defaults.filters ?? []), { type: 'lua', path: REMOTE_FILTER }];
};
