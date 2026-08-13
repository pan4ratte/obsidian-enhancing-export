import { deflateRawSync } from 'zlib';
import { extractFromZip } from '../../src/wasm/zip';

/** An archive built by hand, so the reader is measured against the format rather than against another reader. */
const zip = (entries: { name: string; data: Buffer; stored?: boolean }[]): ArrayBuffer => {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let at = 0;

  for (const { name, data, stored } of entries) {
    const packed = stored ? data : deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf-8');

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    locals.push(local, packed);

    const header = Buffer.alloc(46 + nameBytes.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(stored ? 0 : 8, 10);
    header.writeUInt32LE(packed.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt32LE(at, 42);
    nameBytes.copy(header, 46);
    central.push(header);

    at += local.length + packed.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(at, 16);

  const whole = Buffer.concat([...locals, directory, end]);
  return whole.buffer.slice(whole.byteOffset, whole.byteOffset + whole.byteLength);
};

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('extractFromZip', () => {
  test('takes the file out from under the folder the release names after its version', async () => {
    const archive = zip([
      { name: 'pandoc-wasm-3.10.2/COPYING.md', data: Buffer.from('a licence') },
      { name: 'pandoc-wasm-3.10.2/pandoc.wasm', data: Buffer.from('the binary') },
    ]);
    expect(text(await extractFromZip(archive, 'pandoc.wasm'))).toBe('the binary');
  });

  test('reads a file that was stored rather than packed', async () => {
    const archive = zip([{ name: 'pandoc.wasm', data: Buffer.from('as it is'), stored: true }]);
    expect(text(await extractFromZip(archive, 'pandoc.wasm'))).toBe('as it is');
  });

  test('carries bytes through unchanged, however long', async () => {
    const data = Buffer.alloc(200_000);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (i * 7) % 251;
    }
    const archive = zip([{ name: 'x/pandoc.wasm', data }]);
    expect(Buffer.from(await extractFromZip(archive, 'pandoc.wasm')).equals(data)).toBe(true);
  });

  test('says so when the archive holds no such file', async () => {
    const archive = zip([{ name: 'readme.txt', data: Buffer.from('x') }]);
    await expect(extractFromZip(archive, 'pandoc.wasm')).rejects.toThrow(/no "pandoc\.wasm"/);
  });

  test('says so when it is not an archive at all', async () => {
    const bytes = new TextEncoder().encode('not a zip, just some bytes'.repeat(4));
    await expect(extractFromZip(bytes.buffer, 'pandoc.wasm')).rejects.toThrow(/Not a zip/);
  });
});
