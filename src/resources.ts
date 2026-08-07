// The loader in <root>/vite.config.ts emits `Uint8Array.from(atob(...))`, so every
// embedded resource is backed by a plain ArrayBuffer it owns in full.
type Resource = { default: Uint8Array<ArrayBuffer> };

const embed = (dir: string, res: Record<string, Resource>) =>
  [dir, Object.entries(res).map(([k, m]) => [k.substring(dir.length + 3), m.default] as const)] as const;

// The embedded resource
export default [
  // For other file types, the Loader must be configured in the <root>/vite.config.ts.
  embed('lua', import.meta.glob<Resource>('../lua/*.lua', { eager: true })),
  embed('textemplate', import.meta.glob<Resource>('../textemplate/*.{tex,sty}', { eager: true })),
];
