// Job sources and matching. Public Greenhouse, Lever and Ashby board APIs for the companies in companies.json,
// plus optional Adzuna search (free API key) to discover companies hiring near any UK location.
import { readFileSync } from "node:fs";

export type Job = { id: string; source: string; company: string; title: string; location: string; locations?: string[]; url: string; updated?: string; description: string; flags: string[] };
export type Search = { titleKeywords: string[]; locationKeywords: string[]; excludeKeywords: string[]; maxAgeDays: number };

export const loadSearch = () => JSON.parse(readFileSync("profile/search.json", "utf8")) as Search;
export const loadCompanies = () => {
  const c = JSON.parse(readFileSync("companies.json", "utf8")) as Record<string, string[] | string>;
  const list = (k: string) => (Array.isArray(c[k]) ? (c[k] as string[]).filter((t) => !t.startsWith("example-")) : []);
  return { greenhouse: list("greenhouse"), lever: list("lever"), ashby: list("ashby") };
};
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const uniq = (a: (string | undefined | null)[]) => [...new Set(a.map((x) => (x ?? "").trim()).filter(Boolean))];

async function getJson<T>(url: string, errors?: string[]): Promise<T | null> {
  const label = url.replace(/app_(id|key)=[^&]+/g, "app_$1=***");
  const fail = (m: string) => { console.warn(`  ${m}`); errors?.push(m); return null; };
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return fail(`${res.status} ${label}`);
    return (await res.json()) as T;
  } catch (e) { return fail(`failed ${label}: ${(e as Error).message}`); }
}

export async function greenhouse(token: string, errors?: string[]): Promise<Job[]> {
  const d = await getJson<{ jobs: any[] }>(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, errors);
  return (d?.jobs ?? []).map((j) => ({ id: `gh-${j.id}`, source: "greenhouse", company: token, title: j.title, location: j.location?.name ?? "", locations: uniq([j.location?.name, ...(j.offices ?? []).flatMap((o: any) => [o?.name, o?.location])]), url: j.absolute_url, updated: j.updated_at, description: strip(j.content ?? ""), flags: [] }));
}
export async function lever(token: string, errors?: string[]): Promise<Job[]> {
  const d = await getJson<any[]>(`https://api.lever.co/v0/postings/${token}?mode=json`, errors);
  return (Array.isArray(d) ? d : []).map((j) => ({ id: `lv-${j.id}`, source: "lever", company: token, title: j.text, location: j.categories?.location ?? "", locations: uniq([j.categories?.location, ...(j.categories?.allLocations ?? []), j.workplaceType === "remote" ? "Remote" : "", j.country === "GB" ? "United Kingdom" : ""]), url: j.hostedUrl, updated: j.createdAt ? new Date(j.createdAt).toISOString() : undefined, description: strip(`${j.descriptionPlain ?? ""} ${(j.lists ?? []).map((l: any) => `${l.text} ${l.content}`).join(" ")}`), flags: [] }));
}
export async function ashby(token: string, errors?: string[]): Promise<Job[]> {
  const d = await getJson<{ jobs: any[] }>(`https://api.ashbyhq.com/posting-api/job-board/${token}`, errors);
  return (d?.jobs ?? []).map((j) => ({ id: `ab-${j.id}`, source: "ashby", company: token, title: j.title, location: j.location ?? "", locations: uniq([j.location, ...(j.secondaryLocations ?? []).map((s: any) => s?.location), j.address?.postalAddress?.addressLocality, j.address?.postalAddress?.addressCountry, j.isRemote ? "Remote" : ""]), url: j.jobUrl, updated: j.publishedAt, description: strip(j.descriptionPlain ?? j.descriptionHtml ?? ""), flags: [] }));
}

export async function fetchBoards(errors?: string[]): Promise<Job[]> {
  const c = loadCompanies();
  const tasks = [...c.greenhouse.map((t) => greenhouse(t, errors)), ...c.lever.map((t) => lever(t, errors)), ...c.ashby.map((t) => ashby(t, errors))];
  return (await Promise.all(tasks)).flat();
}

// ---------- Adzuna (optional) ----------
export const adzunaKeys = () => (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY ? { id: process.env.ADZUNA_APP_ID, key: process.env.ADZUNA_APP_KEY } : null);

// One request per field keyword (phrase search), newest first, within about 15 km of the location.
export async function adzuna(location: string, keywords: string[], maxAgeDays: number, errors?: string[]): Promise<Job[]> {
  const k = adzunaKeys();
  if (!k) return [];
  const phrases = uniq(keywords.map((w) => w.toLowerCase().replace(/-/g, " "))).slice(0, 8);
  const seen = new Map<string, Job>();
  for (const phrase of phrases) {
    const q = new URLSearchParams({ app_id: k.id, app_key: k.key, results_per_page: "50", what_phrase: phrase, sort_by: "date", max_days_old: String(maxAgeDays) });
    if (location && !isUkWide(location)) { q.set("where", location); q.set("distance", "15"); }
    const d = await getJson<{ results: any[] }>(`https://api.adzuna.com/v1/api/jobs/gb/search/1?${q}`, errors);
    for (const r of d?.results ?? []) {
      if (!r?.id || !r.redirect_url) continue;
      seen.set(String(r.id), { id: `az-${r.id}`, source: "adzuna", company: r.company?.display_name ?? "Unknown company", title: strip(String(r.title ?? "")), location: r.location?.display_name ?? location, url: r.redirect_url, updated: r.created, description: strip(String(r.description ?? "")), flags: [] });
    }
  }
  return [...seen.values()];
}

// ---------- Matching ----------
export const UK_PLACES = ["London", "Birmingham", "Coventry", "Manchester", "Leeds", "Bristol", "Edinburgh", "Glasgow", "Cambridge", "Oxford", "Leamington Spa", "Warwick", "Nottingham", "Leicester", "Sheffield", "Liverpool", "Newcastle", "Cardiff", "Belfast", "Reading", "Milton Keynes", "Southampton", "Brighton", "Bath", "York", "Derby", "Wolverhampton", "Solihull", "Northampton", "Norwich", "Exeter", "Aberdeen", "Swindon", "Cheltenham", "Guildford", "Slough"];
const word = (s: string) => new RegExp(`(^|[^a-z])${s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+")}($|[^a-z])`);
const UK_COUNTRY = /(^|[^a-z])(uk|u\.k\.|united kingdom|great britain|britain|england|scotland|wales|northern ireland|gb|gbr)($|[^a-z])/;
const UK_CITY = new RegExp(`(^|[^a-z])(${UK_PLACES.map((p) => p.toLowerCase()).join("|")})($|[^a-z])`);
// "Birmingham, AL", "London, ON" and similar are not in the UK.
const ELSEWHERE = /(^|[^a-z])(united states|usa|u\.s\.|new york|canada|australia|ontario|alabama|india|germany|france|ireland$)($|[^a-z])|,\s*(?!uk\b|gb\b)[a-z]{2}\s*($|[,;|])/;
const OPEN_REMOTE = /emea|europe|anywhere|global|worldwide/;

export const isUkWide = (q: string) => !q.trim() || /^(uk|u\.k\.|united kingdom|great britain|britain|anywhere|all)$/i.test(q.trim());
const inUk = (loc: string) => UK_COUNTRY.test(loc) || (UK_CITY.test(loc) && !ELSEWHERE.test(loc));

export function matchesLocation(job: Job, query: string, includeRemote: boolean): boolean {
  const locs = (job.locations?.length ? job.locations : [job.location]).map((l) => l.toLowerCase()).filter(Boolean);
  if (!locs.length) return false;
  const all = locs.join(" | ");
  const ukSomewhere = locs.some(inUk);
  if (includeRemote && /remote/.test(all)) {
    const rest = all.replace(/remote|[^a-z]/g, "");
    if (ukSomewhere || !rest || (OPEN_REMOTE.test(all) && !locs.some((l) => ELSEWHERE.test(l)))) return true;
  }
  if (isUkWide(query)) return ukSomewhere;
  const q = word(query.trim());
  // the place must be named, and that same entry must not point outside the UK
  return locs.some((l) => q.test(l) && (UK_COUNTRY.test(l) || !ELSEWHERE.test(l)));
}

export const matchesTitle = (job: Job, keywords: string[]) => { const t = job.title.toLowerCase(); return keywords.some((k) => t.includes(k.toLowerCase())); };
export const isRecent = (job: Job, maxAgeDays: number) => !job.updated || Date.now() - new Date(job.updated).getTime() <= maxAgeDays * 864e5;
export const flagsFor = (text: string, exclude: string[]) => { const t = text.toLowerCase(); return exclude.filter((k) => t.includes(k)); };
