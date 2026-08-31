import test from 'node:test';
import assert from 'node:assert/strict';
import { isRelevantJob, isBadJob, scoreJob, normalize } from '../api/jobs.js';

test('accepts a remote paid-media role', () => {
  const job = {
    title: 'Remote Meta Ads Media Buyer',
    description: 'Manage and scale Meta Ads campaigns for ecommerce brands. Freelance contract.'
  };
  assert.equal(isRelevantJob(`${job.title} ${job.description}`), true);
  assert.equal(isBadJob(`${job.title} ${job.description}`), false);
  assert.ok(scoreJob(job, 'Meta Ads') >= 80);
});

test('rejects unrelated and clearly bad jobs', () => {
  assert.equal(isRelevantJob('Remote Software Engineer'), false);
  assert.equal(isBadJob('Remote Meta Ads Internship unpaid'), true);
  assert.equal(scoreJob({ title: 'Remote Meta Ads Internship', description: 'Unpaid internship' }, 'Meta Ads'), 0);
});

test('normalizes a job and preserves its publication date', () => {
  const job = normalize({
    id: 123,
    title: 'Remote Google Ads Specialist',
    description: 'Optimize Google Ads and manage paid search campaigns.',
    created: '2026-08-31T12:00:00Z',
    redirect_url: 'https://example.com/job/123',
    company: { display_name: 'Example' },
    location: { display_name: 'Remote' }
  }, 'us', 'Google Ads remote');

  assert.equal(job.created, '2026-08-31T12:00:00Z');
  assert.equal(job.source, 'Adzuna');
  assert.equal(job.remote, true);
  assert.equal(job.url, 'https://example.com/job/123');
});
