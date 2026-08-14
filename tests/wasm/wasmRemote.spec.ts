/* The images a note names by URL: which ones are found, and what the run is handed to read them by. */

import { fetchRemote, imageUrls, REMOTE_FILTER, REMOTE_LIST } from '../../src/wasm/remote';
import type { Download } from '../../src/wasm/remote';

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: string | Uint8Array) => (typeof data === 'string' ? data : new TextDecoder().decode(data));

/** A network that answers with the URL it was asked for, and nothing for the ones named as missing. */
const network = (missing: string[] = []): { download: Download; asked: string[] } => {
  const asked: string[] = [];
  return {
    asked,
    download: url => {
      asked.push(url);
      return Promise.resolve(missing.includes(url) ? undefined : bytes(`bytes of ${url}`));
    },
  };
};

describe('finding the images a note names by URL', () => {
  test('reads one written as markdown', () => {
    expect(imageUrls('![a picture](https://example.com/a.png)')).toEqual(['https://example.com/a.png']);
  });

  test('reads one written as HTML', () => {
    expect(imageUrls('<img class="x" src="https://example.com/b.jpg" />')).toEqual(['https://example.com/b.jpg']);
  });

  test('leaves a link that is not an image', () => {
    expect(imageUrls('[the site](https://example.com/page)')).toEqual([]);
  });

  test('names each one once, however often it is written', () => {
    expect(imageUrls('![a](https://example.com/a.png) and ![b](https://example.com/a.png)')).toEqual(['https://example.com/a.png']);
  });
});

describe('fetching them', () => {
  test('hands the run the bytes, the list and the filter that reads it', async () => {
    const { download } = network();
    const { files } = await fetchRemote({ 'Notes/note.md': '![a](https://example.com/a.png)' }, download);

    expect(text(files['/_remote/0.png'])).toBe('bytes of https://example.com/a.png');
    expect(text(files[REMOTE_LIST])).toBe('https://example.com/a.png\t/_remote/0.png\n');
    expect(text(files[REMOTE_FILTER])).toContain('.obsidian-remote');
  });

  test('numbers them, so two URLs ending in the same name stay apart', async () => {
    const { download } = network();
    const note = '![a](https://one.example/a.png) ![b](https://two.example/a.png)';
    const { files } = await fetchRemote({ 'Notes/note.md': note }, download);

    expect(Object.keys(files).filter(path => path.startsWith('/_remote/'))).toEqual(['/_remote/0.png', '/_remote/1.png']);
  });

  test('reads the notes an export embeds as well as the note itself', async () => {
    const { download, asked } = network();
    await fetchRemote(
      { 'Notes/note.md': '![a](https://example.com/a.png)', 'Notes/embedded.md': '![b](https://example.com/b.png)' },
      download
    );

    expect(asked.sort()).toEqual(['https://example.com/a.png', 'https://example.com/b.png']);
  });

  test('does not read a picture for the URLs inside it', async () => {
    const { download, asked } = network();
    await fetchRemote({ 'Attachments/a.png': bytes('https://example.com/not-a-url-in-a-png.png') }, download);

    expect(asked).toEqual([]);
  });

  test('says what it could not fetch, and hands over the rest', async () => {
    const { download } = network(['https://example.com/gone.png']);
    const note = '![a](https://example.com/a.png) ![b](https://example.com/gone.png)';
    const { files, warnings } = await fetchRemote({ 'Notes/note.md': note }, download);

    expect(warnings).toEqual(['Could not fetch https://example.com/gone.png']);
    expect(text(files[REMOTE_LIST])).toBe('https://example.com/a.png\t/_remote/0.png\n');
  });

  test('hands over nothing at all where the note names no URL', async () => {
    const { download, asked } = network();
    const { files, warnings } = await fetchRemote({ 'Notes/note.md': '![a](Attachments/a.png)' }, download);

    expect(asked).toEqual([]);
    expect(files).toEqual({});
    expect(warnings).toEqual([]);
  });
});
