# Northstar (Valnee) — Deployment Testing SOP

**Purpose:** A repeatable, end-to-end checklist for verifying that a deployed instance of this app (Next.js app, codename **Northstar**, org-branded **Valnee**) is fully healthy after a deploy, a config change, or on a periodic cadence (e.g. weekly / post-release).

**Audience:** Whoever owns deploys/QA for this app (you, or anyone you hand this to).

**How to use this doc:** Work top to bottom. Each phase has a checklist with an expected result. Record PASS/FAIL + notes in the sign-off table at the end. Anything marked **🔲 CONFIRM** is a value this SOP could not verify directly from the codebase and must be filled in once (then it stays valid until infra changes).

---

## 0. Ground truth this SOP is based on

This SOP was built by reading the actual source in this repo, not assumptions. Know these facts before you start, because they change *how* you test:

| Area | Reality in this codebase |
|---|---|
| Framework | Next.js (App Router) + TypeScript, deployed as a normal Next.js server (see `src/app`) |
| Auth | **Supabase Auth**, Google as the *only* sign-in provider (`src/lib/supabase/*`, `/login`, `/auth/callback`). Any Google/Gmail account can sign in — there is no allow-list. |
| Primary DB | **Supabase Postgres** (org/team data) — connection strings in `NEXT_SUPABASE_DIRECT_CONNECTION_URL` / pooler URL |
| Secondary/local store | **SQLite** via `better-sqlite3` + Drizzle, path controlled by `MARKET_RESEARCH_DATA_DIR` (see `src/lib/db/paths.ts`) — used for research snapshots/desktop mode |
| AI / "content generation" | **Google Gemini** with Google Search grounding (`src/lib/ai/gemini.ts`) — drives the research pipeline (`src/lib/research/stages/*`) and the Ads & Content idea generator. **No image/video files are generated or stored by the app itself** — users manually attach finished media when publishing to LinkedIn/YouTube. |
| Email | **Resend** (`src/lib/email/resend-client.ts`, `mention-email.ts`) — sends "@mentioned in a comment" notifications only. No Gmail API/SMTP is used. Silently no-ops if `RESEND_API_KEY` is unset (check server logs for `[email]` lines). |
| "Gmail" | Not an integration — it's just the Google account used for **Sign in with Google**. Testing "the Gmail" = testing Google OAuth login. |
| Object/file storage | **No GCS bucket or Supabase Storage bucket exists in the current code.** If your deployment does use one (e.g. for exports/backups), see §4 — fill in the 🔲 CONFIRM fields there. |
| Built-in health page | `/setup` (UI) and `/api/setup/check` (API) already run live checks against Gemini, Google Search grounding, billing/quota, local storage, and every optional integration. **Use this as your primary smoke test**, not a rebuild of it. |
| Deploy infra | **No Dockerfile, Cloud Build config, or IaC is committed to this repo.** Cloud Run project ID, service names, and regions are therefore not discoverable from source — fill in §1 once.

---

## 1. Access & environment checklist (do this once, keep it updated)

Fill in and keep somewhere your team can find (password manager / internal wiki), not in git:

| Item | Value |
|---|---|
| GCP Project ID | 🔲 CONFIRM (run `gcloud projects list` after `gcloud auth login` with the correct account) |
| Cloud Run service #1 (web/frontend) | 🔲 CONFIRM name + region |
| Cloud Run service #2 (worker/backend, if any) | 🔲 CONFIRM name + region |
| Supabase project ref | `vzaklqtnjiayevynvtqc` (from `NEXT_PUBLIC_SUPABASE_URL`) — confirm this is still the prod project |
| Resend account / domain | Sending domain `northstar.valnee.com` (`RESEND_FROM_EMAIL=updates@northstar.valnee.com`) |
| Production base URL | 🔲 CONFIRM (used as `APP_BASE_URL` for "view in app" links in emails) |
| Test Google account(s) | At least one real Gmail/Google Workspace account dedicated to QA login |
| GCS/Storage bucket(s), if any | 🔲 CONFIRM name(s) and what they hold — not referenced anywhere in `src/` today |

**Before touching GCP:** make sure your local `gcloud` CLI is authenticated as the account that actually owns this deployment:

```bash
gcloud auth list                 # confirm active account is the right one
gcloud config get-value project  # confirm project matches the table above
# if wrong:
gcloud auth login
gcloud config set project <correct-project-id>
```

Do not proceed with §2 until `gcloud config get-value project` matches the confirmed project ID — testing against the wrong project will give false confidence.

---

## 2. Phase 1 — Cloud Run health & logs (both services)

Run this for **each** Cloud Run service in the table above.

### 2.1 Service status

```bash
gcloud run services list --platform=managed
gcloud run services describe <SERVICE_NAME> --region <REGION> --format json
```

Check:
- 🔲 `status.conditions` all report `"status": "True"` for `Ready`, `ConfigurationsReady`, `RoutesReady`.
- 🔲 `latestReadyRevisionName` matches `latestCreatedRevisionName` (deploy actually rolled out, didn't get stuck on an old revision).
- 🔲 `traffic[].percent` is 100% on the revision you expect (no accidental canary split left behind).
- 🔲 Container resource limits (`resources.limits.cpu`/`memory`) are sane for load — flag if memory is small (e.g. 512Mi) and the service does Gemini calls + Postgres queries under load.

### 2.2 Revision history / rollback readiness

```bash
gcloud run revisions list --service <SERVICE_NAME> --region <REGION>
```
- 🔲 Confirm there's a previous healthy revision you could roll back to if this deploy is bad.

### 2.3 Logs — errors and startup

```bash
# Last 100 log lines
gcloud run services logs read <SERVICE_NAME> --region <REGION> --limit=100

# Errors only, last 30 minutes
gcloud logging read '
  resource.type="cloud_run_revision"
  resource.labels.service_name="<SERVICE_NAME>"
  severity>=ERROR
' --freshness=30m --limit=100 --format="table(timestamp,severity,textPayload)"
```

Check for, and treat as a blocker if found:
- 🔲 Unhandled exceptions / 5xx stack traces around request handling.
- 🔲 `[email] failed to send mention email` — Resend key/domain issue (cross-check §5).
- 🔲 Gemini errors: quota/billing/rate-limit messages (see `src/lib/ai/gemini-errors.ts` classifications: `billing_required`, `credits_depleted`, `rate_limited`).
- 🔲 Supabase/Postgres connection errors (pooler timeouts, auth failures).
- 🔲 Container startup probe failures / repeated cold-start crash loops (`Default startup probe` timing out — note current `timeoutSeconds` is tight in some deployments; a slow Next.js cold start can trip this).

### 2.4 Application-level health endpoint

The app exposes a lightweight health/status API — hit it directly against the live URL, don't just trust "container is Ready":

```bash
curl -s https://<SERVICE_URL>/api/status | jq
```

Expected: JSON with a `gemini` status object and `dataDir`. If `gemini.status` isn't `"ready"`, the Gemini key/billing is broken **in that environment's env vars specifically** (separate from your local `.env`).

- 🔲 `/api/status` returns 200 with `gemini.status: "ready"`.
- 🔲 Response time is reasonable (no cold-start pileup) — time it: `curl -s -o /dev/null -w "%{time_total}\n" https://<SERVICE_URL>/api/status`.

### 2.5 Environment variables / secrets sanity (without printing secret values)

```bash
gcloud run services describe <SERVICE_NAME> --region <REGION> \
  --format="table(spec.template.spec.containers[0].env[].name)"
```

Cross-check the returned **names** (not values) against the required/optional variables in `.env.example`:
- 🔲 Required present: `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- 🔲 If email is expected in prod: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_BASE_URL`.
- 🔲 If any optional integration is supposed to be live in prod (LinkedIn/YouTube/Reddit/Apify), its full variable set is present — partial sets silently degrade (see `linkedinEnvPresence()` → `"partial"` in `src/lib/setup/integration-checks.ts`).
- 🔲 No secret values appear in plaintext build logs (`gcloud builds log <BUILD_ID>` if using Cloud Build).

---

## 3. Phase 2 — "Content generation" (Gemini research pipeline) verification

This is the core product function: multi-stage AI research writing structured data (competitors, projects, leads, financials, marketing, strategy, ads). "Does content generation work" = does this pipeline complete and produce real, cited output.

### 3.1 Pre-flight via the built-in diagnostics page

Open **`https://<SERVICE_URL>/setup`** logged in as your QA account. This page already runs live checks — use it instead of re-deriving pass/fail criteria by hand.

- 🔲 All **required** checks pass: API key present, Gemini API reachable, model access (`GEMINI_MODEL`), Google Search grounding, billing & quota, local storage writable.
- 🔲 Note the state of each **optional** check (Reddit, LinkedIn Advertising, YouTube, LinkedIn publish, Apify, YouTube publish) — compare against what's *supposed* to be configured in this environment. "Skipped" is fine if intentionally not configured; "Failed" on something that should be configured is a real bug.
- 🔲 Cross-check via API directly: `curl -s https://<SERVICE_URL>/api/setup/check | jq '.checks[] | {id, state, message}'`.

### 3.2 End-to-end research run

1. 🔲 As a fresh (or reset) test account, complete **Onboarding** (`/onboarding`): business name, website, service domain, region, currency, current/target MRR, horizon.
2. 🔲 Trigger a research run (dashboard/settings action → `POST /api/research/start`).
3. 🔲 Poll `GET /api/research/status` (or watch the UI) until it reports complete. Note total duration — flag if dramatically slower than baseline (could indicate Gemini rate-limiting/retries).
4. 🔲 Confirm no stage silently failed. Stages to verify produced output (`src/lib/research/stages/`):
   - Competitor intelligence → **Dashboard** / **Projects** shows competitors with evidence.
   - Project enrichment → **Projects** page has regional pricing + sourced evidence, not placeholder text.
   - Lead discovery → **Leads** page has discovered companies with fit scores and sources.
   - Financial modeling → **Financial Analysis** shows an MRR chart and domain-specific expense line items (not empty).
   - Marketing / social strategy → **Marketing** page has campaigns + social tabs populated.
   - Ad idea sourcing / generation → **Ads & Content** (`/ads`) shows trending ideas with either "✓ Verified via {platform}" or "AI-estimated" badges — confirm the badge logic matches whether `APIFY_API_TOKEN`/`YOUTUBE_API_KEY` are configured in this env.
5. 🔲 Open **Research Sources** — confirm citations/AI traces exist and links resolve (not dead/blank).
6. 🔲 Open **API Costs** — confirm per-call cost entries were recorded for the run just performed (proves cost tracking isn't silently broken).

### 3.3 Re-run / refresh path (not just first run)

- 🔲 From **Settings**, re-run research on an account that already has data. Confirm existing data isn't corrupted and new/updated fields appear (this exercises a different code path than first-run onboarding).
- 🔲 On **Ads & Content**, use "Refresh ad trends" — confirm it completes without error and (if Apify configured) verified badges appear; if not configured, confirm graceful fallback to AI-estimated with no crash.

### 3.4 Failure-mode sanity checks (do at least one deliberately)

- 🔲 Temporarily use an invalid/expired Gemini key in a staging env (never prod) and confirm the UI surfaces a clear, classified error (billing/rate-limit/credits message from `gemini-errors.ts`) instead of a raw 500 or infinite spinner.

---

## 4. Phase 3 — Storage / bucket visibility

Because no bucket is referenced in the current codebase, **first confirm whether a bucket is even part of this deployment**, then test accordingly.

### 4.1 If a GCS bucket exists for this deployment (🔲 CONFIRM name/purpose from §1)

```bash
gsutil ls gs://<BUCKET_NAME>
gsutil ls -L -b gs://<BUCKET_NAME>          # versioning, retention, public-access-prevention
gsutil iam get gs://<BUCKET_NAME>           # who can read/write
```

- 🔲 Bucket is **not** publicly readable/writable unless it's explicitly meant to serve public assets (check `allUsers`/`allAuthenticatedUsers` bindings in the IAM output — flag immediately if present on anything containing user data).
- 🔲 The service account the Cloud Run service runs as (`spec.template.spec.serviceAccountName` from §2.1) has the *minimum* required role (e.g. `roles/storage.objectViewer` / `objectCreator`, not `roles/storage.admin`, unless justified).
- 🔲 Upload a small test object as the app would, then confirm it's retrievable via the same code path the app uses (or via signed URL if that's the pattern) — don't just test with your own elevated `gsutil` credentials, which bypasses the app's actual permission path.
- 🔲 Object lifecycle/retention rules (if any) match data-retention expectations (e.g. exported reports shouldn't vanish after 24h if users expect to download them later).

### 4.2 What actually exists today: local + Supabase storage

- 🔲 **Local SQLite data dir** (`MARKET_RESEARCH_DATA_DIR`) — on the Cloud Run instance this is ephemeral container storage unless mounted to a persistent volume. Confirm: does research data (SQLite snapshots) need to survive container restarts/redeploys in this deployment? If yes and there's no mounted volume/Cloud SQL, this is a **data-loss risk**, not just a test item — escalate.
- 🔲 **Supabase Postgres** — connect with the pooler URL from `.env` and run a read query against org/profile tables to confirm connectivity and that RLS policies allow the expected access for the service role vs. anon key.
- 🔲 If Supabase **Storage** (not GCS) is actually the "bucket" in question — check Supabase Dashboard → Storage → confirm bucket exists, its public/private setting, and that RLS storage policies match intent.

---

## 5. Phase 4 — Email system (Resend)

### 5.1 Config check

- 🔲 `/setup` or `/api/setup/check` doesn't directly test Resend (it's not in `REQUIRED_REQUIREMENT_IDS`), so verify manually: confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in the Cloud Run env (§2.5) — if `RESEND_API_KEY` is unset, mentions silently no-op (check logs for `[email] RESEND_API_KEY not set, skipping mention email to ...`).
- 🔲 In [Resend dashboard](https://resend.com/emails), confirm the sending domain (`northstar.valnee.com`) shows **verified** DNS (SPF/DKIM) — an unverified domain causes silent failures or spam-folder delivery.

### 5.2 Functional test — trigger a real mention email

1. 🔲 As QA user A, open any entity with comments (task/lead/project) and post a comment `@mentioning` QA user B (a real, checkable inbox).
2. 🔲 Confirm the API call succeeds (`POST /api/comments`, then check `GET /api/mentions` for user B shows the new mention).
3. 🔲 Confirm user B's inbox receives the email within a couple minutes: subject `"{mentioner} mentioned you in a {entity} comment"`, body includes the comment text (escaped, no broken HTML), and a **"View in app"** link.
4. 🔲 Click the "View in app" link — confirm it points at the correct `APP_BASE_URL` (prod URL, not `localhost:3000` — check `mention-email.ts`'s fallback) and lands on the right entity.
5. 🔲 Check [Resend dashboard → Logs] for that send — confirm status `delivered` (not `bounced`/`complained`).
6. 🔲 Repeat once with a mention where the mentioned user has no email address or an invalid one on file — confirm the app doesn't crash and logs a clear error (`src/lib/email/mention-email.ts` catches and logs, doesn't throw).

---

## 6. Phase 5 — Authentication ("the Gmail" / Google sign-in)

1. 🔲 Visit the prod URL logged out — confirm it redirects to `/login` (no route is reachable unauthenticated).
2. 🔲 `/login` shows a single "Sign in with Google" button (no password/email form).
3. 🔲 Sign in with a **brand-new** Google/Gmail account never used before on this app — confirm it lands in `/onboarding` with an empty profile (not an error, not someone else's data).
4. 🔲 Sign in with an **existing** QA Google account — confirm it lands on the dashboard with that account's prior data intact.
5. 🔲 Check the Google Cloud Console OAuth client's **Authorized redirect URIs** includes the current prod Supabase callback URL (`https://<supabase-ref>.supabase.co/auth/v1/callback`) — a redirect URI mismatch is a top real-world cause of "login broken in prod but works locally."
6. 🔲 Confirm session persists across a page refresh and a new tab, and sign-out actually clears the session (retry an authenticated route after signing out → redirected to `/login`).
7. 🔲 Multi-tenant check: sign in as two different Google accounts in the same org (`src/app/api/org/members`) — confirm each only sees data scoped to their org, not cross-tenant leakage.

---

## 7. Phase 6 — UI functional walkthrough

Go through every top-level route as an authenticated user with an org that already has research data. For each, check: loads without error, no console errors, data renders (not stuck skeleton/spinner), and primary actions work.

| Route | What to verify |
|---|---|
| `/dashboard` | MRR chart, competitor spend, demand, leads widgets render with real numbers |
| `/projects` | Sortable table, evidence links, regional pricing; manual project creation form works |
| `/leads` | Discovered companies, fit scores, sources; manual lead creation form works; "find contact" / "draft message" / "mark sent" actions work |
| `/financial-analysis` | MRR/expense chart renders, expense line items are editable and persist, LinkedIn ad panel appears iff LinkedIn ads configured |
| `/marketing` | Campaigns tab + social strategy tab populated |
| `/ads` | Trending ideas list, idea detail sheet, generate-more, publish-to-LinkedIn/YouTube flows, trash/restore |
| `/strategy` | ICP, priorities render |
| `/investment-planner` | Spend recommendations render |
| `/research-sources` | Citations/AI traces list, links resolve |
| `/api-costs` | Per-call cost entries for the latest research run |
| `/tasks` | Task list, assignment, comments + @mentions (ties to §5.2) |
| `/team` | Org members list, add/remove member (`/api/org/members`) respects role permissions |
| `/settings` | Profile edit persists; "re-run research" kicks off a new pipeline run |
| `/setup` | See §3.1 |
| `/onboarding` | See §6.3 |
| `/privacy`, `/terms` | Static pages load (public, no auth loop) |

- 🔲 Check browser devtools console/network tab on at least `/dashboard`, `/ads`, `/financial-analysis` for silent 4xx/5xx API failures that the UI might be masking with empty states.
- 🔲 Test on both desktop viewport and a narrow/mobile viewport if the app claims responsive support — README describes this as "desktop-first," so at minimum confirm it doesn't outright break on a laptop-sized window.

---

## 8. Phase 7 — Third-party integrations regression pass

Use `/setup` (§3.1) as the fast pass, but also do one **real functional** action per configured integration, since a green "credentials valid" check doesn't prove write scopes work:

- 🔲 **Reddit** — confirm a research run actually surfaces Reddit-sourced signals when Reddit is configured.
- 🔲 **LinkedIn Advertising API** — confirm real ad spend numbers appear in Financial Analysis (not the AI-estimate fallback) when `LINKEDIN_AD_ACCOUNT_ID` is set.
- 🔲 **LinkedIn publishing** — from an Ads & Content idea, actually publish a test post to LinkedIn (`POST /api/ads/ideas/[id]/publish/linkedin`) and confirm it appears on the LinkedIn profile. Do this sparingly (it's a real post) — coordinate with whoever owns that LinkedIn account.
- 🔲 **YouTube Data API** — confirm real trending videos (not Gemini-search-only) appear in Ads & Content.
- 🔲 **YouTube publishing** — upload a small test video end-to-end (`POST /api/ads/ideas/[id]/publish/youtube`) as unlisted, confirm it appears on the channel, then delete/clean up.
- 🔲 **Apify** — confirm "✓ Verified via Instagram/LinkedIn" badges appear (real scraped data) instead of "AI-estimated" when Apify is configured, and that per-refresh cost stays within expected bounds (check Apify console usage).

---

## 9. Phase 8 — Electron desktop build (if this deployment also ships desktop)

- 🔲 `npm run electron:dev` launches, points at port 3847, and `/setup` still passes.
- 🔲 Confirm `MARKET_RESEARCH_DATA_DIR` is set automatically to the app's user-data directory in packaged builds (not the repo's `./data`).
- 🔲 Build via `electron-builder.yml` config and smoke-test the packaged app on the target OS at least once per release.

---

## 10. Phase 9 — Security & secrets hygiene (quick pass, every SOP run)

- 🔲 Confirm `.env`/`.env.local` are still git-ignored (`git check-ignore -v .env` → should match) and were never committed (`git log --all -- .env`).
- 🔲 Rotate any credential that has ever been pasted into chat, a shared doc, or a non-secret-manager file. **Action item found during this audit:** this repo's local `.env` contains live, unrotated production-looking secrets (Gemini, Supabase service role key, LinkedIn, Reddit, Resend, YouTube OAuth) sitting in a plain file — recommend moving these to a proper secret manager (GCP Secret Manager / Cloud Run secrets) if not already done for the deployed services, and rotating any of these that may have been shared outside a password manager.
- 🔲 Confirm the Cloud Run service account (§2.1 `serviceAccountName`) is scoped minimally — not the default compute service account with broad project-level roles, unless deliberately accepted.
- 🔲 Confirm `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (grep the deployed bundle / confirm it's never in a `NEXT_PUBLIC_*` var) — this key bypasses RLS.

---

## 11. Sign-off template

Copy this table per test cycle:

| Phase | Result | Notes | Tested by | Date |
|---|---|---|---|---|
| 1. Cloud Run health & logs (service 1) | ⬜ Pass / Fail | | | |
| 1. Cloud Run health & logs (service 2) | ⬜ Pass / Fail | | | |
| 2. Content generation (research pipeline) | ⬜ Pass / Fail | | | |
| 3. Storage / bucket | ⬜ Pass / Fail | | | |
| 4. Email system (Resend) | ⬜ Pass / Fail | | | |
| 5. Auth (Google/Gmail sign-in) | ⬜ Pass / Fail | | | |
| 6. UI walkthrough | ⬜ Pass / Fail | | | |
| 7. Third-party integrations | ⬜ Pass / Fail | | | |
| 8. Electron desktop (if applicable) | ⬜ Pass / Fail | | | |
| 9. Security & secrets hygiene | ⬜ Pass / Fail | | | |

**Overall deployment status:** ⬜ Healthy / ⬜ Degraded (list which optional pieces are down) / ⬜ Blocked (list blocker)

---

## 12. Quick command reference

```bash
# --- Identity / project ---
gcloud auth list
gcloud config set project <PROJECT_ID>

# --- Cloud Run ---
gcloud run services list --platform=managed
gcloud run services describe <SERVICE> --region <REGION> --format json
gcloud run revisions list --service <SERVICE> --region <REGION>
gcloud run services logs read <SERVICE> --region <REGION> --limit=100
gcloud logging read 'resource.type="cloud_run_revision" severity>=ERROR' --freshness=30m

# --- Storage (only if a bucket is confirmed to exist) ---
gsutil ls gs://<BUCKET>
gsutil iam get gs://<BUCKET>

# --- App-level health ---
curl -s https://<SERVICE_URL>/api/status | jq
curl -s https://<SERVICE_URL>/api/setup/check | jq '.checks[] | {id,state,message}'
```
