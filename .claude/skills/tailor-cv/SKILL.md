---
name: tailor-cv
description: Tailor Aditya Kundurkar's one-page, ATS-optimised CV (and optional cover letter or application answers) to a specific job description. Use whenever asked to generate, create, tailor or optimise a CV or resume, or to run /batch or /apply.
---

# Tailor CV for Aditya Kundurkar

This skill turns a job description (JD) into a tailored, truthful, one-page CV PDF using the project's build scripts. It combines resume tailoring, ATS optimisation, quantification, formatting and tech-resume best practice.

## Skills to use
Whenever you generate or create a CV, apply these skills: **resume-tailor, resume-formatter, resume-ats-optimizer, resume-quantifier and tech-resume-optimizer**. If they are installed in this environment (for example as `anthropic-skills:resume-tailor`), load them first. If they are not available, follow the summary of each one built into this file:
- **resume-tailor** → sections 2 to 4 (match the JD while staying truthful)
- **resume-ats-optimizer** → section 2 (keywords and match score) and section 5 (ATS-safe format)
- **resume-quantifier** → section 4 (use the known metrics, never invent numbers)
- **resume-formatter** → section 5 (one page, clean layout, no empty space)
- **tech-resume-optimizer** → section 4 (technical bullet formula, skills grouping, projects, GitHub)

## 0. Inputs
- The JD (from `output/<batch>/<job>/jd.txt`, a URL, or pasted text).
- `cv/master_cv.json`: the only source of facts. Run `npm run bullets` once to see it as numbered ids.
- `output/<batch>/<job>/keywords.md` from `npm run prepare` (exact JD terms, matched vs missing).
- `profile/candidate.json` for contact and right-to-work details.

## 1. Eligibility check (do this first, stop if it fails)
Flag clearly and do not build unless Aditya insists:
- Security clearance (SC, DV, eDV, NPPV, "BPSS and SC") or "5 years continuous UK address history". Aditya moved to the UK in Sep 2024.
- Must be US-based or need US work authorisation, or the role is outside the UK and not remote-friendly from the UK.
- The role runs past Feb 2028 in a way that needs right to work then (for example an event in summer 2028), unless they sponsor.
- Principal, Staff or Head roles that require 6+ years (Aditya has 2.5+ years).
- Not a software role at all (for example events or operations).
Also note, but still build: "no sponsorship" (fine until Feb 2028), years required above 2.5, and in-person locations far from Coventry (Glasgow, Edinburgh, London 3+ days, Manchester in-person only), suggesting a "happy to relocate" line only if Aditya confirms.

## 2. Keyword analysis (ATS)
1. Extract hard skills, tools, methods and soft skills from the JD. Keep the **exact spelling and casing the JD uses** (React.js vs React, Node.js, Next.js, CI/CD, RESTful APIs, PostgreSQL vs Postgres, TypeScript).
2. Mark each as matched (in master CV), close (a true synonym Aditya has, for example GitHub Actions for "CI/CD pipelines"), or missing.
3. Estimate the match score: matched / total important terms. Target 80%+, but never fake a match to reach it.
4. Placement: top 5 to 8 terms go in the title line and profile, the JD's exact terms appear 2 to 4 times across title, profile, bullets and skills, and the common alternative spelling appears once in Skills (for example "React.js (React)"). No keyword stuffing.

## 3. Honesty rules (non-negotiable)
- Only use facts in `cv/master_cv.json` or facts Aditya has confirmed in the conversation. If unsure, ask, and list it as a gap instead.
- Never invent tools, metrics, clients, team sizes, users, years or outcomes. Do not upgrade "started adding tests" into "TDD", "used once" into "expert", or "in development" into "in production".
- Keep real job titles: "Full Stack Developer | Primors" and "Blockchain Frontend Developer | DappLooker". Do not rename them or add things like "(backend focus)".
- Keep reverse chronological order. Primors first, then DappLooker.
- The AI-Powered WhatsApp Shopping Assistant is always labelled "(in development)".
- Personal-use-only tools are labelled, for example "NestJS (personal projects)".
- Do not attach a tool to a project unless that link is confirmed (for example do not put Lambda under RS Setu).
- Reframing is allowed when true: "workflow engine" for Salad O'Clock's order state flow, "customer portal and internal admin system" for RS Setu, "data analytics platform" for DappLooker.

### Not claimed (unless Aditya confirms later)
Django, .NET / C# / ASP.NET, Azure / Azure DevOps, GCP, Kubernetes, Terraform, Redis, Kafka / RabbitMQ, Go, Kotlin, Rust, PHP / Laravel / Symfony, WordPress, Elementor, jQuery, Power BI, Snowflake / Streamlit, Vite, SQLAlchemy, Sass, Zustand, Context API, React Server Components, SSG, Cypress, Selenium, TDD, Postman / Swagger, LangChain (use "LangGraph (LangChain ecosystem)"), Bedrock / Vertex AI, production LLM agents with real users, HealthTech or regulated-industry experience, SOC tools (SIEM, SOAR, EDR).

### Confirmed extras (fine to use when relevant)
Bootstrap, Playwright, GitLab CI/CD, Jenkins, Microsoft SQL Server, SOLID principles, Stripe (DappLooker), SEO work (DappLooker and Primors), Next.js migration for SSR and SEO, Jira knowledge, React Native apps, Java (Servlets, JSP, Spring Boot, Maven) from projects, Pydantic models for tool inputs and outputs, styled-components shared component library, Metabase, D3.js, Plotly.js, Chart.js, Figma, AWS CDK, AWS Lambda, API Gateway, EC2, observability (logging and monitoring), rate limiting, AES-256-GCM, OTP, RBAC.

## 4. Writing the content
**Title line:** "<JD role name> | <4 to 6 top JD terms in exact spelling>".

**Profile:** 3 to 5 sentences, about 450 characters or fewer when using the batch builder. Lead with the role name and 2.5+ years, then the strongest matching proof points with numbers, then the AI or domain angle that the JD cares about, then "MSc Computer Science, University of Warwick".

**Bullets:** use the formula Action verb + what + how (tech) + result or scale. Use the JD's language where it is true. Order bullets so the most relevant come first within each block. Prefer quantified bullets. The known metrics are:
- 700+ residents across 14 projects (RS Setu)
- 3,000+ orders in the first 2 days with no reported issues, and 75% more orders than the website (Salad O'Clock)
- JavaScript bundle 35 MB to 6 MB, Lighthouse 56 to 90 (RS Setu)
- up to 60% lower page load latency (DappLooker Angular to Next.js)
- 35% more user engagement (Telegram and Discord bots)

**Projects:** pick the one or two that fit (CineVerse for AI and agents, DeFIX for Web3, Quotation Management System for Java, React Native for mobile). Use a "Personal Projects" or "Side Projects" heading for startups that value side projects.

**Education:** MSc then B.E. Put Education first only for graduate or junior roles. Add modules or the dissertation only when relevant (security, NLP, HPC, data mining, DAO governance for Web3).

**Skills:** 4 to 6 labelled lines, JD terms first in exact spelling, grouped by category.

## 5. Formatting rules (ATS-safe and Aditya's preferences)
- One page, A4, single column, Calibri, standard headings: Profile, Professional Experience, Projects, Education, Skills. No tables, columns, images, headers or footers.
- Font auto-fits 10.5pt, then 10pt, then 9.5pt. If it is still 2 pages, drop the least relevant bullets. Never go below 9.5pt.
- **No em dashes (—). Use commas, not semicolons.** Check the final text.
- **Fill leftover space at the bottom with extra DappLooker bullets** instead of leaving a gap.
- Contact line: email, UK phone, "Coventry, United Kingdom", LinkedIn, GitHub. The right-to-work line reads "Full right to work in the UK until Feb 2028 (Graduate visa)", plus a nearby-location note when the job is local (for example "based in Coventry, close to Birmingham").
- File name: `Aditya_Kundurkar_CV_<Company>.pdf`.

## 6. Build (batch builder)
1. Write `output/<batch>/<job>/tailor.json`:
   ```json
   {
     "company": "Acme",
     "title": "Front End Developer | React.js, Next.js, TypeScript, REST APIs",
     "profile": "...",
     "drop": ["0.4", "0.9", "1.5"],
     "edit": { "0.3": "Rewritten bullet using exact JD terms, same facts" },
     "skills": [["Frontend", "React.js (React), Next.js, TypeScript"], ["APIs", "REST APIs, GraphQL"]]
   }
   ```
   Dropping a [role] or [proj] id drops its whole block.
2. Run `npm run build -- output/<batch>/<job>`. If it says TOO LONG, drop 2 or 3 more ids and rebuild.
3. Write `notes.md`: the first line is a one-line summary (fit plus biggest gap or flag), then the missing keywords and the questions for Aditya.

## 7. Final checks before handing over
- [ ] Exactly 1 page (never 2), and the PDF text extracts cleanly (`pdftotext`).
- [ ] 0 em dashes and 0 semicolons.
- [ ] The JD's exact-spelling terms are present 2 to 4 times for the top terms.
- [ ] Every claim is in the master CV or confirmed by Aditya. Real titles, correct dates, correct order.
- [ ] The Shopping Assistant is labelled "(in development)".
- [ ] No empty space at the bottom of the page. If there is a gap, add true DappLooker bullets until the page is full but still 1 page.

## 8. Report back (short)
- Match score (rough %) and font size
- 3 to 5 strongest matches
- Gaps not faked, and questions ("If you have used X, tell me and I will add it")
- Any eligibility or location flags

## 9. Related writing rules
- **Messages, short answers, "why us" and "start a conversation" notes:** no hyphens (-) and no apostrophes ('), humanised simple language, a few small natural grammar slips, short. List the deliberate slips afterwards.
- **Formal cover letters for upload:** clean and professional, one page, no deliberate mistakes unless asked. Honest about gaps (for example "My pipeline experience is with GitHub Actions, and I can pick up Azure DevOps quickly").
- **Standard facts for forms:** Graduate visa valid until February 2028, no sponsorship needed until then. Employment gap: left DappLooker in Aug 2024 to do an MSc at Warwick (Sep 2024 to Sep 2025), built CineVerse, joined Primors in Jan 2026.
