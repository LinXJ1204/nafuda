import { defineConfig } from 'vite'

// `base` is the GitHub Pages project path; override with VITE_BASE for other hosts.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/nafuda/',
  server: { fs: { allow: ['..'] } },
})
