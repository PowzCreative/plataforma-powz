const test = require('node:test');
const assert = require('node:assert/strict');
const clients = require('../api/clients.js');
const jobs = require('../api/jobs.js');

function responseMock() {
  const state = {};
  return {
    setHeader() {},
    status(code) { state.code = code; return this; },
    json(body) { state.body = body; },
    get state() { return state; }
  };
}

test('clients handler keeps only strict client leads and sorts newest first', async () => {
  process.env.TAVILY_API_KEY = 'test';
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, async text() { return JSON.stringify({ results: [
    { title: 'Founder needs Meta Ads freelancer', url: 'https://x.test/old', content: 'I am the founder of an ecommerce brand and need a freelance Meta Ads expert.', published_date: '2026-08-30T12:00:00Z' },
    { title: 'Ultimate Meta Ads guide', url: 'https://x.test/bad', content: 'The ultimate guide to Meta Ads strategy and ROAS.', published_date: '2026-08-31T12:00:00Z' },
    { title: 'Owner looking for Meta Ads help', url: 'https://x.test/new', content: 'Business owner looking for someone to manage our Meta Ads campaigns for our store.', published_date: '2026-08-31T15:00:00Z' }
  ] }); } });
  const res = responseMock();
  await clients({ query: { service: 'Meta Ads', region: 'worldwide', minScore: '50' } }, res);
  global.fetch = oldFetch;
  assert.equal(res.state.code, 200);
  assert.equal(res.state.body.results.length, 2);
  assert.equal(res.state.body.results[0].url, 'https://x.test/new');
});

test('jobs handler keeps remote paid-media jobs and sorts newest first', async () => {
  process.env.ADZUNA_APP_ID = 'test';
  process.env.ADZUNA_APP_KEY = 'test';
  const oldFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, async text() { return JSON.stringify({ results: [
    { id: 1, title: 'Remote Meta Ads Media Buyer', description: 'Fully remote freelance role managing ROAS and campaigns.', company:{display_name:'A'}, location:{display_name:'Remote'}, contract_type:'contract', redirect_url:'https://x.test/old', created:'2026-08-30T12:00:00Z' },
    { id: 2, title: 'Remote Google Ads Specialist', description: 'Work from anywhere. Manage PPC campaigns.', company:{display_name:'B'}, location:{display_name:'Remote'}, contract_type:'contract', redirect_url:'https://x.test/new', created:'2026-08-31T15:00:00Z' }
  ] }); } });
  const res = responseMock();
  await jobs({ query: { q: 'Meta Ads', country: 'us', service: 'all', minScore: '55' } }, res);
  global.fetch = oldFetch;
  assert.equal(res.state.code, 200);
  assert.equal(res.state.body.results.length, 2);
  assert.equal(res.state.body.results[0].url, 'https://x.test/new');
});
