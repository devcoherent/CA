/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /**
   * DEMO MODE (fake data, no Supabase). On only when VITE_DEMO_MODE=true AND either:
   *  - the dev server is running (`vite` / `npm run preview:demo`), or
   *  - an explicit `vite build --mode demo` preview build.
   * A normal production build (`npm run build`, mode "production") can never turn it on:
   * __DEMO__ is compiled to `false` and the demo client is never aliased in, so no demo code
   * or fake data reaches the bundle. CI verifies this (scripts/check-prod-bundle.mjs).
   */
  const demo = env.VITE_DEMO_MODE === 'true' && mode !== 'production' && mode !== 'test' && (command === 'serve' || mode === 'demo')

  return {
    plugins: [react(), tailwindcss(), brandCssPlugin()],
    define: { __DEMO__: JSON.stringify(demo) },
    resolve: {
      alias: [
        // In demo mode the real Supabase client is replaced by the in-memory mock.
        ...(demo ? [{ find: /^@\/lib\/supabase$/, replacement: fileURLToPath(new URL('./src/demo/supabaseDemo.ts', import.meta.url)) }] : []),
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    server: { port: 5173, host: 'localhost' },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
      css: false,
    },
  }
})
