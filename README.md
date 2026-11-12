# Job Application Copilot

Semi-automated job applications with Claude Code and the Playwright MCP.
It finds roles, tailors your CV, fills the application form and logs it. **You always review and click Submit yourself.**

## 1. Install (one time)
1. Install Node.js 20+ and LibreOffice (for DOCX to PDF). Check: `node -v` and `soffice --version`.
   - macOS: `brew install --cask libreoffice`. Windows: install from libreoffice.org and add `soffice` to PATH.
   - Also install poppler for page checks (`brew install poppler`), optional.
2. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
3. In this folder run: `npm install`
4. The Playwright MCP is already configured in `.mcp.json`:
   ```
   npx @playwright/mcp@latest --user-data-dir ./.browser-profile
   ```
   The first time you start Claude Code here, approve the "playwright" MCP server. Run `/mcp` inside Claude Code to check it is connected.
   (Alternative: `claude mcp add playwright -- npx @playwright/mcp@latest`.)

## 2. Personalise (one time)
- `profile/candidate.json`: fill every `[ADD]` (notice period, portfolio). `ASK_USER` fields will always be asked per application.
- `companies.json`: add board tokens for companies you like, for example `boards.greenhouse.io/monzo` gives `monzo` under "greenhouse".
- `profile/search.json`: adjust title and location keywords and the skip list.
- `cv/master_cv.json`: your full master CV. Update it when you learn something new, every tailored CV is built from it.

## 3. Daily use

### Web UI (no tokens)
1. Run `npm run ui` and open http://localhost:4173 (set `PORT=5000` to change the port).
2. Type a UK location (for example Coventry, London, or `UK` for everywhere) and press Search. You get the companies hiring there and their open roles in your field, newest first. Click a company chip to see only that company.
3. Each role has:
   - **Open job link**: opens the posting in a new tab.
   - **Generate CV**: paste the job description you copied from the posting. It builds a one-page tailored PDF in `output/ui/<company>-<role>/` and shows the keyword match plus what is missing from your master CV.
   - **Applied**: tick it after you submit. The role moves to the Applied tab and is not listed in later searches (untick or Undo to bring it back).

Where the roles come from:
- Always: the Greenhouse, Lever and Ashby boards in `companies.json`, filtered to the location you typed. Add more board tokens to cover more companies.
- Optional, to discover other companies near any UK town: get a free key at developer.adzuna.com and create a `.env` file in this folder:
  ```
  ADZUNA_APP_ID=your_id
  ADZUNA_APP_KEY=your_key
  ```
  Adzuna only gives a short snippet of each description, which is why Generate CV asks you to paste the full text.

The UI tailors by rules, not AI: it keeps the bullets, skills and profile sentences from `cv/master_cv.json` that best match the pasted description and never writes new text. It saves the same `tailor.json` that `/batch` uses, so you can ask Claude Code to refine any folder afterwards. "My field" keywords, the skip flags and the maximum posting age come from `profile/search.json`.

### Recommended: batch mode (cheap and fast)
1. `npm run fetch-jobs` (no tokens) to see matching roles and their ids.
2. In Claude Code: `/batch 2026-11-12 ab-123 gh-456 lv-789` (or paste job URLs).
3. Open `output/2026-11-12/INDEX.md`: each row has the Apply link, the tailored CV PDF and a note. Apply yourself.

Tip: for a job not on Greenhouse, Lever or Ashby, run `/batch <name> <url>`, then paste the job description into the jd.txt it creates.

### Full assisted apply (uses more tokens)
Open a terminal in this folder and run `claude`, then:
- `/find-jobs` fetches new matching roles from your companies.
- `/apply <job URL>` tailors the CV, fills the form in a visible browser and stops before Submit.
- `/tracker` shows all applications and their status.

A Chromium window opens so you can watch. Sign in to job sites yourself when asked, the browser profile remembers you.

## 4. Files
| Path | What it is |
|---|---|
| `CLAUDE.md` | Rules and workflow the agent follows |
| `profile/` | Your details, search filters, writing rules |
| `cv/` | Master CV plus the CV and cover letter generators |
| `src/server.ts`, `ui/` | The local web UI (`npm run ui`) |
| `output/<company>/` | Job description, tailored CV and cover letter for each application |
| `data/applications.csv` | Your application log (open in Excel or Google Sheets) |

## 5. Safety
- The agent never clicks Submit, never handles CAPTCHAs or passwords, and never automates LinkedIn.
- Check every answer before you submit. You are responsible for what is sent.
- The web UI only listens on your own machine (127.0.0.1).
- Do not commit `profile/`, `data/`, `.env` or `.browser-profile/` to a public GitHub repo.
