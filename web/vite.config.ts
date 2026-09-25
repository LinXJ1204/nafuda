import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Two pages: the consumer app at / and the grader console at /grader/. Both use hash routes,
// so any static host works without rewrites. Set VITE_BASE for a sub-path host.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: { fs: { allow: ['..'] } },
  build: {
    rollupOptions: {
      input: {
        consumer: page('index.html'),
        grader: page('grader/index.html'),
      },
    },
  },
})
