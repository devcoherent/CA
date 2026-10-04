// Plain email template. No Deno or Node APIs here so it can be unit tested.

export interface EmailRow {
  subject: string
  heading: string | null
  body: string
  cta_label: string | null
  cta_path: string | null
}

export interface Brand {
  siteUrl: string
  accent: string
  supportEmail: string
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Absolute link for a path like "/client/projects/123". Never links off-site. */
export function ctaUrl(siteUrl: string, path: string | null): string {
  const base = siteUrl.replace(/\/+$/, '')
  if (!path || !path.startsWith('/') || path.startsWith('//')) return base + '/'
  return base + path
}

export function renderEmail(row: EmailRow, brand: Brand): { html: string; text: string } {
  const url = ctaUrl(brand.siteUrl, row.cta_path)
  const heading = escapeHtml(row.heading ?? row.subject)
  const paragraphs = row.body
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#0f1419">${escapeHtml(p)}</p>`)
    .join('')
  const label = escapeHtml(row.cta_label ?? 'Open the portal')
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e6ea;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-weight:600;font-size:16px;color:#0f1419">Coherent</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f1419">${heading}</h1>
${paragraphs}
<p style="margin:24px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${escapeHtml(brand.accent)};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px">${label}</a></p>
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#5b6670">Questions? Reply to this email or write to ${escapeHtml(brand.supportEmail)}.</p>
</td></tr></table></body></html>`
  const text = `${row.heading ?? row.subject}\n\n${row.body}\n\n${row.cta_label ?? 'Open the portal'}: ${url}\n\nQuestions? Write to ${brand.supportEmail}.`
  return { html, text }
}
