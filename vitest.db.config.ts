import { defineConfig } from 'vitest/config'

// Database tests: run against a real Postgres with the migrations applied
// (local Supabase via `supabase start`, or any DB in TEST_DATABASE_URL).
export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})
