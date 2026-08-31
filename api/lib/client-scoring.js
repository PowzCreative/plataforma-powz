const SERVICE_PATTERNS = {
  'Meta Ads': /\b(meta ads|facebook ads|facebook advertising|facebook ad manager|meta advertising)\b/i,
  'Media Buying': /\b(media buyer|media buying|paid media|paid media buyer|media buying specialist)\b/i,
  'Google Ads': /\b(google ads|google advertising|google ppc|ppc specialist|paid search|google ads specialist)\b/i,
  'TikTok Ads': /\b(tiktok ads|tiktok advertising|tiktok media buyer|tiktok ads specialist)\b/i,
  'Paid Social': /\b(paid social|performance marketing|social ads|performance marketer)\b/i
};

const SERVICE_QUERY_TERMS = {
  'Meta Ads': ['Meta Ads', 'Facebook Ads', 'Facebook advertising', 'Meta advertising'],
  'Media Buying': ['media buyer', 'media buying', 'paid media'],
  'Google Ads': ['Google Ads', 'Google PPC', 'paid search', 'PPC'],
  'TikTok Ads': ['TikTok Ads', 'TikTok advertising'],
  'Paid Social': ['paid social', 'performance marketing', 'social ads']
};

const DIRECT_REQUEST_PATTERNS = [
  /\b(looking for|need|needs|seeking|want to hire|wanted|looking to hire)\b/i,
  /\b(hire|hiring|find someone|find a|looking to work with)\b/i,
  /\b(need help|looking for help|need support|seeking help)\b/i,
  /\b(need someone to|looking for someone to|take over|manage our|run our|scale our|optimize our|optimise our)\b/i
];

const OWNER_PATTERNS = /\b(founder|co-founder|owner|business owner|ceo|entrepreneur|operator|director|marketing director)\b/i;
const OWN_BUSINESS_PATTERNS = /\b(i own|my business|my company|our business|our company|our brand|our store|my store|we run|we operate)\b/i;
const BUSINESS_CONTEXT_PATTERNS = /\b(ecommerce|e-commerce|shopify|online store|saas|startup|clinic|restaurant|real estate|agency|brand|business|company|store)\b/i;
const EXTERNAL_PROVIDER_PATTERNS = /\b(freelancer|freelance|contractor|consultant|agency|partner|specialist|expert|service provider)\b/i;
const JOB_SEEKER_PATTERNS = /\b(looking for a job|looking for work|seeking employment|available for work|open to work|open for work|my resume|my cv|i am a media buyer looking)\b/i;
const EMPLOYMENT_PATTERNS = /\b(full[- ]time|part[- ]time|salary|benefits|employee|join our team|employment|permanent position|staff position|job opening|job vacancy|vacancy|apply now|submit your resume|send your cv)\b/i;
const CONTENT_PATTERNS = /\b(guide|tutorial|how to|tips|strategies|course|training|academy|learn|lesson|webinar|ebook|blog post|case study|best practices|ultimate guide)\b/i;
const GENERIC_MARKETING_PATTERNS = /\b(what is meta ads|what are meta ads|how meta ads work|meta ads strategy|facebook ads strategy|google ads guide)\b/i;
const URGENCY_PATTERNS = /\b(today|tonight|this week|just posted|recently posted|posted recently|asap|immediately|urgent)\b/i;

function cleanText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function detectService(text = '') {
  for (const [service, pattern] of Object.entries(SERVICE_PATTERNS)) {
    if (pattern.test(text)) return service;
  }
  return null;
}

function hasAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildTavilyQueries(service = 'Meta Ads', region = 'worldwide') {
  const terms = SERVICE_QUERY_TERMS[service] || SERVICE_QUERY_TERMS['Meta Ads'];
  const primary = terms[0];
  const queries = [
    `"looking for" "${primary}" freelancer -job -jobs -career`,
    `"need" "${primary}" expert business owner -job -jobs`,
    `"need help" "${primary}" business -course -tutorial`,
    `"looking for someone" "${primary}" -job -jobs`,
    `"seeking" "${primary}" freelancer -job -jobs`,
    `"looking to hire" "${primary}" -job -jobs`,
    `"need a" "${primary}" freelancer -job -jobs`,
    `"looking for a" "${primary}" freelancer -job -jobs`,
    `"need someone to manage" "${primary}" -job -jobs`,
    `"looking for an agency" "${primary}" -job -jobs`
  ];
  if (region === 'rd') {
    return queries.map((q) => `${q} ("Dominican Republic" OR "Santo Domingo" OR "República Dominicana")`);
  }
  return queries.map((q) => `${q} remote`);
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
  const hasDirectIntent = hasAnyPattern(t, DIRECT_REQUEST_PATTERNS);
  const hasBusinessIdentity = OWNER_PATTERNS.test(t) || OWN_BUSINESS_PATTERNS.test(t);
  const hasBusinessContext = BUSINESS_CONTEXT_PATTERNS.test(t);
  const hasExternalProvider = EXTERNAL_PROVIDER_PATTERNS.test(t);

  if (hasDirectIntent) add(35, 'direct hiring/help request');
  if (hasBusinessIdentity) add(22, 'founder/owner signal');
  if (OWN_BUSINESS_PATTERNS.test(t)) add(15, 'own-business signal');
  if (hasExternalProvider) add(12, 'external-provider signal');
  if (service) add(20, `${service} service signal`);
  if (hasBusinessContext) add(10, 'business context');
  if (/\b(manage|run|scale|optimize|optimise|campaigns?|advertising account|ad account|roas|cpa|acquisition)\b/i.test(t)) add(8, 'campaign management signal');
  if (URGENCY_PATTERNS.test(t)) add(5, 'recent/urgent signal');

  if (JOB_SEEKER_PATTERNS.test(t)) add(-70, 'job-seeker signal');
  if (EMPLOYMENT_PATTERNS.test(t)) add(-60, 'traditional employment signal');
  if (CONTENT_PATTERNS.test(t)) add(-60, 'content/education signal');
  if (GENERIC_MARKETING_PATTERNS.test(t)) add(-45, 'generic marketing content');

  score = Math.max(0, Math.min(100, score));
  const level = score >= 85 ? 'HOT' : score >= 70 ? 'HIGH POTENTIAL' : score >= 50 ? 'POSSIBLE' : 'LOW';

  const clearlyNotClient = JOB_SEEKER_PATTERNS.test(t) || CONTENT_PATTERNS.test(t) || GENERIC_MARKETING_PATTERNS.test(t) || EMPLOYMENT_PATTERNS.test(t);
  const isClient = Boolean(service && hasDirectIntent && (hasBusinessIdentity || hasBusinessContext) && !clearlyNotClient && score >= 50);

  return { score, level, service: service || 'Paid Social', reasons, isClient };
}

function normalizeClient(item, source = 'Tavily') {
  const title = cleanText(item.title || '');
  const content = cleanText(item.content || item.description || '');
  const text = `${title} ${content}`;
  const classification = classifyClient(text);
  const created = item.published_date || item.created || null;
  const isRD = /dominican republic|república dominicana|santo domingo|\bSDQ\b/i.test(text);
  const safeUrl = item.url || '';
  const encodedId = Buffer.from(safeUrl || title || text).toString('base64url').slice(0, 48);
  return {
    id: `${source}-${encodedId}`,
    source,
    title: title || 'Potential client lead',
    url: safeUrl,
    description: content,
    created: created || new Date().toISOString(),
    service: classification.service,
    score: classification.score,
    level: classification.level,
    reasons: classification.reasons,
    isClient: classification.isClient,
    region: isRD ? 'Dominican Republic' : 'Worldwide',
    linkedinUrl: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(title || classification.service)}`
  };
}

module.exports = { SERVICE_PATTERNS, buildTavilyQueries, classifyClient, normalizeClient, cleanText, detectService };
