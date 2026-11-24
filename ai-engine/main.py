"""AI Resume Platform - NLP / AI engine (FastAPI).

Run:  uvicorn main:app --reload      then open http://localhost:8000/ui
"""
import hmac
import logging
import os
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Deque, Dict, List, Literal, Optional

import uvicorn
from fastapi import APIRouter, Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

import config
from core import analyzer, llm, services
from core.skills import extract_skills
from utils.pdf_extractor import PDFExtractionError, extract_text_from_pdf, is_pdf, ocr_available
from utils.safe_fetch import UnsafeURL, fetch_pdf

log = logging.getLogger("api")

if not config.API_KEY:
    raise RuntimeError("API_KEY environment variable is not set. Refusing to start the AI Engine unsecured.")
if len(config.API_KEY) < 16:
    log.warning("API_KEY is short; use a long random value in production.")
if not llm.is_configured():
    log.warning("GROQ_API_KEY is not set. AI features will use the offline engine.")

STATIC_DIR = Path(__file__).parent / "static"


def verify_api_key(x_api_key: Optional[str] = Header(None)) -> None:
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), config.API_KEY.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_in_threadpool(analyzer.get_nlp)  # warm up spaCy so the first request is fast
    yield


app = FastAPI(title="AI Resume Platform - AI Engine", version=config.APP_VERSION, lifespan=lifespan)
router = APIRouter(dependencies=[Depends(verify_api_key)])


# --------------------------------------------------------------------------- middleware
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window limiter per client IP. In-memory: use a shared store if you run several workers."""
    EXEMPT = {"/", "/health", "/ui", "/docs", "/openapi.json", "/redoc"}

    def __init__(self, app, max_requests: int, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests, self.window = max_requests, window_seconds
        self.hits: Dict[str, Deque[float]] = defaultdict(deque)
        self.calls = 0

    def _client(self, request: Request) -> str:
        if config.TRUST_PROXY:
            fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            if fwd:
                return fwd
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if request.url.path in self.EXEMPT or request.method == "OPTIONS":
            return await call_next(request)
        now = time.monotonic()
        self.calls += 1
        if self.calls % 500 == 0:  # drop idle clients so memory cannot grow without bound
            for k in [k for k, q in self.hits.items() if not q or now - q[-1] > self.window]:
                del self.hits[k]
        q = self.hits[self._client(request)]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max_requests:
            retry = max(1, int(self.window - (now - q[0])))
            return JSONResponse(status_code=429, headers={"Retry-After": str(retry)},
                                content={"success": False, "error": "Too many requests. Please try again later.",
                                         "detail": "Too many requests. Please try again later."})
        q.append(now)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        log.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - start) * 1000)
        return response


app.add_middleware(RateLimitMiddleware, max_requests=config.RATE_LIMIT_PER_MINUTE, window_seconds=60)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(  # added last = outermost, so even 429/401 answers carry CORS headers
    CORSMiddleware, allow_origins=config.ALLOWED_ORIGINS, allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["x-api-key", "content-type"])


# --------------------------------------------------------------------------- error handling
def _error(status: int, message, headers=None) -> JSONResponse:
    return JSONResponse(status_code=status, headers=headers,
                        content={"success": False, "error": message, "detail": message})


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    return _error(exc.status_code, exc.detail, getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    problems = [{"field": ".".join(str(p) for p in e["loc"][1:]) or str(e["loc"][0]), "message": e["msg"]}
                for e in exc.errors()]
    first = problems[0] if problems else {"field": "", "message": "invalid input"}
    return JSONResponse(status_code=422, content={
        "success": False, "error": f"Invalid input for '{first['field']}': {first['message']}", "detail": problems})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    ref = uuid.uuid4().hex[:8]
    log.exception("Unhandled error ref=%s path=%s", ref, request.url.path)
    return _error(500, f"Internal server error (ref {ref}).")


# --------------------------------------------------------------------------- schemas
class _Base(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class JDRequest(_Base):
    job_description: str = Field(..., min_length=1, max_length=config.MAX_JD_CHARS)
    num_questions: int = Field(5, ge=1, le=config.MAX_QUESTIONS)
    resume_text: Optional[str] = Field(None, max_length=config.MAX_RESUME_CHARS)
    resume_url: Optional[str] = Field(None, max_length=2048)


class KeywordRequest(_Base):
    job_description: str = Field(..., min_length=1, max_length=config.MAX_JD_CHARS)


class EnhanceBulletRequest(_Base):
    bullet_point: str = Field(..., min_length=1, max_length=1000)


class GlobalRankRequest(_Base):
    resume_text: str = Field(..., min_length=1, max_length=config.MAX_RESUME_CHARS)


class AnswerEvaluationRequest(_Base):
    question: str = Field(..., min_length=1, max_length=1000)
    user_answer: str = Field(..., min_length=1, max_length=config.MAX_ANSWER_CHARS)
    expected_keywords: List[str] = Field(default_factory=list, max_length=30)
    resume_text: Optional[str] = Field(None, max_length=config.MAX_RESUME_CHARS)
    resume_url: Optional[str] = Field(None, max_length=2048)


class CoverLetterRequest(_Base):
    resume_text: str = Field(..., min_length=1, max_length=config.MAX_RESUME_CHARS)
    job_description: str = Field(..., min_length=1, max_length=config.MAX_JD_CHARS)


class ChatMessage(_Base):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class CareerChatRequest(_Base):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=30)
    resume_text: Optional[str] = Field(None, max_length=config.MAX_RESUME_CHARS)

    @field_validator("messages")
    @classmethod
    def _last_is_user(cls, v):
        if v[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return v


# --------------------------------------------------------------------------- helpers
async def read_pdf_upload(file: UploadFile) -> str:
    # The PDF signature is what matters: phones often send files without a ".pdf" name.
    data = await file.read(config.MAX_PDF_BYTES + 1)
    if len(data) > config.MAX_PDF_BYTES:
        raise HTTPException(413, f"File too large. {config.MAX_PDF_BYTES // (1024 * 1024)}MB maximum.")
    if not is_pdf(data):
        raise HTTPException(400, "Only PDF files are supported. Save or export your resume as PDF and try again.")
    try:
        text = await run_in_threadpool(extract_text_from_pdf, data)
    except PDFExtractionError as exc:
        raise HTTPException(400, str(exc))
    if not text.strip():
        raise HTTPException(400, "No readable text found in the PDF. If it is a scan, upload a clearer copy "
                                 "or a text-based PDF." if ocr_available() else
                                 "No text found in the PDF (scanned image-only PDFs need OCR, which is not installed).")
    return text[: config.MAX_RESUME_CHARS]


def resolve_resume(resume_text: Optional[str], resume_url: Optional[str]):
    """Return (text, warning). A bad URL never fails the request; it is reported as a warning."""
    if resume_text:
        return resume_text, None
    if resume_url:
        try:
            text = extract_text_from_pdf(fetch_pdf(resume_url))[: config.MAX_RESUME_CHARS]
            return (text or None), (None if text else "No text found in the resume URL.")
        except (UnsafeURL, PDFExtractionError) as exc:
            log.warning("resume_url rejected: %s", exc)
            return None, f"Resume URL ignored: {exc}"
    return None, None


def ok(payload: dict, warning: Optional[str] = None) -> dict:
    out = {"success": True, **payload}
    if warning:
        out["input_warning"] = warning
    return out


# --------------------------------------------------------------------------- public routes
@app.get("/", include_in_schema=False)
def root():
    return {"message": "AI Resume Platform AI Engine is running", "version": config.APP_VERSION,
            "ui": "/ui" if config.UI_ENABLED else None, "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok", "version": config.APP_VERSION, "ai_configured": llm.is_configured(),
            "model": config.GROQ_MODEL if llm.is_configured() else None,
            "nlp_ready": analyzer.get_nlp() is not None, "ocr_ready": ocr_available()}


@app.get("/ui", include_in_schema=False)
def ui():
    page = STATIC_DIR / "index.html"
    if not config.UI_ENABLED or not page.exists():
        raise HTTPException(404, "UI is disabled.")
    csp = ("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
           "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
    return FileResponse(page, headers={"Content-Security-Policy": csp, "Cache-Control": "no-cache"})


# --------------------------------------------------------------------------- protected routes
@router.post("/analyze_resume")
async def analyze_resume(
    job_description: str = Form(..., max_length=config.MAX_JD_CHARS),
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None, max_length=config.MAX_RESUME_CHARS),
    use_ai: bool = Form(False),
):
    jd = job_description.strip()
    if not jd:
        raise HTTPException(400, "Job description cannot be empty.")
    if resume_file is not None and resume_file.filename:
        text = await read_pdf_upload(resume_file)
    elif resume_text and resume_text.strip():
        text = resume_text.strip()
    else:
        raise HTTPException(400, "Provide either a resume_file (PDF) or resume_text.")

    analysis = await run_in_threadpool(analyzer.analyze_resume_match, text, jd)
    payload = {"data": analysis, "ai_used": False}
    if use_ai:
        tips = await run_in_threadpool(services.ai_insights, text, jd, analysis)
        analysis["ai_suggestions"] = tips
        payload["ai_used"] = tips is not None
        if tips is None:
            payload["warning"] = "AI insights unavailable; showing rule-based suggestions only."
    return ok(payload)


@router.post("/extract_keywords")
def extract_keywords(request: KeywordRequest):
    keywords = analyzer.extract_keywords(request.job_description)
    return ok({"keywords": keywords[:15], "skills": extract_skills(request.job_description)})


@router.post("/enhance_bullet")
def enhance_bullet(request: EnhanceBulletRequest):
    return ok(services.enhance_bullet(request.bullet_point))


@router.post("/evaluate_global_rank")
def evaluate_global_rank(request: GlobalRankRequest):
    return ok(services.evaluate_global_rank(request.resume_text))


@router.post("/generate_questions")
def generate_questions(request: JDRequest):
    resume, warn = resolve_resume(request.resume_text, request.resume_url)
    return ok(services.generate_questions(request.job_description, request.num_questions, resume), warn)


@router.post("/evaluate_answer")
def evaluate_answer(request: AnswerEvaluationRequest):
    resume, warn = resolve_resume(request.resume_text, request.resume_url)
    return ok(services.evaluate_interview_answer(
        request.question, request.user_answer, request.expected_keywords, resume), warn)


@router.post("/generate_cover_letter")
def generate_cover_letter(request: CoverLetterRequest):
    return ok(services.generate_cover_letter(request.resume_text, request.job_description))


@router.post("/career_chat")
def career_chat(request: CareerChatRequest):
    history = [m.model_dump() for m in request.messages]
    return ok(services.career_chat(history, request.resume_text))


@router.post("/parse_resume")
async def parse_resume(file: UploadFile = File(...)):
    text = await read_pdf_upload(file)
    return ok(await run_in_threadpool(services.parse_profile, text, "resume"))


@router.post("/parse_linkedin")
async def parse_linkedin(file: UploadFile = File(...)):
    text = await read_pdf_upload(file)
    return ok(await run_in_threadpool(services.parse_profile, text, "LinkedIn profile"))


app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "8000")),
                reload=os.getenv("DEV_RELOAD", "false").lower() == "true")
