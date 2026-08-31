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

/*
 * Robust pattern matcher.
 *
 * Accepts:
 * - an array of RegExp
 * - one RegExp
 * - an array of strings
 * - one string
 *
 * This prevents "patterns.some is not a function".
 */
function hasAnyPattern(text = '', patterns) {
  const value = cleanText(text);

  if (Array.isArray(patterns)) {
    return patterns.some((pattern) =>
      hasAnyPattern(value, pattern)
    );
  }

  if (patterns instanceof RegExp) {
    patterns.lastIndex = 0;
    return patterns.test(value);
  }

  if (typeof patterns === 'string') {
    return value
      .toLowerCase()
      .includes(patterns.toLowerCase());
  }

  return false;
}

function detectService(text = '') {
  const value = cleanText(text);

  for (const [service, pattern] of Object.entries(
    SERVICE_PATTERNS
  )) {
    pattern.lastIndex = 0;

    if (pattern.test(value)) {
      return service;
    }
  }

  return 'Paid Social';
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
   * CLIENT INTENT
   */

  const hasDirectRequest =
    hasAnyPattern(
      t,
      DIRECT_REQUEST_PATTERNS
    );

  const hasGeneralIntent =
    hasAnyPattern(
      t,
      CLIENT_INTENT_PATTERNS
    );

  if (hasDirectRequest) {
    add(
      35,
      'direct hiring/help request'
    );
  } else if (hasGeneralIntent) {
    add(
      18,
      'client intent signal'
    );
  }

  /*
   * BUSINESS / BUYER SIGNALS
   */

  if (
    hasAnyPattern(
      t,
      OWNER_PATTERNS
    )
  ) {
    add(
      20,
      'founder/owner signal'
    );
  }

  if (
    hasAnyPattern(
      t,
      OWN_BUSINESS_PATTERNS
    )
  ) {
    add(
      15,
      'own-business signal'
    );
  }

  if (
    hasAnyPattern(
      t,
      EXTERNAL_PROVIDER_PATTERNS
    )
  ) {
    add(
      15,
      'external-provider signal'
    );
  }

  /*
   * SERVICE SIGNAL
   */

  const servicePattern =
    SERVICE_PATTERNS[service];

  if (
    hasAnyPattern(
      t,
      servicePattern
    )
  ) {
    add(
      15,
      `${serviceLabel(t)} service signal`
    );
  }

  /*
   * BUSINESS CONTEXT
   */

  if (
    hasAnyPattern(
      t,
      BUSINESS_CONTEXT_PATTERNS
    )
  ) {
    add(
      8,
      'business context'
    );
  }

  /*
   * CAMPAIGN MANAGEMENT
   */

  if (
    /\b(manage|run|scale|optimize|optimise|campaigns?|advertising account|ad account|roas|cpa|acquisition|performance)\b/i.test(
      t
    )
  ) {
    add(
      8,
      'campaign management signal'
    );
  }

  /*
   * RECENCY / URGENCY
   */

  if (
    hasAnyPattern(
      t,
      DATE_PATTERNS
    )
  ) {
    add(
      5,
      'recent/urgent signal'
    );
  }

  /*
   * NEGATIVE: JOB SEEKER
   */

  if (
    hasAnyPattern(
      t,
      JOB_SEEKER_PATTERNS
    )
  ) {
    add(
      -70,
      'job-seeker signal'
    );
  }

  /*
   * NEGATIVE: EDUCATIONAL CONTENT
   */

  if (
    hasAnyPattern(
      t,
      CONTENT_PATTERNS
    )
  ) {
    add(
      -60,
      'content/education signal'
    );
  }

  /*
   * NEGATIVE: GENERIC MARKETING CONTENT
   */

  if (
    hasAnyPattern(
      t,
      GENERIC_MARKETING_PATTERNS
    )
  ) {
    add(
      -45,
      'generic marketing content'
    );
  }

  /*
   * NEGATIVE: TRADITIONAL EMPLOYMENT
   */

  const traditionalEmployment =
    hasAnyPattern(
      t,
      EMPLOYMENT_PATTERNS
    );

  if (traditionalEmployment) {
    add(
      -55,
      'traditional employment signal'
    );
  }

  /*
   * NEGATIVE: CLEAR JOB POSTING
   */

  const clearJobPosting =
    /\b(apply now|apply here|submit your resume|send your cv|job opening|job vacancy|vacancy|career opportunity|job description)\b/i.test(
      t
    );

  if (clearJobPosting) {
    add(
      -55,
      'job-posting signal'
    );
  }

  /*
   * CLIENT VALIDATION
   */

  const clearlyNotClient =
    hasAnyPattern(
      t,
      JOB_SEEKER_PATTERNS
    ) ||
    hasAnyPattern(
      t,
      CONTENT_PATTERNS
    ) ||
    hasAnyPattern(
      t,
      GENERIC_MARKETING_PATTERNS
    ) ||
    clearJobPosting;

  /*
   * A normal employee job should not be
   * treated as a client.
   *
   * Exception:
   * if the company explicitly wants an
   * external freelancer/agency/consultant.
   */

  const hasExternalProvider =
    hasAnyPattern(
      t,
      EXTERNAL_PROVIDER_PATTERNS
    );

  const clearlyEmployeeJob =
    traditionalEmployment &&
    !hasExternalProvider &&
    !hasDirectRequest;

  const isClient =
    hasDirectRequest ||
    hasGeneralIntent;

  const finalIsClient =
    isClient &&
    !clearlyNotClient &&
    !clearlyEmployeeJob &&
    score >= 25;

  /*
   * SCORE LEVEL
   */

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
    isClient: finalIsClient
  };
}

export function normalizeClient(
  item,
  source = 'Tavily'
) {
  const title = cleanText(
    item?.title || ''
  );

  const content = cleanText(
    item?.content ||
    item?.description ||
    ''
  );

  const text = cleanText(
    `${title} ${content}`
  );

  const classification =
    classifyClient(text);

  const date =
    item?.published_date ||
    item?.created ||
    item?.date ||
    null;

  const isRD =
    /\b(dominican republic|república dominicana|santo domingo|sdq)\b/i.test(
      text
    );

  const safeUrl =
    item?.url || '';

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
