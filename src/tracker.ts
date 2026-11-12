// Application tracker. Usage:
//   npm run track -- add "<company>" "<role>" "<url>" [status] [notes]
//   npm run track -- status "<url>" <status>      (statuses: drafted, submitted, interview, offer, rejected)
//   npm run track -- list
import { loadApps, saveApps, today } from "./applications.js";

const [cmd, ...args] = process.argv.slice(2);
const apps = loadApps();
if (cmd === "add") {
  const [company, role, url, status = "drafted", notes = "", cv = ""] = args;
  if (!company || !role || !url) throw new Error("add needs company, role and url");
  const existing = apps.find((a) => a.url === url);
  if (existing) Object.assign(existing, { status, notes: notes || existing.notes, cv: cv || existing.cv });
  else apps.push({ date: today(), company, role, url, status, notes, cv });
  saveApps(apps); console.log(`Saved: ${company} | ${role} | ${status}`);
} else if (cmd === "status") {
  const [url, status] = args; const a = apps.find((x) => x.url === url);
  if (!a) throw new Error("No application with that url"); a.status = status; saveApps(apps); console.log(`Updated ${a.company} to ${status}`);
} else {
  if (!apps.length) console.log("No applications yet.");
  for (const a of apps) console.log(`${a.date} | ${a.status.padEnd(9)} | ${a.company} | ${a.role} | ${a.url}`);
}
