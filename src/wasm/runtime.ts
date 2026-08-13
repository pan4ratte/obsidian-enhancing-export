/* Pandoc's wasm build, run in the process Obsidian is already in.
 *
 * The binary is a wasi reactor: it is initialized once and then answers `convert` and `query` calls. Everything it
 * reads and writes lives in a file system built here, in memory — it can open no real file, reach no network and start
 * no program, which is what `src/pandoc/engine.ts` gates the plugin's features on.
 */

import { ConsoleStdout, Directory, File, OpenFile, PreopenDirectory, WASI, type Inode } from '@bjorn3/browser_wasi_shim';
import type { PandocDefaults } from './defaults';

/** What the binary exports, past the wasi imports it is instantiated with. */
interface PandocExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  __wasm_call_ctors(): void;
  hs_init_with_rtsopts(argc: number, argv: number): void;
  convert(options: number, length: number): void;
  query(options: number, length: number): void;
}

export interface WasmRunResult {
  /** What pandoc wrote where a command line would have put it on screen. */
  stdout: string;
  stderr: string;
  /** Pandoc's own structured warnings, which the command line prints as text. */
  warnings: unknown[];
  /** Every file the run produced — the output, and anything `--extract-media` pulled out. */
  files: Record<string, Uint8Array>;
}

/** A run's input files, keyed by the path pandoc is to find them under. */
export type WasmFiles = Record<string, Uint8Array | string>;

const encoder = new TextEncoder();

/** Decoded as text where it is text, which is how pandoc's own output is read back. */
const decode = (data: Uint8Array): string => new TextDecoder('utf-8').decode(data);

/** The reserved names the binary uses for the streams a command line would give it. */
const STREAMS = ['stdin', 'stdout', 'stderr', 'warnings'];

export class PandocWasm {
  #exports: PandocExports;
  #root: Map<string, Inode>;
  /** The one directory the binary is given, so `create_entry_for_path` can make folders inside it. */
  #dir: Directory;

  private constructor(instance: WebAssembly.Instance, root: Map<string, Inode>, dir: Directory) {
    this.#exports = instance.exports as PandocExports;
    this.#root = root;
    this.#dir = dir;
  }

  /** Bring the runtime up on an already compiled module. Slow enough — seconds, with the first conversion — to do once. */
  static async load(module: WebAssembly.Module): Promise<PandocWasm> {
    const args = ['pandoc.wasm', '+RTS', '-H64m', '-RTS'];
    const root = new Map<string, Inode>();
    const preopen = new PreopenDirectory('/', root);
    // Pandoc is handed files for everything it has to say — see `run` — so the two streams a command line would read
    // are here only to catch what nothing else does.
    const fds = [
      new OpenFile(new File(new Uint8Array(), { readonly: true })),
      ConsoleStdout.lineBuffered(() => {}),
      ConsoleStdout.lineBuffered(line => console.warn(line)),
      preopen,
    ];
    const wasi = new WASI(args, [], fds, { debug: false });

    const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
    // The shim asks for a memory export it cannot see on the plain `Instance` type; this binary has one.
    wasi.initialize(instance as Parameters<typeof wasi.initialize>[0]);
    const exports = instance.exports as PandocExports;
    exports.__wasm_call_ctors();

    // The Haskell runtime takes its own arguments the way a `main` would have been handed them.
    const view = () => new DataView(exports.memory.buffer);
    const argcPtr = exports.malloc(4);
    view().setUint32(argcPtr, args.length, true);
    const argv = exports.malloc(4 * (args.length + 1));
    args.forEach((arg, i) => {
      const bytes = encoder.encode(arg);
      const ptr = exports.malloc(bytes.length + 1);
      new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
      view().setUint8(ptr + bytes.length, 0);
      view().setUint32(argv + 4 * i, ptr, true);
    });
    view().setUint32(argv + 4 * args.length, 0, true);
    const argvPtr = exports.malloc(4);
    view().setUint32(argvPtr, argv, true);
    exports.hs_init_with_rtsopts(argcPtr, argvPtr);

    return new PandocWasm(instance, root, preopen.dir);
  }

  /** A JSON string in the binary's own memory, which is how both entry points are given their options. */
  #write(value: unknown): [number, number] {
    const bytes = encoder.encode(JSON.stringify(value));
    const ptr = this.#exports.malloc(bytes.length);
    new Uint8Array(this.#exports.memory.buffer, ptr, bytes.length).set(bytes);
    return [ptr, bytes.length];
  }

  /** A file at `path`, with every folder on the way to it created first. */
  #addFile(path: string, data: Uint8Array | string, readonly: boolean) {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    const clean = path.replace(/^\/+/, '');
    const parts = clean.split('/');
    if (parts.length === 1) {
      this.#root.set(clean, new File(bytes, { readonly }));
      return;
    }
    // One folder at a time: the shim creates a single entry, and fails on a path whose parent is not there yet.
    for (let i = 1; i < parts.length; i += 1) {
      this.#dir.create_entry_for_path(parts.slice(0, i).join('/'), true);
    }
    // Already there, from an earlier file of the same name — that is the one to write into.
    const entry = this.#dir.create_entry_for_path(clean, false).entry ?? this.#find(parts);
    if (entry instanceof File) {
      entry.data = bytes;
      entry.readonly = readonly;
    }
  }

  /** The entry at `parts`, walked from the root. */
  #find(parts: string[]): Inode | undefined {
    let at: Inode | undefined = this.#dir;
    for (const part of parts) {
      at = at instanceof Directory ? at.contents.get(part) : undefined;
    }
    return at;
  }

  /** Every file in the tree, as flat paths. */
  #collect(dir: Map<string, Inode>, prefix: string, into: Record<string, Uint8Array>) {
    for (const [name, entry] of dir) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (entry instanceof Directory) {
        this.#collect(entry.contents, path, into);
      } else if (entry instanceof File && entry.data.length > 0) {
        into[path] = entry.data;
      }
    }
  }

  /**
   * One conversion. `defaults` is a pandoc defaults file as an object — see `commandToDefaults` — and `files` has to
   * carry every file it names: the binary can open nothing that is not put here first.
   */
  run(defaults: PandocDefaults, stdin?: string, files: WasmFiles = {}): WasmRunResult {
    this.#root.clear();

    const stdinFile = new File(stdin ? encoder.encode(stdin) : new Uint8Array(), { readonly: true });
    const stdout = new File(new Uint8Array(), { readonly: false });
    const stderr = new File(new Uint8Array(), { readonly: false });
    const warnings = new File(new Uint8Array(), { readonly: false });
    this.#root.set('stdin', stdinFile);
    this.#root.set('stdout', stdout);
    this.#root.set('stderr', stderr);
    this.#root.set('warnings', warnings);

    const given = new Set(STREAMS);
    for (const [path, data] of Object.entries(files)) {
      this.#addFile(path, data, true);
      given.add(path.replace(/^\/+/, ''));
    }

    // Pandoc writes into a file that is already there, so the output is put in place empty first.
    const output = defaults['output-file'];
    if (typeof output === 'string') {
      this.#addFile(output, new Uint8Array(), false);
    }

    const [ptr, length] = this.#write(defaults);
    this.#exports.convert(ptr, length);

    const produced: Record<string, Uint8Array> = {};
    this.#collect(this.#root, '', produced);
    for (const path of given) {
      delete produced[path];
    }

    let parsed: unknown[] = [];
    const raw = decode(warnings.data);
    if (raw) {
      try {
        parsed = JSON.parse(raw) as unknown[];
      } catch {
        // Warnings are a courtesy; a run that produced a file is not a failure because they could not be read.
      }
    }

    return { stdout: decode(stdout.data), stderr: decode(stderr.data), warnings: parsed, files: produced };
  }

  /** What the binary knows about itself: its version, the formats it reads and writes. */
  query<T>(options: Record<string, string>): T {
    this.#root.clear();
    const stdout = new File(new Uint8Array(), { readonly: false });
    const stderr = new File(new Uint8Array(), { readonly: false });
    this.#root.set('stdout', stdout);
    this.#root.set('stderr', stderr);

    const [ptr, length] = this.#write(options);
    this.#exports.query(ptr, length);
    return JSON.parse(decode(stdout.data)) as T;
  }

  get version(): string {
    return this.query<string>({ query: 'version' });
  }
}
