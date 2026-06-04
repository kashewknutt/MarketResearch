# Market Research Platform

Desktop-first Next.js app for real-time market research tailored to service-based companies. Uses local SQLite storage, Gemini 3 Flash with **Grounding with Google Search** (via `GEMINI_API_KEY` only), and editable AI-generated insights.

**Not used:** Google Custom Search API, Search Console API, OAuth 2.0 clients, or service accounts for search — those are separate products with different auth.

## Quick start

### Web development

```bash
cp .env.example .env.local
# Required: GEMINI_API_KEY for all AI research (no mock data)

npm install
npm run dev:data
```

Open [http://localhost:3000](http://localhost:3000). You will land on **System requirements** first — all checks must pass (API key, Gemini, Google Search, billing, local storage) before onboarding.

### Desktop (Electron)

```bash
npm run electron:dev
```

Data is stored in `./data` during development.

## Environment

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | **Required.** Google Gemini API key (server-side only) |
| `MARKET_RESEARCH_DATA_DIR` | Override local data folder (set automatically by Electron) |
| `GEMINI_BILLING_TIER` | `paid` (default) or `free` — controls cost estimates in API Costs |

## Features

- **System requirements** — Pre-flight checks for Gemini API, Google Search grounding, billing/quota, and local storage
- **Onboarding** — Business profile, regions (default US + India), currency, current/target **monthly** MRR, and time horizon (1–50 months)
- **Dashboard** — Top 10 demands per region, active projects with ticket sizes
- **Projects** — 10 active projects per region; mark done → AI fetches 1 replacement
- **Financial Analysis** — Projections, assumptions, investment breakdown (all editable)
- **Marketing** — Positioning, channels, offers tied to research
- **Strategy** — ICP, region comparison, priorities
- **Investment Planner** — Where to spend and expected outcomes
- **Research Sources** — Citations and AI logs
- **API Costs** — Traceable per-call costs (setup tests, research, projects) with live pricing from Google
- **Settings** — Edit profile, re-run research

## Scripts

- `npm run dev` — Next.js dev server
- `npm run dev:data` — Dev with `./data` persistence
- `npm run electron:dev` — Electron + Next.js on port 3847
- `npm run build` — Production build (standalone)
- `npm run test:projection` — Projection engine smoke test

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Electron (desktop packaging)
- SQLite + Drizzle ORM
- Gemini 3 Flash (`gemini-3-flash-preview`) with Google Search grounding
- Tailwind CSS 4
