# AI Resume Engine

A FastAPI service that analyses resumes against job descriptions, scores ATS readiness, coaches interviews and
generates career content. It ships with a built-in web dashboard at **`/ui`**.

## Features

| Feature | Endpoint | How it works |
|---|---|---|
| Resume ↔ JD match, ATS score, fixes | `POST /analyze_resume` | Curated skill taxonomy (synonyms, whole-word, keeps C++/C#/Node.js) + spaCy phrases + vocabulary similarity. Optional AI recommendations (`use_ai=true`) |
| Keyword extraction | `POST /extract_keywords` | Skills first, then domain phrases |
| Cover letter | `POST /generate_cover_letter` | Groq LLM, offline template fallback |
| Mock interview questions | `POST /generate_questions` | LLM (resume-aware) or skill-based templates |
| Answer evaluation | `POST /evaluate_answer` | LLM rubric or offline STAR/evidence/relevance rubric |
| Bullet enhancer | `POST /enhance_bullet` | LLM or rule-based verb upgrade |
| Resume / LinkedIn PDF parser | `POST /parse_resume`, `/parse_linkedin` | LLM JSON (validated) or offline heuristic parser |
| Profile strength tier | `POST /evaluate_global_rank` | LLM facts (clamped) or heuristics → score 0-100 + tier |
| Health | `GET /health` | public |

Every AI response includes `ai_used` and, when the LLM was unavailable, `fallback: true` plus a `warning`, so a
caller can always tell real AI output from offline output.

## Architecture

```
Browser (/ui)  ─┐
Your backend   ─┴─►  FastAPI (main.py)  ── auth, rate-limit, validation
                          │
              ┌───────────┼─────────────┐
        core/analyzer   core/services   utils/pdf_extractor, safe_fetch
        core/skills     core/llm ──► Groq API
        core/interviewer core/profile_parser
```

The engine is **stateless**: it stores nothing. A database (e.g. Supabase) belongs in your main backend, which
calls this engine with the `x-api-key` header.

## Run locally

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env      # then set API_KEY (and GROQ_API_KEY for AI features)
uvicorn main:app --reload
```

Open <http://localhost:8000/ui>, paste your `API_KEY` into the box at the top right, and use the tabs.
API docs: <http://localhost:8000/docs>.

## Tests

```powershell
pytest
```

Tests run fully offline (the LLM is mocked / disabled).

## Deploy

```powershell
docker build -t ai-engine .
docker run -p 8080:8080 --env-file .env ai-engine
```

Set `API_KEY`, `GROQ_API_KEY`, `ALLOWED_ORIGINS` and `TRUST_PROXY=true` (behind a load balancer) as environment
variables on your host (Render, Railway, Cloud Run, ...). Use `/health` as the health check path.

## Security notes

- All feature endpoints require `x-api-key` (constant-time compare). `/health`, `/ui`, `/docs` are public.
- Inputs are length-limited; PDFs are size/page-limited and validated by signature.
- `resume_url` fetching blocks private/loopback addresses (SSRF) and never follows redirects.
- Prompts fence user content and instruct the model to treat it as data (prompt-injection hardening).
- Never commit `.env`. If a key was ever shared, rotate it.
