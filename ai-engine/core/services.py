"""AI features. Each function tries the LLM first and falls back to a local engine.

Every result carries `ai_used` and, on fallback, `fallback: True` + `warning`, so callers and the UI
can tell real AI output from offline output (the old engine silently returned fake data).
"""
import datetime
import logging
import re
from typing import Any, Dict, List, Optional

from core import llm
from core.analyzer import _METRIC_RE, analyze_resume_match
from core.interviewer import evaluate_answer as rule_evaluate
from core.interviewer import generate_interview_questions as rule_questions
from core.profile_parser import heuristic_profile, normalize_profile, split_sections
from core.skills import extract_skills, skill_rarity

log = logging.getLogger("services")


def _ai(data: Dict[str, Any]) -> Dict[str, Any]:
    return {**data, "ai_used": True, "fallback": False}


def _offline(data: Dict[str, Any]) -> Dict[str, Any]:
    warning = ("AI model unavailable right now - showing results from the offline engine."
               if llm.is_configured() else "AI is not configured (set GROQ_API_KEY) - showing offline results.")
    return {**data, "ai_used": False, "fallback": True, "warning": warning}


def _clamp(v: Any, lo: int, hi: int, default: int) -> int:
    try:
        return max(lo, min(hi, int(round(float(v)))))
    except (TypeError, ValueError):
        return default


# --------------------------------------------------------------------------- bullet enhancer
_WEAK = [
    (r"^(?:was\s+)?responsible for\b", "Owned"), (r"^worked on\b", "Contributed to"),
    (r"^helped(?: to)?\b", "Supported"), (r"^(?:was )?involved in\b", "Contributed to"),
    (r"^made\b", "Created"), (r"^did\b", "Executed"), (r"^used\b", "Leveraged"),
]


def _rule_bullet(bullet: str) -> str:
    text = bullet.strip().lstrip("-•*– ").strip()
    for pat, rep in _WEAK:
        if re.match(pat, text, re.IGNORECASE):
            text = re.sub(pat, rep, text, count=1, flags=re.IGNORECASE)
            break
    text = text[:1].upper() + text[1:]
    return text if text.endswith((".", "!")) else text + "."


def enhance_bullet(bullet: str) -> Dict[str, Any]:
    prompt = (
        "You are an expert resume writer. Rewrite the bullet point inside <bullet> to be more impactful, "
        "professional and results-oriented.\n"
        "Rules: start with a strong action verb; one sentence; no leading dash or asterisk; do NOT invent "
        "metrics, tools or facts that are not in the original; return ONLY the rewritten sentence.\n"
        + llm.fence("bullet", bullet)
    )
    try:
        text = llm.complete(prompt, temperature=0.4, max_tokens=200).splitlines()[0]
        text = re.sub(r'^[\s\-•*"“]+|["”\s]+$', "", text)
        if text:
            return _ai({"enhanced_bullet": text})
    except llm.LLMUnavailable:
        pass
    return _offline({"enhanced_bullet": _rule_bullet(bullet)})


# --------------------------------------------------------------------------- global rank
EDU_TIERS = ["High School", "Bachelors", "Masters", "PhD", "None"]
_RANGE = re.compile(r"((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now)", re.IGNORECASE)


def _years_experience(text: str) -> int:
    stated = re.findall(r"(\d{1,2})\+?\s*(?:years|yrs)", text, re.IGNORECASE)
    if stated:
        return min(max(int(x) for x in stated), 40)
    exp = " ".join(split_sections(text).get("experience", []))
    now = datetime.date.today().year
    total = sum(max(0, (int(b) if b.isdigit() else now) - int(a)) for a, b in _RANGE.findall(exp))
    return min(total, 40)


def _education_tier(text: str) -> str:
    low = text.lower()
    if re.search(r"\b(ph\.?d|doctorate|doctoral)\b", low):
        return "PhD"
    if re.search(r"\b(master'?s?|m\.sc|msc|m\.tech|mtech|mba|mca|m\.s\.)\b", low):
        return "Masters"
    if re.search(r"\b(bachelor'?s?|b\.?tech|b\.e\.|b\.sc|bsc|bca|b\.s\.|b\.a\.)\b", low):
        return "Bachelors"
    if re.search(r"\b(high school|hsc|secondary school|12th|10th)\b", low):
        return "High School"
    return "None"


def _heuristic_rank_facts(text: str) -> Dict[str, Any]:
    skills = extract_skills(text)
    rarities = sorted((skill_rarity(s) for s in skills), reverse=True)[:5]
    has_projects = bool(split_sections(text).get("projects"))
    return {
        "totalYearsExperience": _years_experience(text),
        "educationTier": _education_tier(text),
        "skillRarity": _clamp(sum(rarities) / len(rarities), 1, 10, 3) if rarities else 3,
        "impactMetricsCount": len(_METRIC_RE.findall(text)),
        "projectComplexity": _clamp(3 + len(skills) // 3 + (1 if has_projects else 0), 1, 10, 4),
    }


def _validate_rank(d: Any) -> Dict[str, Any]:
    if not isinstance(d, dict):
        raise ValueError("not an object")
    edu = next((e for e in EDU_TIERS if str(d.get("educationTier", "")).strip().lower() == e.lower()), "None")
    return {
        "totalYearsExperience": _clamp(d.get("totalYearsExperience"), 0, 50, 0),
        "educationTier": edu,
        "skillRarity": _clamp(d.get("skillRarity"), 1, 10, 5),
        "impactMetricsCount": _clamp(d.get("impactMetricsCount"), 0, 200, 0),
        "projectComplexity": _clamp(d.get("projectComplexity"), 1, 10, 5),
    }


def compute_rank(f: Dict[str, Any]) -> Dict[str, Any]:
    edu_pts = {"None": 0, "High School": 4, "Bachelors": 9, "Masters": 13, "PhD": 15}[f["educationTier"]]
    total = (min(f["totalYearsExperience"], 10) / 10 * 30 + edu_pts + f["skillRarity"] * 2
             + min(f["impactMetricsCount"], 8) / 8 * 15 + f["projectComplexity"] * 2)
    score = int(round(max(0, min(100, total))))
    tier = ("Elite" if score >= 85 else "Advanced" if score >= 70 else "Intermediate" if score >= 50
            else "Emerging" if score >= 30 else "Beginner")
    return {"rankScore": score, "tier": tier}


def evaluate_global_rank(resume_text: str) -> Dict[str, Any]:
    prompt = (
        "You are an expert technical recruiter. From the resume inside <resume>, estimate these facts and "
        "return ONLY this JSON object:\n"
        '{"totalYearsExperience": <integer years of work experience>, '
        '"educationTier": <one of "High School","Bachelors","Masters","PhD","None">, '
        '"skillRarity": <integer 1-10, 1 = only common skills, 10 = rare specialised skills>, '
        '"impactMetricsCount": <integer, how many distinct measurable results are stated>, '
        '"projectComplexity": <integer 1-10 based on tech stack and scope>}\n'
        + llm.fence("resume", resume_text)
    )
    try:
        facts = llm.complete_json(prompt, _validate_rank, temperature=0.1, max_tokens=300)
        return _ai({"data": {**facts, **compute_rank(facts)}})
    except llm.LLMUnavailable:
        facts = _heuristic_rank_facts(resume_text)
        return _offline({"data": {**facts, **compute_rank(facts)}})


# --------------------------------------------------------------------------- interview
def generate_questions(job_description: str, num: int, resume_text: Optional[str]) -> Dict[str, Any]:
    ctx = ("Tailor questions to connect the candidate's resume to the job requirements.\n"
           + llm.fence("resume", resume_text)) if resume_text else ""
    prompt = (
        f"You are an expert HR manager and technical interviewer. Generate exactly {num} interview questions "
        "for the role in <job_description>: a mix of technical, problem-solving and behavioural questions, "
        'each specific and answerable in 1-2 minutes. Return ONLY JSON: {"questions": ["...", "..."]}\n'
        + llm.fence("job_description", job_description) + "\n" + ctx
    )

    def validate(d: Any) -> List[str]:
        if not isinstance(d, dict) or not isinstance(d.get("questions"), list):
            raise ValueError("bad shape")
        qs = [str(q).strip() for q in d["questions"] if str(q).strip()][:num]
        if not qs:
            raise ValueError("no questions")
        return qs

    try:
        return _ai({"questions": llm.complete_json(prompt, validate, temperature=0.6, max_tokens=900)})
    except llm.LLMUnavailable:
        return _offline({"questions": rule_questions(job_description, num)})


def evaluate_interview_answer(question: str, answer: str, expected_keywords: List[str],
                              resume_text: Optional[str]) -> Dict[str, Any]:
    ctx = ("Use the resume to judge whether the answer is consistent with their claimed experience.\n"
           + llm.fence("resume", resume_text)) if resume_text else ""
    prompt = (
        "You are a strict but fair interviewer. Evaluate the candidate's answer. Score 0-100 for clarity, "
        "relevance, depth, evidence (numbers/outcomes) and STAR structure. Return ONLY JSON:\n"
        '{"score": <int 0-100>, "feedback": "<2-3 constructive sentences>", '
        '"matched_keywords": [<expected keywords actually covered>], '
        '"strengths": [<short strings>], "improvements": [<short strings>]}\n'
        f"Expected keywords: {', '.join(expected_keywords) if expected_keywords else 'none'}\n"
        + llm.fence("question", question) + "\n" + llm.fence("answer", answer) + "\n" + ctx
    )

    def validate(d: Any) -> Dict[str, Any]:
        if not isinstance(d, dict) or "score" not in d:
            raise ValueError("bad shape")

        def strs(v: Any) -> List[str]:
            return [str(x) for x in v][:6] if isinstance(v, list) else []
        return {
            "score": _clamp(d.get("score"), 0, 100, 0),
            "feedback": str(d.get("feedback", "")).strip(),
            "matched_keywords": strs(d.get("matched_keywords")),
            "strengths": strs(d.get("strengths")),
            "improvements": strs(d.get("improvements")),
        }

    try:
        return _ai({"data": llm.complete_json(prompt, validate, temperature=0.2, max_tokens=500)})
    except llm.LLMUnavailable:
        return _offline({"data": rule_evaluate(question, answer, expected_keywords)})


# --------------------------------------------------------------------------- cover letter
def _template_letter(resume_text: str, jd_text: str) -> str:
    name = heuristic_profile(resume_text)["contact"]["fullName"] or "[Your Name]"
    skills = analyze_resume_match(resume_text, jd_text)["matched_skills"][:4]
    if len(skills) > 1:
        skill_txt = ", ".join(skills[:-1]) + " and " + skills[-1]
    else:
        skill_txt = skills[0] if skills else "the skills described in your job posting"
    return (
        "Dear Hiring Manager,\n\n"
        "I am excited to apply for this opportunity. After reading the job description, I believe my background "
        f"is a strong fit, particularly my hands-on experience with {skill_txt}.\n\n"
        "In my previous work and projects I have focused on delivering reliable, well-tested solutions and "
        "learning new tools quickly. My resume highlights relevant examples, and I would be glad to discuss "
        "how I can contribute to your team.\n\n"
        "Thank you for your time and consideration.\n\n"
        f"Sincerely,\n{name}"
    )


def generate_cover_letter(resume_text: str, jd_text: str) -> Dict[str, Any]:
    prompt = (
        "You are an expert career coach. Write a tailored, persuasive cover letter (about 250-300 words) for the "
        "candidate in <resume> applying to the job in <job_description>. Highlight relevant skills and experience "
        "that match the requirements. Do NOT invent experience or employers; if a requirement is missing from the "
        "resume, emphasise transferable skills and ability to learn. Tone: confident, concise, modern. "
        "Format: start directly with 'Dear Hiring Manager,' (no address, date or contact header block), "
        "3-4 short paragraphs, then 'Sincerely,' and the candidate's full name taken from the resume. "
        "Refer to the employer as 'your company' or by name if the job description gives one - never use "
        "bracketed placeholders, except [Your Name] if the resume has no name. Return only the letter.\n"
        + llm.fence("job_description", jd_text) + "\n" + llm.fence("resume", resume_text)
    )
    try:
        return _ai({"cover_letter": llm.complete(prompt, temperature=0.5, max_tokens=900)})
    except llm.LLMUnavailable:
        return _offline({"cover_letter": _template_letter(resume_text, jd_text)})


# --------------------------------------------------------------------------- profile parsing
_PROFILE_SCHEMA = (
    '{"contact": {"fullName": "", "email": "", "phone": "", "linkedin": "", "portfolio": ""}, "summary": "", '
    '"experience": [{"id": "", "company": "", "role": "", "startDate": "", "endDate": "", "description": ""}], '
    '"education": [{"id": "", "institution": "", "degree": "", "year": ""}], '
    '"projects": [{"id": "", "title": "", "link": "", "description": ""}], "skills": ["skill1"]}'
)


def parse_profile(text: str, source: str = "resume") -> Dict[str, Any]:
    prompt = (
        f"You are an expert data extractor. The text inside <document> comes from a {source} PDF. Map it into EXACTLY "
        f"this JSON schema and return ONLY the JSON:\n{_PROFILE_SCHEMA}\n"
        'Use sequential ids ("exp-1", "edu-1", "proj-1"). Leave unknown fields as "" or []. Keep descriptions as '
        "bullet lines separated by newlines. Do not invent information.\n" + llm.fence("document", text)
    )
    try:
        return _ai({"data": llm.complete_json(prompt, normalize_profile, temperature=0.1, max_tokens=3000)})
    except llm.LLMUnavailable:
        return _offline({"data": heuristic_profile(text)})


# --------------------------------------------------------------------------- AI insights for analyzer
def ai_insights(resume_text: str, jd_text: str, analysis: Dict[str, Any]) -> Optional[List[str]]:
    """3-5 tailored improvement tips, or None when the LLM is unavailable."""
    prompt = (
        "You are a career coach reviewing a resume against a job description. Match score: "
        f"{analysis['score']}/100. Missing skills detected: {', '.join(analysis['missing_skills']) or 'none'}.\n"
        "Give 3-5 specific, actionable improvements (rewrite suggestions, what to emphasise, what to add if the "
        'candidate truly has it). Never suggest fabricating experience. Return ONLY JSON: {"suggestions": ["..."]}\n'
        + llm.fence("job_description", jd_text) + "\n" + llm.fence("resume", resume_text)
    )

    def validate(d: Any) -> List[str]:
        if not isinstance(d, dict) or not isinstance(d.get("suggestions"), list):
            raise ValueError("bad shape")
        tips = [str(t).strip() for t in d["suggestions"] if str(t).strip()][:5]
        if not tips:
            raise ValueError("empty")
        return tips

    try:
        return llm.complete_json(prompt, validate, temperature=0.4, max_tokens=700)
    except llm.LLMUnavailable:
        return None
