// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output, and Supabase edge functions, which are Deno: they import by URL and
    // resolve against Deno's module graph, so Node resolution reports every import broken.
    ignores: ['dist/*', 'supabase/functions/**']
  },
  {
    // Repo tooling runs in Node as CommonJS, where __dirname and require are defined.
    files: ['scripts/**/*.cjs', '*.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly', require: 'readonly', module: 'writable', process: 'readonly' } }
  },
  {
    // A test may call a hook from a harness function on purpose; that is what is under test.
    files: ['tests/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' }
  }
]);
