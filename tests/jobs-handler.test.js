const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/jobs.js');

test('jobs handler returns a JSON error when Adzuna credentials are missing', async () => {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
  const result = await new Promise((resolve) => handler({ query: {} }, { setHeader(){}, status(code){ this.code=code; return this; }, json(body){ resolve({ code:this.code, body }); } }));
  if (id) process.env.ADZUNA_APP_ID = id;
  if (key) process.env.ADZUNA_APP_KEY = key;
  assert.equal(result.code, 500);
  assert.match(result.body.error, /Adzuna credentials/i);
});
