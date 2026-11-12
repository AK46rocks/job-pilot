// Rule-based CV tailoring for the web UI (no AI call). It only selects and reorders text that is already
// in cv/master_cv.json, so it cannot invent facts. It writes the same tailor.json that `npm run build` reads,
// so a job folder made by the UI can still be refined later with /batch.
import { TERMS } from "./terms.js";
import { keywordReport, mentions, baseTerm } from "./keywords.js";

type Item = any[];
type Master = { title: string; profile: string; sections: { name: string; items: Item[] }[] };
export type Tailor = { company: string; title: string; profile: string; drop: string[]; skills: string[][] };

const SOFT_FROM = TERMS.indexOf("accessibility"); // terms from here on are ways of working, not core tech
const clean = (s: string) => s.replace(/[—–]/g, "-").replace(/;/g, ",").replace(/\s+/g, " ").trim();
const splitList = (s: string) => s.split(/,\s*(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);

export function autoTailor(masterJson: string, jd: string, job: { company: string; title: string }, budget = 2600) {
  const master = JSON.parse(masterJson) as Master;
  const report = keywordReport(jd, masterJson);
  const matched = report.rows.filter((r) => r.inMaster);
  const score = (text: string) => { const t = text.toLowerCase(); return matched.reduce((n, r) => n + (mentions(t, r.term) ? r.count : 0), 0); };

  // ----- bullets: drop the least relevant until the text fits the one-page budget -----
  type B = { id: string; len: number; score: number; section: string; owner: string; order: number };
  const bullets: B[] = [];
  master.sections.forEach((s, si) => {
    let owner = "";
    s.items.forEach((it, ii) => {
      if (it[0] === "role") owner = `${si}.${ii}`;
      if (it[0] === "b") bullets.push({ id: `${si}.${ii}`, len: String(it[1]).length, score: score(String(it[1])), section: s.name, owner, order: bullets.length });
    });
  });
  // every job in Professional Experience keeps its two strongest bullets
  const protectedIds = new Set<string>();
  for (const owner of new Set(bullets.filter((b) => b.section === "Professional Experience").map((b) => b.owner)))
    bullets.filter((b) => b.owner === owner).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 2).forEach((b) => protectedIds.add(b.id));
  const sectionRank = (n: string) => (n === "Education" ? 0 : n === "Projects" ? 1 : 2);
  const candidates = bullets.filter((b) => !protectedIds.has(b.id)).sort((a, b) => a.score - b.score || sectionRank(a.section) - sectionRank(b.section) || b.order - a.order);
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

  // ----- skills: the 5 most relevant lines, with the JD's terms first and in the JD's spelling -----
  const skillsSection = master.sections.find((s) => s.name === "Skills");
  const lines = (skillsSection?.items ?? []).filter((it) => it[0] === "s").map((it, i) => ({ label: String(it[1]), text: String(it[2]), i, score: score(String(it[2])) }));
  const skills = [...lines].sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 5).sort((a, b) => a.i - b.i).map((l) => {
    const parts = splitList(l.text).map((p, i) => {
      // "React" becomes "React.js" when that is how the job spells it
      const exact = matched.find((r) => r.term.toLowerCase() !== p.toLowerCase() && baseTerm(r.term) === p.toLowerCase());
      return { text: exact ? exact.term : p, score: score(p), i };
    });
    return [l.label, parts.sort((a, b) => b.score - a.score || a.i - b.i).map((p) => p.text).join(", ")];
  });

  // ----- title: the role plus the top matched tech terms, exact JD spelling -----
  const seen = new Set<string>();
  const top = matched.filter((r) => TERMS.indexOf(r.term) < SOFT_FROM).filter((r) => { const b = baseTerm(r.term); if (seen.has(b)) return false; seen.add(b); return true; }).slice(0, 5).map((r) => r.term);
  const role = clean(job.title.replace(/\([^)]*\)/g, "")).slice(0, 70);
  const title = top.length >= 3 && role ? `${role} | ${top.join(", ")}` : master.title;

  // ----- profile: opening sentence plus the most relevant sentences that fit in 450 characters -----
  const sentences = master.profile.split(/(?<=\.)\s+(?=[A-Z])/).map((text, i) => ({ text, i, score: score(text) }));
  const picked = sentences.slice(0, 1);
  let len = picked[0]?.text.length ?? 0;
  for (const s of sentences.slice(1).sort((a, b) => b.score - a.score || a.i - b.i)) if (len + 1 + s.text.length <= 450) { picked.push(s); len += 1 + s.text.length; }
  const profile = picked.sort((a, b) => a.i - b.i).map((s) => s.text).join(" ").slice(0, 450);

  const tailor: Tailor = { company: clean(job.company), title, profile, drop: [...drop], skills };
  return { tailor, report, matched: matched.map((r) => r.term), missing: report.rows.filter((r) => !r.inMaster).map((r) => r.term) };
}
