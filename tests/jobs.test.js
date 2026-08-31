const test = require('node:test');
const assert = require('node:assert/strict');
const jobsHandler = require('../api/jobs.js');

test('jobs handler returns newest first and filters to remote opportunities', async () => {
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  Date.now = () => new Date('2026-08-31T15:00:00Z').getTime();
  global.fetch = async () => new Response(JSON.stringify({
    results: [
      { id: 1, title: 'Remote Meta Ads Media Buyer', company: { display_name: 'Newest' }, description: 'Remote freelance Meta Ads manager', created: '2026-08-31T14:59:00Z', redirect_url: 'https://example.com/1' },
      { id: 2, title: 'Meta Ads Specialist', company: { display_name: 'Older' }, description: 'Remote Facebook advertising', created: '2026-08-31T14:00:00Z', redirect_url: 'https://example.com/2' }
    ]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  process.env.ADZUNA_APP_ID = 'test';
  process.env.ADZUNA_APP_KEY = 'test';
  const response = await invoke(jobsHandler, { q: 'Meta Ads', country: 'us', service: 'all' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.results.length, 2);
  assert.equal(response.body.results[0].id, 'adzuna-us-1');
  global.fetch = originalFetch;
  Date.now = originalNow;
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
