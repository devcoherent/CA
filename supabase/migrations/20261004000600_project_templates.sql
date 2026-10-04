-- Default project templates. Admins can edit these in the app (Admin -> Templates).
-- This is app configuration, not test data, so it runs in production too.

insert into public.project_templates (key, name, description) values
  ('webflow_build', 'Webflow Build', 'Design and build a new Webflow website.'),
  ('seo_audit', 'SEO Audit', 'Technical and content SEO audit with a clear action plan.'),
  ('custom', 'Custom', 'Start from a blank project with the basic access steps.')
on conflict (key) do nothing;

with t as (select id from public.project_templates where key = 'webflow_build')
insert into public.template_items (template_id, kind, name, position, stage_name, access_key)
select t.id, v.kind::public.template_item_kind, v.name, v.position, v.stage_name, v.access_key::public.access_key
from t, (values
  ('stage', 'Discovery', 1, null, null),
  ('stage', 'Design', 2, null, null),
  ('stage', 'Development', 3, null, null),
  ('stage', 'QA', 4, null, null),
  ('stage', 'Launch', 5, null, null),
  ('task', 'Kickoff call', 1, 'Discovery', null),
  ('task', 'Sitemap and content plan', 2, 'Discovery', null),
  ('task', 'Home page design', 3, 'Design', null),
  ('task', 'Inner pages design', 4, 'Design', null),
  ('task', 'Style guide and components in Webflow', 5, 'Development', null),
  ('task', 'Build pages in Webflow', 6, 'Development', null),
  ('task', 'CMS setup', 7, 'Development', null),
  ('task', 'Cross-browser and mobile QA', 8, 'QA', null),
  ('task', 'Client review round', 9, 'QA', null),
  ('task', 'Connect domain and publish', 10, 'Launch', null),
  ('task', 'Post-launch checks (forms, analytics, redirects)', 11, 'Launch', null),
  ('access_step', 'Webflow', 1, null, 'webflow'),
  ('access_step', 'Domain / DNS', 2, null, 'domain_dns'),
  ('access_step', 'Google Tag Manager', 3, null, 'gtm'),
  ('access_step', 'Google Analytics 4', 4, null, 'ga4'),
  ('access_step', 'Google Search Console', 5, null, 'gsc'),
  ('access_step', 'Brand assets', 6, null, 'brand_assets')
) as v(kind, name, position, stage_name, access_key);

with t as (select id from public.project_templates where key = 'seo_audit')
insert into public.template_items (template_id, kind, name, position, stage_name, access_key)
select t.id, v.kind::public.template_item_kind, v.name, v.position, v.stage_name, v.access_key::public.access_key
from t, (values
  ('stage', 'Discovery', 1, null, null),
  ('stage', 'Technical audit', 2, null, null),
  ('stage', 'Content audit', 3, null, null),
  ('stage', 'Report', 4, null, null),
  ('stage', 'Handover', 5, null, null),
  ('task', 'Kickoff call and goals', 1, 'Discovery', null),
  ('task', 'Crawl the site', 2, 'Technical audit', null),
  ('task', 'Core Web Vitals review', 3, 'Technical audit', null),
  ('task', 'Indexing and sitemap review', 4, 'Technical audit', null),
  ('task', 'Keyword and content gap analysis', 5, 'Content audit', null),
  ('task', 'On-page review of key pages', 6, 'Content audit', null),
  ('task', 'Write the audit report', 7, 'Report', null),
  ('task', 'Walkthrough call', 8, 'Handover', null),
  ('access_step', 'Webflow', 1, null, 'webflow'),
  ('access_step', 'Domain / DNS', 2, null, 'domain_dns'),
  ('access_step', 'Google Tag Manager', 3, null, 'gtm'),
  ('access_step', 'Google Analytics 4', 4, null, 'ga4'),
  ('access_step', 'Google Search Console', 5, null, 'gsc')
) as v(kind, name, position, stage_name, access_key);

with t as (select id from public.project_templates where key = 'custom')
insert into public.template_items (template_id, kind, name, position, stage_name, access_key)
select t.id, v.kind::public.template_item_kind, v.name, v.position, v.stage_name, v.access_key::public.access_key
from t, (values
  ('stage', 'Discovery', 1, null, null),
  ('stage', 'In progress', 2, null, null),
  ('stage', 'Review', 3, null, null),
  ('stage', 'Done', 4, null, null),
  ('access_step', 'Webflow', 1, null, 'webflow')
) as v(kind, name, position, stage_name, access_key);
