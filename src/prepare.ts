// Usage: npm run prepare -- <batch-name> <job-id or url> [more ids/urls...]
// Picks jobs from data/jobs.json (or a manual URL with a JD pasted into output/<batch>/<slug>/jd.txt later),
// writes jd.txt, link.txt and keywords.md (exact JD terms, matched vs missing against the master CV).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { keywordReport, keywordsMd } from "./keywords.js";

type Job = { id: string; company: string; title: string; location: string; url: string; description: string; flags: string[] };
const [batch, ...picks] = process.argv.slice(2);
// npm also runs a script called "prepare" during `npm install`, so exit quietly when there are no arguments.
if (!batch || !picks.length) { console.log("Usage: npm run prepare -- <batch-name> <job-id|url> ..."); process.exit(0); }
const jobs: Job[] = existsSync("data/jobs.json") ? JSON.parse(readFileSync("data/jobs.json", "utf8")) : [];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
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
  writeFileSync(`${dir}/keywords.md`, keywordsMd(rows, score, job?.flags ?? []));
  index.push(`${dir}`);
  console.log(`${score}%  ${dir}${job?.flags.length ? `  FLAGS: ${job.flags.join(", ")}` : ""}`);
}
console.log(`\nPrepared ${index.length} job folders in output/${batch}`);
