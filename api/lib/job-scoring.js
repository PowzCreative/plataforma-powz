const SERVICE_PATTERNS = {
  'Meta Ads': /\b(meta ads|facebook ads|facebook advertising|facebook ad manager|meta advertising)\b/i,
  'Media Buying': /\b(media buyer|media buying|paid media|paid media buyer|media buying specialist)\b/i,
  'Google Ads': /\b(google ads|google advertising|google ppc|ppc specialist|paid search|google ads specialist)\b/i,
  'TikTok Ads': /\b(tiktok ads|tiktok advertising|tiktok media buyer|tiktok ads specialist)\b/i,
  'Paid Social': /\b(paid social|performance marketing|social ads|performance marketer)\b/i
};

function detectService(text = '') {
  return Object.entries(SERVICE_PATTERNS).find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function remoteConfidence(text = '') {
  const t = String(text).toLowerCase();
  if (/worldwide|work from anywhere|anywhere in the world|global remote|remote anywhere/.test(t)) return 'Worldwide';
  if (/fully remote|100% remote|remote-first|remote position|remote role|work remotely/.test(t)) return 'Remote';
  if (/remote|work from home|home-based|distributed team/.test(t)) return 'Likely remote';
  return 'Unknown';
}

function scoreJob(job, query = '') {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const remote = remoteConfidence(`${text} ${query}`);
  let score = 35;
  if (remote === 'Worldwide') score += 30;
  else if (remote === 'Remote') score += 25;
  else if (remote === 'Likely remote') score += 15;
  if (/freelance|contract|contractor|part-time|retainer/.test(text)) score += 12;
  if (detectService(text)) score += 20;
  if (/manage|optimi[sz]e|scale|campaign|roas|cpa|performance|acquisition/.test(text)) score += 8;
  if (/intern|unpaid|commission only/.test(text)) score -= 40;
  return Math.max(0, Math.min(100, score));
}

function normalizeJob(j, country, q) {
  const text = `${j.title || ''} ${j.description || ''}`;
  const created = j.created || new Date().toISOString();
  const remote = remoteConfidence(`${text} ${q}`);
  const score = scoreJob(j, q);
  return {
    id: `adzuna-${country}-${j.id}`,
    source: 'Adzuna',
    title: j.title || 'Untitled opportunity',
    company: j.company?.display_name || '',
    description: j.description || '',
    location: j.location?.display_name || '',
    salary: j.salary_min != null ? `${j.salary_min}${j.salary_max != null ? `–${j.salary_max}` : '+'}` : '',
    contractType: j.contract_type || j.contract_time || '',
    created,
    url: j.redirect_url || '',
    remote: remote !== 'Unknown',
    remoteConfidence: remote,
    service: detectService(text) || 'Paid Social',
    score,
    linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(j.title || q)}&f_WT=2`
  };
}

module.exports = { SERVICE_PATTERNS, detectService, remoteConfidence, scoreJob, normalizeJob };
