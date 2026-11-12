// Fetches open roles from public Greenhouse, Lever and Ashby job board APIs,
// filters them by profile/search.json and writes data/jobs.json.
import { writeFileSync, mkdirSync } from "node:fs";
import { fetchBoards, loadCompanies, loadSearch, flagsFor, type Job } from "./jobs.js";
import { loadApps, isApplied } from "./applications.js";

const search = loadSearch();

function keep(job: Job): boolean {
  const t = job.title.toLowerCase(), loc = job.location.toLowerCase();
  if (!search.titleKeywords.some((k) => t.includes(k))) return false;
  if (loc && !search.locationKeywords.some((k) => loc.includes(k))) return false;
  if (job.updated && Date.now() - new Date(job.updated).getTime() > search.maxAgeDays * 864e5) return false;
  job.flags = flagsFor(`${t} ${loc} ${job.description}`, search.excludeKeywords);
  return true;
}

async function main() {
  const c = loadCompanies();
  if (!(c.greenhouse.length + c.lever.length + c.ashby.length)) { console.log("No companies in companies.json yet. Add board tokens first."); return; }
  const jobs = (await fetchBoards()).filter(keep);
  // jobs already applied for (anything past "drafted" in the tracker) are not listed again
  const applied = loadApps().filter(isApplied);
  const fresh = jobs.filter((j) => !applied.some((a) => a.url === j.url || a.id === j.id));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/jobs.json", JSON.stringify(fresh, null, 2));
  console.log(`Found ${fresh.length} matching roles (${fresh.filter((j) => j.flags.length).length} flagged). Saved to data/jobs.json`);
  for (const j of fresh) console.log(`${j.flags.length ? "FLAG " : "     "}${j.id} | ${j.company} | ${j.title} | ${j.location} | ${j.url}${j.flags.length ? `  [${j.flags.join(", ")}]` : ""}`);
}
main();
