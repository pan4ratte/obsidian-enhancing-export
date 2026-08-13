/* Where a file on the machine stands in the wasm build's own file system.
 *
 * The vault is laid out as it really is, so a note that links to `../Attachments/a.png` finds it exactly where it
 * would have. Anything from outside the vault — a reference document in Documents, a `.csl` somewhere else — has no
 * such place, and is given one under a folder of its own.
 */

import { basename, dirname, normalize } from '../system/paths';

/** The folder anything from outside the vault is put under. */
const EXTERNAL = '_external';

export class VirtualPaths {
  #vault: string;
  /** Whether paths are compared letter for letter — they are not on the platform that writes `C:/`. */
  #caseSensitive: boolean;
  /** Folders from outside the vault, each given a numbered home so two files of the same name stay apart. */
  #external = new Map<string, string>();
  /** Every mapping made, so an output can be traced back to where it belongs. */
  #back = new Map<string, string>();

  constructor(vaultDir: string) {
    this.#vault = normalize(vaultDir);
    this.#caseSensitive = !/^[a-zA-Z]:/.test(this.#vault);
  }

  #compare(path: string): string {
    return this.#caseSensitive ? path : path.toLowerCase();
  }

  /** The vault path of `real`, or nothing when it lies outside the vault. */
  inVault(real: string): string | undefined {
    const path = normalize(real);
    const prefix = `${this.#compare(this.#vault)}/`;
    return this.#compare(path).startsWith(prefix) ? path.substring(this.#vault.length + 1) : undefined;
  }

  /** Where a folder is put. A folder outside the vault gets one of its own, and keeps it. */
  directory(real: string): string {
    const path = normalize(real);
    const inside = this.inVault(path);
    if (inside !== undefined) {
      return this.#remember(path, inside);
    }
    if (this.#compare(path) === this.#compare(this.#vault)) {
      return this.#remember(path, '.');
    }
    const known = this.#external.get(this.#compare(path));
    if (known) {
      return known;
    }
    const home = `${EXTERNAL}/${this.#external.size}`;
    this.#external.set(this.#compare(path), home);
    return this.#remember(path, home);
  }

  /** Where a file is put — beside the other files of the folder it came from. */
  file(real: string): string {
    const path = normalize(real);
    const inside = this.inVault(path);
    if (inside !== undefined) {
      return this.#remember(path, inside);
    }
    return this.#remember(path, `${this.directory(dirname(path))}/${basename(path)}`);
  }

  #remember(real: string, virtual: string): string {
    this.#back.set(virtual, real);
    return virtual;
  }

  /**
   * The file `virtual` came from, or where it belongs when it is new — pandoc writing `media/a.png` under a folder it
   * was given puts it beside the folder's real counterpart.
   */
  toReal(virtual: string): string | undefined {
    const known = this.#back.get(virtual);
    if (known) {
      return known;
    }
    const at = virtual.lastIndexOf('/');
    if (at === -1) {
      return undefined;
    }
    const parent = this.toReal(virtual.substring(0, at));
    return parent === undefined ? undefined : `${parent}/${virtual.substring(at + 1)}`;
  }
}
