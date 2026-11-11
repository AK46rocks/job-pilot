// Fetches open roles from public Greenhouse, Lever and Ashby job board APIs,
// filters them by profile/search.json and writes data/jobs.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

type Job = { id: string; source: string; company: string; title: string; location: string; url: string; updated?: string; description: string; flags: string[] };
type Search = { titleKeywords: string[]; locationKeywords: string[]; excludeKeywords: string[]; maxAgeDays: number };

const companies = JSON.parse(readFileSync("companies.json", "utf8")) as Record<string, string[] | string>;
const search = JSON.parse(readFileSync("profile/search.json", "utf8")) as Search;
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const list = (k: string) => (Array.isArray(companies[k]) ? (companies[k] as string[]).filter((t) => !t.startsWith("example-")) : []);

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) { console.warn(`  ${res.status} ${url}`); return null; }
    return (await res.json()) as T;
  } catch (e) { console.warn(`  failed ${url}: ${(e as Error).message}`); return null; }
}

async function greenhouse(token: string): Promise<Job[]> {
  const d = await getJson<{ jobs: any[] }>(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
  return (d?.jobs ?? []).map((j) => ({ id: `gh-${j.id}`, source: "greenhouse", company: token, title: j.title, location: j.location?.name ?? "", url: j.absolute_url, updated: j.updated_at, description: strip(j.content ?? ""), flags: [] }));
}
async function lever(token: string): Promise<Job[]> {
  const d = await getJson<any[]>(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return (d ?? []).map((j) => ({ id: `lv-${j.id}`, source: "lever", company: token, title: j.text, location: j.categories?.location ?? "", url: j.hostedUrl, updated: j.createdAt ? new Date(j.createdAt).toISOString() : undefined, description: strip(`${j.descriptionPlain ?? ""} ${(j.lists ?? []).map((l: any) => `${l.text} ${l.content}`).join(" ")}`), flags: [] }));
}
async function ashby(token: string): Promise<Job[]> {
  const d = await getJson<{ jobs: any[] }>(`https://api.ashbyhq.com/posting-api/job-board/${token}`);
  return (d?.jobs ?? []).map((j) => ({ id: `ab-${j.id}`, source: "ashby", company: token, title: j.title, location: j.location ?? "", url: j.jobUrl, updated: j.publishedAt, description: strip(j.descriptionPlain ?? j.descriptionHtml ?? ""), flags: [] }));
}

function keep(job: Job): boolean {
  const t = job.title.toLowerCase(), loc = job.location.toLowerCase(), all = `${t} ${loc} ${job.description.toLowerCase()}`;
  if (!search.titleKeywords.some((k) => t.includes(k))) return false;
  if (loc && !search.locationKeywords.some((k) => loc.includes(k))) return false;
  if (job.updated && Date.now() - new Date(job.updated).getTime() > search.maxAgeDays * 864e5) return false;
  job.flags = search.excludeKeywords.filter((k) => all.includes(k));
  return true;
}

async function main() {
  const tasks: Promise<Job[]>[] = [...list("greenhouse").map(greenhouse), ...list("lever").map(lever), ...list("ashby").map(ashby)];
  if (!tasks.length) { console.log("No companies in companies.json yet. Add board tokens first."); return; }
  const jobs = (await Promise.all(tasks)).flat().filter(keep);
  const applied = existsSync("data/applications.json") ? (JSON.parse(readFileSync("data/applications.json", "utf8")) as { url: string }[]).map((a) => a.url) : [];
  const fresh = jobs.filter((j) => !applied.includes(j.url));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/jobs.json", JSON.stringify(fresh, null, 2));
  console.log(`Found ${fresh.length} matching roles (${fresh.filter((j) => j.flags.length).length} flagged). Saved to data/jobs.json`);
  for (const j of fresh) console.log(`${j.flags.length ? "FLAG " : "     "}${j.company} | ${j.title} | ${j.location} | ${j.url}${j.flags.length ? `  [${j.flags.join(", ")}]` : ""}`);
}
main();
