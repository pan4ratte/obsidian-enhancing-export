/* Paths as strings, without node.
 *
 * `path` is node's, and there is none on a phone. Everything the plugin does with a path is a handful of string
 * operations on a path written with forward slashes, so they are written out here.
 */

/** Forward slashes, no trailing one — the shape everything is compared and joined in. */
export const normalize = (path: string): string => path.replaceAll('\\', '/').replace(/\/+$/, '');

export const basename = (path: string): string => normalize(path).split('/').pop() ?? '';

export const dirname = (path: string): string => {
  const at = normalize(path).lastIndexOf('/');
  return at <= 0 ? '' : normalize(path).substring(0, at);
};

/** The extension, dot and all, or nothing where the name has none. A leading dot is a name, not an extension. */
export const extname = (path: string): string => {
  const name = basename(path);
  const at = name.lastIndexOf('.');
  return at <= 0 ? '' : name.substring(at);
};

/** The file name without its extension. */
export const stem = (path: string): string => {
  const name = basename(path);
  return name.substring(0, name.length - extname(name).length);
};

/** Whether a path stands on its own rather than against a folder. */
export const isAbsolute = (path: string): boolean => /^([a-zA-Z]:)?[\\/]/.test(path);

/** `path` as read from `from`, with `.` and `..` walked out of it. */
export const resolve = (from: string, path: string): string => {
  const whole = isAbsolute(path) ? normalize(path) : `${normalize(from)}/${normalize(path)}`;
  const parts: string[] = [];
  for (const part of whole.split('/')) {
    if (part === '.') {
      continue;
    }
    // A `..` that has nothing left to climb is kept, so a path is never quietly turned into another one.
    if (part === '..' && parts.length > 0 && parts[parts.length - 1] !== '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
};

/** `to` as named from `from` — how the import command says where the images went, from the folder it runs in. */
export const relativeTo = (from: string, to: string): string => {
  const here = normalize(from).split('/');
  const there = normalize(to).split('/');
  let shared = 0;
  while (shared < here.length && shared < there.length && here[shared] === there[shared]) {
    shared += 1;
  }
  const up = Array.from({ length: here.length - shared }, () => '..');
  return [...up, ...there.slice(shared)].join('/') || '.';
};
