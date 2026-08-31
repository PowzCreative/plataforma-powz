const SERVICE_TERMS = {
  'Meta Ads': ['meta ads', 'facebook ads', 'facebook advertising', 'facebook media buyer'],
  'Google Ads': ['google ads', 'google advertising', 'google ppc', 'ppc specialist', 'paid search'],
  'TikTok Ads': ['tiktok ads', 'tiktok advertising', 'tiktok media buyer'],
  'Media Buying': ['media buyer', 'media buying', 'media buyer specialist', 'paid media'],
  'Paid Social': ['paid social', 'performance marketing', 'paid social specialist', 'social ads']
};

const COUNTRIES = ['us', 'gb', 'ca', 'au', 'ie', 'es', 'de', 'nl'];

function pickService(text) {
  const lower = String(text || '').toLowerCase();
  let best = { service: 'Paid Social', hits: 0 };
  for (const [service, terms] of Object.entries(SERVICE_TERMS)) {
    const hits = terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
    if (hits > best.hits) best = { service, hits };
  }
  return best.service;
}

function remoteConfidence(text) {
  const t = String(text || '').toLowerCase();
  if (/worldwide|work from anywhere|anywhere in the world|global remote|remote anywhere/.test(t)) return 'Worldwide';
  if (/fully remote|100% remote|remote-first|remote position|remote role|work remotely/.test(t)) return 'Remote';
  if (/remote|work from home|home-based|distributed team/.test(t)) return 'Likely remote';
  return 'Unknown';
}

function scoreJob(job, query) {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const remote = remoteConfidence(`${text} ${query || ''}`);
  let score = 35;
  if (remote === 'Worldwide') score += 30;
  else if (remote === 'Remote') score += 25;
  else if (remote === 'Likely remote') score += 15;
  if (/freelance|contract|contractor|part-time|retainer/.test(text)) score += 12;
  if (/meta ads|facebook ads|google ads|tiktok ads|paid social|media buyer|media buying/.test(text)) score += 15;
  if (/manage|optimi[sz]e|scale|campaign|roas|cpa|performance|acquisition/.test(text)) score += 8;
  if (/intern|unpaid|commission only/.test(text)) score -= 35;
  return Math.max(0, Math.min(100, score));
}

function normalize(job, country, query) {
  const text = `${job.title || ''} ${job.description || ''}`;
  const created = job.created || job.date || new Date().toISOString();
  const parsed = new Date(created);
  const timestamp = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  const ageMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const mins = Math.floor(ageMs / 60000);
  const remoteConfidenceValue = remoteConfidence(`${text} ${query || ''}`);
  const salary = job.salary_min != null
    ? `${job.salary_min}${job.salary_max != null ? `–${job.salary_max}` : '+'}`
    : '';

  return {
    id: `adzuna-${country}-${job.id}`,
    source: 'Adzuna',
    title: job.title || 'Untitled opportunity',
    company: job.company?.display_name || '',
    description: job.description || '',
    location: job.location?.display_name || '',
    salary,
    contractType: job.contract_type || job.contract_time || '',
    created: timestamp,
    age: mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`,
    url: job.redirect_url || job.adref || '',
    remote: remoteConfidenceValue !== 'Unknown',
    remoteConfidence: remoteConfidenceValue,
    service: pickService(text),
    score: scoreJob(job, query),
    linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.title || pickService(text))}&f_WT=2`
  };
}

async function readJson(response) {
  const raw = await response.text();
  try { return { data: raw ? JSON.parse(raw) : {}, raw }; }
  catch { return { data: {}, raw }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('X-PowZ-Version', 'v7-final');

  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return res.status(500).json({ error: 'ADZUNA_APP_ID / ADZUNA_APP_KEY are not configured in Vercel.' });

    const q = String(req.query?.q || 'Meta Ads').trim().slice(0, 60);
    const requestedCountry = String(req.query?.country || 'all').toLowerCase();
    const service = String(req.query?.service || 'all');
    const codes = requestedCountry === 'all' ? COUNTRIES : COUNTRIES.includes(requestedCountry) ? [requestedCountry] : COUNTRIES;
    const terms = q ? [`${q} remote`, `${q} freelance remote`] : [`${service} remote`, `${service} freelance remote`];
    const tasks = [];

    for (const country of codes) {
      for (const term of terms) {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
        url.searchParams.set('app_id', appId);
        url.searchParams.set('app_key', appKey);
        url.searchParams.set('results_per_page', '20');
        url.searchParams.set('what', term);
        url.searchParams.set('content-type', 'application/json');
        url.searchParams.set('sort_by', 'date');
        tasks.push(fetch(url, { headers: { Accept: 'application/json' } }).then(async (response) => ({ country, term, ok: response.ok, status: response.status, ...(await readJson(response)) })).catch((error) => ({ country, term, ok: false, status: 0, data: {}, raw: error.message })));
      }
    }

    const responses = await Promise.all(tasks);
    const successful = responses.filter((response) => response.ok && Array.isArray(response.data?.results));
    const failed = responses.filter((response) => !response.ok);
    const output = [];

    for (const response of successful) {
      for (const job of response.data.results) {
        const normalized = normalize(job, response.country, response.term);
        const matchesService = service === 'all' || normalized.service === service;
        if (normalized.remote && matchesService) output.push(normalized);
      }
    }

    const unique = [...new Map(output.map((item) => [item.id, item])).values()]
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime() || b.score - a.score)
      .slice(0, 100);

    if (!unique.length && failed.length === responses.length) {
      return res.status(502).json({ error: 'Adzuna search failed.', detail: failed[0]?.raw || 'No valid response from Adzuna.', upstreamStatus: failed[0]?.status || 0 });
    }

    return res.status(200).json({ results: unique, sourceCount: unique.length, query: q, country: requestedCountry, service, failedQueries: failed.length });
  } catch (error) {
    return res.status(500).json({ error: 'Adzuna connector error.', detail: error?.message || String(error) });
  }
};
