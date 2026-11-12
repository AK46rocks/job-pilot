// Local web UI. Usage: npm run ui   then open http://localhost:4173
// Search a UK location, see companies hiring there and their relevant roles, build a tailored CV from a pasted
// job description, and tick roles off once applied so they are not listed again.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, sep, extname } from "node:path";
import { fetchBoards, adzuna, adzunaKeys, loadSearch, loadCompanies, matchesLocation, matchesTitle, isRecent, flagsFor, isUkWide, UK_PLACES, type Job } from "./jobs.js";
import { loadApps, saveApps, findApp, isApplied, today } from "./applications.js";
import { autoTailor } from "./tailor.js";
import { keywordsMd } from "./keywords.js";

try { if (existsSync(".env")) process.loadEnvFile(".env"); } catch (e) { console.warn(`Could not read .env: ${(e as Error).message}`); }
const PORT = Number(process.env.PORT || 4173);
const TTL = 15 * 60 * 1000;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

// ---------- job cache ----------
const cache = new Map<string, { at: number; jobs: Job[]; errors: string[] }>();
const known = new Map<string, Job>(); // every job seen this session, by id
async function cached(key: string, refresh: boolean, load: (errors: string[]) => Promise<Job[]>) {
  const hit = cache.get(key);
  if (hit && !refresh && Date.now() - hit.at < TTL) return hit;
  const errors: string[] = [];
  const entry = { at: Date.now(), jobs: await load(errors), errors };
  cache.set(key, entry);
  return entry;
}

async function search(q: URLSearchParams) {
  const cfg = loadSearch();
  const location = (q.get("location") ?? "").trim().slice(0, 80);
  const remote = q.get("remote") === "1", refresh = q.get("refresh") === "1";
  const custom = (q.get("keywords") ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  const keywords = custom.length ? custom : cfg.titleKeywords;

  const boards = await cached("boards", refresh, fetchBoards);
  const extra = adzunaKeys() ? await cached(`adzuna|${location.toLowerCase()}|${keywords.join(",")}`, refresh, (e) => adzuna(location, keywords, cfg.maxAgeDays, e)) : null;
  const pool = [
    ...boards.jobs.filter((j) => matchesLocation(j, location, remote)),
    ...(extra?.jobs ?? []), // Adzuna already searched around the location
  ].filter((j) => matchesTitle(j, keywords) && isRecent(j, cfg.maxAgeDays));
  const seen = new Set<string>();
  const matches = pool.filter((j) => { const k = `${j.company.toLowerCase()}|${j.title.toLowerCase()}|${j.location.toLowerCase()}`; if (seen.has(k) || seen.has(j.url)) return false; seen.add(k); seen.add(j.url); return true; });
  for (const j of matches) { j.flags = flagsFor(`${j.title} ${j.location} ${j.description}`, cfg.excludeKeywords); known.set(j.id, j); }

  const apps = loadApps();
  const fresh = matches.filter((j) => !isApplied(findApp(apps, j)));
  fresh.sort((a, b) => (b.updated ? new Date(b.updated).getTime() : 0) - (a.updated ? new Date(a.updated).getTime() : 0));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/jobs.json", JSON.stringify(fresh, null, 2)); // keeps /batch <id> working for jobs found here

  const companies = new Map<string, number>();
  for (const j of fresh) companies.set(j.company, (companies.get(j.company) ?? 0) + 1);
  return {
    location: isUkWide(location) ? "the UK" : location, keywords,
    fetchedAt: Math.min(boards.at, extra?.at ?? Infinity),
    hiddenApplied: matches.length - fresh.length,
    errors: [...boards.errors, ...(extra?.errors ?? [])],
    companies: [...companies.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    jobs: fresh.map((j) => { const a = findApp(apps, j); return { id: j.id, source: j.source, company: j.company, title: j.title, location: j.location, url: j.url, updated: j.updated, flags: j.flags, hasDescription: j.source !== "adzuna" && j.description.length > 300, cv: cvUrl(a?.cv), notes: a?.notes ?? "" }; }),
  };
}

const cvUrl = (path?: string) => (path && path.startsWith("output/") && existsSync(path) ? `/files/${path.slice("output/".length).split("/").map(encodeURIComponent).join("/")}` : "");

// ---------- CV build (one at a time, LibreOffice does not like running in parallel) ----------
let queue: Promise<unknown> = Promise.resolve();
const runBuild = (dir: string) => new Promise<{ code: number; out: string }>((done) => {
  const p = spawn(process.execPath, ["--import", "tsx", "src/build.ts", dir], { env: process.env });
  let out = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (out += d));
  p.on("error", (e) => done({ code: 1, out: e.message }));
  p.on("close", (code) => done({ code: code ?? 1, out }));
});

async function generateCv(body: any) {
  const job = { id: String(body?.job?.id ?? ""), company: String(body?.job?.company ?? "").trim(), title: String(body?.job?.title ?? "").trim(), location: String(body?.job?.location ?? ""), url: String(body?.job?.url ?? "").trim() };
  const jd = String(body?.jd ?? "").trim();
  if (!job.company || !job.title || !/^https?:\/\//.test(job.url)) throw new Error("The job needs a company, a title and a link.");
  if (jd.length < 200) throw new Error("Paste the full job description first (at least a few paragraphs).");
  const cfg = loadSearch();
  const flags = flagsFor(`${job.title} ${jd}`, cfg.excludeKeywords);
  const master = readFileSync("cv/master_cv.json", "utf8");
  const dir = `output/ui/${slug(job.company)}-${slug(job.title)}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/link.txt`, job.url + "\n");
  writeFileSync(`${dir}/jd.txt`, `${job.company} | ${job.title} | ${job.location}\n${job.url}\n\n${jd}\n`);

  let result: ReturnType<typeof autoTailor> | undefined, built = false, log = "";
  for (const budget of [2600, 2350, 2100, 1850, 1600]) {
    result = autoTailor(master, jd, job, budget);
    writeFileSync(`${dir}/keywords.md`, keywordsMd(result.report.rows, result.report.score, flags));
    writeFileSync(`${dir}/tailor.json`, JSON.stringify(result.tailor, null, 2));
    const summary = `Match ${result.report.score}%. ${result.missing.length ? `Missing: ${result.missing.slice(0, 6).join(", ")}` : "No missing keywords found"}.${flags.length ? ` FLAGS: ${flags.join(", ")}.` : ""}`;
    writeFileSync(`${dir}/notes.md`, `${summary}\n\nBuilt by the web UI with rule-based tailoring (bullets, skills and profile selected from the master CV).\n\n## Keywords in the job description that are not in the master CV\n${result.missing.map((m) => `- ${m}`).join("\n") || "- none"}\n`);
    const r = await runBuild(dir);
    log = r.out.trim();
    if (r.code === 0) { built = true; break; }
    if (r.code !== 2) throw new Error(log.split("\n").pop() || "CV build failed");
  }
  if (!built || !result) throw new Error("Could not fit the CV on one page. " + log.split("\n").pop());
  const pdf = readdirSync(dir).filter((f) => f.endsWith(".pdf")).map((f) => `${dir}/${f}`).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!pdf) throw new Error("The build finished but no PDF was written. " + log);

  const apps = loadApps();
  const notes = `Match ${result.report.score}%${result.missing.length ? `, missing: ${result.missing.slice(0, 6).join(", ")}` : ""}`;
  const a = findApp(apps, job);
  if (a) Object.assign(a, { cv: pdf, notes, id: a.id ?? (job.id || undefined) });
  else apps.push({ date: today(), company: job.company, role: job.title, url: job.url, status: "drafted", notes, cv: pdf, id: job.id || undefined });
  saveApps(apps);
  return { cv: cvUrl(pdf), folder: dir, score: result.report.score, matched: result.matched, missing: result.missing, flags, title: result.tailor.title, notes };
}

function setApplied(body: any) {
  const job = { id: String(body?.job?.id ?? ""), company: String(body?.job?.company ?? "").trim(), title: String(body?.job?.title ?? "").trim(), url: String(body?.job?.url ?? "").trim() };
  if (!/^https?:\/\//.test(job.url)) throw new Error("The job needs a link.");
  const apps = loadApps();
  const a = findApp(apps, job);
  if (body?.applied) {
    if (a) Object.assign(a, { status: "submitted", date: today(), id: a.id ?? (job.id || undefined) });
    else apps.push({ date: today(), company: job.company, role: job.title, url: job.url, status: "submitted", notes: "", cv: "", id: job.id || undefined });
  } else if (a) {
    if (a.cv) a.status = "drafted"; else apps.splice(apps.indexOf(a), 1);
  }
  saveApps(apps);
  return { ok: true };
}

// ---------- http ----------
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const json = (res: ServerResponse, code: number, data: unknown) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
const readBody = (req: IncomingMessage) => new Promise<any>((ok, fail) => {
  let s = "";
  req.on("data", (c) => { s += c; if (s.length > 2e6) { fail(new Error("Request too large")); req.destroy(); } });
  req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch { fail(new Error("Invalid JSON")); } });
  req.on("error", fail);
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    // local tool only: refuse other hosts (DNS rebinding) and cross-site form posts
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? "")) return json(res, 403, { error: "Open this page as http://localhost" });
    if (req.method === "POST" && !/^application\/json/.test(req.headers["content-type"] ?? "")) return json(res, 415, { error: "JSON only" });

    if (req.method === "GET" && path === "/") { res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-store" }); return res.end(readFileSync("ui/index.html")); }
    if (req.method === "GET" && path === "/api/config") {
      const c = loadCompanies(), s = loadSearch();
      return json(res, 200, { titleKeywords: s.titleKeywords, places: UK_PLACES, adzuna: !!adzunaKeys(), boards: c.greenhouse.length + c.lever.length + c.ashby.length });
    }
    if (req.method === "GET" && path === "/api/search") return json(res, 200, await search(url.searchParams));
    if (req.method === "GET" && path === "/api/description") {
      const j = known.get(url.searchParams.get("id") ?? "");
      return j ? json(res, 200, { description: j.description }) : json(res, 404, { error: "Search again, then retry." });
    }
    if (req.method === "GET" && path === "/api/applications") return json(res, 200, { applications: loadApps().map((a) => ({ ...a, cv: cvUrl(a.cv) })).reverse() });
    if (req.method === "POST" && path === "/api/cv") { const body = await readBody(req); const r = await (queue = queue.catch(() => {}).then(() => generateCv(body))); return json(res, 200, r); }
    if (req.method === "POST" && path === "/api/applied") return json(res, 200, setApplied(await readBody(req)));
    if (req.method === "GET" && path.startsWith("/files/")) {
      const root = resolve("output"), file = resolve(root, decodeURIComponent(path.slice("/files/".length)));
      if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return json(res, 404, { error: "Not found" });
      res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store" });
      return res.end(readFileSync(file));
    }
    json(res, 404, { error: "Not found" });
  } catch (e) { json(res, 400, { error: (e as Error).message }); }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Job Pilot UI: http://localhost:${PORT}\n${adzunaKeys() ? "Adzuna search is on." : "Adzuna keys not set, searching the company boards in companies.json only."}`));
