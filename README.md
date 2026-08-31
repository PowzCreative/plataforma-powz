# PowZ Lead Radar v0.3

Live MVP with an Adzuna connector.

## Required environment variables

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

Do not commit credentials to GitHub. Configure them in the hosting provider's environment variables.

## Deploy

This project is structured for Vercel: `index.html` is the frontend and `api/jobs.js` is the serverless API endpoint.

The first connector searches multiple Adzuna markets, applies a remote-work heuristic, normalizes results and calculates a preliminary PowZ score.

Next connectors can be added without changing the frontend contract: each source should return the same normalized opportunity shape.
