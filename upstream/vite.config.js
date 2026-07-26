import {fileURLToPath, URL} from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  resolve: {
    alias: {
      '@assets': `${src}/assets`,
      '@api': `${src}/lib/api`,
      '@store': `${src}/lib/store`,
      '@lib': `${src}/lib`,
      '@': src,
    },
  },
})
