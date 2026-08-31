const { scoreJob, normalizeJob, detectService } = require('./lib/job-scoring.js');

const COUNTRIES = ['us', 'gb', 'ca', 'au', 'ie', 'es', 'de', 'nl'];
const SERVICES = ['Meta Ads', 'Media Buying', 'Google Ads', 'TikTok Ads', 'Paid Social'];

function json(res, status, body) { res.status(status).json(body); }

async function safeJson(response) {
  const text = await response.text();
  try { return { data: JSON.parse(text), raw: text }; }
  catch { return { data: {}, raw: text }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return json(res, 500, { error: 'Adzuna credentials are not configured in Vercel.' });

    const q = String(req.query.q || 'Meta Ads').trim().slice(0, 80);
    const country = String(req.query.country || 'all').toLowerCase();
    const service = SERVICES.includes(String(req.query.service || '')) ? String(req.query.service) : 'all';
    const minScore = Math.max(0, Math.min(100, Number(req.query.minScore || 55)));
    const codes = country === 'all' ? COUNTRIES : COUNTRIES.includes(country) ? [country] : COUNTRIES;
    const baseTerm = service !== 'all' ? service : q;
    const terms = [`${baseTerm} remote`, `${baseTerm} freelance remote`];

    const tasks = [];
    for (const code of codes) {
      for (const term of terms) {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/${code}/search/1`);
        url.searchParams.set('app_id', appId);
        url.searchParams.set('app_key', appKey);
        url.searchParams.set('results_per_page', '20');
        url.searchParams.set('what', term);
        url.searchParams.set('content-type', 'application/json');
        url.searchParams.set('sort_by', 'date');
        tasks.push(fetch(url, { headers: { accept: 'application/json' } }).then(async (response) => {
          const parsed = await safeJson(response);
          return { ok: response.ok, status: response.status, data: parsed.data, raw: parsed.raw, code, term };
        }));
      }
    }

    const responses = await Promise.all(tasks);
    const failures = responses.filter((x) => !x.ok).map((x) => ({ status: x.status, country: x.code, term: x.term, detail: String(x.raw).slice(0, 180) }));
    const jobs = [];

    for (const response of responses) {
      if (!response.ok || !Array.isArray(response.data.results)) continue;
      for (const item of response.data.results) {
        const normalized = normalizeJob(item, response.code, response.term);
        if (!normalized.remote) continue;
        if (service !== 'all' && normalized.service !== service) continue;
        if (service === 'all' && !detectService(`${item.title || ''} ${item.description || ''}`)) continue;
        if (normalized.score < minScore) continue;
        jobs.push(normalized);
      }
    }

    const unique = [...new Map(jobs.map((x) => [x.id, x])).values()]
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime() || b.score - a.score);

    return json(res, 200, { results: unique.slice(0, 100), sourceCount: unique.length, minScore, warnings: failures });
  } catch (error) {
    return json(res, 500, { error: 'Job search failed.', detail: error?.message || String(error) });
  }
};
