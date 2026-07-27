import {fileURLToPath, URL} from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // Chrome 99 / Safari 15.4 / Firefox 97, i.e. spring 2022. Everything
      // above this line that the browser lacks gets a fallback written for it.
      targets: {chrome: 99 << 16, safari: (15 << 16) | (4 << 8), firefox: 97 << 16},
    },
  },
  build: {cssMinify: 'lightningcss'},
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
