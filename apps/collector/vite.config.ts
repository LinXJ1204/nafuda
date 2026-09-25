import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Collector app (nafuda.sololin.xyz). In dev, /api goes to a local server (npm run api in server/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { allow: ['../..'] },
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3310' },
  },
  preview: { proxy: { '/api': process.env.API_URL ?? 'http://localhost:3310' } },
  build: { chunkSizeWarningLimit: 1500 },
})
