import { Platform } from 'obsidian';
import { currentPlatform } from './platform';

/**
 * The platforms a setting can be given a value of its own on: node's own names for the desktops, which is what vaults
 * have stored since before there was a phone to run on, plus one for each phone.
 */
export type PlatformKey = NodeJS.Platform | 'ios' | 'android' | '*';

export type PlatformValue<T> = { [k in PlatformKey]?: T };

export function setPlatformValue<T>(obj: PlatformValue<T>, value: T, platform?: PlatformKey | PlatformKey[]): PlatformValue<T> {
  if (typeof value === 'string' && value.trim() === '') {
    value = undefined;
  }

  if (platform instanceof Array) {
    return platform.reduce((o, p) => setPlatformValue(o, value, p), obj);
  }

  platform ??= currentPlatform();

  return {
    ...(obj ?? {}),
    [platform]: value,
  };
}

export function getPlatformValue<T>(obj: PlatformValue<T>, platform?: PlatformKey): T {
  obj ??= {};
  const val = obj[platform ?? currentPlatform()];
  const all = obj['*'];
  if (all && typeof all === 'object') {
    return Object.assign({}, all, val);
  }
  return val ?? all;
}

export interface ExecResult {
  stdout: string;
  /** What the program said on the side. Pandoc warns there and still writes the file, so it is not a failure. */
  stderr: string;
}

/** Run a command. Node's, so only where there is one — the wasm engine is what a phone converts with. */
export async function exec(cmd: string, options?: { cwd?: string; env?: Record<string, string> }): Promise<ExecResult> {
  // Obsidian's own check, not this plugin's `isDesktop`: a phone being emulated is given no node to run anything
  // with, so there is nothing here to run either. See `isDesktop`.
  if (!Platform.isDesktop) {
    throw new Error('There is no Pandoc to run on this device — see the engine setting.');
  }
  const { exec: run } = await import('child_process');
  return await new Promise((resolve, reject) => {
    // Naming the encoding picks the overload that returns text rather than a Buffer.
    run(cmd, { ...options, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(stdout, stderr, error);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * A deep copy of plain data, typed as what went in. `JSON.parse` returns `any`,
 * and spreading that hands `any` on to everything downstream.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function trimQuotes(s: string) {
  return (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.substring(1, s.length - 1) : s;
}

export { renderTemplate, TemplateError } from './template';
