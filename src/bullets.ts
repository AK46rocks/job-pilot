// Prints the master CV as a compact numbered list so the agent can pick bullets by id cheaply.
// Usage: npm run bullets
import { readFileSync } from "node:fs";
const m = JSON.parse(readFileSync("cv/master_cv.json", "utf8"));
m.sections.forEach((s: any, si: number) => {
  console.log(`## ${s.name}`);
  s.items.forEach((it: any[], ii: number) => {
    const id = `${si}.${ii}`;
    if (it[0] === "b") console.log(`${id} ${it[1]}`);
    else if (it[0] === "s") console.log(`${id} [skills] ${it[1]}: ${it[2]}`);
    else if (it[0] === "role" || it[0] === "proj") console.log(`${id} [${it[0]}] ${it[1]}${it[2] ? ` (${it[2]})` : ""}   (dropping this drops its whole block)`);
    else console.log(`${id} [${it[0]}] ${it[1]}`);
  });
});
