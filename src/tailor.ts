// Rule-based CV tailoring for the web UI (no AI call). It applies the parts of .claude/skills/tailor-cv/SKILL.md
// that can be done by rules: exact JD spelling, title and profile format, most relevant and quantified bullets
// first, one page filled as far as it goes. It only selects and reorders text that is already in
// cv/master_cv.json (plus the "confirmed extras" from the skill), so it cannot invent facts.
// It writes the same tailor.json that `npm run build` reads, so Claude Code can refine a folder later.
import { TERMS } from "./terms.js";
import { keywordReport, mentions, baseTerm } from "./keywords.js";

type Item = any[];
type Master = { title: string; profile: string; rtw: string; sections: { name: string; items: Item[] }[] };
export type Tailor = { company: string; title: string; profile: string; rtw?: string; drop: string[]; order: string[]; skills: string[][] };

// "Confirmed extras" in the tailor-cv skill that are not in the master CV: JD term -> [Skills line, text to add].
const EXTRAS: Record<string, [string, string]> = {
  Bootstrap: ["Frontend", "Bootstrap"], Playwright: ["Ways of working", "Playwright"], GitLab: ["Cloud and DevOps", "GitLab CI/CD"], Jenkins: ["Cloud and DevOps", "Jenkins"],
  "SQL Server": ["Data", "Microsoft SQL Server"], "Microsoft SQL Server": ["Data", "Microsoft SQL Server"],
};
// places close enough to Coventry for the "nearby" note on the right-to-work line
const NEARBY = ["Birmingham", "Leamington Spa", "Leamington", "Warwick", "Solihull", "Rugby", "Nuneaton", "Kenilworth"];

const SOFT_FROM = TERMS.indexOf("accessibility"); // terms from here on are ways of working, not core tech
const clean = (s: string) => s.replace(/[—–]/g, "-").replace(/;/g, ",").replace(/\s+/g, " ").trim();
const splitList = (s: string) => s.split(/,\s*(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
const quantified = (s: string) => /\d+\+|\d+%|\d+ MB|\b\d{2,}\b/.test(s);

export function autoTailor(masterJson: string, jd: string, job: { company: string; title: string; location?: string }, budget = 2600) {
  const master = JSON.parse(masterJson) as Master;
  const report = keywordReport(jd, `${masterJson} ${Object.keys(EXTRAS).join(" , ")}`);
  const matched = report.rows.filter((r) => r.inMaster);
  const score = (text: string) => { const t = text.toLowerCase(); return matched.reduce((n, r) => n + (mentions(t, r.term) ? r.count : 0), 0); };

  // ----- bullets: drop the least relevant until the text fits the one-page budget -----
  type B = { id: string; len: number; score: number; section: string; owner: string; ownerName: string; order: number };
  const bullets: B[] = [];
  master.sections.forEach((s, si) => {
    let owner = "", ownerName = "";
    s.items.forEach((it, ii) => {
      if (it[0] === "role") { owner = `${si}.${ii}`; ownerName = String(it[1]); }
      // a known metric makes a bullet slightly stronger than an equally relevant one without
      if (it[0] === "b") bullets.push({ id: `${si}.${ii}`, len: String(it[1]).length, score: score(String(it[1])) + (quantified(String(it[1])) ? 0.5 : 0), section: s.name, owner, ownerName, order: bullets.length });
    });
  });
  // every job in Professional Experience keeps its two strongest bullets
  const protectedIds = new Set<string>();
  for (const owner of new Set(bullets.filter((b) => b.section === "Professional Experience").map((b) => b.owner)))
    bullets.filter((b) => b.owner === owner).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 2).forEach((b) => protectedIds.add(b.id));
  // on a tie: education notes go first, then side projects, and DappLooker bullets are kept longest (they fill the page)
  const keepRank = (b: B) => (b.section === "Education" ? 0 : b.section === "Projects" ? 1 : /DappLooker/.test(b.ownerName) ? 3 : 2);
  const candidates = bullets.filter((b) => !protectedIds.has(b.id)).sort((a, b) => a.score - b.score || keepRank(a) - keepRank(b) || b.order - a.order);
  const drop = new Set<string>();
  let total = bullets.reduce((n, b) => n + b.len, 0);
  for (const b of candidates) { if (total <= budget) break; drop.add(b.id); total -= b.len; }
  // a project left with no bullets goes too (heading and tech line). Employers and degrees always stay.
  master.sections.forEach((s, si) => {
    let block: string[] = [], droppable = false, kept = 0;
    const close = () => { if (droppable && block.length && !kept) block.forEach((id) => drop.add(id)); };
    s.items.forEach((it, ii) => {
      const id = `${si}.${ii}`;
      if (it[0] === "role" || it[0] === "proj") { close(); block = [id]; kept = 0; droppable = it[0] === "proj" || s.name === "Projects"; }
      else if (it[0] === "b") { if (!drop.has(id)) kept++; }
      else block.push(id);
    });
    close();
  });
  // most relevant bullets first inside each role or project
  const order = bullets.filter((b) => !drop.has(b.id) && b.score >= 1).sort((a, b) => b.score - a.score || a.order - b.order).map((b) => b.id);

  // ----- skills: the 5 most relevant lines, JD terms first, JD spelling plus the usual spelling once -----
  const extras = report.rows.filter((r) => EXTRAS[r.term]).map((r) => ({ label: EXTRAS[r.term][0], text: EXTRAS[r.term][1], count: r.count }));
  const langChain = report.rows.find((r) => r.term === "LangChain")?.count ?? 0; // shown as "LangGraph (LangChain ecosystem)"
  const wantsLangChain = langChain > 0;
  const skillsSection = master.sections.find((s) => s.name === "Skills");
  const lines = (skillsSection?.items ?? []).filter((it) => it[0] === "s").map((it, i) => {
    const label = String(it[1]);
    const add = [...new Set(extras.filter((e) => e.label === label).map((e) => e.text))].filter((t) => !String(it[2]).toLowerCase().includes(t.toLowerCase()));
    const text = [...add, String(it[2])].join(", ");
    return { label, text, i, score: score(text) + extras.filter((e) => e.label === label).reduce((n, e) => n + e.count, 0) + (/LangGraph/.test(text) ? langChain : 0) };
  });
  const skills = [...lines].sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 5).sort((a, b) => a.i - b.i).map((l) => {
    const parts = splitList(l.text).map((p, i) => {
      // "React" becomes "React.js (React)" when the job spells it React.js
      const exact = matched.find((r) => r.term.toLowerCase() !== p.toLowerCase() && baseTerm(r.term) === p.toLowerCase());
      const text = exact ? `${exact.term} (${p})` : p === "LangGraph" && wantsLangChain ? "LangGraph (LangChain ecosystem)" : p;
      return { text, score: score(p), i };
    });
    return [l.label, parts.sort((a, b) => b.score - a.score || a.i - b.i).map((p) => p.text).join(", ")];
  });

  // ----- title: the role plus the top matched tech terms, exact JD spelling -----
  const seen = new Set<string>();
  const top = matched.filter((r) => TERMS.indexOf(r.term) < SOFT_FROM && !EXTRAS[r.term]).filter((r) => { const b = baseTerm(r.term); if (seen.has(b)) return false; seen.add(b); return true; }).slice(0, 5).map((r) => r.term);
  const role = clean(job.title.replace(/\([^)]*\)/g, "")).slice(0, 70);
  const title = top.length >= 3 && role ? `${role} | ${top.join(", ")}` : master.title;

  // ----- profile: opening sentence, the most relevant proof points that fit, and the MSc line last (450 characters) -----
  const sentences = master.profile.split(/(?<=\.)\s+(?=[A-Z])/).map((text, i) => ({ text, i, score: score(text) + (quantified(text) ? 0.5 : 0) }));
  const picked = sentences.slice(0, 1);
  const msc = sentences.slice(1).find((s) => /^MSc\b/.test(s.text));
  if (msc) picked.push(msc);
  let len = picked.reduce((n, s) => n + s.text.length + 1, -1);
  for (const s of sentences.slice(1).filter((s) => s !== msc).sort((a, b) => b.score - a.score || a.i - b.i)) if (len + 1 + s.text.length <= 450) { picked.push(s); len += 1 + s.text.length; }
  const profile = picked.sort((a, b) => a.i - b.i).map((s) => s.text).join(" ").slice(0, 450);

  // ----- right-to-work line: add where he is based when the job is local to Coventry -----
  const loc = (job.location ?? "").toLowerCase();
  const near = NEARBY.find((p) => loc.includes(p.toLowerCase()));
  const rtw = near ? `${master.rtw}, based in Coventry, close to ${near}` : loc.includes("coventry") ? `${master.rtw}, based in Coventry` : undefined;

  const tailor: Tailor = { company: clean(job.company), title, profile, ...(rtw ? { rtw } : {}), drop: [...drop], order, skills };
  return { tailor, report, matched: matched.map((r) => r.term), missing: report.rows.filter((r) => !r.inMaster).map((r) => r.term) };
}
