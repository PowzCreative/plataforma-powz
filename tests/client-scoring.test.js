const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyClient, buildTavilyQueries, normalizeClient } = require('../api/lib/client-scoring.js');

test('scores a real founder request for a Meta Ads freelancer as HOT', () => {
  const result = classifyClient("I'm the founder of an ecommerce brand and need a freelance Meta Ads expert to manage and scale our campaigns.");
  assert.equal(result.isClient, true);
  assert.ok(result.score >= 85);
  assert.equal(result.service, 'Meta Ads');
});

test('rejects a normal full-time media buyer job as a client lead', () => {
  const result = classifyClient('We are hiring a full-time Media Buyer to join our marketing team. Apply now and send your resume.');
  assert.equal(result.isClient, false);
  assert.ok(result.score < 50);
});

test('rejects educational content even when it mentions a service', () => {
  const result = classifyClient('The ultimate guide to Meta Ads strategy: how to optimize campaigns and improve ROAS.');
  assert.equal(result.isClient, false);
});

test('requires both intent and a paid-media service signal', () => {
  const result = classifyClient('I need help growing my ecommerce business.');
  assert.equal(result.isClient, false);
});

test('builds targeted worldwide and Dominican Republic queries', () => {
  const worldwide = buildTavilyQueries('Meta Ads', 'worldwide');
  const local = buildTavilyQueries('Meta Ads', 'rd');
  assert.ok(worldwide.length >= 8);
  assert.ok(worldwide.every(q => /Meta Ads/i.test(q)));
  assert.ok(local.every(q => /Dominican Republic|Santo Domingo|República Dominicana/i.test(q)));
});

test('normalizes a lead while preserving its original URL and date', () => {
  const lead = normalizeClient({
    title: 'Founder needs Meta Ads help',
    url: 'https://example.com/post',
    content: 'Founder looking for a freelancer to manage Meta Ads for my ecommerce business.',
    published_date: '2026-08-31T12:00:00Z'
  });
  assert.equal(lead.url, 'https://example.com/post');
  assert.equal(lead.created, '2026-08-31T12:00:00Z');
  assert.equal(lead.source, 'Tavily');
  assert.equal(lead.isClient, true);
});
