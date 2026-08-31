const SERVICE_TERMS = {
  "Meta Ads": [
    "meta ads",
    "facebook ads",
    "facebook advertising",
    "facebook media buyer"
  ],
  "Google Ads": [
    "google ads",
    "google advertising",
    "google ppc",
    "ppc specialist"
  ],
  "TikTok Ads": [
    "tiktok ads",
    "tiktok advertising",
    "tiktok media buyer"
  ],
  "Media Buying": [
    "media buyer",
    "media buying",
    "media buyer specialist",
    "paid media"
  ],
  "Paid Social": [
    "paid social",
    "performance marketing",
    "paid social specialist",
    "social ads"
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

function pickService(text) {
  const t = text.toLowerCase();

  let best = {
    service: "Paid Social",
    hits: 0
  };

  for (const [service, terms] of Object.entries(SERVICE_TERMS)) {
    const hits = terms.reduce(
      (count, term) =>
        count + (t.includes(term) ? 1 : 0),
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

function remoteConfidence(text) {
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
    /remote|work from home|home-based|distributed team/.test(
      t
    )
  ) {
    return "Likely remote";
  }

  return "Unknown";
}

function scoreJob(job, query) {
  const text =
    `${job.title || ""} ${job.description || ""}`.toLowerCase();

  const remote = remoteConfidence(
    `${text} ${query || ""}`
  );

  let score = 35;

  if (remote === "Worldwide") {
    score += 30;
  } else if (remote === "Remote") {
    score += 25;
  } else if (remote === "Likely remote") {
    score += 15;
  }

  if (
    /freelance|contract|contractor|part-time|retainer/.test(
      text
    )
  ) {
    score += 12;
  }

  if (
    /meta ads|facebook ads|google ads|tiktok ads|paid social|media buyer|media buying/.test(
      text
    )
  ) {
    score += 15;
  }

  if (
    /manage|optimi[sz]e|scale|campaign|roas|cpa|performance/.test(
      text
    )
  ) {
    score += 8;
  }

  if (
    /intern|unpaid|commission only/.test(text)
  ) {
    score -= 35;
  }

  return Math.max(
    0,
    Math.min(100, score)
  );
}

function normalize(job, country, query) {
  const text =
    `${job.title || ""} ${job.description || ""}`;

  const created =
    job.created ||
    new Date().toISOString();

  const createdMs =
    new Date(created).getTime();

  const ageMs = Number.isFinite(createdMs)
    ? Math.max(0, Date.now() - createdMs)
    : 0;

  const minutes = Math.floor(
    ageMs / 60000
  );

  return {
    id: `adzuna-${country}-${job.id}`,
    source: "Adzuna",
    title:
      job.title ||
      "Untitled opportunity",
    company:
      job.company?.display_name ||
      "",
    description:
      job.description ||
      "",
    location:
      job.location?.display_name ||
      "",
    salary:
      job.salary_min != null
        ? `${job.salary_min}${
            job.salary_max != null
              ? `–${job.salary_max}`
              : "+"
          }`
        : "",
    contractType:
      job.contract_type ||
      job.contract_time ||
      "",
    created,
    age:
      minutes < 60
        ? `${minutes}m ago`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)}h ago`
          : `${Math.floor(minutes / 1440)}d ago`,
    url: job.redirect_url,
    remote:
      remoteConfidence(`${text} ${query || ""}`) !==
      "Unknown",
    remoteConfidence:
      remoteConfidence(`${text} ${query || ""}`),
    service: pickService(text),
    score: scoreJob(job, query),
    linkedinUrl:
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
        job.title || pickService(text)
      )}&f_WT=2`
  };
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );

  try {
    const id = process.env.ADZUNA_APP_ID;
    const key = process.env.ADZUNA_APP_KEY;

    if (!id || !key) {
      return res.status(500).json({
        error:
          "Adzuna credentials are not configured."
      });
    }

    const query = String(
      req.query?.q || "Meta Ads"
    )
      .trim()
      .slice(0, 60);

    const country = String(
      req.query?.country || "all"
    ).toLowerCase();

    const service = String(
      req.query?.service || "all"
    );

    const codes =
      country === "all"
        ? COUNTRIES
        : [country];

    const terms = query
      ? [
          `${query} remote`,
          `${query} freelance remote`
        ]
      : [
          `${service} remote`,
          `${service} freelance remote`
        ];

    const tasks = [];

    for (const code of codes.slice(0, 8)) {
      for (const term of terms) {
        const url = new URL(
          `https://api.adzuna.com/v1/api/jobs/${code}/search/1`
        );

        url.searchParams.set(
          "app_id",
          id
        );

        url.searchParams.set(
          "app_key",
          key
        );

        url.searchParams.set(
          "results_per_page",
          "20"
        );

        url.searchParams.set(
          "what",
          term
        );

        url.searchParams.set(
          "content-type",
          "application/json"
        );

        url.searchParams.set(
          "sort_by",
          "date"
        );

        tasks.push(
          fetch(url, {
            headers: {
              accept:
                "application/json"
            }
          }).then(async (response) => ({
            ok: response.ok,
            data:
              await response
                .json()
                .catch(() => ({})),
            country: code,
            term
          }))
        );
      }
    }

    const responses =
      await Promise.all(tasks);

    const output = [];

    for (const response of responses) {
      if (!response.ok) continue;

      for (const job of
        response.data?.results || []) {
        const normalized = normalize(
          job,
          response.country,
          response.term
        );

        if (
          normalized.remote &&
          (
            service === "all" ||
            normalized.service === service
          )
        ) {
          output.push(normalized);
        }
      }
    }

    const unique = [
      ...new Map(
        output.map((item) => [
          item.id,
          item
        ])
      ).values()
    ].sort(
      (a, b) =>
        new Date(b.created || 0) -
          new Date(a.created || 0) ||
        b.score - a.score
    );

    return res.status(200).json({
      results:
        unique.slice(0, 100),
      sourceCount:
        unique.length
    });
  } catch (error) {
    return res.status(500).json({
      error:
        "Adzuna connector error.",
      detail:
        error?.message ||
        String(error)
    });
  }
}
