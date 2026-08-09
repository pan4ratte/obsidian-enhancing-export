import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
  // `main.js` is built output and `typings/electron.d.ts` is a vendored upstream
  // dump — 670k of declarations that are not ours to bring into line.
  { ignores: ['main.js', 'coverage/', 'typings/electron.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Obsidian's own ruleset, which checks what a plugin is reviewed against
  // rather than what TypeScript can see.
  ...obsidianmd.configs.recommended,
  {
    // Both rulesets above include rules that ask the type checker rather than
    // just the syntax tree, and those need the project wired up.
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Everything, `.tsx` included. The components were excluded for as long as
    // the config had a `--ext .ts,.js` flag behind it, which is how they came to
    // be the half of the source nothing checked.
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
      },
    },
    rules: {
      // Formatting belongs to prettier (see .prettierrc), which is the only one
      // of the two that can also fix it. The core rules that used to say this —
      // indent, quotes, semi, linebreak-style — are deprecated in ESLint 10.
      'no-prototype-builtins': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript resolves names itself, and does it properly — it knows about
      // `declare global`, which this rule does not. Turning it off for typed
      // files is typescript-eslint's own advice.
      'no-undef': 'off',

      /*
       * Deferred, not dismissed. Obsidian's preset brings typescript-eslint's
       * type-checked rules with it, and this codebase predates them: what is
       * left is ten reports of solid's store and `JSON.parse` returning `any`
       * and spreading from there. Clearing them means typing those boundaries
       * properly, which is a change worth making on its own rather than
       * smuggling in behind a lint config. `no-unsafe-argument` and
       * `no-misused-promises` are done and enforced again.
       */
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    /*
     * The template engine. `renderTemplate` evaluates `${outputPath}` and the rest
     * as a real template literal, which is what the Function constructor is for —
     * the code is the plugin's own and the only names in scope are the variables
     * handed in. `isVarName` builds one purely to ask the engine whether a string
     * is a legal identifier, and never calls it. The console line and the raw
     * localStorage read are a developer's debug switch, off in normal use.
     *
     * These are exemptions the preset does not allow inline — `eslint-comments/
     * no-restricted-disable` blocks suppressing its safety rules from the source,
     * so the argument for them has to live here.
     */
    files: ['src/utils.ts'],
    rules: {
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'obsidianmd/rule-custom-message': 'off',
      'no-restricted-globals': 'off',
    },
  },
  {
    // The dev-only hot-reload shim. It is not shipped — `main.ts` only calls it
    // under `import.meta.env.DEV` — so the guidelines about what a released
    // plugin may touch do not apply to it.
    files: ['src/hmr.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'obsidianmd/rule-custom-message': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      // `let el!: HTMLDivElement` is assigned by solid through `ref={el}`, which
      // compiles to an assignment the rule cannot see. Every report of it in the
      // components is that pattern.
      'no-unassigned-vars': 'off',
    },
  },
  {
    // Jest's globals.
    files: ['tests/**/*.ts'],
    languageOptions: { globals: globals.jest },
  },
  {
    // The build and lint config are plain JS, outside the TypeScript project,
    // so the rules that need a type checker have nothing to ask.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Repository tooling, run from a terminal by a maintainer and never shipped.
    // Obsidian's guideline against logging is about a plugin filling a user's
    // console; a command-line script reporting what it rewrote is the opposite.
    files: ['scripts/**/*.{js,mjs,cjs}', 'version.mjs'],
    languageOptions: { globals: globals.node },
    rules: { 'obsidianmd/rule-custom-message': 'off' },
  }
);
