# Coherent Agency App

Client portal and internal project dashboard for Coherent Agency, served at **app.coherent.agency**.

- **Clients** follow their project step by step: stages, updates, due date, access onboarding, "Let's Go" kickoff, QA feedback, requests.
- **Team** see their assigned projects, track time (start / stop / switch with handoff notes), run a task board, share client updates and keep internal notes.
- **Admin** see everything: workload and hours, people and approvals, organizations, templates, audit log.

Everything runs on free tiers: **Supabase** (Auth, Postgres, Storage, Realtime, Edge Functions), **Resend** (email), **Cloudflare Pages** (hosting), **GitHub Actions** (CI and keepalive).

---

## Contents

1. [How it works (short)](#how-it-works-short)
1. [Preview (fastest way to see the app)](#preview-fastest-way-to-see-the-app)
2. [Local development](#local-development)
3. [Test logins (local only)](#test-logins-local-only)
4. [Testing](#testing)
5. [Production setup, step by step](#production-setup-step-by-step)
6. [Free tier limits and how we handle them](#free-tier-limits-and-how-we-handle-them)
7. [Security model](#security-model)
8. [Where to change things](#where-to-change-things)
9. [Decisions made (simplest option picked)](#decisions-made-simplest-option-picked)
10. [Not completed / known limitations](#not-completed--known-limitations)

---

## How it works (short)

| Piece | Where |
| --- | --- |
| React + Vite + React Router + Tailwind (TypeScript) | `src/` |
| Database schema, RLS, functions, cron jobs | `supabase/migrations/` (run in order) |
| Local test data | `supabase/seed.sql` (**never run in production**) |
| Email sender (Resend) | `supabase/functions/send-email/` |
| Database tests (RLS, timers, kickoff, signup roles) | `supabase/tests/` |
| UI + unit tests | `src/**/*.test.ts(x)` |
| Browser checks (local) | `e2e/` |
| CI and keepalive | `.github/workflows/ci.yml`, `.github/workflows/keepalive.yml` |
| SPA routing on Cloudflare | `public/_redirects` (`/* /index.html 200`) |

**Roles are decided only in the database.** A trigger on `auth.users` creates each profile:
invited staff (table `staff_invites`) get their invited role; people using the client signup form become
`client` with no organization (they see an empty welcome screen until an admin links them); anyone else
becomes `team` with status `pending` and can read nothing. Nothing the browser sends can choose a role.

**Emails** are queued in `email_outbox` by the database (in the same transaction as the bell notification),
then sent by the `send-email` Edge Function through Resend. A `pg_net` trigger wakes the function
immediately and a `pg_cron` job retries every 15 minutes.

---

## Preview (fastest way to see the app)

```bash
npm install
npm run preview:local     # needs Docker. Starts local Supabase, loads the seed data, serves http://localhost:5173
npm run preview:gallery   # in a second terminal: screenshots of every main screen → open preview/index.html
```

`preview:local` writes `.env.development.local` with the local keys (it never touches `.env.local`) and prints the
test logins. `preview:gallery` logs in as each seeded user, captures every main screen in light and dark (plus phone
width) and builds a clickable gallery in `preview/` (git-ignored). It needs Chromium for Playwright
(`npx playwright install chromium` once, or set `CHROMIUM_PATH`).

## Local development

Prerequisites: Node 22+, Docker, [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
supabase start                 # local Postgres, Auth, Storage, Realtime, Mailpit
supabase db reset              # applies supabase/migrations/* then supabase/seed.sql
cp .env.example .env.local     # then fill in with the values printed by `supabase status`:
                               #   VITE_SUPABASE_URL=http://127.0.0.1:54321
                               #   VITE_SUPABASE_ANON_KEY=<anon key>
npm run dev                    # http://localhost:5173
```

- Magic-link emails in local development land in **Mailpit**: http://127.0.0.1:54324
- A **developer email + password login** is shown on `/login` only when running `npm run dev`
  (`import.meta.env.DEV`). It never appears in a production build.
- Optional, to try real emails locally: copy `supabase/functions/.env.example` to `supabase/functions/.env`,
  run `supabase functions serve --env-file supabase/functions/.env --no-verify-jwt`, and add the two
  `private.app_settings` rows from step 6 below (use `http://supabase_kong_coherent-agency-app:8000/functions/v1/send-email` as the URL).

`supabase/config.toml` raises the Auth email rate limits **for local development only** so tests can sign up many users.

---

## Test logins (local only)

All seeded users have the password **`Password123!`** (use the developer login on `/login`).

| Role | Email | Notes |
| --- | --- | --- |
| Admin | `will@coherent.test` | Will. Sees everything. |
| Team | `sadman@coherent.test` | Assigned to **project 1 only** (Acme Bakery website). |
| Team | `ashik@coherent.test` | Assigned to **both** projects. |
| Client | `maya@acmebakery.test` | Acme Bakery → project 1, *Webflow Build*, not kicked off, Webflow access still pending. |
| Client | `leo@northwind.test` | Northwind Outdoors → project 2, *SEO Audit*, kicked off, in "Technical audit". |
| New client (not linked) | `newclient@freshco.test` | Sees the "setting up your project" welcome screen. |
| Pending team signup | `pending@coherent.test` | Sees `/pending` only. |

You can also sign up with any new email on `/signup` and click the link in Mailpit.

---

## Testing

```bash
npm run lint          # ESLint (incl. jsx-a11y)
npm run typecheck     # TypeScript
npm test              # UI + unit tests (Vitest, Testing Library) – no backend needed
npm run test:db       # Database tests against local Supabase (needs `supabase start && supabase db reset`)
npm run build         # production build
```

Database tests (`supabase/tests/*.test.ts`) cover:

- **RLS**: a client cannot read another org's projects, internal notes, time entries, tasks or audit log; a team
  member cannot read unassigned projects; a client cannot update another org's access steps; only staff can mark
  a step verified; admin edits are tagged `provided_by = admin`; anonymous visitors get nothing.
- **Time**: one running timer per user (partial unique index), `switch_project` ends the old entry at exactly the
  instant the new one starts, 8-hour auto-stop is flagged.
- **Updates**: submit creates a `client_updates` row + client notification + email; with `require_admin_approval`
  the client sees nothing until an admin approves; rejected updates stay hidden.
- **Let's Go**: blocked while Webflow is Pending, allowed otherwise (other pending steps come back as warnings),
  notifies assigned team and admins (not unassigned staff), sends the kickoff summary, cannot run twice.
- **Signup roles**: client signup → client with `org_id NULL` seeing nothing; non-invited team signup → pending
  and can read **no table at all**; invited signup → team seeing only assigned projects; a `role` in user metadata
  or a profile update from the browser has no effect; real calls to Supabase Auth (`signInWithOtp`).
- Due-date history + client email, stage change notifications, audit log, access reminders, client requests.

The test suite leaves its fixtures in the local database. Run `supabase db reset` afterwards for clean demo data.

Browser checks (local only, see `e2e/README.md`): `npm run e2e:smoke` (every screen, every role, light and dark),
`npm run e2e:flows` (real magic-link signups, approvals, autosave, Let's Go, realtime bell, timer switch…),
`npm run e2e:a11y` (axe WCAG 2.1 AA). The landing, login and signup pages score 100 for accessibility in Lighthouse.

---

## Production setup, step by step

### 1. Create the Supabase project (free)

1. Go to https://supabase.com → **New project**. Pick a region close to most clients (e.g. `eu-west-2` London).
2. Save the database password in your password manager (not in the repo).
3. From **Project Settings → API** note the **Project URL** and the **anon / publishable key**.
   The **service role key** is only ever used inside Supabase (Edge Functions get it automatically). Never put it in
   the frontend, Cloudflare, or GitHub.

### 2. Run the migrations

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push            # applies supabase/migrations in order. Do NOT run seed.sql in production.
```

Check in **Database → Extensions** that `pg_cron` and `pg_net` are enabled (the migrations enable them), and check
the jobs with `select jobname, schedule from cron.job;` – you should see `auto-stop-long-timers`,
`access-step-reminders` and `send-queued-emails`.

### 3. Create the first admin (Will)

There is no way to become admin from the app. In **SQL Editor** run:

```sql
insert into public.staff_invites (email, role) values ('will@coherent.agency', 'admin');
```

Will then signs up at `https://app.coherent.agency/signup?role=team` with that exact email, clicks the link, and is
an admin. (If Will already signed up before the invite, run
`update public.profiles set role = 'admin', status = 'approved' where email = 'will@coherent.agency';`.)
After that, invite the team from **Admin → People → Invites**.

### 4. Auth settings

**Authentication → URL Configuration**

- Site URL: `https://app.coherent.agency`
- Redirect URLs: `https://app.coherent.agency/auth/callback` (and `http://localhost:5173/auth/callback` for local).

**Authentication → Sign In / Providers → Email**: Email enabled. Keep "Allow new users to sign up" **on**
(the signup page needs it; the database decides roles). Magic link / OTP expiry: 1 hour is fine.

### 5. Send Auth emails through Resend (SMTP)

The built-in Supabase mailer only allows a couple of emails per hour, so magic links must go through Resend.

1. Create a free account at https://resend.com, **Domains → Add domain** `coherent.agency` and add the DNS records it
   shows (SPF/DKIM) at your DNS host. Wait until it says *Verified*.
2. **API Keys → Create** (sending access). Keep it in your password manager.
3. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**
   - Host `smtp.resend.com`, Port `465`, Username `resend`, Password = the Resend API key
   - Sender email `login@coherent.agency`, Sender name `Coherent`
4. **Authentication → Rate Limits**: set "emails per hour" to something like 30.
5. Optional: edit the **Magic Link** and **Confirm signup** templates (Authentication → Emails → Templates) to match
   the brand. Keep `{{ .ConfirmationURL }}` in them.

### 6. Deploy the email Edge Function

```bash
# a long random secret shared by the database and the function:
openssl rand -hex 32

supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="Coherent <updates@coherent.agency>" \
  EMAIL_WEBHOOK_SECRET=<the random secret> \
  SITE_URL=https://app.coherent.agency \
  EMAIL_DAILY_CAP=90

supabase functions deploy send-email --no-verify-jwt
```

Then tell the database where the function is (SQL Editor):

```sql
insert into private.app_settings (key, value) values
  ('email_function_url', 'https://<your-project-ref>.supabase.co/functions/v1/send-email'),
  ('email_webhook_secret', '<the same random secret>')
on conflict (key) do update set value = excluded.value;
```

`--no-verify-jwt` is intentional: the function is protected by the `x-webhook-secret` header and is only called by
the database. Check sent/failed emails with `select status, count(*) from email_outbox group by 1;`.

### 7. GitHub

1. Push this repo to GitHub (a **private** repo works).
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = the anon / publishable key
   These are used only by `keepalive.yml`, which pings the database once a day. Run it once by hand
   (**Actions → Keep Supabase awake → Run workflow**) to check it works.
3. `ci.yml` runs on every push: lint, typecheck, unit/UI tests, build, and the database tests on a throwaway local
   Supabase inside the runner.

### 8. Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**. Authorize the Cloudflare GitHub app
   for the (private) repo.
2. Build settings: Framework preset **Vite** (or none), Build command `npm run build`, Output directory `dist`.
3. **Environment variables** (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   and `NODE_VERSION` = `22`.
4. Deploy. `public/_redirects` makes deep links like `/client/projects/123` work.

### 9. Custom domain `app.coherent.agency`

1. In the Pages project → **Custom domains → Set up a custom domain** → `app.coherent.agency`.
2. If `coherent.agency` DNS is on Cloudflare, the record is created for you. Otherwise add a **CNAME** at your DNS
   host: `app` → `<your-pages-project>.pages.dev`.
3. Wait for the certificate (a few minutes), then make sure Supabase's Site URL and Redirect URL use this domain (step 4).

### 10. Smoke test production

Open `https://app.coherent.agency`, sign up as a client with a personal email, link yourself to a test organization
as admin, create a test project from a template, and walk through the **TEST CHECKLIST** below.

---

## Free tier limits and how we handle them

| Limit | What we do |
| --- | --- |
| **Supabase pauses** a free project after 7 days without activity | `keepalive.yml` calls `rpc/keepalive` every day. GitHub only disables scheduled workflows for inactivity on *public* repos; on a private repo it keeps running. If the project ever pauses, restore it from the Supabase dashboard (data is kept). |
| **500 MB database** | Only text is stored (no files). The biggest table over time is `audit_log`; check size with `select pg_size_pretty(pg_total_relation_size('audit_log'));` and prune old rows if needed, e.g. `delete from audit_log where created_at < now() - interval '1 year';`. Same for `notifications` and sent `email_outbox` rows. |
| **1 GB file storage** | Only logos and avatars, max **2 MB** each, image types only (enforced by the buckets). Deliverables are links (Figma, Drive, staging). |
| **Resend: 100 emails/day** (3,000/month) | The function stops at `EMAIL_DAILY_CAP` (default 90) per UTC day; the rest stay queued and go out the next day (cron retries every 15 min). Bell notifications are never limited. **Magic-link emails also count** toward Resend's 100/day, so lower the cap if many people log in daily. |
| **Supabase Auth email rate limits** | Custom SMTP (step 5) plus the rate limit setting. The app shows a friendly "Too many emails were sent just now" message when a limit is hit. |
| **No automatic backups** on the free plan | **Weekly export** (put it in your calendar): `supabase db dump --linked -f backups/schema-$(date +%F).sql` and `supabase db dump --linked --data-only -f backups/data-$(date +%F).sql`. Store the files somewhere private (not in the repo: they contain client data). Logos/avatars can be re-uploaded. |
| Edge Functions 500k calls/month, Realtime 200 connections, Cloudflare Pages 500 builds/month | Far above what an agency portal uses. |
| GitHub Actions 2,000 min/month (private repos) | CI takes a few minutes per push (the database job is the slowest). If minutes run low, limit `ci.yml` to pull requests and `main`. |

---

## Security model

- **Row Level Security on every table** (`supabase/migrations/*_rls_helpers_and_policies.sql`). Helper functions
  `is_admin()`, `is_staff()`, `is_assigned(project_id)`, `client_org_id()`, `can_view_project()` are
  `SECURITY DEFINER` with an empty `search_path` (no RLS recursion, no search-path hijack). They only return
  something for **approved** accounts, so pending/rejected accounts match no policy.
- Clients never see internal notes, tasks, time entries, hours, workload, other clients, the audit log or emails.
- Column-level rules are enforced by triggers: users cannot change their own role, status, org or email; team
  members cannot change project dates, name or the approval toggle; team can only mark access steps verified;
  clients cannot mark verified or edit a verified step.
- Write paths with business rules go through RPCs (`start_timer`, `switch_project`, `submit_client_update`,
  `confirm_kickoff`, …) that check permissions themselves.
- `anon` (logged-out) gets no table access at all; only `keepalive()`. Authenticated users have no `TRUNCATE`.
- **No secrets in the repo.** The browser only has the public URL and anon key. The service role key is only used
  inside Supabase. `npm run lint` (and so CI) fails if `service_role` appears anywhere in `src/`.
- **Access form stores IDs, links and status only.** It shows "Never share passwords here", asks clients to invite
  our email instead, and refuses to save values that look like passwords or API keys.

---

## Where to change things

| What | File |
| --- | --- |
| Brand colors, radius, button shape, fonts (whole app) | `src/styles/brand.ts` (**every value is marked `TODO(brand)`**) |
| Logo | `src/assets/logo.svg` and `public/favicon.svg` |
| All wording (landing, login, signup, client screens, errors) | `src/content/copy.ts` |
| Support email, access email, marketing link | top of `src/content/copy.ts` |
| Access step instructions and fields | `src/content/accessSteps.ts` |
| QA (Webvizio) guide | `src/content/qaGuide.ts` |
| Default stages/tasks/access steps | **Admin → Templates** in the app (seeded by `*_project_templates.sql`) |
| Email look | `supabase/functions/send-email/template.ts` |
| Reminder / auto-stop schedules | `*_cron_realtime_email.sql` (`cron.schedule(...)`) |

---

## Decisions made (simplest option picked)

- **Brand**: coherent.agency could not be reached from the build environment, so the tokens from the brief are used
  and every value in `brand.ts` (and the placeholder logo) is marked `TODO(brand)`. Change them in that one file.
- **Placeholder addresses**: `hello@coherent.agency` (support) and `access@coherent.agency` (the email clients
  invite to their tools). Change at the top of `src/content/copy.ts`.
- **Magic links use the implicit flow** so a link requested on a laptop can be opened on a phone.
- **Clients do not see tasks.** Progress = % of tasks done (falls back to % of stages done when a project has no tasks).
- **Admins' own client updates skip approval** even when `require_admin_approval` is on (they are the approvers).
- **Team can** edit tasks and stages, change project status and the Webvizio/staging links, mark access steps
  verified, and add notes on assigned projects. **Only admins** change project name, dates, the approval toggle and
  team assignment, and create projects.
- **Kickoff starts the first stage** automatically (quietly: the kickoff emails already cover it), and sets status to
  "Kickoff confirmed". Advancing a stage later sets "In progress"; finishing the last stage sets "Completed".
- **Starting a timer while one is running is refused** with a friendly message; use **Switch** (no gap) or **Stop**.
- **Access step extra IDs** (registrar, measurement ID, …) are stored in `access_steps.fields` (JSON) next to `value_text`.
- **Extra tables** beyond the brief: `client_requests` (request/bug form), `email_outbox` (email queue),
  `staff_invites` (invites), `private.app_settings` (function URL + secret).
- **Reminders** run daily at 09:15 UTC, go to all client users of the organization, at most once every 3 days per
  project, for projects created 3+ days ago with a Pending step (skipped for on-hold/completed projects).
- **Emails are sent for**: new client update, stage change, due-date change, kickoff (team + admins + client summary),
  access reminders, client requests (to admins), new signups (to admins), account approved/linked, staff invites.
  Bell only: update waiting for approval, update reviewed, timer auto-stopped.
- **Webvizio**: the "Open Webvizio" button is the main action; an optional embed is offered but many sites block
  being shown inside another page. Comments are not synced (as requested).
- **Pending users** can call `get_my_account()` (to learn they are pending) but read no table rows at all.
- **Dates** are shown in the viewer's browser timezone; the profile/org timezone fields are stored for reference.
- The landing, login, signup and database signup-role pieces were built in the same pass as the rest of the app;
  signup roles live in their own migration (`*_signup_and_roles.sql`).

---

## Not completed / known limitations

- **No live deployment was done** (no access to your Supabase, Resend, Cloudflare or DNS accounts). Steps 1–9 above
  are manual.
- **Real brand values** were not available (site unreachable from the build environment); see `TODO(brand)`.
- The email function was tested locally end-to-end with a **mock Resend server** (queue → pg_net → function → API
  call → marked sent; daily cap). It has not sent through the real Resend API.
- No UI to **edit or delete time entries** (admins can do it in SQL; team members cannot by design).
- No UI to delete projects or organizations (do it in the Supabase table editor if ever needed).
- Lists have simple limits instead of paging (audit log 300 rows per filter, notifications 200, time entries 2,000 per range).
- TypeScript row types are hand-written in `src/lib/types.ts`; regenerate with `supabase gen types typescript` if you prefer.
- Browser scripts in `e2e/` are not part of CI (they need a running dev server and seeded data).
