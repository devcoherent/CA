# Coherent Agency — GSC / SEO notes

## Site facts
- Webflow site ID: `626c2242e24b7000f6241060`
- Default domain: `coherent.agency` (non-www). www and the old `webeight.studio` / `webeight.work` domains 301 to it.
- GSC property: `https://www.coherent.agency/` (URL-prefix, www only). No Domain property; no DNS access.
- CMS paths: blog posts `/post/<slug>`, case studies `/case-study/<slug>`, services `/services/<slug>`.
- `/blog-category/*` template is not published.
- Webflow 301 list (as of 2026-10-14): `301-redirects-2026-10-14.csv`. The API cannot read it; ask for a fresh export.

## Issues log (2026-10-14)
1. **Page with redirect (20)**: 19 are www → non-www, which is normal. `/app` redirects to an external page. Closed.
2. **Redirect error (2)**: `/blog-category/webflow` and `/post/building-a-brand-...-2023`. Both last crawled 2026-06-29. Fix: clean up the 301 list, publish, then Validate Fix.
   - Schema URL fixed on the post `building-a-brand-...-2026` (CMS item `64a80bfadb6f0b019acb4e95`). Staged on 2026-10-14.

## Open findings
- 43 of 45 blog posts have `schema-markup` URLs using `/blog/<slug>` instead of `/post/<slug>`.
- Services schema uses `https://www.coherent.agency/...` (non-canonical host).
- Some case-study bodies link to `coherent-agency.webflow.io` (staging domain).
- Post `how-to-use-ai-generated-seo-website-layout` links to `/post/stop-using-lorem-ipsum`, which redirects.
