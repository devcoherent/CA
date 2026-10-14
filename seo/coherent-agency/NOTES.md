# Coherent Agency — GSC / SEO notes

## Site facts
- Webflow site ID: `626c2242e24b7000f6241060`
- Default domain: `coherent.agency` (non-www). www and the old `webeight.studio` / `webeight.work` domains 301 to it.
- GSC property: `https://www.coherent.agency/` (URL-prefix, www only). No Domain property; no DNS access.
- CMS paths: blog posts `/post/<slug>`, case studies `/case-study/<slug>`, services `/services/<slug>`.
- `/blog-category/*` template is not published.
- Webflow 301 list: original export `301-redirects-2026-10-14.csv`; cleaned replacement `301-redirects-import-2026-10-14.csv` (24 rules, no chains/loops/404 targets). The API cannot read the live list; ask for a fresh export after import.

## Issues log (2026-10-14)
1. **Page with redirect (20)**: 19 are www → non-www, which is normal. `/app` redirects to an external page. Closed.
2. **Redirect error (2)**: `/blog-category/webflow` and `/post/building-a-brand-...-2023`. Both last crawled 2026-06-29. Fix: clean up the 301 list, publish, then Validate Fix.
   - Cleaned 301 list: fixed malformed target (missing `/`), leading space, 2 chains, 3 rules pointing at 404s; added `/blog/(.*)` → `/post/%1` and `/case-studies-tags/(.*)`, `/blog-category/(.*)` wildcards.
   - Schema URL fixed on the post `building-a-brand-...-2026` (CMS item `64a80bfadb6f0b019acb4e95`). Staged on 2026-10-14.
3. **Excluded by noindex (1)**: `/contact-us`. The cause was Sitemap indexing turned OFF, which adds noindex. Sadman turned it ON on 2026-10-14 (verified via MCP). Utility-page check and Validate Fix were skipped by choice.
4. **Not found 404 (1)**: `/case-study/veptos` is a draft CMS item that was kept unpublished on purpose. Decision: 301 to `/webflow-portfolio` (added to the import CSV). Note: if it is published later, fix the `what-we-do` field (it holds the medical-research copy) and the staging links in the body first.

5. **Duplicate, Google chose different canonical (12)**: from crawls made before 2026-08 while the global canonical was still www. The global canonical is now `https://coherent.agency`. Closed.
6. **Crawled, not indexed (7)**: `/blog?q={search_term_string}` came from the Home schema SearchAction. The Home schema was replaced manually by Sadman on 2026-10-14 (verified: no SearchAction, no www). Webflow MCP gets a 403 when writing page schema, so page-schema edits must be done by hand. Remaining: Blog page schema still lists the `building-a-brand-...-2023` URL (low priority, redirect exists). A/B testing post is LIVE (last published Jun 29) but its CMS status is Draft, so staged changes (incl. the schema fix) will not go live until the item is set to publish. Keep it; no redirect. Vlorish (354 words) and OM Digital (378 words) are thin and need more content. The other URLs are old www crawls.

## Cleanup done 2026-10-14 (staged, not published)
- CMS URL cleanup across 75 items / 82 fields. Verified with a script: 0 leftover patterns, 0 mismatches, 0 unintended changes.
  - Posts (43): schema `coherent.agency/blog/` → `/post/`. One post-body had 5 `/blog/` links, also fixed.
  - Services (3): schema `www.coherent.agency` → `coherent.agency`.
  - Case studies (29): `coherent-agency.webflow.io` links → relative; www links → non-www. 7 of these items are archived and 1 is a draft.
- Contact page footer script: thank-you URL changed to non-www.

## Open findings
- Contact page footer script uses `preventDefault()` + `window.open`. It may block the Webflow form submission. Not verified.
- `/blog-tags/*` template is published and indexable, so its pages may be thin. Revisit.
- Static pages (Designer content) were not scanned for www or staging links; the Data API cannot read Designer content.
