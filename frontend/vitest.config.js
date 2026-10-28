import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Reuses the Vite settings (Vue plugin, '@/' alias) so tests import files the same way the app does.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Plain JavaScript for now; switch to 'jsdom' once component tests need a browser-like page
      environment: 'node',
      include: ['src/**/__tests__/*.spec.js'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url))
    }
  })
)
