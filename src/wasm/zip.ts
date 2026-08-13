/* Just enough of the zip format to take one file out of pandoc's release archive.
 *
 * The archive holds a licence, a copyright notice and the binary; only the binary is wanted, and pulling it out here
 * saves both a dependency and writing 56 MB of files nobody asked for.
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const STORED = 0;
const DEFLATED = 8;

/** Where the central directory starts, found by walking back from the end of the archive. */
const endOfCentralDirectory = (view: DataView): number => {
  // The record is 22 bytes plus a comment of up to 64 KB.
  const from = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= from; at -= 1) {
    if (view.getUint32(at, true) === EOCD) {
      return at;
    }
  }
  throw new Error('Not a zip archive');
};

const inflate = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * The contents of the first file in `archive` whose name ends in `name`, decompressed.
 *
 * The entry is looked up by its tail rather than its whole path because the release archive puts the binary in a
 * folder named after the version — `pandoc-wasm-3.10.2/pandoc.wasm`.
 */
export async function extractFromZip(archive: ArrayBuffer, name: string): Promise<Uint8Array> {
  const view = new DataView(archive);
  const bytes = new Uint8Array(archive);
  const eocd = endOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);

  let at = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== CENTRAL) {
      break;
    }
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const entry = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (entry === name || entry.endsWith(`/${name}`)) {
      if (view.getUint32(localAt, true) !== LOCAL) {
        throw new Error(`"${entry}" is not where the archive says it is`);
      }
      // The local header repeats the name and can carry different extra fields, so its own lengths are the ones to use.
      const start = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
      const data = bytes.subarray(start, start + compressed);
      if (method === STORED) {
        return data.slice();
      }
      if (method === DEFLATED) {
        return await inflate(data);
      }
      throw new Error(`"${entry}" is packed in a way this cannot unpack (${method})`);
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`The archive has no "${name}" in it`);
}
