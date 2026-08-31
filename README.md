# PowZ Lead Radar — v7 backend fix

Este ZIP contiene los archivos de backend corregidos para el error:

`ERR_REQUIRE_ESM: require() of ES Module ... api/lib/client-scoring.mjs`

## Archivos incluidos

- `api/clients.js`
- `api/lib/client-scoring.mjs`
- `api/jobs.js`
- `tests/client-scoring.test.mjs`

## Cambio principal

`api/clients.js` ahora carga `client-scoring.mjs` con `await import(...)` dentro del handler. Esto evita el conflicto de Vercel al compilar las funciones Node desde ESM a CommonJS.

También se mantiene el scoring de clientes y el orden por fecha más reciente primero.

## Cómo usarlo

En tu repositorio actual, reemplaza:

- `api/clients.js`
- `api/lib/client-scoring.mjs`
- `api/jobs.js`
- `tests/client-scoring.test.mjs`

NO reemplaces `index.html` con este ZIP: este paquete está pensado como parche de backend para conservar la interfaz v7 que ya tienes.

Después haz commit en `main` y espera el deployment de Vercel.
