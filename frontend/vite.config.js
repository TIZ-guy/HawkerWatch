import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // '@/' means frontend/src/, so imports like '@/utils/time.js' work from any folder
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    // Sends /api requests to the backend, so the browser treats the API as the same site
    // and the login cookie works without any cross-site setup.
    proxy: { '/api': 'http://localhost:3000' }
  }
})
