const SERVICE_TERMS = {
  'Meta Ads': ['meta ads', 'facebook ads', 'facebook advertising', 'meta advertising', 'facebook ads manager'],
  'Google Ads': ['google ads', 'google advertising', 'google ppc', 'ppc specialist', 'paid search'],
  'TikTok Ads': ['tiktok ads', 'tiktok advertising', 'tiktok media buyer', 'tiktok ads specialist'],
  'Media Buying': ['media buyer', 'media buying', 'paid media', 'paid media buyer', 'media buying specialist'],
  'Paid Social': ['paid social', 'performance marketing', 'social ads', 'performance marketer']
};

const COUNTRIES = ['us', 'gb', 'ca', 'au', 'ie', 'es', 'de', 'nl'];

const SERVICE_PATTERN = /\b(meta ads|facebook ads|facebook advertising|meta advertising|facebook ads manager|google ads|google advertising|google ppc|ppc specialist|paid search|tiktok ads|tiktok advertising|tiktok media buyer|tiktok ads specialist|media buyer|media buying|paid media|paid media buyer|media buying specialist|paid social|performance marketing|social ads|performance marketer)\b/i;

const BAD_JOB_PATTERN = /\b(intern(?:ship)?|unpaid|commission only|volunteer|junior developer|software engineer|graphic designer|web developer|accountant|customer service|sales representative|recruiter|warehouse|driver|construction|teacher|nurse)\b/i;

const EMPLOYMENT_PATTERN = /\b(full[- ]time|salary|benefits|employee|join our team|permanent position|staff position)\b/i;

function pickService(text = '') {
  const t = String(text).toLowerCase();
  let best = { service: 'Paid Social', hits: 0 };

  for (const [service, terms] of Object.entries(SERVICE_TERMS)) {
    const hits = terms.reduce((n, term) => n + (t.includes(term) ? 1 : 0), 0);
    if (hits > best.hits) best = { service, hits };
  }

  return best.service;
}

function remoteConfidence(text = '') {
  const t = String(text).toLowerCase();
  if (/worldwide|work from anywhere|anywhere in the world|global remote|remote anywhere/.test(t)) return 'Worldwide';
  if (/fully remote|100% remote|remote-first|remote position|remote role|work remotely/.test(t)) return 'Remote';
  if (/remote|work from home|home-based|distributed team/.test(t)) return 'Likely remote';
  return 'Unknown';
}

export function isRelevantJob(text = '') {
  return SERVICE_PATTERN.test(String(text));
}

export function isBadJob(text = '') {
  return BAD_JOB_PATTERN.test(String(text));
}

function hasPaidMediaResponsibility(text = '') {
  return /\b(manage|managing|run|running|optimize|optimise|scale|scaling|campaign|campaigns|roas|cpa|conversion|acquisition|advertising account|ad account|media buying|paid media)\b/i.test(text);
}

export function scoreJob(job, query = '') {
  const text = `${job?.title || ''} ${job?.description || ''} ${query || ''}`.toLowerCase();

  if (!isRelevantJob(text) || isBadJob(text)) return 0;

  let score = 35;
  const remote = remoteConfidence(text);

  if (remote === 'Worldwide') score += 30;
  else if (remote === 'Remote') score += 25;
  else if (remote === 'Likely remote') score += 15;

  if (/\bfreelance|freelancer|contractor|contract|part[- ]time|retainer\b/i.test(text)) score += 15;
  if (/\bmeta ads|facebook ads|facebook advertising|meta advertising\b/i.test(text)) score += 15;
  if (/\bgoogle ads|google advertising|google ppc|paid search|ppc specialist\b/i.test(text)) score += 15;
  if (/\btiktok ads|tiktok advertising|tiktok media buyer\b/i.test(text)) score += 15;
  if (/\bmedia buyer|media buying|paid media|paid social\b/i.test(text)) score += 15;
  if (hasPaidMediaResponsibility(text)) score += 10;
  if (/\broas|cpa|ctr|conversion rate|performance|scaling|acquisition\b/i.test(text)) score += 5;

  if (/\bintern|unpaid|commission only|volunteer\b/i.test(text)) score -= 40;
  if (EMPLOYMENT_PATTERN.test(text) && /\b(full[- ]time|employee|salary|benefits|join our team|permanent)\b/i.test(text)) score -= 25;

  return Math.max(0, Math.min(100, score));
}

export function normalize(job, country, query) {
  const title = String(job?.title || '').trim();
  const description = String(job?.description || '').trim();
  const text = `${title} ${description}`;
  const created = job?.created || new Date().toISOString();
  const remote = remoteConfidence(`${text} ${query || ''}`);
  const score = scoreJob(job, query);
  const ageMs = Math.max(0, Date.now() - new Date(created).getTime());
  const mins = Math.floor(ageMs / 60000);

  return {
    id: `adzuna-${country}-${job?.id || Buffer.from(title).toString('base64url').slice(0, 24)}`,
    source: 'Adzuna',
    title: title || 'Untitled opportunity',
    company: job?.company?.display_name || '',
    description,
    location: job?.location?.display_name || '',
    salary: job?.salary_min ? `${job.salary_min}${job.salary_max ? `–${job.salary_max}` : '+'}` : '',
    contractType: job?.contract_type || job?.contract_time || '',
    created,
    age: mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`,
    url: job?.redirect_url || '',
    remote: remote !== 'Unknown',
    remoteConfidence: remote,
    service: pickService(text),
    score,
    opportunity: score >= 85 ? 'HOT' : score >= 70 ? 'HIGH POTENTIAL' : score >= 45 ? 'POSSIBLE' : 'LOW',
    linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title || pickService(text))}&f_WT=2`
  };
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { _raw: raw.slice(0, 500) }; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      return res.status(500).json({ error: 'Adzuna credentials are not configured in Vercel.' });
    }

    const query = String(req.query?.q || 'Meta Ads').trim().slice(0, 80);
    const requestedCountry = String(req.query?.country || 'all').toLowerCase();
    const requestedService = String(req.query?.service || 'all');
    const countries = requestedCountry === 'all' ? COUNTRIES : [requestedCountry];

    const serviceTerms = SERVICE_TERMS[requestedService] || [query];
    const searchTerms = [...new Set([query, ...serviceTerms.slice(0, 3)].map(x => String(x).trim()).filter(Boolean))];
    const tasks = [];

    for (const country of countries.slice(0, 8)) {
      for (const term of searchTerms) {
        for (const searchTerm of [`${term} remote`, `${term} freelance remote`]) {
          const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
          url.searchParams.set('app_id', appId);
          url.searchParams.set('app_key', appKey);
          url.searchParams.set('results_per_page', '50');
          url.searchParams.set('what', searchTerm);
          url.searchParams.set('sort_by', 'date');
          url.searchParams.set('content-type', 'application/json');

          tasks.push(fetch(url, { headers: { accept: 'application/json' } }).then(async response => ({
            ok: response.ok,
            status: response.status,
            data: await readJson(response),
            country,
            searchTerm
          })));
        }
      }
    }

    const responses = await Promise.all(tasks);
    const results = [];

    for (const response of responses) {
      if (!response.ok || !Array.isArray(response.data?.results)) continue;

      for (const job of response.data.results) {
        const normalized = normalize(job, response.country, response.searchTerm);
        const text = `${normalized.title} ${normalized.description}`;

        if (!isRelevantJob(text)) continue;
        if (isBadJob(text)) continue;
        if (!normalized.remote) continue;
        if (requestedService !== 'all' && normalized.service !== requestedService) continue;
        if (normalized.score < 45) continue;

        results.push(normalized);
      }
    }

    const unique = [...new Map(results.map(item => [item.url || `${item.title}-${item.company}`, item])).values()];

    unique.sort((a, b) => {
      const dateDiff = new Date(b.created).getTime() - new Date(a.created).getTime();
      return dateDiff || b.score - a.score;
    });

    const finalResults = unique.slice(0, 100);

    return res.status(200).json({
      results: finalResults,
      sourceCount: unique.length,
      totalFound: results.length,
      returned: finalResults.length,
      sortedBy: 'newest_first'
    });
  } catch (error) {
    console.error('Adzuna connector error:', error);
    return res.status(500).json({ error: 'Adzuna connector error.', detail: error?.message || String(error) });
  }
}
