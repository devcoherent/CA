/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { brandCss } from './src/styles/brand.ts'

/** Injects the brand tokens from src/styles/brand.ts as CSS variables before paint. */
function brandCssPlugin(): Plugin {
  return {
    name: 'coherent-brand-css',
    transformIndexHtml(html) {
      return html.replace('<!--brand-css-->', `<style id="brand-tokens">${brandCss()}</style>`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), brandCssPlugin()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, host: 'localhost' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    css: false,
  },
})
