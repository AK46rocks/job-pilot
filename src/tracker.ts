// Application tracker. Usage:
//   npm run track -- add "<company>" "<role>" "<url>" [status] [notes]
//   npm run track -- status "<url>" <status>      (statuses: drafted, submitted, interview, offer, rejected)
//   npm run track -- list
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

type App = { date: string; company: string; role: string; url: string; status: string; cv?: string; notes?: string };
const FILE = "data/applications.json";
const load = (): App[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (a: App[]) => { mkdirSync("data", { recursive: true }); writeFileSync(FILE, JSON.stringify(a, null, 2)); writeCsv(a); };
const writeCsv = (a: App[]) => writeFileSync("data/applications.csv", ["date,company,role,status,url,cv,notes", ...a.map((x) => [x.date, x.company, x.role, x.status, x.url, x.cv ?? "", x.notes ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"));

const [cmd, ...args] = process.argv.slice(2);
const apps = load();
if (cmd === "add") {
  const [company, role, url, status = "drafted", notes = "", cv = ""] = args;
  if (!company || !role || !url) throw new Error("add needs company, role and url");
  const existing = apps.find((a) => a.url === url);
  if (existing) Object.assign(existing, { status, notes: notes || existing.notes, cv: cv || existing.cv });
  else apps.push({ date: new Date().toISOString().slice(0, 10), company, role, url, status, notes, cv });
  save(apps); console.log(`Saved: ${company} | ${role} | ${status}`);
} else if (cmd === "status") {
  const [url, status] = args; const a = apps.find((x) => x.url === url);
  if (!a) throw new Error("No application with that url"); a.status = status; save(apps); console.log(`Updated ${a.company} to ${status}`);
} else {
  if (!apps.length) console.log("No applications yet.");
  for (const a of apps) console.log(`${a.date} | ${a.status.padEnd(9)} | ${a.company} | ${a.role} | ${a.url}`);
}
