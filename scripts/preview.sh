#!/usr/bin/env bash
# One-command local preview: local Supabase + seed data + the app on http://localhost:5173
# Usage: npm run preview:local
# Needs Docker running. Uses the Supabase CLI on PATH, or `npx supabase` if not installed.
# Writes .env.development.local (local-only keys); never touches .env.local.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop (or dockerd) and try again." >&2
  exit 1
fi

if command -v supabase >/dev/null 2>&1; then SB=(supabase); else SB=(npx --yes supabase); fi

echo "→ Starting local Supabase (first run downloads images, a few minutes)…"
"${SB[@]}" start -x studio,imgproxy,vector,logflare,postgres-meta,supavisor,edge-runtime

echo "→ Resetting the database with seed data…"
"${SB[@]}" db reset

STATUS="$("${SB[@]}" status -o env)"
API_URL="$(printf '%s\n' "$STATUS" | sed -n 's/^API_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
ANON_KEY="$(printf '%s\n' "$STATUS" | sed -n 's/^ANON_KEY="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "Could not read API_URL / ANON_KEY from 'supabase status'." >&2
  exit 1
fi
cat > .env.development.local <<ENV
# Written by scripts/preview.sh for local preview only. Safe to delete.
VITE_SUPABASE_URL=$API_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
ENV

cat <<MSG

  Preview ready → http://localhost:5173
  Log in with "Developer login" on /login. Password for everyone: Password123!
    Admin   will@coherent.test        Team  sadman@coherent.test / ashik@coherent.test
    Client  maya@acmebakery.test      Client leo@northwind.test
  Magic-link emails: http://127.0.0.1:54324  (Mailpit)
  Screenshots of every screen (no backend needed): npm run screenshots

MSG
exec npx vite --port 5173 --host localhost --strictPort
