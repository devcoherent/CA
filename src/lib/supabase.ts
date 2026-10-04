import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Only the public URL and anon (publishable) key are ever used in the browser.
// The service role key must NEVER appear in frontend code.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit flow so a magic link works even when opened on another device.
    flowType: 'implicit',
  },
})
