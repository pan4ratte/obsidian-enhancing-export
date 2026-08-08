// The loader in <root>/vite.config.ts emits `Uint8Array.from(atob(...))`, so every
// embedded resource is backed by a plain ArrayBuffer it owns in full.
type Resource = { default: Uint8Array<ArrayBuffer> };

/**
 * `dir` is where the files are written inside the plugin folder, which is not
 * where they are kept in the repository: the bundled filters are sources, and
 * live with the rest of the catalogue in `lua-filters/`, while `lua/` in a
 * plugin folder is written to at runtime — by `releaseResources` and by the
 * store. Only the file name survives the glob, so the two are free to differ.
 */
const embed = (dir: string, res: Record<string, Resource>) =>
  [dir, Object.entries(res).map(([k, m]) => [k.substring(k.lastIndexOf('/') + 1), m.default] as const)] as const;

/**
 * The lua filters the plugin ships with, by file name. `releaseResources` rewrites
 * every one of them on load, so a downloaded filter that took one of these names
 * would be silently reverted on the next start — the store refuses them instead.
 * Same glob as the embed below, so Vite resolves it once and nothing is embedded
 * twice.
 */
export const BUNDLED_LUA_FILES: readonly string[] = Object.keys(
  import.meta.glob<Resource>('../lua-filters/bundled/*.lua', { eager: true })
).map(k => k.substring(k.lastIndexOf('/') + 1));

// The embedded resource
export default [
  // For other file types, the Loader must be configured in the <root>/vite.config.ts.
  embed('lua', import.meta.glob<Resource>('../lua-filters/bundled/*.lua', { eager: true })),
  embed('textemplate', import.meta.glob<Resource>('../textemplate/*.{tex,sty}', { eager: true })),
];
