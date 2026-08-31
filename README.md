# PowZ Lead Radar — v7 Final

This version is intentionally **CommonJS end-to-end** for the Vercel Node functions. It does not import `.mjs` from a CommonJS function, avoiding the `ERR_REQUIRE_ESM` failure seen in production.

## Files to upload to the GitHub repository

- `api/clients.js`
- `api/jobs.js`
- `api/lib/client-scoring.js`
- `tests/clients.test.js`
- `tests/jobs.test.js`
- `tests/client-scoring.test.js`
- `package.json`
- `vercel.json`

Keep your existing `index.html` if you only want the backend fix.

## Environment variables in Vercel

Production must contain:

- `TAVILY_API_KEY`
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

## What v7 fixes

1. Removes the `.mjs` / CommonJS module mismatch.
2. Prevents `patterns.some is not a function` by making the pattern matcher type-safe.
3. Prevents non-JSON upstream responses from causing `Unexpected token A` crashes.
4. Jobs are sorted newest → oldest.
5. Clients are sorted newest → oldest.
6. Client results require actual help/hiring intent and reject obvious job seekers, educational content and ordinary employee job posts.
7. Client scoring keeps evidence/reasons for every lead.
8. Both APIs return structured upstream errors instead of crashing.
9. Includes regression tests for the production failures.

## Local verification

```bash
npm test
npm run check
```
