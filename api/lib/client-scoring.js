const SERVICE_PATTERNS = {
  'Meta Ads': /\b(meta ads|facebook ads|facebook advertising|facebook ad manager|meta advertising|meta ads manager)\b/i,
  'Media Buying': /\b(media buyer|media buying|paid media|paid media buyer|media buying specialist|performance media buyer)\b/i,
  'Google Ads': /\b(google ads|google advertising|google ppc|ppc specialist|paid search|google ads specialist)\b/i,
  'TikTok Ads': /\b(tiktok ads|tiktok advertising|tiktok media buyer|tiktok ads specialist)\b/i,
  'Paid Social': /\b(paid social|performance marketing|social ads|performance marketer|paid acquisition)\b/i
};

const SERVICE_QUERY_TERMS = {
  'Meta Ads': ['Meta Ads', 'Facebook Ads', 'Facebook advertising', 'Meta advertising'],
  'Media Buying': ['media buyer', 'media buying', 'paid media'],
  'Google Ads': ['Google Ads', 'Google PPC', 'paid search', 'PPC'],
  'TikTok Ads': ['TikTok Ads', 'TikTok advertising'],
  'Paid Social': ['paid social', 'performance marketing', 'social ads']
};

const DIRECT_REQUEST_PATTERNS = [
  /\blooking for (a|an|someone|somebody)\b/i,
  /\bneed (a|an|someone|somebody)\b/i,
  /\bseeking (a|an|someone|somebody)\b/i,
  /\bwant to hire\b/i,
  /\blooking to hire\b/i,
  /\bneed help\b/i,
  /\bhire someone\b/i,
  /\bfind someone\b/i,
  /\blooking for help\b/i,
  /\bneed support\b/i
];

const CLIENT_INTENT_PATTERNS = [
  ...DIRECT_REQUEST_PATTERNS,
  /\b(hire|hiring|seeking|looking to work with)\b/i,
  /\b(manage|run|scale|optimize|optimise|take over) (my|our|the)\b/i
];

const EXTERNAL_PROVIDER_PATTERNS = /\b(freelancer|freelance|contractor|consultant|agency|partner|specialist|expert|service provider|outside help|outsourced)\b/i;
const OWNER_PATTERNS = /\b(founder|co-founder|owner|business owner|ceo|entrepreneur|operator|director|marketing director|head of marketing)\b/i;
const OWN_BUSINESS_PATTERNS = /\b(i own|my business|my company|our business|our company|our brand|our store|my store|we run|we operate|our ecommerce|our e-commerce)\b/i;
const BUSINESS_CONTEXT_PATTERNS = /\b(ecommerce|e-commerce|shopify|online store|saas|startup|clinic|restaurant|real estate|agency|brand|business|company|store|dtc|direct-to-consumer)\b/i;
const JOB_SEEKER_PATTERNS = /\b(looking for a job|looking for work|seeking employment|available for work|open to work|open for work|my resume|my cv|i am a media buyer looking|i'm a media buyer looking|as a media buyer i)\b/i;
const EDUCATION_PATTERNS = /\b(guide|tutorial|how to|tips|strategies|course|training|academy|learn|lesson|webinar|ebook|blog post|case study|best practices|ultimate guide)\b/i;
const GENERIC_MARKETING_PATTERNS = /\b(what is meta ads|what are meta ads|how meta ads work|meta ads strategy|facebook ads strategy|google ads guide)\b/i;
const JOB_POSTING_PATTERNS = /\b(apply now|apply here|submit your resume|send your cv|job opening|job vacancy|vacancy|career opportunity|job description|salary|benefits|join our team|employee|employment|permanent position|staff position|full[- ]time|part[- ]time)\b/i;
const RECENCY_PATTERNS = [
  /\b(today|tonight|this morning|this afternoon|this week|yesterday)\b/i,
  /\b(just posted|recently posted|posted recently|new post|just now)\b/i,
  /\b(hours? ago|minutes? ago|days? ago)\b/i,
  /\b(asap|immediately|urgent)\b/i
];

function cleanText(text = '') {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function hasAnyPattern(text = '', patterns) {
  const value = cleanText(text);
  if (Array.isArray(patterns)) return patterns.some((pattern) => hasAnyPattern(value, pattern));
  if (patterns instanceof RegExp) {
    patterns.lastIndex = 0;
    return patterns.test(value);
  }
  if (typeof patterns === 'string') return value.toLowerCase().includes(patterns.toLowerCase());
  return false;
}

function detectService(text = '') {
  const value = cleanText(text);
  for (const [service, pattern] of Object.entries(SERVICE_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) return service;
  }
  return 'Paid Social';
}

function serviceTerms(service) {
  return SERVICE_QUERY_TERMS[service] || SERVICE_QUERY_TERMS['Meta Ads'];
}

function classifyClient(text = '') {
  const t = cleanText(text);
  let score = 0;
  const reasons = [];
  const add = (points, reason) => {
    score += points;
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  const service = detectService(t);
  const direct = hasAnyPattern(t, DIRECT_REQUEST_PATTERNS);
  const intent = hasAnyPattern(t, CLIENT_INTENT_PATTERNS);
  const external = hasAnyPattern(t, EXTERNAL_PROVIDER_PATTERNS);
  const owner = hasAnyPattern(t, OWNER_PATTERNS);
  const ownBusiness = hasAnyPattern(t, OWN_BUSINESS_PATTERNS);
  const business = hasAnyPattern(t, BUSINESS_CONTEXT_PATTERNS);
  const jobSeeker = hasAnyPattern(t, JOB_SEEKER_PATTERNS);
  const education = hasAnyPattern(t, EDUCATION_PATTERNS);
  const generic = hasAnyPattern(t, GENERIC_MARKETING_PATTERNS);
  const jobPosting = hasAnyPattern(t, JOB_POSTING_PATTERNS);

  if (direct) add(35, 'direct hiring/help request');
  else if (intent) add(18, 'client intent signal');
  if (owner) add(18, 'founder/owner signal');
  if (ownBusiness) add(15, 'own-business signal');
  if (external) add(15, 'external-provider signal');
  if (SERVICE_PATTERNS[service].test(t)) add(15, `${service} service signal`);
  if (business) add(8, 'business context');
  if (/\b(manage|run|scale|optimize|optimise|take over|campaigns?|ad account|roas|cpa|acquisition|performance)\b/i.test(t)) add(8, 'campaign management signal');
  if (hasAnyPattern(t, RECENCY_PATTERNS)) add(5, 'recent/urgent signal');

  if (jobSeeker) add(-75, 'job-seeker signal');
  if (education) add(-60, 'content/education signal');
  if (generic) add(-45, 'generic marketing content');
  if (jobPosting && !external && !direct) add(-60, 'traditional job-posting signal');

  const clearlyNotClient = jobSeeker || education || generic;
  const clearlyEmployeeJob = jobPosting && !external && !direct;
  const isClient = (direct || intent) && !clearlyNotClient && !clearlyEmployeeJob && score >= 25;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 85 ? 'HOT' : score >= 70 ? 'HIGH POTENTIAL' : score >= 50 ? 'POSSIBLE' : 'LOW';

  return { score, level, service, reasons, isClient };
}

function normalizeClient(item, source = 'Tavily') {
  const title = cleanText(item?.title || '');
  const content = cleanText(item?.content || item?.description || '');
  const text = cleanText(`${title} ${content}`);
  const classification = classifyClient(text);
  const date = item?.published_date || item?.created || item?.date || null;
  const isRD = /\b(dominican republic|república dominicana|santo domingo|sdq)\b/i.test(text);
  const safeUrl = String(item?.url || '');
  const encodedId = Buffer.from(safeUrl || title || text).toString('base64url').slice(0, 48);

  return {
    id: `${source}-${encodedId}`,
    source,
    title: title || 'Potential client lead',
    url: safeUrl,
    description: content,
    created: date || new Date().toISOString(),
    service: classification.service,
    score: classification.score,
    level: classification.level,
    reasons: classification.reasons,
    isClient: classification.isClient,
    region: isRD ? 'Dominican Republic' : 'Worldwide',
    linkedinUrl: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(title || classification.service)}`
  };
}

module.exports = {
  SERVICE_PATTERNS,
  SERVICE_QUERY_TERMS,
  cleanText,
  hasAnyPattern,
  detectService,
  buildTavilyQueries(service = 'Meta Ads', region = 'worldwide') {
    const queries = [];
    for (const term of serviceTerms(service)) {
      queries.push(
        `"looking for" "${term}" freelancer`,
        `"need" "${term}" freelancer`,
        `"need help" "${term}" business`,
        `"looking for someone" "${term}"`,
        `"seeking" "${term}" freelancer`,
        `"looking to hire" "${term}"`,
        `"need someone to manage" "${term}"`,
        `"looking for an agency" "${term}"`
      );
    }
    const unique = [...new Set(queries)];
    if (region === 'rd') {
      return unique.map((q) => `${q} ("Dominican Republic" OR "Santo Domingo" OR "República Dominicana")`);
    }
    return unique.map((q) => `${q} remote -course -tutorial -training -guide -jobs -job -career`);
  },
  classifyClient,
  normalizeClient
};
