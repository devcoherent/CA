// Supabase Edge Function: sends queued rows from public.email_outbox through Resend.
//
// Called by the database (pg_net trigger on new emails, and a pg_cron safety net),
// never by the browser. Deploy with: supabase functions deploy send-email --no-verify-jwt
// It is protected by a shared secret header instead of a user JWT.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY        Resend API key
//   EMAIL_FROM            e.g. "Coherent <updates@coherent.agency>" (domain verified in Resend)
//   EMAIL_WEBHOOK_SECRET  long random string, same value as private.app_settings.email_webhook_secret
//   SITE_URL              https://app.coherent.agency
//   EMAIL_DAILY_CAP       optional, default 90 (Resend free tier is 100/day; Auth emails share it)
//   SUPPORT_EMAIL         optional, default hello@coherent.agency
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.

import { renderEmail, type EmailRow } from './template.ts'

interface OutboxRow extends EmailRow {
  id: string
  to_email: string
  attempts: number
}

const env = (k: string, fallback = '') => Deno.env.get(k) ?? fallback

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Tiny PostgREST client using the service role (server-side only). No dependencies. */
function rest() {
  const url = env('SUPABASE_URL').replace(/\/+$/, '')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) })
      if (!res.ok) throw new Error(`${fn}: HTTP ${res.status} ${await res.text()}`)
      return (await res.json()) as T
    },
    async update(id: string, patch: Record<string, unknown>): Promise<void> {
      const res = await fetch(`${url}/rest/v1/email_outbox?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`update: HTTP ${res.status} ${await res.text()}`)
    },
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = env('EMAIL_WEBHOOK_SECRET')
  if (!secret || !timingSafeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return json({ error: 'unauthorized' }, 401)
  }
  const apiKey = env('RESEND_API_KEY')
  const from = env('EMAIL_FROM')
  if (!apiKey || !from) return json({ error: 'email_not_configured' }, 500)

  const db = rest()
  const cap = Number(env('EMAIL_DAILY_CAP', '90')) || 90
  let batch: OutboxRow[]
  try {
    const sentToday = await db.rpc<number>('emails_sent_today')
    const remaining = cap - sentToday
    if (remaining <= 0) return json({ sent: 0, reason: 'daily_cap_reached' })
    batch = await db.rpc<OutboxRow[]>('claim_email_batch', { p_limit: Math.min(remaining, 20) })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }

  const brand = { siteUrl: env('SITE_URL', 'https://app.coherent.agency'), accent: '#2f5bff', supportEmail: env('SUPPORT_EMAIL', 'hello@coherent.agency') }
  const resendUrl = env('RESEND_API_URL', 'https://api.resend.com/emails')
  let sent = 0
  let failed = 0
  let rateLimited = false

  for (const row of batch) {
    if (rateLimited) {
      await db.update(row.id, { status: 'queued' })
      continue
    }
    const { html, text } = renderEmail(row, brand)
    try {
      const res = await fetch(resendUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': row.id },
        body: JSON.stringify({ from, to: [row.to_email], subject: row.subject, html, text }),
      })
      if (res.ok) {
        await db.update(row.id, { status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        sent++
      } else {
        const detail = (await res.text()).slice(0, 500)
        if (res.status === 429) rateLimited = true
        await db.update(row.id, { status: row.attempts >= 5 ? 'failed' : 'queued', last_error: `HTTP ${res.status}: ${detail}` })
        failed++
      }
    } catch (e) {
      await db.update(row.id, { status: row.attempts >= 5 ? 'failed' : 'queued', last_error: String(e).slice(0, 500) })
      failed++
    }
  }
  return json({ sent, failed, rateLimited })
})
