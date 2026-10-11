import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Proxies API calls to the local fraud-platform-api backend so the
    // browser sees same-origin requests in dev, sidestepping CORS entirely
    // rather than requiring CORS_ALLOWED_ORIGINS to track the Vite port.
    proxy: {
      // Wave 46: overridable so the Playwright end-to-end suite can point a `vite preview` at the real
      // backend it spawns (the session cookie only works same-origin, i.e. through this proxy).
      '/api': {
        target: process.env.FRAUDDETECT_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    // Allows the app to be reached through an ngrok tunnel for remote viewing.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
  },
})
