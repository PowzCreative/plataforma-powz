const test = require('node:test');
const assert = require('node:assert/strict');
const clientsHandler = require('../api/clients.js');

test('clients handler accepts valid JSON from Tavily and returns only real client-intent leads', async () => {
  const originalFetch = global.fetch;
  process.env.TAVILY_API_KEY = 'test';
  global.fetch = async () => new Response(JSON.stringify({
    results: [
      { title: 'Founder needs a Meta Ads freelancer', url: 'https://example.com/new', content: 'I own an ecommerce business and need a freelance Meta Ads expert to manage and scale our campaigns.', published_date: '2026-08-31T14:59:00Z' },
      { title: 'We are hiring a full-time Media Buyer', url: 'https://example.com/job', content: 'Join our team, salary and benefits. Apply now.', published_date: '2026-08-31T15:00:00Z' }
    ]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const response = await invoke(clientsHandler, { service: 'Meta Ads', region: 'worldwide' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.results[0].url, 'https://example.com/new');
  assert.equal(response.body.results[0].isClient, true);
  global.fetch = originalFetch;
});

test('clients handler does not crash when Tavily returns non-JSON', async () => {
  const originalFetch = global.fetch;
  process.env.TAVILY_API_KEY = 'test';
  global.fetch = async () => new Response('A server error occurred', { status: 500 });
  const response = await invoke(clientsHandler, { service: 'Meta Ads', region: 'worldwide' });
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.error, 'Tavily search failed.');
  global.fetch = originalFetch;
});

function invoke(handler, query) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      body: null,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve(this); }
    };
    Promise.resolve(handler({ query }, response)).catch(reject);
  });
}
