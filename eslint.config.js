import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  // The .tsx components have never been linted (the removed `--ext .ts,.js` flag
  // excluded them, and the prettier scripts still do); typescript-eslint's own
  // configs would otherwise pull them in.
  { ignores: ['main.js', 'coverage/', '**/*.tsx'] },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  {
    // Same scope the removed `--ext .ts,.js` flag had. The .tsx components have
    // never been linted (nor covered by the prettier scripts) and are not clean.
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
      },
    },
    rules: {
      'indent': ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'no-prototype-builtins': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
