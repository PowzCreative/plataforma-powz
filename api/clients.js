import { buildTavilyQueries, normalizeClient } from './lib/client-scoring.mjs';

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { _raw: raw.slice(0, 500) }; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return res.status(500).json({ error: 'Tavily API key is not configured in Vercel.' });

    const service = String(req.query?.service || 'Meta Ads').slice(0, 60);
    const region = req.query?.region === 'rd' ? 'rd' : 'worldwide';
    const queries = buildTavilyQueries(service, region);

    const responses = await Promise.all(queries.map(async query => {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: 'basic',
          max_results: 10,
          topic: 'general',
          include_answer: false
        })
      });

      return { ok: response.ok, status: response.status, data: await readJson(response) };
    }));

    const leads = responses
      .filter(x => x.ok && Array.isArray(x.data?.results))
      .flatMap(x => x.data.results)
      .map(x => normalizeClient(x, 'Tavily'))
      .filter(x => x.score >= 25);

    const unique = [...new Map(leads.map(x => [x.url || x.id, x])).values()];

    unique.sort((a, b) => {
      const dateDiff = new Date(b.created).getTime() - new Date(a.created).getTime();
      return dateDiff || b.score - a.score;
    });

    return res.status(200).json({
      results: unique.slice(0, 100),
      sourceCount: unique.length,
      queries,
      region,
      sortedBy: 'newest_first'
    });
  } catch (error) {
    console.error('Client search failed:', error);
    return res.status(500).json({ error: 'Client search failed.', detail: error?.message || String(error) });
  }
}
