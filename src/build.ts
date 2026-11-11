// Builds a one-page CV PDF from cv/master_cv.json plus a small tailor.json.
// Usage: npm run build -- output/<batch>/<job-folder>
// tailor.json: { "company": "Acme", "title": "...", "profile": "...",
//   "drop": ["0.5","0.12"],            // ids from `npm run bullets` to remove (bullets, projects, skills lines)
//   "edit": { "0.4": "new bullet text" } // rewrite specific lines with exact JD keywords (facts must stay true)
//   "skills": [["Frontend","React.js, ..."]] // optional: replaces the Skills section
// }
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const dir = process.argv[2];
if (!dir || !existsSync(`${dir}/tailor.json`)) { console.log("Usage: npm run build -- <job folder containing tailor.json>"); process.exit(1); }
const t = JSON.parse(readFileSync(`${dir}/tailor.json`, "utf8"));
const m = JSON.parse(readFileSync("cv/master_cv.json", "utf8"));
const drop = new Set<string>(t.drop ?? []);
// dropping a role or project header drops everything until the next header in that section
m.sections.forEach((s: any, si: number) => {
  let dropping = false;
  s.items.forEach((it: any[], ii: number) => {
    const id = `${si}.${ii}`;
    if (it[0] === "role" || it[0] === "proj") dropping = drop.has(id);
    else if (dropping) drop.add(id);
  });
});
const company = String(t.company ?? "Company").replace(/[^A-Za-z0-9]+/g, "_");
const out = `${dir}/Aditya_Kundurkar_CV_${company}`;

m.out = out; if (t.title) m.title = t.title; if (t.profile) m.profile = t.profile; if (t.rtw) m.rtw = t.rtw;
m.sections = m.sections.map((s: any, si: number) => {
  let items = s.items.map((it: any[], ii: number) => {
    const id = `${si}.${ii}`;
    if (t.edit?.[id] !== undefined) { const c = [...it]; c[it[0] === "s" ? 2 : 1] = t.edit[id]; return c; }
    return it;
  }).filter((_: any, ii: number) => !drop.has(`${si}.${ii}`));
  if (s.name === "Skills" && Array.isArray(t.skills)) items = t.skills.map((x: string[]) => ["s", x[0], x[1]]);
  return { ...s, items };
}).filter((s: any) => s.items.length);
writeFileSync(`${dir}/cv.json`, JSON.stringify(m, null, 2));

const text = JSON.stringify(m);
if (/[—;]/.test(text)) console.warn("WARNING: em dash or semicolon found, fix tailor.json");

const SOFFICE = [process.env.SOFFICE, "/Applications/LibreOffice.app/Contents/MacOS/soffice", "soffice"].find((p) => { if (!p) return false; try { execSync(`"${p}" --version`, { stdio: "ignore" }); return true; } catch { return false; } });
if (!SOFFICE) { console.log("LibreOffice not found. Install it (brew install --cask libreoffice) or set SOFFICE=/path/to/soffice"); process.exit(1); }
const pages = () => { try { return Number(execSync(`pdfinfo "${out}.pdf"`).toString().match(/Pages:\s+(\d+)/)?.[1] ?? 0); } catch { return -1; } };
for (const size of [21, 20, 19]) {
  execSync(`node cv/gen.cjs "${dir}/cv.json"`, { env: { ...process.env, CV_SIZE: String(size) } });
  execSync(`"${SOFFICE}" --headless --convert-to pdf --outdir "${dir}" "${out}.docx"`, { stdio: "ignore" });
  const p = pages();
  if (p === 1 || p === -1) { console.log(`OK ${out}.pdf (font ${size / 2}pt${p === -1 ? ", install poppler to check pages" : ""})`); updateIndex(); process.exit(0); }
}
const chars = m.sections.flatMap((s: any) => s.items).filter((i: any[]) => i[0] === "b").reduce((n: number, i: any[]) => n + i[1].length, 0);
updateIndex(); console.log(`Bullet text is ${chars} characters and the profile is ${String(m.profile).length}. Aim for bullets of 2,600 characters or less, a profile of 450 or less and at most 5 skills lines.`); console.log(`TOO LONG: still 2 pages at 9.5pt. Drop 2 to 3 more bullets in ${dir}/tailor.json and rebuild.`); process.exit(2);

function updateIndex() {
  const batchDir = dir.split("/").slice(0, 2).join("/");
  const rows = readdirSync(batchDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const f = `${batchDir}/${d.name}`; const link = existsSync(`${f}/link.txt`) ? readFileSync(`${f}/link.txt`, "utf8").trim() : "";
    const score = existsSync(`${f}/keywords.md`) ? (readFileSync(`${f}/keywords.md`, "utf8").match(/Rough match: (\d+)%/)?.[1] ?? "") : "";
    const pdf = readdirSync(f).find((x) => x.endsWith(".pdf")) ?? "not built";
    const notes = existsSync(`${f}/notes.md`) ? readFileSync(`${f}/notes.md`, "utf8").split("\n")[0] : "";
    return `| ${d.name} | ${score}% | [Apply](${link}) | ${d.name}/${pdf} | ${notes} |`;
  });
  writeFileSync(`${batchDir}/INDEX.md`, `# Applications to submit\n\n| Job | Match | Link | CV | Notes |\n|---|---|---|---|---|\n${rows.join("\n")}\n`);
}
