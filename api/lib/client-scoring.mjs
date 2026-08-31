const SERVICE_PATTERNS = {
  'Meta Ads': /meta ads|facebook ads|facebook advertising|facebook ad[s]? manager|meta advertising/i,
  'Media Buying': /media buyer|media buying|paid media/i,
  'Google Ads': /google ads|google advertising|google ppc|ppc specialist|paid search/i,
  'TikTok Ads': /tiktok ads|tiktok advertising|tiktok media buyer/i,
  'Paid Social': /paid social|performance marketing|social ads/i
};

export function buildTavilyQueries(service = 'Meta Ads', region = 'worldwide') {
  const base = [
    `"looking for" "${service}" freelancer`,
    `"need" "${service}" expert business owner`,
    `"hiring" "${service}" freelancer`,
    `"need help" "${service}" business`,
    `"looking for someone" "${service}"`
  ];
  if (region === 'rd') return base.map(q => `${q} ("Dominican Republic" OR "Santo Domingo" OR "República Dominicana")`);
  return base.map(q => `${q} remote`);
}

export function classifyClient(text = '') {
  const t = String(text);
  let score = 0;
  const reasons = [];
  const lower = t.toLowerCase();
  const add = (points, reason) => { score += points; reasons.push(reason); };

  if (/\b(founder|co-founder|owner|business owner|ceo|entrepreneur)\b/i.test(t)) add(22, 'founder/owner signal');
  if (/\b(i own|my business|my company|our business|our brand|our store)\b/i.test(t)) add(10, 'own-business signal');
  if (/\b(need|looking for|seeking|want to hire|hire|hiring|find someone|looking to work with)\b/i.test(t)) add(22, 'explicit help/hiring intent');
  if (/\b(freelance|freelancer|contractor|agency|consultant|partner)\b/i.test(t)) add(15, 'external-provider signal');
  if (/\b(meta ads|facebook ads|google ads|tiktok ads|paid social|media buyer|media buying|ppc)\b/i.test(t)) add(20, `${serviceLabel(t)} service signal`);
  if (/\b(ecommerce|e-commerce|shopify|store|saas|clinic|restaurant|real estate|agency|brand)\b/i.test(t)) add(8, 'business context');
  if (/\b(full[- ]time|part[- ]time)\b/i.test(t) && /\b(join our team|employee|salary|benefits)\b/i.test(t)) add(-25, 'traditional employment signal');
  if (/\b(looking for a job|seeking employment|available for work|my resume|cv)\b/i.test(t)) add(-35, 'job-seeker signal');
  if (/\b(dominican republic|república dominicana|santo domingo|sdq)\b/i.test(t)) add(5, 'Dominican Republic signal');

  const service = Object.entries(SERVICE_PATTERNS).find(([, re]) => re.test(t))?.[0] || 'Paid Social';
  function serviceLabel(text) { return Object.entries(SERVICE_PATTERNS).find(([, re]) => re.test(text))?.[0] || 'Paid Social'; }
  score = Math.max(0, Math.min(100, score));
  const level = score >= 85 ? 'HOT' : score >= 70 ? 'HIGH POTENTIAL' : score >= 50 ? 'POSSIBLE' : 'LOW';
  return { score, level, service, reasons, isClient: score >= 25 };
}

export function normalizeClient(item, source = 'Tavily') {
  const text = `${item.title || ''} ${item.content || item.description || ''}`;
  const c = classifyClient(text);
  const date = item.published_date || item.created || null;
  return {
    id: `${source}-${Buffer.from(item.url || item.title || text).toString('base64url').slice(0, 48)}`,
    source,
    title: item.title || 'Potential client lead',
    url: item.url,
    description: item.content || item.description || '',
    created: date || new Date().toISOString(),
    service: c.service,
    score: c.score,
    level: c.level,
    reasons: c.reasons,
    region: /dominican republic|república dominicana|santo domingo|sdq/i.test(text) ? 'Dominican Republic' : 'Worldwide',
    linkedinUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(item.title || c.service)}&f_WT=2`
  };
}
