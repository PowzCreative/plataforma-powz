import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyClient,
  buildTavilyQueries,
  normalizeClient
} from '../api/lib/client-scoring.mjs';

test(
  'classifies a founder explicitly seeking a Meta Ads freelancer as a hot client',
  () => {
    const text =
      "I'm the founder of an ecommerce brand and need a freelance Meta Ads expert to manage and scale our campaigns.";

    const result =
      classifyClient(text);

    assert.equal(
      result.isClient,
      true
    );

    assert.ok(
      result.score >= 85
    );

    assert.ok(
      result.reasons.some((reason) =>
        reason.includes('founder')
      )
    );

    assert.ok(
      result.reasons.some((reason) =>
        reason.includes('Meta Ads')
      )
    );
  }
);

test(
  'keeps a traditional Media Buyer job as a lower-intent client result',
  () => {
    const text =
      'We are hiring a full-time Media Buyer to join our marketing team.';

    const result =
      classifyClient(text);

    assert.equal(
      result.isClient,
      true
    );

    assert.ok(
      result.score < 70
    );
  }
);

test(
  'builds worldwide and Dominican Republic search queries',
  () => {
    const worldwide =
      buildTavilyQueries(
        'Meta Ads',
        'worldwide'
      );

    const local =
      buildTavilyQueries(
        'Meta Ads',
        'rd'
      );

    assert.ok(
      worldwide.some((query) =>
        query.includes('Meta Ads')
      )
    );

    assert.ok(
      local.some((query) =>
        /Dominican Republic|Santo Domingo|República Dominicana/i.test(
          query
        )
      )
    );
  }
);

test(
  'normalizes a client lead with original URL and evidence',
  () => {
    const lead =
      normalizeClient(
        {
          title:
            'Founder needs Meta Ads help',
          url:
            'https://example.com/post',
          content:
            'Founder looking for a freelancer to manage Meta Ads for my ecommerce business.',
          published_date:
            '2026-08-31T12:00:00Z'
        },
        'Tavily'
      );

    assert.equal(
      lead.url,
      'https://example.com/post'
    );

    assert.equal(
      lead.source,
      'Tavily'
    );

    assert.ok(
      lead.score >= 85
    );

    assert.equal(
      lead.isClient,
      true
    );

    assert.ok(
      lead.reasons.length > 0
    );
  }
);
