# Household PWA standard

The general rules live in [pwa-kit's STANDARD.md](https://github.com/piekstra/huishouden-pwa-kit/blob/main/STANDARD.md)
and every household app follows them. This file adds what is specific to the household.

## Household specifics

- Firebase project: `huishouden-piekstra` (free plan, no billing account). Sites:
  `huishouden-piekstra` (this portal), `huishouden-spending`, `huishouden-tasks`.
- Wiring: `bun run bootstrap` here runs pwa-kit's bootstrap with `infra/apps.conf`.
- Register each app in this portal's `src/apps.ts`; set `live: true` once it is deployed.
- Firestore rules: the project's single rules file is deployed from `household-tasks`. Other apps'
  blocks go there (spending's is `households/{householdId}/spendingTransactions`).
- `authDomain`: `huishouden-piekstra.firebaseapp.com`.

---

Every app in the household (portal, spending, tasks, and whatever comes next) follows this.
Each rule is here because skipping it broke something; the reason is given so the rule can be
judged rather than copied.

## Shape

- **One repo per app**, under `piekstra/`. Its own CI, its own deploys.
- **One Firebase project for the household**: `huishouden-piekstra`. Each app gets its own
  Hosting site (`huishouden-<app>.web.app`) and its own Firebase web app registration.
  Unrelated or shareable projects get their own Firebase project instead.
- **Stack**: Vite + TypeScript, `vite-plugin-pwa` (Workbox), bun. React where the app has state;
  plain TS is fine for static pages like the portal.
- **Register the app in the portal**: add it to `src/apps.ts` here; set `live: true` once deployed.
- **Wire it up with `infra/bootstrap.sh`**: add the repo to `APPS` and re-run. It creates the
  site and web app and sets the repo variables. Never hand-create deploy keys.

## PWA

- Manifest: `display: standalone`, `start_url` and `scope` `/`, icons at 192 and 512 plus a
  512 maskable icon. Generate PNGs from one SVG (`bun run icons` in this repo).
- Service worker: `registerType: 'autoUpdate'`, so installed copies update on the next launch.
- **`navigateFallbackDenylist: [/^\/__\//]`**. Firebase serves its sign-in popup at
  `/__/auth/handler`; without this the service worker answers it with the cached app and
  "Sign in with Google" opens the app instead of Google.
- Hosting headers: `sw.js`, `registerSW.js`, `index.html` and the manifest `no-cache`;
  `/assets/**` immutable for a year. Copy `firebase.json` from an existing app.
- Tablet first: test at 1280×800 landscape; tap targets at least 44 px.

## Sign-in and data

- Firebase Auth with Google. `authDomain` is the project's `huishouden-piekstra.firebaseapp.com`:
  it is the only redirect URI the auto-created OAuth client allows. An app's own domain gives
  `Error 400: redirect_uri_mismatch` until its `/__/auth/handler` is added to that client.
- The OAuth consent screen is In production, External. Asking for sensitive scopes (Sheets,
  Drive) shows "unverified app" once per user and counts toward a lifetime cap of 100 users.
  Prefer designs that need no Google API scopes in the browser.
- Household data lives in Firestore in the shared project, under `households/{householdId}/<collection>`
  per app. The project's single rules file is deployed from `household-tasks` (see above).
- Card names, people and other household facts are data, not code: keep them in the Sheet or
  Firestore, not in the repo (the repos may be published).

## CI/CD

Every app's `.github/workflows/ci.yml` has these jobs, all on `ubuntu-latest`:

| Job | Runs on | Does |
|---|---|---|
| `leak-scan` | every PR and push | `piekstra/huishouden-pwa-kit/actions/leak-scan@v0` |
| `build` | every PR and push | `bun install --frozen-lockfile`, lint (`tsc --noEmit`), unit tests, build |
| `deploy` | push to `main` | Keyless via Workload Identity Federation; `firebase deploy --only hosting:<target>` |
| `smoke` | after `deploy` | Playwright against the live site |

- Repo variables (not secrets; the Firebase web config is public by design): `GCP_WIF_PROVIDER`,
  `GCP_DEPLOY_SA`, `VITE_FIREBASE_*`. The bootstrap sets them.
- Deploy waits on `leak-scan` and `build`. `concurrency: cancel-in-progress` on every workflow.
- Real secrets (test account passwords, API tokens) go in GitHub Actions secrets and are read
  only in the jobs that need them. Never in argv, logs, or the repo.

## Tests

- **Unit tests** (`bun test`) for parsing and money logic, with inputs and expected outputs in
  fixture files (`__fixtures__/`, `fixtures/`), scrubbed of real names, emails and card digits.
- **Smoke tests** (`bun run e2e`, Playwright, headless Chromium) against the deployed site.
  Minimum set, copied from `household-spending/e2e/smoke.spec.ts`:
  1. Loads with no runtime errors.
  2. Installable: manifest has a 512 icon, every icon URL loads, a service worker controls the
     page after one reload.
  3. Sign-in popup lands on accounts.google.com with a `/__/auth/handler` redirect and no
     `redirect_uri_mismatch`, run on the second load (under the service worker).
- Signed-in flows use a dedicated test account in GitHub secrets, not a household member's
  Google account: Google blocks scripted sign-in to real accounts.

## Leaks

- `.gitleaks.toml` copied from this repo (defaults plus a personal-email rule), with any
  allowlist entry stating why it is safe.
- The scan covers the commits each PR or push adds. History before the scan existed is audited
  once, at publication, with a fresh-history publish if needed.

## Apps Script

- Script source lives in the app repo (`apps-script/`), deployed with `clasp`
  (`bun run script:push` runs its tests first). Never edit only in the browser editor.
