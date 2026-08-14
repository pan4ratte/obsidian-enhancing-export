/* Fetching a file from the network, wherever the plugin is running.
 *
 * Obsidian's own request rather than `fetch`: the renderer is a page of its own origin, and a picture on someone
 * else's server sends no header that would let that page read it.
 */

import { requestUrl } from 'obsidian';

/** The bytes at a URL, or nothing where they could not be had — the caller reports it and carries on. */
export async function download(url: string): Promise<Uint8Array | undefined> {
  try {
    const { status, arrayBuffer } = await requestUrl({ url, throw: false });
    return status >= 200 && status < 300 ? new Uint8Array(arrayBuffer) : undefined;
  } catch {
    return undefined;
  }
}
