// Finds the tech and role terms a job description uses (exact JD spelling) and checks them against the master CV.
import { readFileSync } from "node:fs";
import { TERMS } from "./terms.js";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const boundary = (t: string, flags: string) => new RegExp(`(^|[^A-Za-z0-9.+#])${esc(t)}(?=$|[^A-Za-z0-9+#])`, flags);
export const baseTerm = (t: string) => t.toLowerCase().replace(/\.js$/, "");

// True when `text` (already lower case) mentions the term. Short terms such as Go, Java or SQL must
// stand alone as a word, so "Go" is not found inside "Google" and "Java" is not found inside "JavaScript".
const ALIASES: Record<string, string> = { "restful apis": "rest apis", restful: "rest", golang: "go", llms: "llm", oauth2: "oauth", "code reviews": "code review", "vector databases": "vector database" };
export function mentions(text: string, term: string): boolean {
  const t = term.toLowerCase(), base = baseTerm(term), alias = ALIASES[t];
  if (boundary(t, "").test(text) || boundary(base, "").test(text) || (!!alias && boundary(alias, "").test(text))) return true;
  return t.length >= 5 && (text.includes(t) || (base.length >= 5 && text.includes(base)));
}

export function keywordReport(jd: string, master = readFileSync("cv/master_cv.json", "utf8")) {
  const cv = master.toLowerCase();
  const found = new Map<string, number>();
  for (const t of TERMS) {
    const n = (jd.match(boundary(t, "g")) ?? []).length;
    if (n) found.set(t, n);
  }
  // drop shorter terms fully covered by a longer exact term (e.g. React when only React.js appears)
  for (const t of [...found.keys()]) for (const u of found.keys()) if (u !== t && u.includes(t) && found.get(u)! >= found.get(t)!) found.delete(t);
  const rows = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ term: t, count: n, inMaster: mentions(cv, t) }));
  const matched = rows.filter((r) => r.inMaster).length;
  return { rows, score: rows.length ? Math.round((matched / rows.length) * 100) : 0 };
}

export const keywordsMd = (rows: { term: string; count: number; inMaster: boolean }[], score: number, flags: string[] = []) =>
  `# Keywords (exact JD spelling)\nRough match: ${score}%\n${flags.length ? `FLAGS: ${flags.join(", ")}\n` : ""}\n| Term | Times in JD | In master CV |\n|---|---|---|\n${rows.map((r) => `| ${r.term} | ${r.count} | ${r.inMaster ? "yes" : "NO"} |`).join("\n")}\n`;
