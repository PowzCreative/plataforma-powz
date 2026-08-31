import { buildTavilyQueries, normalizeClient } from './lib/client-scoring.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return res.status(500).json({ error: 'Tavily API key is not configured in Vercel.' });
    const service = String(req.query.service || 'Meta Ads').slice(0, 60);
    const region = req.query.region === 'rd' ? 'rd' : 'worldwide';
    const queries = buildTavilyQueries(service, region);
    const responses = await Promise.all(queries.map(async query => {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ api_key: key, query, search_depth: 'basic', max_results: 8, topic: 'general', include_answer: false })
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, data };
    }));
    const leads = responses.flatMap(x => x.ok ? (x.data.results || []) : []).map(x => normalizeClient(x, 'Tavily'))
      .filter(x => x.score >= 25);
    const unique = [...new Map(leads.map(x => [x.url || x.id, x])).values()]
      .sort((a, b) => b.score - a.score || new Date(b.created) - new Date(a.created));
    return res.status(200).json({ results: unique.slice(0, 100), sourceCount: unique.length, queries, region });
  } catch (e) {
    return res.status(500).json({ error: 'Client search failed.', detail: e.message });
  }
}
