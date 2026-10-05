/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** True only in demo mode (dev server or `vite build --mode demo` with VITE_DEMO_MODE=true). Always false in production. */
declare const __DEMO__: boolean
