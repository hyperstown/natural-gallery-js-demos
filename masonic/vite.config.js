import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      // Chrome 99 / Safari 15.4 / Firefox 97, i.e. spring 2022. Anything above
      // this line that the browser lacks gets a fallback written for it.
      targets: {chrome: 99 << 16, safari: (15 << 16) | (4 << 8), firefox: 97 << 16},
    },
  },
  build: {cssMinify: 'lightningcss'},
  // Keep in sync with compilerOptions.paths in jsconfig.json
  resolve: {
    alias: {
      '@assets': `${src}/assets`,
      '@api': `${src}/lib/api`,
      '@lib': `${src}/lib`,
      '@': src,
    },
  },
})
