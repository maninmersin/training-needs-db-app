import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'tools/**', 'coverage/**', 'db/archive/**', '**/*.ts', '**/*.tsx']
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, __DEV__: 'readonly', global: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Existing code predates linting: surface issues without blocking
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': 'warn',
      'no-case-declarations': 'warn',
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'db/**/*.js', 'tests/**/*.mjs', '*.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node }
  },
  {
    files: ['src/**/*.test.{js,jsx}', 'src/**/__tests__/**'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } }
  }
]
