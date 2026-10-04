# Browser checks (local only)

These scripts drive the real app in Chromium against the **local** Supabase stack with the seed data.
They are not part of CI (CI runs lint, typecheck, unit/UI tests, build and the database tests).

```bash
supabase start && supabase db reset     # fresh seed data
npm run dev                              # in another terminal
npx playwright install chromium          # once (or set CHROMIUM_PATH to an existing Chromium)

npm run e2e:smoke   # every main screen, every role, light + dark → e2e/screenshots/
npm run e2e:flows   # magic-link signup, approvals, autosave, Let's Go, realtime bell, timer switch...
npm run e2e:a11y    # axe-core WCAG 2.1 AA scan of signed-in screens, light + dark
```

`e2e:flows` changes data (it kicks off project 1, etc.). Run `supabase db reset` before running it again.
