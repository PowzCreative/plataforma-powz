# PowZ Lead Radar v0.6

PowZ Lead Radar now has two modes: Jobs and Clients.

## Modes

- **Jobs (orange):** live Adzuna remote paid-media opportunities plus safe LinkedIn Jobs search links.
- **Clients (electric blue):** Tavily public-web search for client-intent signals.
- **Local RD:** Clients mode can restrict searches to Dominican Republic / Santo Domingo signals.
- Client results are all shown when detected; the score ranks intent and does not hide lower-scoring leads.
- Clients mode uses a subtle star-field background and animated orange/blue mode transition.

## Environment variables

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `TAVILY_API_KEY`

Keep all secrets in Vercel Environment Variables. Never commit API keys to GitHub.

## Security / source policy

LinkedIn is not scraped or automated. LinkedIn buttons open public Jobs search URLs so the user can review the original opportunity on LinkedIn.

Client Hunter uses Tavily to discover public web results and normalizes them into a PowZ intent score. It is an assistive ranking system, not proof that a person is a business owner or that they will buy services.

## Local development tests

Run:

```bash
node --test tests/client-scoring.test.mjs
```
