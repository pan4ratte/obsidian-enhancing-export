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

export function exec(cmd: string, options?: ExecOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    // Naming the encoding picks the overload that returns text rather than a Buffer.
    node_exec(cmd, { ...options, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        console.error(stdout, error);
        return;
      }
      if (stderr && stderr !== '') {
        reject(new Error(stderr));
        console.error(stdout, error);
        return;
      }
      // A developer's switch, not vault data — raw localStorage, not `App#saveLocalStorage`.
      if (stdout?.trim().length === 0 && '1' === localStorage.getItem('debug-plugin')) {
        console.log(stdout);
      }
      resolve(stdout);
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

/** `renderTemplate('Hi, ${name}', { name: 'John' })` returns `'Hi, John'`. */
export function renderTemplate(template: string, variables: Record<string, unknown> = {}): string {
  while (true) {
    try {
      const keys = Object.keys(variables).filter(isVarName);
      const values = keys.map(k => variables[k]);
      return new Function(...keys, `{ return \`${template.replaceAll('\\', '\\\\')}\` }`).bind(variables)(...values) as string;
    } catch (e: unknown) {
      if (e instanceof ReferenceError && e.message.endsWith('is not defined')) {
        const name = e.message.substring(0, e.message.indexOf(' '));
        const value =
          Object.keys(variables)
            .filter(n => n.toLowerCase() === name.toLowerCase())
            .map(n => variables[n])[0] ?? `\${${name}}`;
        variables[name] = value;
      } else {
        throw e;
      }
    }
  }
}

const isVarName = (str: string) => {
  if (typeof str !== 'string') {
    return false;
  }

  if (str.trim() !== str) {
    return false;
  }

  try {
    // Only the engine knows for certain what a legal identifier is. This is never called.
    new Function(str, 'var ' + str);
  } catch {
    return false;
  }
  return true;
};
