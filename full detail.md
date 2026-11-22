<div align="center">

# AIREADY: AN AI-POWERED RESUME ENGINEERING, ATS ANALYTICS AND CAREER PREPARATION PLATFORM

### A PROJECT REPORT

*Submitted in partial fulfillment of the requirements for the degree of*

**BACHELOR OF TECHNOLOGY / MASTER OF TECHNOLOGY**

*in*

**COMPUTER SCIENCE AND ENGINEERING**

*by*

**SATYAM KUMAR**
**(Roll No. / Student Code: SC20B108)**

*Under the Supervision of*

**PROF. / DR. [SUPERVISOR NAME]**

**DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING**
**INDIAN INSTITUTE OF SPACE SCIENCE AND TECHNOLOGY (IIST)**
**THIRUVANANTHAPURAM – 695 547, KERALA, INDIA**

**NOVEMBER 2026**

</div>

---

## CERTIFICATE

This is to certify that the project report entitled **"AIReady: An AI-Powered Resume Engineering, ATS Analytics and Career Preparation Platform"**, submitted by **Satyam Kumar (Roll No. SC20B108)** to the Department of Computer Science and Engineering, Indian Institute of Space Science and Technology (IIST), Thiruvananthapuram, in partial fulfillment of the requirements for the award of the degree of **Bachelor of Technology / Master of Technology in Computer Science and Engineering**, is a bona fide record of the work carried out under my supervision and guidance.

The results embodied in this report have not been submitted to any other University or Institute for the award of any degree or diploma.

**Dr. / Prof. [Supervisor Name]**
Project Supervisor, Department of Computer Science and Engineering, IIST

**Date:** ____________  **Place:** Thiruvananthapuram

---

## DECLARATION

I, **Satyam Kumar (Roll No. SC20B108)**, declare that this project report represents my original work carried out under the supervision of **Dr. / Prof. [Supervisor Name]**. Wherever the ideas, tools or work of others have been used, they have been acknowledged and referenced. This report has not formed the basis for the award of any other degree or diploma.

**Satyam Kumar** — Roll No. SC20B108

**Date:** ____________  **Place:** Thiruvananthapuram

---

## ACKNOWLEDGEMENTS

I thank my project supervisor, **Dr. / Prof. [Supervisor Name]**, for guidance and encouragement throughout the design and implementation of AIReady, and the Head of the Department and faculty of Computer Science and Engineering at IIST for their support and facilities.

I also acknowledge the open-source and cloud communities whose tools made this project possible: React, Node.js and Express, FastAPI, spaCy (Explosion AI), scikit-learn, PyMuPDF, PostgreSQL and Supabase, Groq, Render and Vercel. Finally, I thank my family and friends for their constant support.

**Satyam Kumar**

---

## ABSTRACT

Most large employers screen resumes with **Applicant Tracking Systems (ATS)** before a human reads them. Resumes are filtered out because of unreadable formatting, missing sections or a poor match with the job description's keywords. At the same time, job seekers use separate tools for writing a resume, checking it, preparing for interviews, writing cover letters and tracking applications.

**AIReady** is a full-stack web platform that brings these tasks together. It is built as a monorepo of three services:

1. **Frontend** — a React 19 single-page application (React Router 7, Tailwind CSS, Framer Motion, Recharts, jsPDF) with a live resume builder (10 preview themes, zoom, ATS-safe and themed PDF export, version history with score trend), resume analyzer, voice-enabled mock interview, AI career coach chat, cover letter generator, Kanban job tracker, dashboard, leaderboard and a one-click demo account.
2. **Backend** — a Node.js 22 / Express 5 REST API with JWT authentication, bcrypt password hashing, rate limiting, CORS allow-listing, PostgreSQL storage (hosted on Supabase) including uploaded resume PDFs, and a gateway to the AI engine with automatic retry while the engine wakes up.
3. **AI engine** — a Python 3.12 FastAPI service combining **classical NLP** (spaCy noun-chunk extraction, a 102-skill / 229-alias skill taxonomy, scikit-learn n-gram cosine similarity, a rule-based ATS rubric) with a **large language model** (Groq, `openai/gpt-oss-120b`) for resume parsing, bullet rewriting, interview questions, answer evaluation and cover letters. Every LLM feature has a rule-based **offline fallback**.

The resume analyzer produces a job-match score (weighted skill coverage, phrase coverage and text similarity) and a separate 100-point ATS structure score with a per-factor breakdown and actionable suggestions. A deterministic 1000-point Global Rank places users into Bronze–Diamond tiers.

Scanned (image-only) resume PDFs are read with Tesseract OCR, and an AI career coach answers open career questions using the user's resume as context.

The system is deployed on free cloud tiers (Vercel, Render, Supabase) with continuous integration on GitHub Actions. In end-to-end tests against the live deployment, **19 of 20 feature checks passed** — the remaining one, password-reset email, requires an email provider key. Typical AI responses arrive in **0.6–2.5 seconds**. Automated test suites (14 backend API tests, 29 AI-engine tests, 7 frontend tests) all pass.

**Keywords:** Applicant Tracking System, Natural Language Processing, Large Language Models, Resume Parsing, Cosine Similarity, FastAPI, React, PostgreSQL.

---

## TABLE OF CONTENTS

- Problem Statement
- Abbreviations
- **Chapter 1** — Introduction
- **Chapter 2** — Literature Review and Background
- **Chapter 3** — System Architecture and Design
- **Chapter 4** — Implementation and Algorithms
- **Chapter 5** — Testing, Results and Evaluation
- **Chapter 6** — Deployment
- **Chapter 7** — Conclusion, Limitations and Future Scope
- References
- **Appendix A** — Installation and Local Setup
- **Appendix B** — REST API Reference
- **Appendix C** — Database Schema
- **Appendix D** — Environment Variables
- **Appendix E** — Project Folder Structure

---

## ABBREVIATIONS

| Abbreviation | Meaning |
|---|---|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| ATS | Applicant Tracking System |
| CORS | Cross-Origin Resource Sharing |
| CRUD | Create, Read, Update, Delete |
| JD | Job Description |
| JWT | JSON Web Token |
| LLM | Large Language Model |
| NLP | Natural Language Processing |
| OTP | One-Time Password |
| PDF | Portable Document Format |
| REST | Representational State Transfer |
| RLS | Row Level Security (PostgreSQL) |
| SPA | Single Page Application |
| SSRF | Server-Side Request Forgery |
| STAR | Situation, Task, Action, Result (interview answer method) |
| TTS / STT | Text-to-Speech / Speech-to-Text |
| UUID | Universally Unique Identifier |

---

## PROBLEM STATEMENT

Job seekers — especially students and early-career candidates — face three connected problems:

1. **ATS rejection:** resumes are rejected automatically because of formatting the ATS cannot read, missing standard sections, or weak keyword overlap with the job description. Candidates rarely learn *why*.
2. **Unfocused preparation:** generic interview practice does not reflect the specific role or the candidate's own experience, and candidates get little structured feedback on their answers.
3. **Fragmented tools:** resume writing, resume checking, cover letters and application tracking are spread across different products, many of them paid.

**Goal:** build a single, free, web-based platform that (a) helps users write ATS-friendly resumes, (b) explains how well a resume matches a specific job and how to improve it, (c) provides realistic, role-specific interview practice with feedback, and (d) organises the job search — while remaining usable even when the AI service is unavailable.

---

# CHAPTER 1 — INTRODUCTION

## 1.1 Background and Motivation

Recruiters for popular roles receive hundreds of applications per opening, so most companies use an ATS to parse resumes into structured data and rank candidates by keyword and requirement match. A resume that is well written for a human can still score poorly if its sections are not recognisable, if it is built from images or complex layouts, or if it does not use the vocabulary of the job description.

Recent large language models (LLMs) can read unstructured text, rewrite content and hold role-specific conversations. Combined with classical, explainable NLP techniques, they make it possible to give candidates fast, personalised and *transparent* feedback.

## 1.2 Objectives

1. Provide a resume builder that produces clean, text-based, ATS-parsable PDFs.
2. Import an existing resume or LinkedIn PDF into structured, editable data automatically.
3. Score a resume against a job description with an explainable breakdown (skills, phrases, similarity, structure) and concrete suggestions.
4. Generate role- and resume-specific interview questions and evaluate spoken or typed answers.
5. Generate tailored cover letters.
6. Track job applications and show progress on a dashboard; motivate users with a ranking and leaderboard.
7. Keep every feature working (with reduced quality) when the LLM is unavailable.
8. Deploy the complete system on free cloud infrastructure with sound security practices.

## 1.3 Scope

**In scope:** English-language resumes and job descriptions; PDF resume upload (up to 5 MB / 30 pages); web browsers on desktop and mobile; single-user accounts.

**Out of scope:** recruiter/employer accounts, integration with job boards, and paid features.

## 1.4 Report Organisation

Chapter 2 reviews background techniques. Chapter 3 describes the architecture, data model and security design. Chapter 4 explains how each feature and algorithm is implemented. Chapter 5 presents testing and results. Chapter 6 covers deployment. Chapter 7 concludes with limitations and future work. Appendices give setup steps, the API reference, the database schema and configuration.

---

# CHAPTER 2 — LITERATURE REVIEW AND BACKGROUND

## 2.1 Applicant Tracking Systems

An ATS converts a resume (PDF/DOCX) into text, splits it into sections (contact, experience, education, skills), extracts entities such as job titles, employers, dates and skills, and compares them with the requirements of a job posting. Common causes of poor parsing are multi-column layouts, tables, text inside images, unusual section headings and decorative characters. This motivates AIReady's choice of a single-column, standard-font, vector-text PDF export (Section 4.2).

## 2.2 Vector Space Model and Cosine Similarity

In the vector space model, a document is represented as a vector of term counts (or TF-IDF weights). The similarity of two documents *A* and *B* is the cosine of the angle between their vectors:

$$\text{sim}(A,B)=\frac{A\cdot B}{\lVert A\rVert\,\lVert B\rVert}$$

AIReady uses scikit-learn's `CountVectorizer` with English stop-word removal and unigrams + bigrams, then computes cosine similarity between the resume and the job description. Because two *different* documents naturally have a low raw cosine, the value is scaled (×1.6, capped at 100) and used only as a small part (15 %) of the match score — keyword and skill coverage are more meaningful for ATS-style matching.

## 2.3 Linguistic NLP: Tokenisation, POS Tagging and Noun Chunks

spaCy's `en_core_web_sm` pipeline provides tokenisation, part-of-speech tagging and dependency parsing. **Noun chunks** (e.g. "payment gateways reconciliation", "microservices architecture") capture the domain concepts a job description emphasises beyond a fixed skill list. AIReady filters these chunks to remove stop words and generic job-posting vocabulary ("requirements", "team", "full", "stack", …) and keeps single words only when they repeat.

## 2.4 Dictionary-Based Skill Extraction

Free-text skill mentions vary ("JS", "Javascript", "javascript"; "Node", "NodeJS", "Node.js"). A curated taxonomy that maps aliases to canonical skills, matched with **whole-word regular expressions**, gives high precision and avoids classic errors such as matching "Java" inside "JavaScript" or "C" inside other words, while correctly handling symbols in "C++", "C#" and "Node.js". AIReady's taxonomy contains **102 canonical skills with 229 aliases**, grouped into categories.

## 2.5 Large Language Models in Career Tools

LLMs can turn unstructured resumes into structured JSON, rewrite text in a target style, and generate and grade interview questions. Their weaknesses are hallucination, inconsistent output format and dependence on a network service. AIReady addresses these by (a) instructing the model not to invent experience, (b) requesting strict JSON and validating it, retrying when invalid, (c) enclosing user text in delimited blocks to reduce prompt injection, and (d) providing deterministic fallbacks.

## 2.6 Comparison with Existing Platforms

| Capability | Typical resume builders | Typical ATS checkers | Interview-practice apps | **AIReady** |
|---|---|---|---|---|
| Resume builder + PDF | Yes | No | No | **Yes (ATS-safe)** |
| Import existing PDF / LinkedIn | Sometimes | No | No | **Yes (AI)** |
| JD match score with explanation | No | Yes (often paid) | No | **Yes, free, explained** |
| Role- and resume-specific interview | No | No | Partly | **Yes, with voice** |
| Cover letters | Sometimes | No | No | **Yes** |
| Application tracker + dashboard | Rarely | No | No | **Yes** |
| Works without the AI service | n/a | n/a | No | **Yes (fallbacks)** |

---

# CHAPTER 3 — SYSTEM ARCHITECTURE AND DESIGN

## 3.1 Overall Architecture

AIReady is a **monorepo** with three independently deployable services:

```
                    ┌────────────────────────┐
   User's browser ─►│  Frontend (React SPA)  │  Vercel  (static files)
                    └───────────┬────────────┘
                                │ HTTPS, JSON, JWT in Authorization header
                    ┌───────────▼────────────┐
                    │ Backend (Node/Express) │  Render web service
                    │  auth · data · files   │
                    └──────┬───────────┬─────┘
          SQL over TLS     │           │  HTTPS + x-api-key (server-to-server)
     ┌─────────────────────▼──┐   ┌────▼─────────────────────┐
     │ PostgreSQL (Supabase)  │   │ AI engine (FastAPI)      │  Render (Docker)
     │ users, resumes, jobs,  │   │ spaCy · scikit-learn ·   │
     │ interviews, files      │   │ PyMuPDF · Groq LLM client│──► Groq API
     └────────────────────────┘   └──────────────────────────┘
```

**Design decisions**

- **The browser never talks to the AI engine directly.** All AI calls go through the backend, which checks the user's JWT and adds the engine's secret API key. The key never reaches the browser.
- **Python for NLP, Node for the web API.** Python has the best NLP/ML ecosystem (spaCy, scikit-learn); Node/Express is well suited to a JSON API and shares the language with the frontend.
- **Relational database.** User data is naturally relational (a user has resumes, jobs, interviews, files). PostgreSQL gives foreign keys, constraints and cascading deletes; flexible parts (resume content, analysis, interview Q&A) use `jsonb` columns.
- **Graceful degradation.** If the LLM fails, the engine returns rule-based results flagged `fallback: true` with a `warning`, so the UI keeps working.

## 3.2 Frontend Design

| Route | Page | Main backend calls |
|---|---|---|
| `/login`, `/register` | Authentication, forgot/reset password | `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` |
| `/` | Dashboard | `/user/dashboard-stats` |
| `/builder` | Resume Builder | `/resume`, `/ai/parse-resume`, `/ai/parse-linkedin`, `/ai/enhance-bullet`, `/ai/extract-keywords`, `/user/rank` |
| `/analyzer` | Resume Analyzer | `/ai/analyze-resume`, `/user/resume-analysis` |
| `/interview` | Mock Interview | `/resume/all`, `/ai/generate-questions`, `/ai/evaluate-answer`, `/user/interviews` |
| `/cover-letter` | Cover Letter | `/ai/generate-cover-letter` |
| `/jobs` | Job Tracker (Kanban) | `/jobs` (GET/POST/PUT/DELETE) |
| `/leaderboard` | Leaderboard | `/leaderboard` |
| `/profile` | Profile, stored resumes | `/auth/profile`, `/auth/profile/resume` |
| `/u/:id` | Public profile | `/public/profile/:id` |

Global state is held in React Contexts: `AuthContext` (user, token, login/logout), `ResumeContext` (resume data, cloud save, imports) and `ThemeContext` (light/dark mode). The JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>`.

## 3.3 Backend Design

```
backend/
  server.js            start-up: check env, connect DB, run migrations, listen, wake AI engine
  app.js               Express app: helmet, rate limit, CORS, JSON parser, routes, 404 + error handler
  db/index.js          pg connection pool + schema migrations (idempotent, run on every boot)
  models/              User, Resume, JobApplication, Interview, File (SQL queries)
  controllers/         auth, jobs, analytics/rank, leaderboard, public profile
  routes/              auth, resume, jobs, user, leaderboard, public, ai (gateway), files
  middleware/          protect (JWT verification)
  config/ai.js         AI engine URL/key, forwardToAi() with cold-start retry, error messages
  utils/               upload (multer), emailService (Brevo API / SMTP)
  tests/api.test.js    end-to-end API tests on in-memory PostgreSQL
```

Models return plain objects with the field names the frontend expects (`_id`, `createdAt`, camelCase), so the frontend did not need changes when the database was migrated from MongoDB to PostgreSQL.

## 3.4 AI Engine Design

```
ai-engine/
  main.py              FastAPI app: API-key auth, rate limiting, CORS, error handlers, routes, /health, /ui
  config.py            settings from environment variables
  core/skills.py       skill taxonomy (102 skills, 229 aliases, categories) + whole-word matcher
  core/analyzer.py     text cleaning, section detection, ATS rubric, match score, keywords, suggestions
  core/interviewer.py  rule-based questions + transparent answer rubric (offline fallback)
  core/profile_parser.py  heuristic resume → JSON parser (offline fallback)
  core/llm.py          Groq client: timeouts, retries, JSON validation, prompt fencing
  core/services.py     each feature: LLM first, fallback second; adds ai_used / fallback / warning
  utils/pdf_extractor.py  PyMuPDF text extraction with size/page limits
  utils/safe_fetch.py  SSRF-safe download of resume PDFs by URL
  static/index.html    built-in test dashboard (/ui)
  tests/               pytest suite (23 tests)
```

## 3.5 Database Design

Five tables in PostgreSQL. All primary keys are UUIDs; child rows are deleted automatically when their user is deleted (`ON DELETE CASCADE`).

```
users ──< resumes
  │──< job_applications
  │──< interviews
  └──< files
```

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts, profile, rank | `email` (unique), `password` (bcrypt hash), `tier`, `global_rank_score`, `category_track`, `leaderboard_opt_in`, `stored_resumes` (jsonb), `reset_otp` (bcrypt hash), `reset_otp_expires` |
| `resumes` | Builder documents | `user_id`, `title`, `content` (jsonb), `analysis` (jsonb) |
| `job_applications` | Job tracker cards | `user_id`, `company`, `role`, `status` ∈ {saved, applied, interviewing, offer, rejected}, `url`, `location`, `notes` |
| `interviews` | Completed mock interviews | `user_id`, `job_role`, `questions` (jsonb), `overall_score`, `overall_feedback` |
| `files` | Uploaded resume PDFs | `user_id`, `filename`, `mime_type`, `size`, `data` (bytea) |

Indexes support the most common queries (a user's latest resumes, jobs and interviews; the leaderboard ordered by score for opted-in users). The full schema is in Appendix C.

## 3.6 Security Design

| Threat | Mitigation |
|---|---|
| Stolen passwords | bcrypt hashing (cost 10); passwords and OTP hashes are never returned by the API |
| Session hijacking / forgery | Signed JWT (HS256), 1-day expiry, secret generated by the hosting platform |
| Brute force / abuse | Rate limit 300 requests / 15 min per IP (backend), 120 / min (AI engine) |
| Cross-site requests | CORS allow-list of the two frontend URLs only |
| Common web attacks | Helmet security headers; JSON body size limit; strict input validation (email format, password length, allowed status values) |
| SQL injection | Parameterised queries everywhere (`$1, $2 …`) |
| Mass assignment | Only whitelisted fields can be updated (e.g. a job's `user` cannot be changed) |
| Accessing others' data | Every resume/job/file query is filtered by the logged-in user's id; other users get 404/401 |
| Direct database access | Supabase's public REST API is blocked by Row Level Security with no policies |
| AI engine misuse | Engine requires a secret `x-api-key` (compared in constant time); key only held by the backend |
| SSRF via resume URLs | Engine downloads only public http(s) URLs: private/loopback/reserved IPs blocked, no redirects, 10 s timeout, size limit |
| Malicious uploads | PDFs only (MIME type and extension), 5 MB, 30 pages |
| Prompt injection | User text is enclosed in delimited blocks; prompts instruct the model to treat it as data |
| Account enumeration | Forgot-password gives the same response whether or not the email exists |
| Information leaks | Production errors return a generic message; details only in server logs |
| Secrets in code | All secrets in environment variables; `.env` files are git-ignored |

---

# CHAPTER 4 — IMPLEMENTATION AND ALGORITHMS

## 4.1 Frontend Application

The frontend is a Create React App project using React 19 and React Router 7. Tailwind CSS provides styling (including dark mode), Framer Motion provides page transitions, Lucide provides icons, Recharts draws dashboard charts and `react-hot-toast` shows notifications. All API calls use Axios with the base URL from `REACT_APP_NODE_API_URL`.

## 4.2 Resume Builder and PDF Export

The builder has form sections for contact details, summary, experience, education, projects and skills, with a **live preview** that can be shown in **10 visual themes** (default, classic, minimal, professional, creative, elegant, energetic, technical, executive, startup) and zoomed. Resumes auto-save to the backend.

**PDF export (`generateAtsPdf.js`)** deliberately produces a single, clean, ATS-friendly format regardless of preview theme:

- Real vector text in a standard font (Helvetica), single column, standard section headings (Professional Summary, Work Experience, Projects, Education, Technical Skills) — so every ATS can extract the text.
- **Text sanitisation:** AI-generated text often contains characters the standard PDF font cannot draw (non-breaking hyphens, smart quotes, special spaces, ₹, arrows). These are mapped to safe equivalents (e.g. `‑`→`-`, `’`→`'`, `₹`→`Rs.`), and anything else unprintable is removed.
- **Layout:** long job titles and degrees wrap instead of overlapping the right-aligned dates; long company/institution names wrap; automatic page breaks.
- **Bullets are drawn as small shapes**, not text glyphs, so extracted text contains no stray symbols.
- File name: `<Full_Name>_ATS.pdf`.

The output was verified by generating a PDF with deliberately difficult content and extracting its text: no characters outside Latin-1 remained, and the visual layout was correct.

## 4.3 AI Import of Resume and LinkedIn PDFs

1. The PDF is uploaded to the backend (in memory) and forwarded to the engine.
2. **PyMuPDF** extracts the text page by page (limits: 5 MB, 30 pages).
3. The LLM is asked to return JSON in a fixed schema: `contact` (name, email, phone, LinkedIn, portfolio), `summary`, `experience[]` (company, role, start/end date, description), `education[]`, `projects[]`, `skills[]`.
4. The JSON is validated; if invalid, the call is retried. If the LLM is unavailable, a **heuristic parser** (regular expressions for email/phone/links, section headings, date ranges and the skill taxonomy) produces the same structure.
5. The frontend fills the builder and saves it.

*Measured on the live system:* a one-page resume was parsed in about 2 s with name, email, 12 skills, 2 jobs (with correct dates and bullets), education and 2 projects extracted correctly.

## 4.4 Resume Analyzer

The analyzer returns two independent scores plus explanations.

### 4.4.1 Text preparation and section detection

Text is extracted from the PDF, normalised (lower-case, punctuation and extra spaces removed for vector comparison) and scanned for standard section headings using regular expressions with common variants (e.g. "Work Experience", "Professional Experience", "Employment History", "Internships"). The result is a section map: experience, education, skills, summary, projects, certifications → true/false.

### 4.4.2 Job-match score (0–100)

Three components are computed:

| Component | How it is computed | Weight |
|---|---|---|
| **Skill coverage** | Skills found in the JD (taxonomy matcher) that also appear in the resume ÷ JD skills | 0.65 |
| **Phrase coverage** | Top domain phrases of the JD (spaCy noun chunks, filtered) found in the resume (whole-word, plural-tolerant) ÷ phrases | 0.20 |
| **Text similarity** | Cosine similarity of unigram+bigram count vectors, ×1.6, capped at 100 | 0.15 |

$$\text{Match}=\frac{\sum_i w_i\,v_i}{\sum_i w_i}$$

A component is left out (and the weights renormalised) when it cannot be measured — e.g. phrase coverage needs at least 3 phrases — so short job descriptions are not penalised unfairly.

### 4.4.3 ATS structure score (0–100)

A transparent rubric with a per-factor breakdown:

| Factor | Points | Rule |
|---|---|---|
| Sections | 35 | Experience 12, Skills 10, Education 8, Summary 5 |
| Contact details | 20 | Email 8, phone 7, LinkedIn/GitHub/portfolio link 5 |
| Length | 15 | 300–900 words = 15; 150–300 or 900–1200 = 10; 100–150 = 6; otherwise 2 |
| Quantified impact | 10 | ≥3 numbers/percentages = 10; ≥1 = 5 |
| Action verbs | 10 | ≥5 distinct strong verbs = 10; ≥2 = 5 |
| Bullet points | 5 | ≥4 = 5; ≥1 = 2 |
| Projects section | 5 | present = 5 |

Every missing point produces a concrete issue message (e.g. *"Quantify achievements (e.g. 'reduced load time by 40%')."*).

### 4.4.4 Overall score, feedback and suggestions

- **Overall score** = 0.7 × Match + 0.3 × ATS.
- **Feedback:** ≥70 strong match, 50–70 moderate, <50 low.
- **Suggestions:** missing skills to add (if genuinely held), JD wording to mirror, and the top ATS issues; plus **AI suggestions** from the LLM when available.
- The response also lists matched/missing keywords, the user's skills grouped by category and the word count. The score is saved to the user's latest resume for the dashboard.

*Measured:* for a sample full-stack resume and job description, the analyzer returned Match 63.8, ATS 78, all six sections detected, matched skills (React, Node.js, TypeScript, PostgreSQL, Docker, AWS, Leadership) and missing skills (Kubernetes, CI/CD, Communication) in about 1.4 s.

## 4.5 Keyword Extraction and Skill Suggestions

`extract_keywords` returns taxonomy skills first (canonical spelling) followed by filtered domain phrases. The builder removes skills the user already has and offers the rest as one-click suggestions.

*Improvement made during testing:* the phrase "Full Stack Developer" previously produced the meaningless keyword "stack". Generic job-posting words were added to the stop list and single-word phrases now must repeat to count, which removed such noise while keeping multi-word concepts like "payment gateways reconciliation".

## 4.6 AI Bullet Enhancer

The LLM rewrites a bullet point to start with a strong action verb, be concise and emphasise impact, **without inventing numbers or facts**. Offline fallback: a rule-based rewrite that replaces weak openings ("worked on", "responsible for") with action verbs. Example from the live system: *"worked on website and made it faster"* → *"Optimized the website to enhance loading speed."*

## 4.7 Mock Interview

1. The user enters a job description and optionally chooses a saved resume (text or stored PDF URL). The engine downloads stored PDFs through the SSRF-safe fetcher.
2. **Question generation:** the LLM creates *N* (default 5) questions mixing technical, problem-solving and behavioural types, tailored to both the JD and the resume. Fallback: templates filled with the top JD skills.
3. **Voice:** questions can be read aloud (Web Speech `speechSynthesis`) and answers dictated (Web Speech `SpeechRecognition`, where the browser supports it).
4. **Stress mode:** a 90-second countdown per question with auto-submit.
5. **Answer evaluation:** the LLM scores 0–100 on clarity, relevance, depth, evidence and STAR structure, and returns 2–3 sentences of feedback, the expected keywords covered, strengths and improvements; when a resume is given it also checks the answer is consistent with it. Fallback: a transparent rubric scoring length, **STAR structure** (30 points), evidence/metrics, relevance to the question, expected keywords and clarity.
6. Results are saved to the user's history and can be downloaded as a PDF report.

## 4.8 Cover Letter Generator

The LLM writes a 250–300-word letter in 3–4 paragraphs, starting with "Dear Hiring Manager," and signed with the candidate's name from the resume. It must not invent experience; missing requirements are addressed through transferable skills. *Improvement made during testing:* the prompt previously allowed placeholders such as `[Your Address]` and `[Company]`; it now forbids bracketed placeholders (except the name when the resume has none). Offline fallback: a template letter using the matched skills. The letter can be copied or downloaded as a PDF (with the same text sanitisation as the resume export).

## 4.9 Global Rank and Leaderboard

The LLM extracts objective facts from the resume — total years of experience, highest education level, skill rarity (1–10), number of quantified achievements, and project complexity (1–10). The **backend** then computes the score deterministically:

| Component | Maximum | Formula |
|---|---|---|
| Experience | 400 | min(years, 15) / 15 × 400 |
| Education | 100 | PhD 100, Masters 80, Bachelors 60, High School 30 |
| Skill rarity | 200 | min(rarity, 10) / 10 × 200 |
| Impact metrics | 200 | min(count, 10) / 10 × 200 |
| Project complexity | 100 | min(complexity, 10) / 10 × 100 |
| **Total** | **1000** | |

Tiers: **Diamond** ≥ 850, **Platinum** ≥ 700, **Gold** ≥ 500, **Silver** ≥ 300, **Bronze** otherwise (Unranked if nothing could be extracted). Keeping the arithmetic outside the LLM makes the score reproducible and explainable. The leaderboard lists only users who **opt in**, optionally filtered by career track, and never exposes email or phone. Each user can share a public profile page (`/u/:id`).

## 4.10 Job Tracker and Dashboard

The job tracker is a Kanban board with five columns (saved, applied, interviewing, offer, rejected); cards are moved by drag and drop and support company, role, URL, location and notes. The dashboard shows the number of interviews, average resume score, ATS hits, a 7-day activity chart and recent activity, aggregated by the backend from all of the user's data.

## 4.11 Accounts, Profile and File Storage

- **Register/login:** emails are normalised to lower case; passwords need at least 6 characters; duplicate emails are rejected.
- **Profile:** name, phone, age, gender, career track, leaderboard opt-in; password change requires the old password.
- **Stored resumes:** uploaded PDFs are saved in the `files` table and served from `/api/files/<uuid>` (an unguessable link, like a cloud-storage URL). Deleting the resume from the profile also deletes the file. *Change made during testing:* the original design stored files on Cloudinary, whose API key had been disabled; storing them in PostgreSQL removed the dependency on an external service. Cloudinary remains available as an option (`FILE_STORAGE=cloudinary`).
- **Forgot password:** a random 6-digit OTP is generated with a cryptographically secure generator, stored only as a bcrypt hash, valid for 10 minutes, and emailed. Email can be sent through the **Brevo HTTPS API** (needed on hosts that block SMTP ports, such as Render's free tier) or through SMTP for local development. If email cannot be sent, the user receives a clear error within ~10 seconds.

## 4.12 LLM Integration and Reliability

- **Model:** Groq `openai/gpt-oss-120b` with low reasoning effort (fast responses). The previously used `llama-3.3-70b-versatile` was retired by the provider, which is why the model is configurable via `GROQ_MODEL`.
- **Timeouts and retries:** 30-second timeout; transient errors are retried with exponential backoff (tenacity); permanent errors (invalid key, bad request) are not retried.
- **Structured output:** JSON responses are parsed and validated against the expected shape; invalid output triggers a retry, then the fallback.
- **Transparency:** every AI response includes `ai_used` (true/false), and fallback responses include `fallback: true` and a `warning`, so the UI never presents rule-based output as AI output.

## 4.13 Cold-Start Handling

On free hosting the backend and AI engine sleep after ~15 minutes without traffic. The backend therefore (a) pings the engine's `/health` as soon as it starts, and (b) retries AI calls that fail with 502/503/504 (the responses the platform gives while a service wakes) for up to 75 seconds with increasing delays. Without this, the first AI request after idle time failed; with it, the request simply takes longer.

In addition, a scheduled **GitHub Action** (`keep-awake.yml`) pings both services every 10 minutes between 09:30 and 21:30 IST. The window is chosen so that two services stay within Render's 750 free instance-hours per month (2 × 12 h × 31 days = 744 h).

## 4.14 AI Career Coach

A chat page where users ask open career questions. The engine endpoint `/career_chat` receives the conversation (up to 30 messages; the last must be from the user) and, optionally, the user's resume as plain text built from the Resume Builder. A system prompt defines the coach's role and scope (career topics only, concrete and concise advice, never inventing achievements), and the resume is passed in a fenced block so it is treated as data. The last 12 turns are sent to the LLM for context. Offline fallback: topic detection (resume/ATS, interviews, skills, salary, LinkedIn, cover letters) with practical prepared answers, clearly labelled as offline in the UI. The conversation is kept in the browser's session storage only.

## 4.15 Resume Version History

Users can save named snapshots of their resume (`resume_versions` table). Each snapshot stores the full content and the match score from the latest analysis, so the version panel shows a **score trend chart** (e.g. 54 → 68 → 82) and the skill count per version. Restoring a version first saves the current state as a "Before restore" version, so every restore can be undone. All version routes check that the resume belongs to the logged-in user.

## 4.16 Themed ("Designed") PDF Export

Besides the ATS-safe PDF, users can download the resume exactly as it looks in the chosen preview theme. The preview's A4 element is rendered with `html2canvas` at 2× resolution (the zoom transform is removed in the rendered clone), sliced into A4 pages and placed into a PDF with jsPDF. Because this PDF is an image, the UI recommends the ATS version for job portals and the designed version for emailing or printing.

## 4.17 OCR for Scanned PDFs

If a PDF's text layer contains fewer than 50 characters (an image-only scan), the engine runs **Tesseract OCR** through PyMuPDF (`get_textpage_ocr`, 200 DPI, English, up to 5 pages). Tesseract is installed in the engine's Docker image; `/health` reports `ocr_ready`. Text-based PDFs never pass through OCR, so normal uploads stay fast. If OCR is unavailable the user gets a clear message instead of an empty result.

## 4.18 Demo Mode

To make the platform easy to evaluate, the login page has a **"Try the demo"** button (`POST /api/auth/demo`). It signs the visitor into a shared demo account and **resets its sample data on every demo login**: a complete resume, three resume versions showing improvement, six job applications across all Kanban columns, and three interviews spread over the last week (so the dashboard chart is populated). Twelve sample users with realistic scores fill the leaderboard; they are created automatically at server start. Demo accounts get random passwords, so nobody can sign in to them with a password, and demo mode can be switched off with `DEMO_MODE=false`.

## 4.19 Branding and Text Encoding

The application has its own logo (SVG, rendered to PNG app icons and a multi-size favicon), a web-app manifest and Open Graph tags for link previews. During this work, several garbled characters in the Resume Builder (e.g. `â€¢` instead of `•`), caused by a file once saved with the wrong encoding, were repaired.

---

# CHAPTER 5 — TESTING, RESULTS AND EVALUATION

## 5.1 Test Environment

| Item | Details |
|---|---|
| Development machine | Windows 11, Node.js 22, Python 3.12.10 |
| Production | Vercel (frontend), Render free tier (backend, AI engine in Docker), Supabase free tier (PostgreSQL, ap-south-1) |
| LLM | Groq `openai/gpt-oss-120b` |

## 5.2 Automated Tests

| Suite | Tool | Tests | Result |
|---|---|---|---|
| Backend API (end-to-end on an in-memory PostgreSQL via PGlite) | `node --test` | 14 | **All pass** |
| Backend route wiring | `test_routes.js` | — | **Pass** |
| AI engine (NLP, scoring, parsing, API auth, validation, rate limiting, SSRF guard, career chat, OCR, offline fallbacks) | pytest | 29 | **All pass** (OCR test runs where Tesseract is installed) |
| Frontend (login and demo flow, PDF generator and text sanitiser) | Jest + Testing Library | 7 | **All pass** |
| Frontend production build (lint warnings treated as errors) | react-scripts | — | **Pass** |

All suites run automatically on every push through **GitHub Actions** (`.github/workflows/ci.yml`), with Tesseract installed so the OCR test also runs.

Backend tests cover: health check; demo login (filled account, reset on every demo login, password login impossible, leaderboard order and tiers); resume version history (save, list, restore with undo point, delete, ownership); registration, duplicate and validation errors, login (including case-insensitive email and rejection of injection-style payloads); protected routes; profile update and password change; PDF upload, download and deletion; resume CRUD and owner isolation; job tracker CRUD, validation, ownership and mass-assignment protection; interviews, analysis and dashboard statistics; leaderboard privacy and filtering; public profile privacy; password-reset validation; unknown routes and malformed JSON. Migrations are verified to be idempotent.

## 5.3 Live End-to-End Test

A script exercised every feature against the **deployed** system exactly as the website calls it (same endpoints, payloads and origin):

| # | Feature | Result | Time |
|---|---|---|---|
| 1 | Register | Pass | 1.7 s |
| 2 | Resume import from PDF (AI) | Pass — name, email, 12 skills, 2 jobs, education, 2 projects | 2.5 s |
| 3 | LinkedIn PDF import | Pass | 1.8 s |
| 4 | Save resume | Pass | 0.8 s |
| 5 | AI bullet enhancer | Pass | 0.9 s |
| 6 | Skill suggestions from JD (NLP) | Pass — 10 relevant keywords | 0.6 s |
| 7 | Global rank | Pass — score 290, Bronze | 1.3 s |
| 8 | Resume analyzer (PDF + JD) | Pass — match 63.8, ATS 78 | 1.5 s |
| 9 | Save analysis to dashboard | Pass | 1.0 s |
| 10 | Interview questions (5) | Pass — tailored to JD and resume | 1.2 s |
| 11 | Answer evaluation | Pass — score with specific feedback | 1.2 s |
| 12 | Save interview | Pass | 1.3 s |
| 13 | Cover letter | Pass — ~1400 characters, no placeholders | 1.4 s |
| 14 | Upload resume PDF to profile | Pass | 1.0 s |
| 15 | Open/download stored PDF | Pass — byte-identical to the upload | 0.6 s |
| 16 | Interview questions from stored resume PDF | Pass | 1.4 s |
| 17 | Dashboard statistics | Pass | 2.2 s |
| 18 | Job tracker add | Pass | 0.7 s |
| 19 | Leaderboard | Pass | 0.5 s |
| 20 | Forgot-password email | **Not available** — no email provider key configured | ~11 s (clear error) |

**19 / 20 passed.** Times are measured from the developer's machine in India to the servers and include network latency; they apply when the services are awake. The first request after ~15 minutes of inactivity can take up to ~50 seconds (free-tier cold start).

## 5.4 Issues Found and Fixed During Testing

| Issue | Cause | Fix |
|---|---|---|
| All AI features returned errors | Groq API key invalid, then the configured model was retired | New key; switched to `openai/gpt-oss-120b`, made the model configurable |
| First AI request after idle failed (502) | Free-tier engine asleep | Backend wakes the engine at start-up and retries 502/503/504 for up to 75 s |
| Profile PDF upload failed (500) | Cloudinary API key disabled | PDFs stored in PostgreSQL, served from `/api/files/:id` |
| Forgot-password request hung for 2 minutes | Render free tier blocks SMTP ports; Gmail password also rejected | SMTP timeouts, Brevo HTTPS API support, clear error message |
| Keyword "stack" suggested as a skill | Generic word from "Full Stack" noun chunk | Extended stop list; single words must repeat |
| Cover letters contained `[Your Address]`, `[Company]` | Prompt allowed placeholders | Prompt specifies format and forbids placeholders |
| PDF could show garbage characters | AI text with characters outside the PDF font | Character sanitiser in resume and cover-letter PDFs |
| Long titles overlapped dates in PDF | No wrapping beside right-aligned text | Title wraps within the remaining width |
| Bullet symbol extracted as `�` by ATS | Text glyph not in font encoding | Bullets drawn as shapes |
| MongoDB Atlas free tier unavailable | Hosting constraint | Backend migrated to PostgreSQL (Supabase) with automatic migrations |

## 5.5 Example Analyzer Output (abridged)

```json
{
  "score": 63.8,
  "base_score": 78,
  "overall_score": 68.1,
  "section_analysis": {"experience": true, "education": true, "skills": true,
                       "summary": true, "projects": true, "certifications": true},
  "matched_keywords": ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS", "Leadership"],
  "missing_keywords": ["Kubernetes", "CI/CD", "Communication"],
  "feedback": "Moderate match. Your background fits the domain, but several skills from the job description are missing.",
  "suggestions": ["Add the missing skills you genuinely have (Kubernetes, CI/CD, Communication) to your Skills section and project bullets.", "..."]
}
```

---

# CHAPTER 6 — DEPLOYMENT

| Component | Platform | Details |
|---|---|---|
| Frontend | **Vercel** | Project root `frontend`, Create React App preset, env `REACT_APP_NODE_API_URL`; SPA rewrites in `vercel.json` |
| Frontend (mirror) | Render static site | Same build, defined in `render.yaml` |
| Backend | Render web service (Node 22) | `npm ci` → `npm start`; health check `/api/health` |
| AI engine | Render web service (Docker) | Python 3.12-slim image, non-root user, health check `/health` |
| Database | Supabase PostgreSQL | Session-pooler connection (IPv4) over TLS; tables created automatically by the backend |

**Continuous deployment:** both Vercel and Render are connected to the GitHub repository. Every push to `main` triggers a build; Render's `buildFilter` rebuilds only the service whose folder changed.

**Configuration:** `render.yaml` (Render Blueprint) declares all services and their environment variables. Secrets (`DATABASE_URL`, `GROQ_API_KEY`, optional `BREVO_API_KEY`) are entered in the dashboard and never committed. The engine's `API_KEY` and the backend's `JWT_SECRET` are generated by Render, and the backend receives the engine key automatically (`fromService`).

**Live URLs**

- Web app: https://aiready-sigma.vercel.app (mirror: https://airesume-web.onrender.com)
- Backend API: https://airesume-backend-xmgp.onrender.com/api
- AI engine: https://ai-resume-engine.onrender.com (health: `/health`, test UI: `/ui`)

---

# CHAPTER 7 — CONCLUSION, LIMITATIONS AND FUTURE SCOPE

## 7.1 Conclusion

AIReady delivers a complete, deployed career-preparation platform: resume building with ATS-safe export, AI import of existing resumes, explainable job matching and ATS scoring, role-specific voice-enabled interview practice, cover letters, application tracking and gamified ranking. Combining explainable classical NLP with an LLM — and keeping every feature usable through fallbacks — gives users answers that are both useful and understandable. The system follows sound security practice, is covered by automated tests, and runs entirely on free cloud tiers.

## 7.2 Limitations

1. **Cold starts:** free hosting sleeps when idle; outside the keep-awake window the first request can take ~50 s.
2. **Email:** password-reset emails require an email-provider key (e.g. Brevo), not yet configured in production.
3. **OCR quality:** scanned resumes are read with Tesseract (English, first 5 pages); low-quality scans or unusual layouts may be read imperfectly.
4. **Language:** English only; the skill taxonomy focuses on technology roles.
5. **LLM variability:** AI outputs can vary between runs; scores that matter (rank, ATS) are therefore computed deterministically.
6. **Designed PDF is an image:** the themed PDF has no selectable text, so the ATS-safe PDF remains the one to upload to job portals.
7. **Shared demo account:** simultaneous demo visitors share one account (it is reset on each demo login).
8. **Token storage:** the JWT is stored in `localStorage`; an HttpOnly cookie would be more resistant to XSS.

## 7.3 Future Scope

- DOCX upload/export and multilingual OCR.
- Configure transactional email in production; email verification at sign-up.
- Larger, multi-domain skill taxonomy (healthcare, finance, design) and multilingual support.
- Semantic matching with sentence embeddings in addition to keyword coverage.
- Recruiter mode: rank multiple resumes against one job description.
- Browser extension to capture job postings directly into the tracker.
- Paid always-on hosting to remove cold starts; caching of repeated analyses.

---

# REFERENCES

1. Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*. Cambridge University Press.
2. Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval. *Information Processing & Management*, 24(5), 513–523.
3. Honnibal, M., & Montani, I. — *spaCy: Industrial-strength Natural Language Processing in Python*. https://spacy.io
4. Pedregosa, F. et al. (2011). Scikit-learn: Machine Learning in Python. *Journal of Machine Learning Research*, 12, 2825–2830.
5. Vaswani, A. et al. (2017). Attention Is All You Need. *Advances in Neural Information Processing Systems*.
6. FastAPI documentation. https://fastapi.tiangolo.com
7. PyMuPDF documentation. https://pymupdf.readthedocs.io
8. Groq API documentation. https://console.groq.com/docs
9. React documentation. https://react.dev
10. Express documentation. https://expressjs.com
11. PostgreSQL documentation. https://www.postgresql.org/docs/
12. Supabase documentation. https://supabase.com/docs
13. OWASP Top 10 Web Application Security Risks. https://owasp.org/www-project-top-ten/
14. Render and Vercel documentation. https://render.com/docs · https://vercel.com/docs

---

# APPENDIX A — INSTALLATION AND LOCAL SETUP

**Prerequisites:** Node.js ≥ 20, Python 3.12, Git, a PostgreSQL database (a free Supabase project works) and a free Groq API key.

```bash
git clone https://github.com/Ronakchandna/AIready.git
cd AIready
```

**1. AI engine** (port 8000)

```bash
cd ai-engine
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt   # includes the spaCy English model
copy .env.example .env            # set GROQ_API_KEY and a random API_KEY
uvicorn main:app --reload
# test UI: http://localhost:8000/ui   health: http://localhost:8000/health
```

**2. Backend** (port 5000)

```bash
cd backend
npm install
copy .env.example .env            # DATABASE_URL, JWT_SECRET, AI_SERVICE_URL=http://localhost:8000, AI_API_KEY=<engine API_KEY>
npm start                         # creates the tables on first start
npm run seed                      # optional: demo leaderboard users
npm test                          # API tests (no database needed)
```

**3. Frontend** (port 3000)

```bash
cd frontend
npm install
copy .env.example .env            # REACT_APP_NODE_API_URL=http://localhost:5000/api
npm start
```

**Supabase connection string:** in Supabase open **Connect → Session pooler** and copy the URI. If the password contains special characters such as `@`, URL-encode them (`@` → `%40`).

---

# APPENDIX B — REST API REFERENCE

Base URL: `/api`. 🔒 = requires `Authorization: Bearer <JWT>`.

### Authentication and profile

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{name, email, password}` → user + token |
| POST | `/auth/login` | `{email, password}` → user + token |
| POST | `/auth/demo` | Sign in to the demo account (its data is reset) → user + token |
| POST | `/auth/forgot-password` | `{email}` → emails a 6-digit OTP |
| POST | `/auth/reset-password` | `{email, otp, newPassword}` |
| GET 🔒 | `/auth/profile` | Current user's profile |
| PUT 🔒 | `/auth/profile` | Update profile; `password` change needs `oldPassword` |
| POST 🔒 | `/auth/profile/resume` | Upload PDF (`multipart`, field `resume`) |
| DELETE 🔒 | `/auth/profile/resume/:index` | Remove a stored resume and its file |
| GET | `/files/:id` | Download a stored PDF |

### Resumes, jobs, analytics

| Method | Path | Description |
|---|---|---|
| GET 🔒 | `/resume` | Latest resume |
| GET 🔒 | `/resume/all` | All resumes |
| POST 🔒 | `/resume` | Create, or update when `id` is given: `{id?, title?, content}` |
| DELETE 🔒 | `/resume/:id` | Delete a resume |
| GET 🔒 | `/resume/:id/versions` | Saved versions, newest first (label, date, score, skill count, content) |
| POST 🔒 | `/resume/:id/versions` | Save the current resume as a version `{label?}` |
| POST 🔒 | `/resume/:id/versions/:versionId/restore` | Restore a version (current state is saved first) |
| DELETE 🔒 | `/resume/:id/versions/:versionId` | Delete a version |
| GET 🔒 | `/jobs` | List applications |
| POST 🔒 | `/jobs` | `{company, role, status?, url?, location?, notes?}` |
| PUT 🔒 | `/jobs/:id` | Update an application |
| DELETE 🔒 | `/jobs/:id` | Delete an application |
| GET 🔒 | `/user/dashboard-stats` | Dashboard statistics |
| POST 🔒 | `/user/interviews` | Save an interview `{jobRole, overallScore, overallFeedback, results[]}` |
| POST 🔒 | `/user/resume-analysis` | Save analysis to latest resume `{score, missingKeywords, feedback}` |
| POST 🔒 | `/user/rank` | Compute Global Rank `{resumeText}` |
| GET | `/leaderboard?category=` | Opted-in users by score |
| GET | `/public/profile/:id` | Public profile |
| GET | `/health` | `{status, db}` |

### AI gateway (backend → engine)

| Method | Backend path | Engine path | Body |
|---|---|---|---|
| POST 🔒 | `/ai/analyze-resume` | `/analyze_resume` | multipart: `resume_file` (PDF) or `resume_text`, `job_description` |
| POST 🔒 | `/ai/parse-resume` | `/parse_resume` | multipart: `file` (PDF) |
| POST 🔒 | `/ai/parse-linkedin` | `/parse_linkedin` | multipart: `file` (PDF) |
| POST 🔒 | `/ai/enhance-bullet` | `/enhance_bullet` | `{bullet_point}` |
| POST 🔒 | `/ai/extract-keywords` | `/extract_keywords` | `{job_description}` |
| POST 🔒 | `/ai/generate-questions` | `/generate_questions` | `{job_description, num_questions?, resume_text?, resume_url?}` |
| POST 🔒 | `/ai/evaluate-answer` | `/evaluate_answer` | `{question, user_answer, expected_keywords?, resume_text?, resume_url?}` |
| POST 🔒 | `/ai/generate-cover-letter` | `/generate_cover_letter` | `{resume_text, job_description}` |
| POST 🔒 | `/ai/career-chat` | `/career_chat` | `{messages: [{role, content}], resume_text?}` |
| — | (used by `/user/rank`) | `/evaluate_global_rank` | `{resume_text}` |

The engine also exposes `GET /health` (status, model, whether AI and NLP are ready) and `GET /ui` (test dashboard). All engine routes except these require the `x-api-key` header.

---

# APPENDIX C — DATABASE SCHEMA

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,                       -- bcrypt hash
  phone text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  age integer,
  profile_photo text NOT NULL DEFAULT '',
  global_rank_score integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'Unranked',
  category_track text NOT NULL DEFAULT 'Software Engineering',
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  stored_resumes jsonb NOT NULL DEFAULT '[]',   -- [{_id, title, url}]
  reset_otp text,                               -- bcrypt hash of the OTP
  reset_otp_expires timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'My Resume',
  content jsonb NOT NULL DEFAULT '{}',          -- contact, summary, experience[], education[], projects[], skills[]
  analysis jsonb NOT NULL DEFAULT '{"score": 0, "missingKeywords": []}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved','applied','interviewing','offer','rejected')),
  url text, location text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_role text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]',        -- [{questionText, userAnswer, aiFeedback, score}]
  overall_score integer NOT NULL DEFAULT 0,
  overall_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  size integer NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resume_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  content jsonb NOT NULL,                       -- full snapshot of resumes.content
  score integer,                                -- match score at snapshot time
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX resume_versions_idx ON resume_versions (resume_id, created_at DESC);
CREATE INDEX resumes_user_idx    ON resumes (user_id, updated_at DESC);
CREATE INDEX jobs_user_idx       ON job_applications (user_id, created_at DESC);
CREATE INDEX interviews_user_idx ON interviews (user_id, updated_at DESC);
CREATE INDEX files_user_idx      ON files (user_id);
CREATE INDEX users_leaderboard_idx ON users (global_rank_score DESC) WHERE leaderboard_opt_in;

-- Block Supabase's public REST API (the backend connects as the table owner)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;   -- likewise for every table
```

**Resume `content` structure**

```json
{
  "contact": {"fullName": "", "email": "", "phone": "", "linkedin": "", "portfolio": ""},
  "summary": "",
  "experience": [{"id": "exp-1", "company": "", "role": "", "startDate": "", "endDate": "", "description": ""}],
  "education":  [{"id": "edu-1", "institution": "", "degree": "", "year": ""}],
  "projects":   [{"id": "proj-1", "title": "", "link": "", "description": ""}],
  "skills": ["Python", "React"]
}
```

---

# APPENDIX D — ENVIRONMENT VARIABLES

### AI engine

| Variable | Default | Purpose |
|---|---|---|
| `API_KEY` | — | Shared secret required in `x-api-key` |
| `GROQ_API_KEY` | — | Groq key; without it the engine runs in offline-fallback mode |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | LLM model |
| `LLM_TIMEOUT_SECONDS` | 30 | LLM request timeout |
| `RATE_LIMIT_PER_MINUTE` | 60 (120 in production) | Requests per client per minute |
| `TRUST_PROXY` | false | Use `X-Forwarded-For` for rate limiting behind a proxy |
| `ALLOWED_ORIGINS` | localhost | CORS origins for direct browser access |
| `MAX_PDF_BYTES` / `MAX_PDF_PAGES` | 5 MB / 30 | Upload limits |
| `UI_ENABLED` | true | Serve the `/ui` test dashboard |

### Backend

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase session pooler) |
| `JWT_SECRET` | Yes | Secret for signing login tokens |
| `FRONTEND_URL` | Yes (prod) | Comma-separated allowed origins |
| `AI_SERVICE_URL` / `AI_API_KEY` | Yes | AI engine address and its `API_KEY` |
| `NODE_ENV` | — | `production` enables strict CORS and generic errors |
| `RATE_LIMIT_MAX` | — | Requests per IP per 15 min (default 300) |
| `BREVO_API_KEY`, `EMAIL_FROM` | Optional | Password-reset email via Brevo |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Optional | Password-reset email via SMTP (local dev) |
| `FILE_STORAGE`, `CLOUDINARY_*` | Optional | Store PDFs on Cloudinary instead of the database |

### Frontend

| Variable | Purpose |
|---|---|
| `REACT_APP_NODE_API_URL` | Backend API base URL, e.g. `https://airesume-backend-xmgp.onrender.com/api` |

---

# APPENDIX E — PROJECT FOLDER STRUCTURE

```
aireadyproject/
├── README.md                 project overview, setup, deployment
├── full detail.md            this report
├── render.yaml               Render Blueprint (all services)
├── ai-engine/                Python FastAPI AI/NLP service (+ Dockerfile, tests/)
├── backend/                  Node.js Express API (+ tests/)
├── frontend/                 React web app (+ vercel.json)
└── old-version/              original pre-upgrade copies (kept locally, not in Git)
```

Source code: https://github.com/Ronakchandna/AIready
