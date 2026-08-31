# PowZ Lead Radar v0.7

PowZ Lead Radar has two live discovery modes:

- **Jobs:** Adzuna remote paid-media opportunities, newest first, with stricter relevance filters.
- **Clients:** Tavily public-web client-intent signals, newest first, with the existing PowZ scoring model.
- **Local RD:** Clients can restrict searches to Dominican Republic / Santo Domingo signals.

## v0.7 fixes

- Fixed the Jobs API syntax issue that caused Vercel 500 responses and `Unexpected token 'A'` in the browser.
- Jobs are sorted newest → oldest by source publication date.
- Jobs without a paid-media/media-buying signal are discarded.
- Unpaid internships and unrelated roles are discarded.
- Remote-only job filtering is preserved.
- Clients are sorted newest → oldest.
- API JSON parsing is defensive so upstream errors are shown clearly instead of as a JSON parsing error.

## Environment variables

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `TAVILY_API_KEY`

Keep all secrets in Vercel Environment Variables. Never commit API keys to GitHub.

## Tests

```bash
node --test tests/client-scoring.test.mjs tests/jobs.test.mjs
```
