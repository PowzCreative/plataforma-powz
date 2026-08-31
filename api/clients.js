const { buildTavilyQueries, normalizeClient } = require('./lib/client-scoring.js');

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function readTavilyResponse(response) {
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  return { ok: response.ok, status: response.status, data, raw: raw.slice(0, 500) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('X-PowZ-Version', 'v7-final');

  try {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return sendJson(res, 500, { error: 'TAVILY_API_KEY is not configured in Vercel.' });

    const service = String(req.query?.service || 'Meta Ads').slice(0, 60);
    const region = String(req.query?.region || 'worldwide').toLowerCase() === 'rd' ? 'rd' : 'worldwide';
    const queries = buildTavilyQueries(service, region).slice(0, 20);

    const responses = await Promise.all(queries.map(async (query) => {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            api_key: key,
            query,
            search_depth: 'advanced',
            max_results: 8,
            topic: 'general',
            include_answer: false,
            include_raw_content: false
          })
        });
        return { query, ...(await readTavilyResponse(response)) };
      } catch (error) {
        return { query, ok: false, status: 0, data: {}, raw: error.message };
      }
    }));

    const failed = responses.filter((r) => !r.ok);
    const leads = responses
      .filter((r) => r.ok && Array.isArray(r.data?.results))
      .flatMap((r) => r.data.results)
      .map((item) => normalizeClient(item, 'Tavily'))
      .filter((lead) => lead.isClient && lead.score >= 45)
      .filter((lead) => lead.url);

    const unique = [...new Map(leads.map((lead) => [lead.url, lead])).values()]
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime() || b.score - a.score)
      .slice(0, 100);

    if (!unique.length && failed.length === responses.length) {
      return sendJson(res, 502, {
        error: 'Tavily search failed.',
        detail: failed[0]?.raw || 'No valid response from Tavily.',
        upstreamStatus: failed[0]?.status || 0
      });
    }

    return sendJson(res, 200, {
      results: unique,
      sourceCount: unique.length,
      queries,
      region,
      service,
      failedQueries: failed.length
    });
  } catch (error) {
    return sendJson(res, 500, { error: 'Client search failed.', detail: error?.message || String(error) });
  }
};
