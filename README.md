# PowZ Lead Radar v0.4

Live MVP with an Adzuna remote-opportunity connector.

## Environment variables

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

Never commit credentials to GitHub.

## What changed in v0.4

- Remote-focused Adzuna queries (`service + remote` and `service + freelance remote`)
- Remote confidence labels: Worldwide / Remote / Likely remote
- Preliminary PowZ opportunity score
- Multiple markets
- Duplicate removal
- Newest-first sorting
- Backend remains server-side so the Adzuna key is not exposed to the browser

## Deployment

Designed for Vercel with:
- `index.html`
- `api/jobs.js`
- `vercel.json`

The next stages add more sources (Jooble, Upwork where authorized, other freelance/job boards and legitimate career-page sources) behind the same normalized opportunity format.
