import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { DEFAULT_APP_BASE, normalizeAppBase } from './appBase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendPublicDir = path.resolve(__dirname, '../backend/public')

/** @param {string} id */
function vendorChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('maplibre-gl') || id.includes('react-map-gl')) return 'map-vendor'
  if (id.includes('react-day-picker')) return 'calendar-vendor'
  if (id.includes('qrcode')) return 'qrcode-vendor'
  if (id.includes('@tanstack/react-query')) return 'query-vendor'
  if (id.includes('react-router') || id.includes('react-dom')) return 'react-vendor'
  if (id.includes('socket.io-client')) return 'socket-vendor'
  if (id.includes('axios') || id.includes('zustand')) return 'utils-vendor'
  return 'vendor'
}

// https://vite.dev/config/
// `base` dari VITE_APP_BASE (.env) — app guna import.meta.env.BASE_URL (src/lib/baseUrl.js).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const base = normalizeAppBase(env.VITE_APP_BASE || DEFAULT_APP_BASE)

  return {
    plugins: [react()],
    base,
    build: {
      outDir: backendPublicDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: vendorChunk,
        },
      },
      chunkSizeWarningLimit: 1100,
    },
  }
})
