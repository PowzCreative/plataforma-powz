const SERVICE_TERMS = {
  "Meta Ads": ["meta ads","facebook ads","facebook advertising","facebook media buyer","meta advertising"],
  "Google Ads": ["google ads","google advertising","google ppc","ppc specialist","paid search"],
  "TikTok Ads": ["tiktok ads","tiktok advertising","tiktok media buyer"],
  "Media Buying": ["media buyer","media buying","media buyer specialist","paid media"],
  "Paid Social": ["paid social","performance marketing","paid social specialist","social ads"]
};

const COUNTRIES = ["us","gb","ca","au","de","fr","es","nl","it","ie","nz","sg"];

function pickService(text) {
  const t = text.toLowerCase();
  let best = {service:"Paid Social", hits:0};
  for (const [service, terms] of Object.entries(SERVICE_TERMS)) {
    const hits = terms.reduce((n,term)=>n+(t.includes(term)?1:0),0);
    if (hits > best.hits) best={service,hits};
  }
  return best.service;
}

function isRemote(text) {
  const t=text.toLowerCase();
  return /\b(remote|work from home|work remotely|fully remote|100% remote|remote-first|distributed team|worldwide|work from anywhere|anywhere in the world)\b/.test(t);
}

function scoreJob(j) {
  const text = `${j.title||""} ${j.description||""}`.toLowerCase();
  let score=30;
  if (isRemote(text)) score+=25;
  if (/\bworldwide|work from anywhere|anywhere in the world\b/.test(text)) score+=12;
  if (/\bfreelance|contract|contractor|part[- ]time|retainer\b/.test(text)) score+=12;
  if (/\bmeta ads|facebook ads|google ads|tiktok ads|paid social|media buyer|media buying\b/.test(text)) score+=16;
  if (/\bmanage|optimi[sz]e|scale|campaigns?|ad account|roas|cpa|performance\b/.test(text)) score+=8;
  if (/\bintern(ship)?|unpaid|commission only|commission-only\b/.test(text)) score-=35;
  return Math.max(0,Math.min(100,score));
}

function normalize(j,country) {
  const text=`${j.title||""} ${j.description||""}`;
  const created=new Date(j.created||Date.now());
  const ageMs=Math.max(0,Date.now()-created.getTime());
  const mins=Math.floor(ageMs/60000);
  const age=mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago`;
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
    url:j.redirect_url,
    remote:isRemote(text),
    service:pickService(text),
    score:scoreJob(j)
  };
}

module.exports = async (req,res)=>{
  res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
  try {
    const appId=process.env.ADZUNA_APP_ID;
    const appKey=process.env.ADZUNA_APP_KEY;
    if(!appId||!appKey) return res.status(500).json({error:"Adzuna credentials are not configured in the deployment environment."});
    const q=String(req.query.q||"Meta Ads").trim().slice(0,80);
    const country=String(req.query.country||"all").toLowerCase();
    const codes=country==="all"?COUNTRIES:[country];
    const terms=q?Array.from(new Set([q,...Object.values(SERVICE_TERMS).flat().filter(x=>x.toLowerCase().includes(q.toLowerCase())||q.toLowerCase().includes(x.toLowerCase())).slice(0,2)])):["Meta Ads"];
    const tasks=[];
    for(const c of codes.slice(0,12)) for(const term of terms.slice(0,2)){
      const url=new URL(`https://api.adzuna.com/v1/api/jobs/${c}/search/1`);
      url.searchParams.set("app_id",appId); url.searchParams.set("app_key",appKey);
      url.searchParams.set("results_per_page","20"); url.searchParams.set("what",term);
      url.searchParams.set("content-type","application/json"); url.searchParams.set("sort_by","date");
      tasks.push(fetch(url,{headers:{accept:"application/json"}}).then(async r=>({ok:r.ok,data:await r.json().catch(()=>({})),country:c})));
    }
    const responses=await Promise.all(tasks);
    const results=[];
    for(const x of responses) if(x.ok) for(const j of (x.data.results||[])) {
      const n=normalize(j,x.country);
      if(n.remote) results.push(n);
    }
    const unique=[...new Map(results.map(x=>[x.id,x])).values()].sort((a,b)=>new Date(b.created)-new Date(a.created)||b.score-a.score);
    return res.status(200).json({results:unique.slice(0,100),sourceCount:unique.length});
  } catch(e) {
    return res.status(500).json({error:"Adzuna connector error.",detail:e.message});
  }
};