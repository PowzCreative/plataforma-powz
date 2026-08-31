# PowZ Lead Radar v7 — clean backend

This package removes the previous `.js` / `.mjs` module conflict and uses CommonJS consistently for Vercel Node functions.

## Files
- `index.html` — standalone UI for Jobs + Clients.
- `api/clients.js` — Tavily client discovery.
- `api/jobs.js` — Adzuna opportunity discovery.
- `api/lib/client-scoring.js` — strict client-intent scoring.
- `api/lib/job-scoring.js` — remote paid-media job scoring.
- `tests/*.test.js` — local regression tests.
- `vercel.json` — valid Vercel Node 20 configuration.
- `package.json` — Node test script and engine.

## Vercel environment variables
Set these in Production (and Preview if desired):
- `TAVILY_API_KEY`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

## GitHub cleanup
Do NOT keep these duplicate paths:
- `api/lib/client-scoring.mjs`
- `api/lib/client-scoring.js`

The v7 package uses **only** `api/lib/client-scoring.js`.

Also keep only one copy of each test filename. The package contains only `.test.js` files.

## Verification
Run:

```bash
npm test
```

The package was designed to avoid the prior ESM/CommonJS `ERR_REQUIRE_ESM`, duplicate-path build error, and non-JSON connector response crash.
