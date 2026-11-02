// ESLint finds likely bugs (unused variables, misspelt names, Vue template mistakes).
// Based on the create-vue defaults from class, without Oxlint, which we don't use.
// Formatting (quotes, spacing) is Prettier's job, so skipFormatting turns those ESLint rules off.
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from 'eslint-config-prettier/flat'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}']
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*']
  },

  // Config files (including playwright.config.js) and the Playwright tests run in Node, not the browser
  {
    files: ['*.config.js', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } }
  },

  skipFormatting
])
