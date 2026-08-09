// `describe`/`test`/`expect` are global under `globals: true` in vitest.config.ts. A reference resolves the package
// subpath that carries their declarations, which naming it in tsconfig's `types` could not — see the note there.
/// <reference types="vitest/globals" />
