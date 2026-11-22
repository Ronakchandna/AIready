# AIready - AI Resume & Interview Platform

A full-stack platform that helps job seekers build ATS-friendly resumes, match them to job descriptions,
practise interviews with AI feedback and track applications.

| Folder | Stack | Purpose |
|---|---|---|
| [`frontend/`](frontend) | React 19, Tailwind, Framer Motion | Web app (dashboard, resume builder/analyzer, mock interview, job tracker, leaderboard) |
| [`backend/`](backend) | Node.js, Express 5, MongoDB (Mongoose), JWT, Cloudinary | Auth, data, file uploads, proxy to the AI engine |
| [`ai-engine/`](ai-engine) | Python, FastAPI, spaCy, scikit-learn, Groq LLM | Resume analysis, ATS scoring, interview Q&A, cover letters, PDF parsing |

```
Browser ──► frontend (static) ──► backend (/api, JWT) ──► MongoDB Atlas
                                        │                 Cloudinary (PDFs)
                                        └──(x-api-key)──► ai-engine ──► Groq LLM
```

## Run locally

1. **AI engine** - see [ai-engine/README.md](ai-engine/README.md) (`uvicorn main:app --reload`, port 8000)
2. **Backend** - `cd backend && npm install && copy .env.example .env` (fill it in) `&& npm start` (port 5000)
3. **Frontend** - `cd frontend && npm install && copy .env.example .env && npm start` (port 3000)

## Deploy (Render, free)

`render.yaml` defines all three services. In Render: **New → Blueprint → this repo**, then fill in the secret
environment variables (MongoDB Atlas URI, Groq key, Cloudinary, email). Every push to `main` redeploys only
the part that changed.
