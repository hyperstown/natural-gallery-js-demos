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
