import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Grader console (nafuda-grader.sololin.xyz). In dev, /api goes to a local server (npm run api in server/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { allow: ['../..'] },
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:3310', changeOrigin: true } },
  },
  preview: { proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:3310', changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 1500 },
})
