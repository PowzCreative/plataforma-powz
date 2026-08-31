import { buildTavilyQueries, normalizeClient } from './lib/client-scoring.mjs';

export default async function handler(req, res) {
  res.setHeader(
    'Cache-Control',
    's-maxage=300, stale-while-revalidate=600'
  );

  try {
    const key = process.env.TAVILY_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: 'Tavily API key is not configured in Vercel.'
      });
    }

    const service = String(
      req.query.service || 'Meta Ads'
    ).slice(0, 60);

    const region =
      req.query.region === 'rd'
        ? 'rd'
        : 'worldwide';

    const queries = buildTavilyQueries(service, region);

    const responses = await Promise.all(
      queries.map(async (query) => {
        try {
          const r = await fetch(
            'https://api.tavily.com/search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
              },
              body: JSON.stringify({
                query,
                search_depth: 'basic',
                max_results: 8,
                topic: 'general',
                include_answer: false
              })
            }
          );

          const text = await r.text();

          let data;

          try {
            data = JSON.parse(text);
          } catch {
            data = {
              error: text || 'Tavily returned an invalid response.'
            };
          }

          return {
            ok: r.ok,
            status: r.status,
            data
          };
        } catch (error) {
          return {
            ok: false,
            status: 0,
            data: {
              error: error.message
            }
          };
        }
      })
    );

    const failedResponses = responses.filter(
      (response) => !response.ok
    );

    if (failedResponses.length > 0) {
      const firstError = failedResponses[0];

      return res.status(502).json({
        error: 'Tavily request failed.',
        status: firstError.status,
        detail: firstError.data?.error || 'Unknown Tavily error.'
      });
    }

    const leads = responses
      .flatMap((response) =>
        Array.isArray(response.data?.results)
          ? response.data.results
          : []
      )
      .map((result) =>
        normalizeClient(result, 'Tavily')
      )
      .filter((lead) => lead.score >= 25);

    const unique = [
      ...new Map(
        leads.map((lead) => [
          lead.url || lead.id,
          lead
        ])
      ).values()
    ].sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.created) - new Date(a.created)
    );

    return res.status(200).json({
      results: unique.slice(0, 100),
      sourceCount: unique.length,
      queries,
      region
    });

  } catch (error) {
    console.error('Client search failed:', error);

    return res.status(500).json({
      error: 'Client search failed.',
      detail: error.message
    });
  }
}
