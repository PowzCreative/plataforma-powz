import { Buffer } from 'node:buffer';

export default async function handler(req, res) {
  try {
    // Dynamic import avoids Vercel's ERR_REQUIRE_ESM when the function
    // is compiled from ESM to CommonJS.
    const {
      buildTavilyQueries,
      normalizeClient
    } = await import('./lib/client-scoring.mjs');

    res.setHeader(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=600'
    );

    const key = process.env.TAVILY_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: 'Tavily API key is not configured in Vercel.'
      });
    }

    const service = String(
      req.query?.service || 'Meta Ads'
    ).slice(0, 60);

    const region =
      String(req.query?.region || 'worldwide').toLowerCase() === 'rd'
        ? 'rd'
        : 'worldwide';

    const queries = buildTavilyQueries(service, region);

    const responses = await Promise.all(
      queries.map(async (query) => {
        try {
          const response = await fetch(
            'https://api.tavily.com/search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                accept: 'application/json'
              },
              body: JSON.stringify({
                api_key: key,
                query,
                search_depth: 'basic',
                max_results: 8,
                topic: 'general',
                include_answer: false
              })
            }
          );

          const data = await response.json().catch(() => ({}));

          return {
            ok: response.ok,
            status: response.status,
            data
          };
        } catch (error) {
          return {
            ok: false,
            status: 0,
            data: {
              error: error?.message || 'Tavily request failed.'
            }
          };
        }
      })
    );

    const failed = responses.filter((item) => !item.ok);

    if (failed.length === responses.length) {
      return res.status(502).json({
        error: 'Tavily search failed for every query.',
        detail: failed[0]?.data?.error || 'Unknown Tavily error.',
        queryCount: queries.length
      });
    }

    const leads = responses
      .flatMap((item) =>
        item.ok ? (item.data?.results || []) : []
      )
      .map((item) => normalizeClient(item, 'Tavily'))
      .filter((item) => item.isClient === true)
      .filter((item) => item.score >= 25);

    const unique = [
      ...new Map(
        leads.map((item) => [
          item.url || item.id,
          item
        ])
      ).values()
    ].sort(
      (a, b) =>
        new Date(b.created || 0) - new Date(a.created || 0) ||
        b.score - a.score
    );

    return res.status(200).json({
      results: unique.slice(0, 100),
      sourceCount: unique.length,
      queries,
      region
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Client search failed.',
      detail: error?.message || String(error)
    });
  }
}
