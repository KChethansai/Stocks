import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Exact package-path matches: the old `includes('react')`
            // substring also caught lucide-react and @react-oauth/google,
            // silently disabling the vendor-ui branch below and pinning
            // icon + OAuth bytes to the critical vendor-react chunk.
            if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return 'vendor-react'
            if (id.includes('lucide-react') || id.includes('@react-oauth') || id.includes('motion') || id.includes('zustand') || id.includes('axios')) return 'vendor-ui'
          }
        }
      }
    }
  }
})
