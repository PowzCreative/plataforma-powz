const SERVICE_PATTERNS = {
  'Meta Ads':
    /\b(meta ads|facebook ads|facebook advertising|facebook ad manager|meta advertising)\b/i,

  'Media Buying':
    /\b(media buyer|media buying|paid media|paid media buyer|media buying specialist)\b/i,

  'Google Ads':
    /\b(google ads|google advertising|google ppc|ppc specialist|paid search|google ads specialist)\b/i,

  'TikTok Ads':
    /\b(tiktok ads|tiktok advertising|tiktok media buyer|tiktok ads specialist)\b/i,

  'Paid Social':
    /\b(paid social|performance marketing|social ads|performance marketer)\b/i
};

const SERVICE_QUERY_TERMS = {
  'Meta Ads': [
    'Meta Ads',
    'Facebook Ads',
    'Facebook advertising',
    'Meta advertising'
  ],

  'Media Buying': [
    'media buyer',
    'media buying',
    'paid media'
  ],

  'Google Ads': [
    'Google Ads',
    'Google PPC',
    'paid search',
    'PPC'
  ],

  'TikTok Ads': [
    'TikTok Ads',
    'TikTok advertising'
  ],

  'Paid Social': [
    'paid social',
    'performance marketing',
    'social ads'
  ]
};

const CLIENT_INTENT_PATTERNS = [
  /\b(looking for|need|needs|seeking|want|wanted|looking to hire)\b/i,
  /\b(hire|hiring|find someone|find a|looking to work with)\b/i,
  /\b(need help|looking for help|need support|seeking help)\b/i,
  /\b(manage|run|scale|optimize|optimise|take over)\b/i
];

const EXTERNAL_PROVIDER_PATTERNS =
  /\b(freelancer|freelance|contractor|consultant|agency|partner|specialist|expert|service provider)\b/i;

const OWNER_PATTERNS =
  /\b(founder|co-founder|owner|business owner|ceo|entrepreneur|operator|director|marketing director)\b/i;

const OWN_BUSINESS_PATTERNS =
  /\b(i own|my business|my company|our business|our company|our brand|our store|my store|we run|we operate)\b/i;

const BUSINESS_CONTEXT_PATTERNS =
  /\b(ecommerce|e-commerce|shopify|online store|saas|startup|clinic|restaurant|real estate|agency|brand|business|company|store)\b/i;

const EMPLOYMENT_PATTERNS =
  /\b(full[- ]time|part[- ]time|salary|benefits|employee|join our team|employment|permanent position|staff position)\b/i;

const JOB_SEEKER_PATTERNS =
  /\b(looking for a job|looking for work|seeking employment|available for work|open to work|open for work|my resume|my cv|i am a media buyer looking)\b/i;

const CONTENT_PATTERNS =
  /\b(guide|tutorial|how to|tips|strategies|course|training|academy|learn|lesson|webinar|ebook|blog post|case study|best practices|ultimate guide)\b/i;

const GENERIC_MARKETING_PATTERNS =
  /\b(what is meta ads|what are meta ads|how meta ads work|meta ads strategy|facebook ads strategy|google ads guide)\b/i;

const DIRECT_REQUEST_PATTERNS = [
  /\blooking for (a|an|someone|somebody)\b/i,
  /\bneed (a|an|someone|somebody)\b/i,
  /\bseeking (a|an|someone|somebody)\b/i,
  /\bwant to hire\b/i,
  /\blooking to hire\b/i,
  /\bneed help\b/i,
  /\bhire someone\b/i,
  /\bfind someone\b/i
];

const DATE_PATTERNS = [
  /\b(today|tonight|this morning|this afternoon|this week|yesterday)\b/i,
  /\b(just posted|recently posted|posted recently|new post|just now)\b/i,
  /\b(hours? ago|minutes? ago|days? ago)\b/i,
  /\b(asap|immediately|urgent)\b/i
];

function cleanText(text = '') {
  return String(text)
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAnyPattern(text, patterns) {
  if (!Array.isArray(patterns)) {
    return false;
  }

  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) {
      pattern.lastIndex = 0;
      return pattern.test(text);
    }

    if (typeof pattern === 'string') {
      return text.toLowerCase().includes(pattern.toLowerCase());
    }

    return false;
  });
}

function detectService(text = '') {
  const matches = Object.entries(SERVICE_PATTERNS)
    .filter(([, pattern]) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    })
    .map(([service]) => service);

  if (matches.length === 0) {
    return 'Paid Social';
  }

  return matches[0];
}

function serviceLabel(text = '') {
  return detectService(text);
}

export function buildTavilyQueries(
  service = 'Meta Ads',
  region = 'worldwide'
) {
  const terms =
    SERVICE_QUERY_TERMS[service] ||
    SERVICE_QUERY_TERMS['Meta Ads'];

  const queries = [];

  for (const term of terms) {
    queries.push(
      `"looking for" "${term}" freelancer`,
      `"need" "${term}" expert`,
      `"need help" "${term}" business`,
      `"looking for someone" "${term}"`,
      `"seeking" "${term}" freelancer`,
      `"looking to hire" "${term}"`,
      `"need a" "${term}"`,
      `"looking for a" "${term}"`,
      `"need someone to manage" "${term}"`,
      `"looking for an agency" "${term}"`
    );
  }

  const uniqueQueries = [
    ...new Set(queries)
  ];

  if (region === 'rd') {
    return uniqueQueries.map(
      (query) =>
        `${query} ("Dominican Republic" OR "Santo Domingo" OR "República Dominicana" OR "RD")`
    );
  }

  return uniqueQueries.map(
    (query) =>
      `${query} remote -course -tutorial -training -guide -job -jobs -career`
  );
}

export function classifyClient(text = '') {
  const t = cleanText(text);

  let score = 0;
  const reasons = [];

  const add = (points, reason) => {
    score += points;

    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  };

  const service = detectService(t);

  /*
   * POSITIVE CLIENT SIGNALS
   */

  if (hasAnyPattern(t, DIRECT_REQUEST_PATTERNS)) {
    add(35, 'direct hiring/help request');
  } else if (hasAnyPattern(t, CLIENT_INTENT_PATTERNS)) {
    add(18, 'client intent signal');
  }

  if (OWNER_PATTERNS.test(t)) {
    add(20, 'founder/owner signal');
  }

  if (OWN_BUSINESS_PATTERNS.test(t)) {
    add(15, 'own-business signal');
  }

  if (EXTERNAL_PROVIDER_PATTERNS.test(t)) {
    add(15, 'external-provider signal');
  }

  if (SERVICE_PATTERNS[service]) {
    SERVICE_PATTERNS[service].lastIndex = 0;

    if (SERVICE_PATTERNS[service].test(t)) {
      add(15, `${serviceLabel(t)} service signal`);
    }
  }

  if (BUSINESS_CONTEXT_PATTERNS.test(t)) {
    add(8, 'business context');
  }

  if (
    /\b(manage|run|scale|optimize|optimise|campaigns?|advertising account|ad account|roas|cpa|acquisition)\b/i.test(
      t
    )
  ) {
    add(8, 'campaign management signal');
  }

  if (hasAnyPattern(t, DATE_PATTERNS)) {
    add(5, 'recent/urgent signal');
  }

  /*
   * NEGATIVE SIGNALS
   */

  if (JOB_SEEKER_PATTERNS.test(t)) {
    add(-70, 'job-seeker signal');
  }

  if (CONTENT_PATTERNS.test(t)) {
    add(-60, 'content/education signal');
  }

  if (GENERIC_MARKETING_PATTERNS.test(t)) {
    add(-45, 'generic marketing content');
  }

  /*
   * TRADITIONAL EMPLOYMENT
   */

  if (EMPLOYMENT_PATTERNS.test(t)) {
    add(-55, 'traditional employment signal');
  }

  /*
   * JOB POSTING SIGNALS
   */

  if (
    /\b(apply now|apply here|submit your resume|send your cv|job opening|job vacancy|vacancy|career opportunity|job description)\b/i.test(
      t
    )
  ) {
    add(-55, 'job-posting signal');
  }

  /*
   * EXPLICIT CLIENT VS JOB CHECK
   */

  const hasIntent =
    hasAnyPattern(t, DIRECT_REQUEST_PATTERNS) ||
    hasAnyPattern(t, CLIENT_INTENT_PATTERNS);

  const clearlyNotClient =
    JOB_SEEKER_PATTERNS.test(t) ||
    CONTENT_PATTERNS.test(t) ||
    GENERIC_MARKETING_PATTERNS.test(t) ||
    /\b(job opening|job vacancy|apply now|submit your resume|career opportunity)\b/i.test(
      t
    );

  /*
   * Traditional employee jobs should NOT normally
   * appear as client opportunities.
   *
   * However, if the text explicitly says the company
   * is looking for an external freelancer/agency,
   * we allow it.
   */

  const clearlyEmployeeJob =
    EMPLOYMENT_PATTERNS.test(t) &&
    !EXTERNAL_PROVIDER_PATTERNS.test(t) &&
    !DIRECT_REQUEST_PATTERNS.some((pattern) => pattern.test(t));

  const isClient =
    hasIntent &&
    !clearlyNotClient &&
    !clearlyEmployeeJob &&
    score >= 25;

  score = Math.max(
    0,
    Math.min(100, score)
  );

  const level =
    score >= 85
      ? 'HOT'
      : score >= 70
        ? 'HIGH POTENTIAL'
        : score >= 50
          ? 'POSSIBLE'
          : 'LOW';

  return {
    score,
    level,
    service,
    reasons,
    isClient
  };
}

export function normalizeClient(
  item,
  source = 'Tavily'
) {
  const title = cleanText(
    item.title || ''
  );

  const content = cleanText(
    item.content ||
      item.description ||
      ''
  );

  const text = cleanText(
    `${title} ${content}`
  );

  const classification =
    classifyClient(text);

  const date =
    item.published_date ||
    item.created ||
    item.date ||
    null;

  const isRD =
    /dominican republic|república dominicana|santo domingo|\bsdq\b/i.test(
      text
    );

  const safeUrl =
    item.url ||
    '';

  const encodedId =
    Buffer.from(
      safeUrl ||
        title ||
        text
    )
      .toString('base64url')
      .slice(0, 48);

  return {
    id:
      `${source}-${encodedId}`,

    source,

    title:
      title ||
      'Potential client lead',

    url:
      safeUrl,

    description:
      content,

    created:
      date ||
      new Date().toISOString(),

    service:
      classification.service,

    score:
      classification.score,

    level:
      classification.level,

    reasons:
      classification.reasons,

    isClient:
      classification.isClient,

    region:
      isRD
        ? 'Dominican Republic'
        : 'Worldwide',

    linkedinUrl:
      `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
        title ||
          classification.service
      )}`
  };
}
