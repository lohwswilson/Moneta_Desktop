import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte()
  ],
  resolve: {
    alias: {
      '$lib': path.resolve(import.meta.dirname, './src/lib')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://weeseng.dev8.ansis.com.sg',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
