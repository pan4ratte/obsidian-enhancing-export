import { ExecOptions, exec as node_exec } from 'child_process';
import process from 'process';

export type PlatformKey = typeof process.platform | '*';

export type PlatformValue<T> = { [k in PlatformKey]?: T };

export function setPlatformValue<T>(obj: PlatformValue<T>, value: T, platform?: PlatformKey | PlatformKey[]): PlatformValue<T> {
  if (typeof value === 'string' && value.trim() === '') {
    value = undefined;
  }

  if (platform instanceof Array) {
    return platform.reduce((o, p) => setPlatformValue(o, value, p), obj);
  }

  platform ??= process.platform;

  return {
    ...(obj ?? {}),
    [platform]: value,
  };
}

export function getPlatformValue<T>(obj: PlatformValue<T>, platform?: PlatformKey): T {
  obj ??= {};
  const val = obj[platform ?? process.platform];
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

export function exec(cmd: string, options?: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    // Naming the encoding picks the overload that returns text rather than a Buffer.
    node_exec(cmd, { ...options, encoding: 'utf8' }, (error, stdout, stderr) => {
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
