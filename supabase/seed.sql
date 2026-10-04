-- LOCAL TEST DATA ONLY. Never run this against production.
-- `supabase db reset` runs it automatically after the migrations.
--
-- Logins (dev password login is only shown when running `npm run dev`):
--   Admin   will@coherent.test        Password123!
--   Team    sadman@coherent.test      Password123!  (assigned to project 1 only)
--   Team    ashik@coherent.test       Password123!  (assigned to both projects)
--   Client  maya@acmebakery.test      Password123!  (Acme Bakery -> Webflow Build)
--   Client  leo@northwind.test        Password123!  (Northwind Outdoors -> SEO Audit)
--   New client (not linked yet)  newclient@freshco.test  Password123!
--   Pending team signup          pending@coherent.test   Password123!

create or replace function pg_temp.create_user(p_id uuid, p_email text, p_meta jsonb)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, p_meta, now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
  return p_id;
end;
$$;

-- Staff are invited first, so the signup trigger gives them their role.
insert into public.staff_invites (email, role) values
  ('will@coherent.test', 'admin'),
  ('sadman@coherent.test', 'team'),
  ('ashik@coherent.test', 'team');

select pg_temp.create_user('a0000000-0000-4000-8000-000000000001', 'will@coherent.test', '{"full_name":"Will"}');
select pg_temp.create_user('a0000000-0000-4000-8000-000000000002', 'sadman@coherent.test', '{"full_name":"Sadman"}');
select pg_temp.create_user('a0000000-0000-4000-8000-000000000003', 'ashik@coherent.test', '{"full_name":"Ashik"}');
-- Clients sign up through the client form (company_name in metadata).
select pg_temp.create_user('c0000000-0000-4000-8000-000000000001', 'maya@acmebakery.test', '{"full_name":"Maya Chen","company_name":"Acme Bakery"}');
select pg_temp.create_user('c0000000-0000-4000-8000-000000000002', 'leo@northwind.test', '{"full_name":"Leo Martins","company_name":"Northwind Outdoors"}');
select pg_temp.create_user('c0000000-0000-4000-8000-000000000003', 'newclient@freshco.test', '{"full_name":"Nina Fresh","company_name":"FreshCo"}');
-- A team signup that nobody invited: stays pending.
select pg_temp.create_user('a0000000-0000-4000-8000-000000000009', 'pending@coherent.test', '{"full_name":"Pat Pending"}');

update public.profiles set timezone = 'Asia/Dhaka' where email in ('sadman@coherent.test', 'ashik@coherent.test');
update public.profiles set timezone = 'Europe/London' where email = 'will@coherent.test';

-- Organizations
insert into public.organizations (id, name, bio, billing_email, timezone) values
  ('b0000000-0000-4000-8000-000000000001', 'Acme Bakery', 'Family bakery with three shops in Bristol.', 'accounts@acmebakery.test', 'Europe/London'),
  ('b0000000-0000-4000-8000-000000000002', 'Northwind Outdoors', 'Outdoor gear for hikers and climbers.', 'billing@northwind.test', 'America/New_York');

update public.profiles set org_id = 'b0000000-0000-4000-8000-000000000001', timezone = 'Europe/London'
  where id = 'c0000000-0000-4000-8000-000000000001';
update public.profiles set org_id = 'b0000000-0000-4000-8000-000000000002', timezone = 'America/New_York'
  where id = 'c0000000-0000-4000-8000-000000000002';

-- Act as Will (admin) inside the block so projects are created through the real RPC.
do $$
declare
  v_p1 uuid;
  v_p2 uuid;
  v_task uuid;
begin
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

  -- Project 1: Acme Bakery website (Webflow Build). Not kicked off yet; Webflow access still pending.
  select id into v_p1 from public.create_project_from_template(
    'b0000000-0000-4000-8000-000000000001', 'Acme Bakery website', 'webflow_build',
    current_date + 3, current_date + 60,
    array['a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003']::uuid[]
  );
  update public.projects
  set webvizio_url = 'https://app.webvizio.com/', staging_url = 'https://acme-bakery.webflow.io'
  where id = v_p1;
  update public.access_steps set status = 'provided', value_text = 'acmebakery.co.uk',
    fields = '{"registrar":"Namecheap"}', provided_by = 'client'
  where project_id = v_p1 and key = 'domain_dns';
  update public.access_steps set status = 'skipped', note = 'Shared with Sadman by email on Monday', provided_by = 'client'
  where project_id = v_p1 and key = 'ga4';
  update public.project_stages set due_date = current_date + 10 where project_id = v_p1 and name = 'Discovery';
  update public.project_stages set due_date = current_date + 25 where project_id = v_p1 and name = 'Design';
  update public.project_stages set due_date = current_date + 45 where project_id = v_p1 and name = 'Development';

  -- Project 2: Northwind SEO audit. Kicked off, in the Technical audit stage.
  select id into v_p2 from public.create_project_from_template(
    'b0000000-0000-4000-8000-000000000002', 'Northwind SEO audit', 'seo_audit',
    current_date - 14, current_date + 21,
    array['a0000000-0000-4000-8000-000000000003']::uuid[]
  );
  update public.projects set staging_url = 'https://northwind-outdoors.webflow.io', created_at = now() - interval '15 days'
  where id = v_p2;
  update public.access_steps set status = 'verified', value_text = 'northwind-outdoors', provided_by = 'client'
  where project_id = v_p2 and key = 'webflow';
  update public.access_steps set status = 'provided', value_text = 'GTM-NW12345', provided_by = 'client'
  where project_id = v_p2 and key = 'gtm';
  update public.access_steps set status = 'provided', value_text = '345678901', provided_by = 'admin'
  where project_id = v_p2 and key = 'ga4';
  update public.projects set kickoff_confirmed_at = now() - interval '13 days',
    kickoff_confirmed_by = 'c0000000-0000-4000-8000-000000000002', status = 'in_progress'
  where id = v_p2;
  update public.project_stages set status = 'done', due_date = current_date - 7
  where project_id = v_p2 and name = 'Discovery';
  update public.project_stages set status = 'active', due_date = current_date + 5
  where project_id = v_p2 and name = 'Technical audit';
  update public.project_stages set due_date = current_date + 12 where project_id = v_p2 and name = 'Content audit';
  update public.tasks set status = 'done' where project_id = v_p2 and title in ('Kickoff call and goals', 'Crawl the site');
  update public.tasks set status = 'doing', assignee_id = 'a0000000-0000-4000-8000-000000000003'
  where project_id = v_p2 and title = 'Core Web Vitals review';

  insert into public.client_updates (project_id, author_id, author_name, message, kind, status, published_at, created_at)
  values (v_p2, 'c0000000-0000-4000-8000-000000000002', 'Leo Martins', 'Project started', 'milestone', 'published',
          now() - interval '13 days', now() - interval '13 days');

  select id into v_task from public.tasks where project_id = v_p2 and title = 'Crawl the site';
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  perform public.submit_client_update(v_p2, 'Ashik completed the full site crawl. 412 pages checked.', v_task);
  perform public.submit_client_update(v_p2, 'Core Web Vitals review has started.');

  insert into public.internal_notes (project_id, author_id, body) values
    (v_p2, 'a0000000-0000-4000-8000-000000000003', 'Client CMS has 40 draft items with no meta descriptions. Flag in the report, not urgent.'),
    (v_p1, 'a0000000-0000-4000-8000-000000000001', 'Maya prefers email over calls. Budget is fixed, keep scope tight.');

  -- Some finished time entries over the last few days.
  insert into public.time_entries (user_id, project_id, started_at, ended_at, handoff_note) values
    ('a0000000-0000-4000-8000-000000000003', v_p2, date_trunc('day', now()) - interval '2 days' + interval '9 hours', date_trunc('day', now()) - interval '2 days' + interval '12 hours 30 minutes', null),
    ('a0000000-0000-4000-8000-000000000003', v_p1, date_trunc('day', now()) - interval '1 day' + interval '10 hours', date_trunc('day', now()) - interval '1 day' + interval '13 hours', 'Sitemap draft is in Figma.'),
    ('a0000000-0000-4000-8000-000000000002', v_p1, date_trunc('day', now()) - interval '1 day' + interval '13 hours', date_trunc('day', now()) - interval '1 day' + interval '17 hours', null),
    ('a0000000-0000-4000-8000-000000000001', v_p2, date_trunc('day', now()) - interval '3 days' + interval '14 hours', date_trunc('day', now()) - interval '3 days' + interval '22 hours', null);
  -- One that the 8-hour rule stopped.
  insert into public.time_entries (user_id, project_id, started_at, ended_at, auto_stopped) values
    ('a0000000-0000-4000-8000-000000000002', v_p1, date_trunc('day', now()) - interval '4 days' + interval '8 hours', date_trunc('day', now()) - interval '4 days' + interval '16 hours', true);
end;
$$;

-- A request from a client.
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.submit_client_request('bug', 'Contact form does not send on mobile', 'Tried on iPhone Safari, nothing happens after Submit.', null, 'https://northwind-outdoors.webflow.io/contact');
select set_config('request.jwt.claims', '', false);

-- Do not send seed emails anywhere.
delete from public.email_outbox;
