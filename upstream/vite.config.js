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
      // Chrome 99 / Safari 15.4 / Firefox 97, i.e. spring 2022. Anything above
      // this line that the browser lacks gets a fallback written for it.
      targets: {chrome: 99 << 16, safari: (15 << 16) | (4 << 8), firefox: 97 << 16},
    },
  },
  build: {cssMinify: 'lightningcss'},
  // vendor/checkout is a full clone of upstream (see scripts/build-upstream.mjs).
  // Its Jekyll docs are .html files full of `{% … %}` template syntax, which the
  // dependency scanner picks up through its default `**/*.html` glob and fails to
  // parse, so point it at our own entry and keep the watcher out of there too.
  optimizeDeps: {
    entries: ['index.html'],
  },
  server: {
    watch: {
      ignored: ['**/vendor/checkout/**'],
    },
  },
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
