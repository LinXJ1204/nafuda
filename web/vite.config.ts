import { defineConfig } from 'vite'

// Served from the domain root (Cloudflare Pages). Set VITE_BASE for a sub-path host.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: { fs: { allow: ['..'] } },
})
