import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The built app is served by the local FastAPI server. In development, /api is proxied to it.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  build: { assetsInlineLimit: 0 },
})
