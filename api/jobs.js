const SERVICE_TERMS = {
  "Meta Ads": [
    "meta ads",
    "facebook ads",
    "facebook advertising",
    "meta advertising",
    "facebook ads manager"
  ],

  "Google Ads": [
    "google ads",
    "google advertising",
    "google ppc",
    "ppc specialist",
    "paid search"
  ],

  "TikTok Ads": [
    "tiktok ads",
    "tiktok advertising",
    "tiktok media buyer",
    "tiktok ads specialist"
  ],

  "Media Buying": [
    "media buyer",
    "media buying",
    "paid media",
    "paid media buyer",
    "media buying specialist"
  ],

  "Paid Social": [
    "paid social",
    "performance marketing",
    "social ads",
    "performance marketer"
  ]
};

const COUNTRIES = [
  "us",
  "gb",
  "ca",
  "au",
  "ie",
  "es",
  "de",
  "nl"
];

/*
 * Detecta el servicio principal.
 */
function pickService(text = "") {
  const t = text.toLowerCase();

  let best = {
    service: "Paid Social",
    hits: 0
  };

  for (const [service, terms] of Object.entries(SERVICE_TERMS)) {
    const hits = terms.reduce(
      (total, term) => total + (t.includes(term) ? 1 : 0),
      0
    );

    if (hits > best.hits) {
      best = {
        service,
        hits
      };
    }
  }

  return best.service;
}

/*
 * Detecta qué tan claramente el trabajo es remoto.
 */
function remoteConfidence(text = "") {
  const t = text.toLowerCase();

  if (
    /worldwide|work from anywhere|anywhere in the world|global remote|remote anywhere/.test(
      t
    )
  ) {
    return "Worldwide";
  }

  if (
    /fully remote|100% remote|remote-first|remote position|remote role|work remotely/.test(
      t
    )
  ) {
    return "Remote";
  }

  if (
    /remote|work from home|home-based|distributed team/.test(t)
  ) {
    return "Likely remote";
  }

  return "Unknown";
}

/*
 * Detecta si realmente parece una oportunidad relacionada
 * con media buying / paid media.
 */
function isRelevantJob(text = "") {
  const t = text.toLowerCase();

  const serviceSignal =
    /\b(
      meta ads|
      facebook ads|
      facebook advertising|
      meta advertising|
      google ads|
      google advertising|
      google ppc|
      ppc specialist|
      paid search|
      tiktok ads|
      tiktok advertising|
      tiktok media buyer|
      media buyer|
      media buying|
      paid media|
      paid media buyer|
      paid social|
      performance marketing|
      social ads|
      performance marketer
    )\b/ix.test(t);

  if (!serviceSignal) {
    return false;
  }

  return true;
}

/*
 * Detecta puestos que NO queremos mostrar.
 */
function isBadJob(text = "") {
  const t = text.toLowerCase();

  const badPatterns = [
    /\bintern(ship)?\b/,
    /\bunpaid\b/,
    /\bcommission only\b/,
    /\bvolunteer\b/,
    /\bjunior developer\b/,
    /\bsoftware engineer\b/,
    /\bgraphic designer\b/,
    /\bweb developer\b/,
    /\baccountant\b/,
    /\bcustomer service\b/,
    /\bsales representative\b/,
    /\brecruiter\b/,
    /\bwarehouse\b/,
    /\bdriver\b/,
    /\bconstruction\b/,
    /\bteacher\b/,
    /\bnurse\b/
  ];

  return badPatterns.some((pattern) => pattern.test(t));
}

/*
 * Determina si el puesto parece buscar a alguien para
 * ejecutar campañas y no solamente un puesto genérico.
 */
function hasPaidMediaResponsibility(text = "") {
  const t = text.toLowerCase();

  return /\b(
    manage|
    managing|
    run|
    running|
    optimize|
    optimise|
    scale|
    scaling|
    campaign|
    campaigns|
    roas|
    cpa|
    conversion|
    acquisition|
    advertising account|
    ad account|
    media buying|
    paid media
  )\b/ix.test(t);
}

/*
 * Score más fino.
 */
function scoreJob(job, query = "") {
  const text = `${job.title || ""} ${job.description || ""} ${query || ""}`.toLowerCase();

  if (!isRelevantJob(text)) {
    return 0;
  }

  if (isBadJob(text)) {
    return 10;
  }

  let score = 35;

  const remote = remoteConfidence(text);

  if (remote === "Worldwide") {
    score += 30;
  } else if (remote === "Remote") {
    score += 25;
  } else if (remote === "Likely remote") {
    score += 15;
  }

  /*
   * Modalidad favorable para PowZ.
   */
  if (
    /\bfreelance|freelancer|contractor|contract|part[- ]time|retainer\b/.test(
      text
    )
  ) {
    score += 15;
  }

  /*
   * Servicio específico.
   */
  if (
    /\bmeta ads|facebook ads|facebook advertising|meta advertising\b/.test(
      text
    )
  ) {
    score += 15;
  }

  if (
    /\bgoogle ads|google advertising|google ppc|paid search|ppc specialist\b/.test(
      text
    )
  ) {
    score += 15;
  }

  if (
    /\btiktok ads|tiktok advertising|tiktok media buyer\b/.test(
      text
    )
  ) {
    score += 15;
  }

  if (
    /\bmedia buyer|media buying|paid media|paid social\b/.test(
      text
    )
  ) {
    score += 15;
  }

  /*
   * Responsabilidad real sobre campañas.
   */
  if (hasPaidMediaResponsibility(text)) {
    score += 10;
  }

  /*
   * Experiencia / performance.
   */
  if (
    /\broas|cpa|ctr|conversion rate|performance|scale|scaling|acquisition\b/.test(
      text
    )
  ) {
    score += 5;
  }

  /*
   * Penalizaciones.
   */
  if (
    /\bintern|unpaid|commission only|volunteer\b/.test(text)
  ) {
    score -= 40;
  }

  if (
    /\bfull[- ]time\b/.test(text) &&
    /\bemployee|salary|benefits|join our team|permanent\b/.test(text)
  ) {
    score -= 25;
  }

  return Math.max(0, Math.min(100, score));
}

/*
 * Normaliza los resultados de Adzuna.
 */
function normalize(job, country, query) {
  const title = String(job.title || "").trim();

  const description = String(
    job.description || ""
  ).trim();

  const text = `${title} ${description}`;

  const created =
    job.created ||
    new Date().toISOString();

  const remote =
    remoteConfidence(`${text} ${query}`);

  const score =
    scoreJob(job, query);

  return {
    id: `adzuna-${country}-${job.id}`,

    source: "Adzuna",

    title:
      title ||
      "Untitled opportunity",

    company:
      job.company?.display_name ||
      "",

    description,

    location:
      job.location?.display_name ||
      "",

    salary:
      job.salary_min
        ? `${job.salary_min}${
            job.salary_max
              ? `–${job.salary_max}`
              : "+"
          }`
        : "",

    contractType:
      job.contract_type ||
      job.contract_time ||
      "",

    created,

    url:
      job.redirect_url ||
      "",

    remote:
      remote !== "Unknown",

    remoteConfidence:
      remote,

    service:
      pickService(text),

    score,

    /*
     * Indicador de qué tan útil es para PowZ.
     */
    opportunity:
      score >= 80
        ? "HOT"
        : score >= 65
          ? "HIGH POTENTIAL"
          : score >= 45
            ? "POSSIBLE"
            : "LOW",

    linkedinUrl:
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
        title || pickService(text)
      )}&f_WT=2`
  };
}

export default async function handler(req, res) {
  /*
   * Cache corto para no consumir innecesariamente la API.
   */
  res.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );

  try {
    const appId =
      process.env.ADZUNA_APP_ID;

    const appKey =
      process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      return res.status(500).json({
        error:
          "Adzuna credentials are not configured in Vercel."
      });
    }

    /*
     * Parámetros enviados desde la página.
     */
    const query =
      String(
        req.query.q ||
        "Meta Ads"
      )
        .trim()
        .slice(0, 80);

    const requestedCountry =
      String(
        req.query.country ||
        "all"
      ).toLowerCase();

    const requestedService =
      String(
        req.query.service ||
        "all"
      );

    /*
     * Si seleccionan Worldwide buscamos
     * en varios mercados.
     */
    const countries =
      requestedCountry === "all"
        ? COUNTRIES
        : [requestedCountry];

    /*
     * Varias búsquedas para aumentar
     * la calidad de los resultados.
     */
    const serviceTerms =
      SERVICE_TERMS[requestedService] ||
      [query];

    const searchTerms = [
      query,
      ...serviceTerms.slice(0, 3)
    ];

    const uniqueSearchTerms = [
      ...new Set(
        searchTerms
          .map((x) =>
            String(x)
              .trim()
              .slice(0, 60)
          )
          .filter(Boolean)
      )
    ];

    /*
     * Consultamos cada país + término.
     */
    const tasks = [];

    for (const country of countries.slice(0, 8)) {
      for (const term of uniqueSearchTerms) {
        const searches = [
          `${term} remote`,
          `${term} freelance remote`
        ];

        for (const searchTerm of searches) {
          const url =
            new URL(
              `https://api.adzuna.com/v1/api/jobs/${country}/search/1`
            );

          url.searchParams.set(
            "app_id",
            appId
          );

          url.searchParams.set(
            "app_key",
            appKey
          );

          url.searchParams.set(
            "results_per_page",
            "50"
          );

          url.searchParams.set(
            "what",
            searchTerm
          );

          /*
           * MUY IMPORTANTE:
           * Adzuna devuelve primero lo más reciente
           * cuando usamos sort_by=date.
           */
          url.searchParams.set(
            "sort_by",
            "date"
          );

          url.searchParams.set(
            "content-type",
            "application/json"
          );

          tasks.push(
            fetch(url, {
              headers: {
                accept:
                  "application/json"
              }
            }).then(
              async (response) => ({
                ok: response.ok,
                status: response.status,
                data:
                  await response
                    .json()
                    .catch(() => ({})),
                country,
                searchTerm
              })
            )
          );
        }
      }
    }

    const responses =
      await Promise.all(tasks);

    const results = [];

    /*
     * Procesamos únicamente respuestas válidas.
     */
    for (const response of responses) {
      if (!response.ok) {
        continue;
      }

      const jobs =
        response.data?.results ||
        [];

      for (const job of jobs) {
        const normalized =
          normalize(
            job,
            response.country,
            response.searchTerm
          );

        const text =
          `${normalized.title} ${normalized.description}`;

        /*
         * Filtros estrictos.
         */

        if (!isRelevantJob(text)) {
          continue;
        }

        if (isBadJob(text)) {
          continue;
        }

        /*
         * Solo trabajos remotos.
         */
        if (!normalized.remote) {
          continue;
        }

        /*
         * Si se seleccionó un servicio concreto,
         * tiene que coincidir.
         */
        if (
          requestedService !== "all" &&
          normalized.service !==
            requestedService
        ) {
          continue;
        }

        /*
         * No mostramos oportunidades
         * demasiado débiles.
         */
        if (normalized.score < 45) {
          continue;
        }

        results.push(
          normalized
        );
      }
    }

    /*
     * Eliminamos duplicados.
     *
     * Usamos URL porque el mismo trabajo puede
     * aparecer en varias búsquedas.
     */
    const unique = [
      ...new Map(
        results.map((item) => [
          item.url ||
            `${item.title}-${item.company}`,
          item
        ])
      ).values()
    ];

    /*
     * ORDEN PRINCIPAL:
     *
     * 1. Más nuevo → más viejo
     * 2. Si tienen la misma fecha,
     *    gana el score más alto.
     */
    unique.sort(
      (a, b) => {
        const dateA =
          new Date(a.created).getTime();

        const dateB =
          new Date(b.created).getTime();

        if (dateB !== dateA) {
          return dateB - dateA;
        }

        return (
          b.score -
          a.score
        );
      }
    );

    /*
     * Los primeros 100 son realmente
     * los más recientes.
     */
    const finalResults =
      unique.slice(0, 100);

    return res.status(200).json({
      results: finalResults,

      sourceCount:
        unique.length,

      totalFound:
        results.length,

      returned:
        finalResults.length,

      sortedBy:
        "newest_first"
    });

  } catch (error) {
    console.error(
      "Adzuna connector error:",
      error
    );

    return res.status(500).json({
      error:
        "Adzuna connector error.",
      detail:
        error?.message ||
        String(error)
    });
  }
}
