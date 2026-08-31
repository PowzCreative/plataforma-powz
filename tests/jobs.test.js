const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreJob, remoteConfidence, normalizeJob } = require('../api/lib/job-scoring.js');

test('scores a remote freelance Meta Ads opportunity highly', () => {
  const job = { title: 'Freelance Meta Ads Media Buyer', description: 'Fully remote. Manage and optimize campaigns, ROAS and CPA.' };
  assert.ok(scoreJob(job, 'Meta Ads') >= 80);
});

test('rejects internships and commission-only jobs from the useful range', () => {
  const job = { title: 'Meta Ads Intern', description: 'Unpaid internship, commission only.' };
  assert.ok(scoreJob(job, 'Meta Ads') < 50);
});

test('detects remote confidence', () => {
  assert.equal(remoteConfidence('Work from anywhere in the world'), 'Worldwide');
  assert.equal(remoteConfidence('Fully remote position'), 'Remote');
  assert.equal(remoteConfidence('Hybrid role'), 'Unknown');
});

test('normalizes an Adzuna job', () => {
  const item = {
    id: 123,
    title: 'Remote Google Ads Specialist',
    description: 'Remote contract role managing PPC campaigns.',
    company: { display_name: 'Example Co' },
    location: { display_name: 'Remote' },
    contract_type: 'contract',
    redirect_url: 'https://example.com/job/123',
    created: '2026-08-31T12:00:00Z'
  };
  const job = normalizeJob(item, 'us', 'Google Ads');
  assert.equal(job.source, 'Adzuna');
  assert.equal(job.url, 'https://example.com/job/123');
  assert.equal(job.created, '2026-08-31T12:00:00Z');
  assert.equal(job.remote, true);
});
