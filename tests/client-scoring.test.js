const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyClient, buildTavilyQueries, normalizeClient, hasAnyPattern } = require('../api/lib/client-scoring.js');

test('classifies a founder explicitly seeking a Meta Ads freelancer as a hot client', () => {
  const result = classifyClient("I'm the founder of an ecommerce brand and need a freelance Meta Ads expert to manage and scale our campaigns.");
  assert.equal(result.isClient, true);
  assert.ok(result.score >= 85, `score was ${result.score}`);
  assert.ok(result.reasons.some((reason) => reason.includes('founder')));
  assert.ok(result.reasons.some((reason) => reason.includes('Meta Ads')));
});

test('rejects a normal full-time media buyer job as a client', () => {
  const result = classifyClient('We are hiring a full-time Media Buyer to join our marketing team. Apply now and send your resume.');
  assert.equal(result.isClient, false);
  assert.ok(result.score < 50, `score was ${result.score}`);
});

test('rejects job seekers and educational articles', () => {
  assert.equal(classifyClient('Media buyer open to work, looking for a new job.').isClient, false);
  assert.equal(classifyClient('Ultimate guide to Meta Ads strategy and tutorials.').isClient, false);
});

test('builds worldwide and Dominican Republic client-intent queries', () => {
  const worldwide = buildTavilyQueries('Meta Ads', 'worldwide');
  const local = buildTavilyQueries('Meta Ads', 'rd');
  assert.ok(worldwide.some((query) => query.includes('Meta Ads')));
  assert.ok(worldwide.some((query) => query.includes('freelancer')));
  assert.ok(local.some((query) => /Dominican Republic|Santo Domingo|República Dominicana/i.test(query)));
});

test('normalizes a client lead and preserves original URL and evidence', () => {
  const lead = normalizeClient({
    title: 'Founder needs Meta Ads help',
    url: 'https://example.com/post',
    content: 'Founder looking for a freelancer to manage Meta Ads for my ecommerce business.',
    published_date: '2026-08-31T12:00:00Z'
  }, 'Tavily');
  assert.equal(lead.url, 'https://example.com/post');
  assert.equal(lead.source, 'Tavily');
  assert.equal(lead.isClient, true);
  assert.ok(lead.score >= 85, `score was ${lead.score}`);
  assert.ok(lead.reasons.length > 0);
});

test('hasAnyPattern is safe for RegExp, arrays, strings, and invalid values', () => {
  assert.equal(hasAnyPattern('need a media buyer', /media buyer/i), true);
  assert.equal(hasAnyPattern('need a media buyer', [/google ads/i, /media buyer/i]), true);
  assert.equal(hasAnyPattern('Need A Media Buyer', 'media buyer'), true);
  assert.equal(hasAnyPattern('anything', null), false);
});
