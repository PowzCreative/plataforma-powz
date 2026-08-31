const SERVICE_TERMS = {
  "Meta Ads": ["meta ads","facebook ads","facebook advertising","facebook media buyer","meta advertising"],
  "Media Buying": ["media buyer","media buying","media buyer specialist","paid media","media buying specialist"],
  "Google Ads": ["google ads","google advertising","google ppc","google paid search","ppc specialist"],
  "TikTok Ads": ["tiktok ads","tiktok advertising","tiktok media buyer"],
  "Paid Social": ["paid social","performance marketing","paid social specialist","social ads"]
};

const COUNTRIES = ["us","gb","ca","au","ie","es","de","nl"];

function pickService(text) {
  const t = text.toLowerCase();
  let best = {service:"Paid Social", hits:0};
  for (const [service, terms] of Object.entries(SERVICE_TERMS)) {
    const hits = terms.reduce((n,term)=>n+(t.includes(term)?1:0),0);
    if (hits > best.hits) best={service,hits};
  }
  return best.service;
}

function remoteConfidence(text) {
  const t = text.toLowerCase();
  if (/\b(worldwide|work from anywhere|anywhere in the world|global remote|remote anywhere|location[- ]independent)\b/.test(t)) return "Worldwide";
  if (/\b(remote[- ]first|100% remote|fully remote|remote position|remote role|work remotely|working remotely)\b/.test(t)) return "Remote";
  if (/\b(remote|work from home|home[- ]based|distributed team)\b/.test(t)) return "Likely remote";
  return "Unknown";
}

function scoreJob(j) {
  const text = `${j.title||""} ${j.description||""}`.toLowerCase();
  const remote = remoteConfidence(text);
  let score=35;
  if (remote==="Worldwide") score+=30;
  else if (remote==="Remote") score+=25;
  else if (remote==="Likely remote") score+=15;

  if (/\bfreelance|contract|contractor|part[- ]time|retainer|project[- ]based\b/.test(text)) score+=12;
  if (/\bmeta ads|facebook ads|google ads|tiktok ads|paid social|media buyer|media buying\b/.test(text)) score+=15;
  if (/\bmanage|optimi[sz]e|scale|campaigns?|ad account|roas|cpa|performance|conversion\b/.test(text)) score+=8;
  if (/\bworldwide|global|anywhere in the world|work from anywhere\b/.test(text)) score+=8;
  if (/\bdominican republic|dominican|latam|latin america|americas\b/.test(text)) score+=5;
  if (/\bintern(ship)?|unpaid|commission only|commission-only\b/.test(text)) score-=35;
  if (/\bon-site|onsite|in office|office-based|must relocate\b/.test(text)) score-=25;

  return Math.max(0,Math.min(100,score));
}

function linkedinUrl(j) {
  const keywords = encodeURIComponent(`${j.title||""} ${j.company?.display_name||""}`.trim());
  const location = encodeURIComponent(j.location?.display_name||"Remote");
  return `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${location}&f_WT=2`;
}

function normalize(j,country) {
  const text=`${j.title||""} ${j.description||""}`;
  const created=new Date(j.created||Date.now());
  const ageMs=Math.max(0,Date.now()-created.getTime());
  const mins=Math.floor(ageMs/60000);
  const age=mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago`;
  const remote=remoteConfidence(text);
  return {
    id:`adzuna-${country}-${j.id}`,
    source:"Adzuna",
    title:j.title||"Untitled opportunity",
    company:j.company?.display_name||"",
    description:j.description||"",
    location:j.location?.display_name||"",
    salary:j.salary_min?`${j.salary_min}${j.salary_max?`–${j.salary_max}`:"+"}`:"",
    contractType:j.contract_type||j.contract_time||"",
    created:j.created||new Date().toISOString(),
    age,
    remote:remote!=="Unknown",
    remoteConfidence:remote,
    service:pickService(text),
    score:scoreJob(j),
    url:j.redirect_url,
    linkedinUrl:linkedinUrl(j)
  };
}

module.exports = async (req,res)=>{
  res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
  try {
    const appId=process.env.ADZUNA_APP_ID;
    const appKey=process.env.ADZUNA_APP_KEY;
    if(!appId||!appKey) return res.status(500).json({error:"Adzuna credentials are not configured in the deployment environment."});

    const requested=String(req.query.q||"").trim().slice(0,100);
    const selectedService=String(req.query.service||"all").trim();
    const country=String(req.query.country||"all").toLowerCase();
    const codes=country==="all"?COUNTRIES:[country];

    const broadTerms=Object.values(SERVICE_TERMS).flat().slice(0,14);
    const searchText = requested
      ? `${requested} remote`
      : selectedService!=="all"
        ? `${selectedService} remote`
        : `(${broadTerms.join(" OR ")}) remote`;

    const tasks=codes.slice(0,8).map(c=>{
      const url=new URL(`https://api.adzuna.com/v1/api/jobs/${c}/search/1`);
      url.searchParams.set("app_id",appId);
      url.searchParams.set("app_key",appKey);
      url.searchParams.set("results_per_page","30");
      url.searchParams.set("what",searchText);
      url.searchParams.set("content-type","application/json");
      url.searchParams.set("sort_by","date");
      return fetch(url,{headers:{accept:"application/json"}}).then(async r=>({
        ok:r.ok,data:await r.json().catch(()=>({})),country:c
      }));
    });

    const responses=await Promise.all(tasks);
    const results=[];
    for(const x of responses) if(x.ok) for(const j of (x.data.results||[])){
      const n=normalize(j,x.country);
      if(n.remote) results.push(n);
    }

    const unique=[...new Map(results.map(x=>[x.id,x])).values()]
      .sort((a,b)=>b.score-a.score||new Date(b.created)-new Date(a.created));

    return res.status(200).json({
      results:unique.slice(0,100),
      sourceCount:unique.length,
      queriedMarkets:codes,
      searchText,
      linkedin:{available:true,mode:"safe_search_links"}
    });
  } catch(e) {
    return res.status(500).json({error:"Adzuna connector error.",detail:e.message});
  }
};