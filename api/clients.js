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

    // Load the ESM scoring module dynamically.
    // This avoids ERR_REQUIRE_ESM when Vercel compiles
    // this serverless function to CommonJS.
    const {
      buildTavilyQueries,
      normalizeClient
    } = await import('./lib/client-scoring.mjs');

    const service = String(
      req.query.service || 'Meta Ads'
    ).slice(0, 60);

    const region =
      req.query.region === 'rd'
        ? 'rd'
        : 'worldwide';

    const queries = buildTavilyQueries(
      service,
      region
    );

    const responses = await Promise.all(
      queries.map(async (query) => {
        try {
          const r = await fetch(
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

          const data = await r
            .json()
            .catch(() => ({}));

          return {
            ok: r.ok,
            status: r.status,
            data
          };
        } catch (error) {
          return {
            ok: false,
            status: 500,
            data: {
              error: error.message
            }
          };
        }
      })
    );

    const leads = responses
      .flatMap((item) =>
        item.ok
          ? item.data.results || []
          : []
      )
      .map((item) =>
        normalizeClient(item, 'Tavily')
      )
      .filter((item) => item.score >= 25);

    const unique = [
      ...new Map(
        leads.map((item) => [
          item.url || item.id,
          item
        ])
      ).values()
    ]
      .sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.created) -
            new Date(a.created)
      );

    return res.status(200).json({
      results: unique.slice(0, 100),
      sourceCount: unique.length,
      queries,
      region
    });

  } catch (error) {
    console.error(
      'Client search failed:',
      error
    );

    return res.status(500).json({
      error: 'Client search failed.',
      detail: error.message
    });
  }
}
