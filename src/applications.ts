// The application log (data/applications.json plus a CSV copy). Shared by the tracker CLI, fetch-jobs and the web UI.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

export type App = { date: string; company: string; role: string; url: string; status: string; cv?: string; notes?: string; id?: string };
const FILE = "data/applications.json";

export const loadApps = (): App[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
export function saveApps(a: App[]) {
  mkdirSync("data", { recursive: true });
  writeFileSync(FILE, JSON.stringify(a, null, 2));
  writeFileSync("data/applications.csv", ["date,company,role,status,url,cv,notes", ...a.map((x) => [x.date, x.company, x.role, x.status, x.url, x.cv ?? "", x.notes ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"));
}
export const today = () => new Date().toISOString().slice(0, 10);
export const findApp = (apps: App[], job: { id?: string; url: string }) => apps.find((a) => a.url === job.url || (!!job.id && a.id === job.id));
// "drafted" means a CV exists but Aditya has not applied yet, so the job should still be listed.
export const isApplied = (a?: App) => !!a && a.status !== "drafted";
