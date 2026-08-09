/*
 * The settings tab asks for pandoc's version every time it is opened, and each
 * ask used to cost a process. It is now looked up once per session per binary —
 * but only once it has actually answered, so that a user who goes off to install
 * pandoc is not told it is missing for the rest of the session.
 */

import { vi } from 'vitest';

const execMock = vi.fn<(cmd: string, options?: unknown) => Promise<string>>();

vi.mock('../src/utils', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('../src/utils')),
  exec: (cmd: string, options?: unknown) => execMock(cmd, options),
}));

import { getCachedPandocVersion } from '../src/pandoc';

const VERSION_OUTPUT = 'pandoc 3.1.11\nFeatures: +server +lua\n';

beforeEach(() => {
  execMock.mockReset();
  execMock.mockResolvedValue(VERSION_OUTPUT);
});

test('the binary is asked once and the answer reused', async () => {
  expect((await getCachedPandocVersion('/one/pandoc')).version).toBe('3.1.11');
  expect((await getCachedPandocVersion('/one/pandoc')).version).toBe('3.1.11');
  expect((await getCachedPandocVersion('/one/pandoc')).version).toBe('3.1.11');
  expect(execMock).toHaveBeenCalledTimes(1);
});

test('a different path is a different binary', async () => {
  await getCachedPandocVersion('/two/pandoc');
  expect(execMock).toHaveBeenCalledTimes(1);

  await getCachedPandocVersion('/three/pandoc');
  expect(execMock).toHaveBeenCalledTimes(2);

  // The first one is not what the cache holds any more, so it is asked again.
  await getCachedPandocVersion('/two/pandoc');
  expect(execMock).toHaveBeenCalledTimes(3);
});

test('a different environment is asked again', async () => {
  await getCachedPandocVersion('/four/pandoc', { PATH: '/usr/bin' });
  await getCachedPandocVersion('/four/pandoc', { PATH: '/usr/bin' });
  expect(execMock).toHaveBeenCalledTimes(1);

  await getCachedPandocVersion('/four/pandoc', { PATH: '/opt/bin' });
  expect(execMock).toHaveBeenCalledTimes(2);
});

test('a failed lookup is not cached, so the next open retries', async () => {
  execMock.mockRejectedValue(new Error('pandoc: not found'));

  await expect(getCachedPandocVersion('/five/pandoc')).rejects.toThrow('not found');
  await expect(getCachedPandocVersion('/five/pandoc')).rejects.toThrow('not found');
  expect(execMock).toHaveBeenCalledTimes(2);

  // Pandoc turns up mid-session; the very next ask sees it.
  execMock.mockResolvedValue(VERSION_OUTPUT);
  expect((await getCachedPandocVersion('/five/pandoc')).version).toBe('3.1.11');
  expect(execMock).toHaveBeenCalledTimes(3);

  // And from then on it is the cached answer.
  await getCachedPandocVersion('/five/pandoc');
  expect(execMock).toHaveBeenCalledTimes(3);
});

test('output with no version to parse is not cached either', async () => {
  execMock.mockResolvedValue('some other program\n');

  expect(await getCachedPandocVersion('/six/pandoc')).toBeNull();
  expect(await getCachedPandocVersion('/six/pandoc')).toBeNull();
  expect(execMock).toHaveBeenCalledTimes(2);
});
