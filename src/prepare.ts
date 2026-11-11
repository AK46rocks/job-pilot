// Usage: npm run prepare -- <batch-name> <job-id or url> [more ids/urls...]
// Picks jobs from data/jobs.json (or a manual URL with a JD pasted into output/<batch>/<slug>/jd.txt later),
// writes jd.txt, link.txt and keywords.md (exact JD terms, matched vs missing against the master CV).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { TERMS } from "./terms.js";

type Job = { id: string; company: string; title: string; location: string; url: string; description: string; flags: string[] };
const [batch, ...picks] = process.argv.slice(2);
if (!batch || !picks.length) { console.log("Usage: npm run prepare -- <batch-name> <job-id|url> ..."); process.exit(1); }
const jobs: Job[] = existsSync("data/jobs.json") ? JSON.parse(readFileSync("data/jobs.json", "utf8")) : [];
const master = readFileSync("cv/master_cv.json", "utf8").toLowerCase();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function keywordReport(jd: string) {
  const found = new Map<string, number>();
  for (const t of TERMS) {
    const re = new RegExp(`(^|[^A-Za-z0-9.+#])${esc(t)}(?=$|[^A-Za-z0-9+#])`, "g");
    const n = (jd.match(re) ?? []).length;
    if (n) found.set(t, n);
  }
  // drop shorter terms fully covered by a longer exact term (e.g. React when only React.js appears)
  for (const t of [...found.keys()]) for (const u of found.keys()) if (u !== t && u.includes(t) && found.get(u)! >= found.get(t)!) found.delete(t);
  const rows = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => {
    const base = t.toLowerCase().replace(/\.js$/, "");
    const inMaster = master.includes(t.toLowerCase()) || master.includes(base);
    return { term: t, count: n, inMaster };
  });
  const matched = rows.filter((r) => r.inMaster).length;
  return { rows, score: rows.length ? Math.round((matched / rows.length) * 100) : 0 };
}

const index: string[] = [];
mkdirSync(`output/${batch}`, { recursive: true });
for (const p of picks) {
  const job = jobs.find((j) => j.id === p || j.url === p);
  const name = job ? `${slug(job.company)}-${slug(job.title)}` : slug(p.replace(/^https?:\/\//, ""));
  const dir = `output/${batch}/${name}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/link.txt`, (job?.url ?? p) + "\n");
  if (job) writeFileSync(`${dir}/jd.txt`, `${job.company} | ${job.title} | ${job.location}\n${job.url}\n\n${job.description}`);
  else if (!existsSync(`${dir}/jd.txt`)) writeFileSync(`${dir}/jd.txt`, "PASTE THE JOB DESCRIPTION HERE\n");
  const jd = readFileSync(`${dir}/jd.txt`, "utf8");
  const { rows, score } = keywordReport(jd);
  writeFileSync(`${dir}/keywords.md`, `# Keywords (exact JD spelling)\nRough match: ${score}%\n${job?.flags.length ? `FLAGS: ${job.flags.join(", ")}\n` : ""}\n| Term | Times in JD | In master CV |\n|---|---|---|\n${rows.map((r) => `| ${r.term} | ${r.count} | ${r.inMaster ? "yes" : "NO"} |`).join("\n")}\n`);
  index.push(`${dir}`);
  console.log(`${score}%  ${dir}${job?.flags.length ? `  FLAGS: ${job.flags.join(", ")}` : ""}`);
}
console.log(`\nPrepared ${index.length} job folders in output/${batch}`);
