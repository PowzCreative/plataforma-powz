const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/clients.js');

test('clients handler returns a JSON error when Tavily key is missing', async () => {
  const previous = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  const result = await new Promise((resolve) => handler({ query: {} }, { setHeader(){}, status(code){ this.code=code; return this; }, json(body){ resolve({ code:this.code, body }); } }));
  if (previous) process.env.TAVILY_API_KEY = previous;
  assert.equal(result.code, 500);
  assert.match(result.body.error, /Tavily API key/i);
});
