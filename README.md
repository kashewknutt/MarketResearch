# Market Research Platform

Desktop-first Next.js app for AI-assisted market research tailored to service-based companies. It stores data locally in SQLite, runs research with **Gemini** and **Google Search grounding**, and lets you edit assumptions, financial line items, and strategy outputs.

**Search setup:** You only need a `GEMINI_API_KEY`. This app does **not** use Google Custom Search API, Search Console API, or service-account JSON for search.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 20+** | LTS recommended ([nodejs.org](https://nodejs.org/)) |
| **npm** | Ships with Node |
| **Gemini API key** | Free or paid — [Google AI Studio](https://aistudio.google.com/apikey) |
| **Billing (recommended)** | Google Search grounding and higher quotas often need a GCP project with billing enabled |

**Native module:** The app uses `better-sqlite3`. On macOS/Linux this usually installs with `npm install`. On Windows, if install fails, install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload) and retry.

---

## Installation

```bash
git clone <your-repo-url>
cd MarketResearch
npm install
```

---

## Configure environment variables

1. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and set at least:

   ```env
   GEMINI_API_KEY=your_key_here
   ```

   Next.js also loads `.env` if you prefer that filename; both are gitignored. **Do not commit API keys.**

3. *(Optional)* Add Reddit or LinkedIn credentials — see [Reddit API](#reddit-api--create-app-and-env-vars) and [LinkedIn API](#linkedin-api--tokens-and-env-vars) under [Optional integrations](#optional-integrations).

---

## How to run

### Option A — Web app (recommended for first run)

Persists SQLite and snapshots under `./data`:

```bash
npm run dev:data
```

Open **[http://localhost:3000](http://localhost:3000)**.

Use plain `npm run dev` if you do not need a fixed `./data` folder (data still goes to the default data directory).

### Option B — Desktop (Electron)

Runs Next.js on port **3847** and opens the Electron shell:

```bash
npm run electron:dev
```

Data is stored in `./data` during development, same as `dev:data`.

---

## First-time user flow

After the dev server is running:

1. **System requirements** (`/setup`)  
   The app checks API key, Gemini connectivity, Google Search grounding, billing/quota hints, and writable local storage. Fix any failed checks before continuing.

2. **Onboarding** (`/onboarding`)  
   Enter business name, website, service domain, regions, currency, current/target **monthly** MRR, goal horizon (1–50 months), and optional social links.

3. **Run research**  
   From the dashboard or settings, start research. This runs multi-stage pipelines (demands, projects, competitors, leads, financials, marketing, strategy). It requires a valid `GEMINI_API_KEY` and can take several minutes.

4. **Explore results**  
   - **Dashboard** — MRR, competitors, demand, leads  
   - **Financial Analysis** — MRR chart, domain-specific expense line items, optional LinkedIn ad history  
   - **Projects / Leads / Marketing / Strategy / Investment** — tables and evidence from research  
   - **Settings** — Edit profile and re-run research  

There is no demo/mock mode: without Gemini configured, research steps will not produce real data.

---

## Optional integrations

Add these to `.env.local` when you want extra signals. The app still runs without them.

| Variables | Purpose |
|-----------|---------|
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Reddit search signals during research |
| `LINKEDIN_ACCESS_TOKEN` | **Advertising API** — OAuth token with ad reporting scopes |
| `LINKEDIN_AD_ACCOUNT_ID` | **Advertising API** — sponsored ad account ID for real spend in **Financial Analysis** |
| `GEMINI_BILLING_TIER` | `paid` (default) or `free` — affects cost estimates on **API Costs** |
| `MARKET_RESEARCH_DATA_DIR` | Override where SQLite and snapshots are stored (Electron sets this automatically in production) |

Leads use Google Search only (no LinkedIn API). If Advertising API vars are missing, financials still estimate LinkedIn ad spend via AI + search (and your onboarding LinkedIn URL if provided).

**Redirect URLs and ports:** Match the port you actually run:

| How you run | URL |
|-------------|-----|
| `npm run dev` / `npm run dev:data` | `http://localhost:3000` |
| `npm run electron:dev` | `http://localhost:3847` |

### Reddit API — create app and env vars

Used for public post search during research (via [snoowrap](https://github.com/not-an-aardvark/snoowrap)).

1. **Log in** to the Reddit account that will own the app (a normal user account is fine).

2. Open **[reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)** (or **User settings → Safety & Privacy → scroll to “Developer Platform” / apps**).

3. Click **“create another app…”** (or **“create app”**).

4. Fill in the form:
   - **name** — e.g. `Market Research Local`
   - **App type** — choose **`script`** (runs on your machine; no web redirect flow in this app)
   - **description** — optional
   - **about url** — optional
   - **redirect uri** — required by Reddit’s form but **not used** for script apps (this app never opens that URL). Use the same host/port as your dev server, e.g. `http://localhost:3847` for Electron or `http://localhost:3000` for web — not an arbitrary port like 8080.

5. Click **Create app**.

6. **Copy credentials** from the app card:
   - **`REDDIT_CLIENT_ID`** — the short string shown **under the app name** (not the title at the top)
   - **`REDDIT_CLIENT_SECRET`** — labeled **“secret”** (only shown once at creation; regenerate in app settings if lost)

7. Set **`REDDIT_USER_AGENT`** — Reddit requires a unique, descriptive user agent string. Use your Reddit username:

   ```env
   REDDIT_USER_AGENT=market-research:1.0 (by /u/your_reddit_username)
   ```

   Replace `your_reddit_username` with your actual handle (no spaces in the username part).

8. Add to `.env.local` and **restart the dev server**:

   ```env
   REDDIT_CLIENT_ID=your_client_id_here
   REDDIT_CLIENT_SECRET=your_secret_here
   REDDIT_USER_AGENT=market-research:1.0 (by /u/your_reddit_username)
   ```

**Notes**

- The app account must not be suspended; keep usage within [Reddit API rules](https://support.reddithelp.com/hc/en-us/articles/16160319875093-Responsible-Builder-Policy).
- If search fails, double-check app type is **script**, the user agent includes your `/u/...` name, and there are no extra quotes around values in `.env.local`.

---

### LinkedIn API — tokens and env vars (Advertising API only)

This app calls **one** LinkedIn product: [**Advertising API**](https://learn.microsoft.com/en-us/linkedin/marketing/getting-started) (`adAnalytics` for monthly spend in **Financial Analysis**). It does **not** use Community Management API, Lead Sync, or other products—do not request them on this app (LinkedIn may require separate apps for other products anyway).

Leads and marketing copy use **Gemini + Google Search**; your company LinkedIn URL in onboarding is context only.

#### 1. Create a LinkedIn developer app

1. Go to **[linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)** and sign in.

2. Click **Create app**.

3. Complete **App name**, **LinkedIn Page** (associate your company page), and **App logo**, then create the app.

4. Open the **Settings** tab **before** requesting products.

5. Under company verification, click **Verify** and follow LinkedIn’s steps (domain/DNS, business documents, or other methods they offer). Product access often stays blocked or pending until verification completes.

6. Open the **Products** tab and request access to **Advertising API** (Development tier) only. Wait for approval before continuing.

   Do **not** add Community Management API, Lead Sync, Share on LinkedIn, or other products to this app—they are unused here and some require a dedicated LinkedIn app per product.

7. Open the **Auth** tab and note:
   - **Client ID** → `LINKEDIN_CLIENT_ID` (for generating tokens; the Market Research app reads **`LINKEDIN_ACCESS_TOKEN`** at runtime)
   - **Client Secret** → `LINKEDIN_CLIENT_SECRET` (keep secret; used only when obtaining tokens)

8. Under **OAuth 2.0 settings**, add a **Redirect URL** that matches how you run the app:
   - Electron: `http://localhost:3847`
   - Web only: `http://localhost:3000`  
   You can register **both** in the LinkedIn app if you switch modes. The redirect must match **exactly** in the OAuth URL and token exchange below.

9. Under **OAuth 2.0 scopes**, enable only scopes that appear after **Advertising API** is approved (e.g. ad account / reporting read). Use the exact strings on the **Auth** tab in OAuth URLs—do not guess from old docs.

#### 2. Get `LINKEDIN_ACCESS_TOKEN`

The app expects a **Bearer access token** in `.env.local`, not the client secret alone.

**Option A — Developer portal token tool (fastest for local dev)**

1. In your app on the Developer Portal, open **Tools** (or **OAuth 2.0 tools**).

2. Use **token generator** / **Create token** (wording varies).

3. Select the member account that manages your company’s LinkedIn assets.

4. Select **Advertising API** scopes only (ad reporting / account read).

5. Generate the token and copy it immediately → **`LINKEDIN_ACCESS_TOKEN`**

   Tokens from this tool are often short-lived; refresh or regenerate when research fails with `401`.

**Option B — Authorization code flow (longer-lived refresh)**

1. Pick your redirect URI (must match step 8), e.g. `http://localhost:3847` for Electron dev.

2. Build an authorize URL (replace placeholders; URL-encode `redirect_uri` and scopes):

   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3847&scope=SPACE_SEPARATED_SCOPES
   ```

   Use scopes exactly as shown on your app’s **Auth** tab (space-separated).

3. Open that URL in a browser, approve access, and copy the `code` query param from the redirect (browser may land on `localhost:3847` or `:3000` with `?code=...`).

4. Exchange the code for an access token (same `redirect_uri` as above):

   ```bash
   curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=YOUR_CODE" \
     -d "redirect_uri=http://localhost:3847" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET"
   ```

   Use `http://localhost:3000` in both places if you run `npm run dev:data` instead of Electron.

5. From the JSON response, copy **`access_token`** → **`LINKEDIN_ACCESS_TOKEN`**

   Store **`refresh_token`** somewhere safe if provided; you can exchange it again when the access token expires.

Official reference: [LinkedIn OAuth 2.0](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication) and [Advertising API overview](https://learn.microsoft.com/en-us/linkedin/marketing/getting-started).

#### 3. Get `LINKEDIN_AD_ACCOUNT_ID` (optional, for real ad spend)

Only needed if you want **actual** monthly spend from LinkedIn instead of AI estimates.

1. Open **[LinkedIn Campaign Manager](https://www.linkedin.com/campaignmanager/)** with the same business that runs ads.

2. Select the ad account you want to track.

3. The **numeric account ID** often appears in the URL, e.g.  
   `https://www.linkedin.com/campaignmanager/accounts/512345678/...`  
   → `LINKEDIN_AD_ACCOUNT_ID=512345678`

4. Alternatively, use the **Advertising API** ad accounts endpoint with your token and copy the sponsored account `id`.

5. The token must have permission to read that account’s analytics; otherwise financials will still fall back to search-based estimates.

#### 4. Add to `.env.local`

```env
# Used when refreshing tokens (optional in .env; helpful for OAuth)
# LINKEDIN_CLIENT_ID=
# LINKEDIN_CLIENT_SECRET=

LINKEDIN_ACCESS_TOKEN=your_oauth_access_token
LINKEDIN_AD_ACCOUNT_ID=512345678
```

Restart the dev server after saving.

**What each variable does in this app**

| Variable | Read by app? | Used for |
|----------|----------------|----------|
| `LINKEDIN_CLIENT_ID` | No (OAuth only) | Generating tokens in the portal or curl |
| `LINKEDIN_CLIENT_SECRET` | No (OAuth only) | Same |
| `LINKEDIN_ACCESS_TOKEN` | **Yes** | Advertising API `adAnalytics` (with ad account ID) |
| `LINKEDIN_AD_ACCOUNT_ID` | **Yes** | Which ad account to read for **Financial Analysis** |

Add your company **LinkedIn page URL** in onboarding **Online presence** — used as context for AI ad-spend estimates when the API is not configured or fails.

---

## Environment reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | **Yes** | Gemini API key (server-side only) |
| `GEMINI_BILLING_TIER` | No | `paid` or `free` for cost display |
| `MARKET_RESEARCH_DATA_DIR` | No | Local data directory (default: `data` under project or app user data in Electron) |
| `REDDIT_*` | No | Reddit API credentials |
| `LINKEDIN_ACCESS_TOKEN` | No* | Advertising API OAuth token (*optional; needed for real ad spend) |
| `LINKEDIN_AD_ACCOUNT_ID` | No* | Sponsored ad account ID (*optional; pair with token) |

---

## npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (default port 3000) |
| `npm run dev:data` | Dev server with `MARKET_RESEARCH_DATA_DIR=./data` |
| `npm run electron:dev` | Electron + Next.js on port 3847 |
| `npm run build` | Production Next.js build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run test:projection` | Smoke test for financial projection engine |
| `npm run db:generate` | Generate Drizzle migrations |

---

## Troubleshooting

**“Could not run requirement checks” on `/setup`**  
Start the dev server first (`npm run dev:data`), then refresh.

**API key not detected**  
Ensure `GEMINI_API_KEY` is in `.env.local` (or `.env`), with no quotes or extra spaces. Restart the dev server after changing env files.

**Gemini or Google Search check fails**  
Confirm the key is valid, the Generative Language API is enabled, and billing/quota are sufficient. Links appear on the setup page for each failed check.

**Research fails or returns errors**  
Check **API Costs** and server logs. Rate limits and quota issues are common on free tiers.

**Empty Financial Analysis**  
Complete onboarding and run research at least once. Expense line items are created during the financial modeling stage.

**`npm install` fails on `better-sqlite3`**  
Use Node 20+, update npm, and install platform build tools (see Prerequisites).

**Reset local data**  
Stop the server, delete the `./data` folder (or your `MARKET_RESEARCH_DATA_DIR`), and run setup again. You can also use setup reset APIs if exposed in the UI.

---

## Features (overview)

- **System requirements** — Pre-flight checks before onboarding  
- **Onboarding** — Profile, social links, regions, currency, MRR goals  
- **Dashboard** — Charts, competitor spend, demand, leads  
- **Projects** — Sortable table with evidence and regional pricing  
- **Leads** — Discovered companies with fit scores and sources  
- **Financial Analysis** — Live MRR/expense chart, editable expense line items, LinkedIn ad panel when available  
- **Marketing** — Campaigns and social strategy tabs  
- **Strategy & Investment** — ICP, priorities, spend recommendations  
- **Research Sources** — Citations and AI traces  
- **API Costs** — Per-call cost estimates  
- **Settings** — Profile edits and re-run research  

---

## Tech stack

- Next.js 16 (App Router) + TypeScript  
- Electron (desktop dev; packaging via `electron-builder.yml`)  
- SQLite + Drizzle ORM  
- Gemini with Google Search grounding  
- Tailwind CSS 4  
