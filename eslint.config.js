/* ESLint flat config — browser ES modules, no build step, pragmatic rules. */
export default [
  {
    files: ['js/**/*.js', 'tests/**/*.js', 'scripts/**/*.mjs', 'playwright.config.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly',
        sessionStorage: 'readonly', location: 'readonly', fetch: 'readonly', URL: 'readonly',
        URLSearchParams: 'readonly', CustomEvent: 'readonly', Blob: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
        crypto: 'readonly', console: 'readonly', FormData: 'readonly',
        caches: 'readonly', self: 'readonly', clients: 'readonly', Deno: 'readonly',
        test: 'readonly', describe: 'readonly', it: 'readonly', assert: 'readonly',
        process: 'readonly', Buffer: 'readonly', globalThis: 'readonly', Intl: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  { ignores: ['node_modules/', 'backend/functions/'] },
];
