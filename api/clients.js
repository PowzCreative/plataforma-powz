const { buildTavilyQueries, normalizeClient } = require('./lib/client-scoring.js');

function json(res, status, body) {
  res.status(status).json(body);
}

async function safeJson(response) {
  const text = await response.text();
  try { return { data: JSON.parse(text), raw: text }; }
  catch { return { data: {}, raw: text }; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  try {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return json(res, 500, { error: 'Tavily API key is not configured in Vercel.' });

    const service = String(req.query.service || 'Meta Ads').slice(0, 60);
    const region = req.query.region === 'rd' ? 'rd' : 'worldwide';
    const minScore = Math.max(0, Math.min(100, Number(req.query.minScore || 50)));
    const queries = buildTavilyQueries(service, region);

    const responses = await Promise.all(queries.map(async (query) => {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: 'advanced',
          max_results: 10,
          topic: 'general',
          include_answer: false,
          include_raw_content: false
        })
      });
      const parsed = await safeJson(response);
      return { ok: response.ok, status: response.status, data: parsed.data, raw: parsed.raw, query };
    }));

    const failures = responses.filter((x) => !x.ok).map((x) => ({ status: x.status, query: x.query, detail: String(x.raw).slice(0, 180) }));
    const leads = responses
      .filter((x) => x.ok && Array.isArray(x.data.results))
      .flatMap((x) => x.data.results)
      .map((x) => normalizeClient(x, 'Tavily'))
      .filter((x) => x.isClient && x.score >= minScore && x.service === service);

    const unique = [...new Map(leads.map((x) => [x.url || x.id, x])).values()]
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime() || b.score - a.score);

    return json(res, 200, {
      results: unique.slice(0, 100),
      sourceCount: unique.length,
      queries,
      region,
      minScore,
      warnings: failures.length ? failures : []
    });
  } catch (error) {
    return json(res, 500, { error: 'Client search failed.', detail: error?.message || String(error) });
  }
};
