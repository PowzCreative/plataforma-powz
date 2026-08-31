import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyClient,
  buildTavilyQueries,
  normalizeClient
} from '../api/lib/client-scoring.mjs';

test('classifies a founder explicitly seeking a Meta Ads freelancer as a hot client', () => {
  const text =
    "I'm the founder of an ecommerce brand and need a freelance Meta Ads expert to manage and scale our campaigns.";

  const result = classifyClient(text);

  assert.equal(result.isClient, true);
  assert.ok(result.score >= 85);
  assert.ok(result.reasons.some(r => r.includes('founder')));
  assert.ok(result.reasons.some(r => r.includes('Meta Ads')));
});

test('classifies a business owner needing someone to manage paid media as a strong client', () => {
  const text =
    'I own a Shopify brand and we need someone to manage our paid media and Facebook Ads campaigns.';

  const result = classifyClient(text);

  assert.equal(result.isClient, true);
  assert.ok(result.score >= 70);
});

test('does not classify a generic Meta Ads article as a client', () => {
  const text =
    'The ultimate guide to Meta Ads: 10 strategies to improve your Facebook advertising campaigns.';

  const result = classifyClient(text);

  assert.equal(result.isClient, false);
});

test('does not classify a Meta Ads course as a client', () => {
  const text =
    'Learn Meta Ads with our complete Facebook advertising course and training program.';

  const result = classifyClient(text);

  assert.equal(result.isClient, false);
});

test('does not classify a person looking for a job as a client', () => {
  const text =
    'I am a Media Buyer looking for a remote job. Available for work and open to new opportunities.';

  const result = classifyClient(text);

  assert.equal(result.isClient, false);
});

test('traditional employee hiring is not treated as a strong client lead', () => {
  const text =
    'We are hiring a full-time Media Buyer to join our marketing team with salary and benefits.';

  const result = classifyClient(text);

  assert.equal(result.isClient, false);
});

test('a business explicitly looking for a freelancer gets strong intent', () => {
  const text =
    'Our ecommerce company is looking for a freelance media buyer to manage and scale our Meta Ads campaigns.';

  const result = classifyClient(text);

  assert.equal(result.isClient, true);
  assert.ok(result.score >= 75);
});

test('builds worldwide and Dominican Republic search queries', () => {
  const worldwide = buildTavilyQueries('Meta Ads', 'worldwide');
  const local = buildTavilyQueries('Meta Ads', 'rd');

  assert.ok(worldwide.some(q => q.includes('Meta Ads')));
  assert.ok(
    local.some(q =>
      /Dominican Republic|Santo Domingo|República Dominicana/i.test(q)
    )
  );
});

test('normalizes a client lead with original URL and evidence', () => {
  const lead = normalizeClient(
    {
      title: 'Founder needs Meta Ads help',
      url: 'https://example.com/post',
      content:
        'Founder looking for a freelancer to manage Meta Ads for my ecommerce business.',
      published_date: '2026-08-31T12:00:00Z'
    },
    'Tavily'
  );

  assert.equal(lead.url, 'https://example.com/post');
  assert.equal(lead.source, 'Tavily');
  assert.ok(lead.score >= 85);
  assert.ok(lead.reasons.length > 0);
});
