"""Resume <-> job-description analysis.

Pipeline
  1. Skill extraction from a curated taxonomy (whole-word, synonym aware, keeps C++, C#, Node.js ...)
  2. Domain phrase extraction with spaCy noun chunks (optional - degrades gracefully if the model is missing)
  3. Weighted match score  = skills (dominant) + domain phrases + vocabulary similarity
  4. Separate ATS (structure) score with a transparent breakdown and actionable issues
"""
import logging
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from core.skills import extract_skills, skill_category

log = logging.getLogger("analyzer")

# --------------------------------------------------------------------------- spaCy (lazy, optional)
_nlp = None
_nlp_tried = False


def get_nlp():
    """Load spaCy once. Returns None when the model is unavailable (keyword fallback is used)."""
    global _nlp, _nlp_tried
    if not _nlp_tried:
        _nlp_tried = True
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm", disable=["ner"])
        except Exception as exc:  # model not installed, etc.
            log.warning("spaCy model unavailable, phrase extraction disabled: %s", exc)
            _nlp = None
    return _nlp


# --------------------------------------------------------------------------- text helpers
def clean_text(text: str) -> str:
    """Normalise text for similarity: drop URLs/noise, keep + # . so tech names survive, lowercase."""
    text = re.sub(r"https?://\S+|www\.\S+", " ", text or "")
    text = re.sub(r"[^a-zA-Z0-9\s.,;+#/-]", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


GENERIC_WORDS = {
    "requirements", "requirement", "qualifications", "qualification", "responsibilities", "responsibility",
    "duties", "experience", "experiences", "year", "years", "ability", "abilities", "knowledge", "skill",
    "skills", "work", "team", "teams", "company", "candidate", "applicant", "job", "position", "description",
    "role", "opportunity", "benefits", "benefit", "equal", "employer", "hands", "proficiency", "strong",
    "good", "excellent", "plus", "preferred", "required", "degree", "bachelor", "understanding", "environment",
    "etc", "looking", "someone", "everyone", "anyone", "people", "business", "solutions", "solution",
    "software", "development", "developer", "engineer", "engineering", "senior", "junior", "level", "field",
    "ideal", "must", "nice", "will", "using", "based", "related", "relevant", "similar", "key", "new",
    "free", "time", "day", "week", "month", "salary", "location", "remote", "office", "us", "we", "you",
    "full", "stack", "end", "front", "back", "hiring", "hire", "join", "member", "members", "candidates",
    "applicants", "role", "roles", "track", "record", "plus", "bonus", "growth", "culture", "pay",
}


def _stem(word: str) -> str:
    w = word.lower()
    for suf in ("ing", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def phrase_in_text(phrase: str, text_lower: str) -> bool:
    """Whole-word, plural/suffix tolerant phrase match."""
    toks = re.findall(r"[a-z0-9+#.]+", phrase.lower())
    if not toks:
        return False
    pattern = r"(?<![a-z0-9])" + r"[\s\-/]+".join(re.escape(_stem(t)) + r"[a-z]*" for t in toks) + r"(?![a-z0-9])"
    return re.search(pattern, text_lower) is not None


def domain_phrases(text: str, limit: int = 12) -> List[str]:
    """Top noun-chunk phrases that are NOT already covered by the skill taxonomy."""
    nlp = get_nlp()
    if nlp is None or not text.strip():
        return []
    doc = nlp(text[:20000])
    counts: Counter = Counter()
    for chunk in doc.noun_chunks:
        words = [t.text.lower() for t in chunk
                 if t.is_alpha and not t.is_stop and len(t.text) > 2 and t.text.lower() not in GENERIC_WORDS]
        if 1 <= len(words) <= 3:
            phrase = " ".join(words)
            if len(phrase) > 3 and not extract_skills(phrase):
                counts[phrase] += 1
    # a lone word is only a meaningful keyword if the text repeats it; multi-word phrases count once
    counts = Counter({p: c for p, c in counts.items() if " " in p or c >= 2})
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], -len(kv[0]), kv[0]))
    return [p for p, _ in ranked[:limit]]


def extract_keywords(text: str) -> List[str]:
    """Skills from the taxonomy first (canonical spelling), then domain phrases."""
    skills = extract_skills(text)
    seen = {s.lower() for s in skills}
    phrases = [p for p in domain_phrases(text, 20) if p not in seen]
    return skills + phrases


# --------------------------------------------------------------------------- structure / ATS
_SECTION_HEADERS = {
    "experience": r"work\s+experience|professional\s+experience|relevant\s+experience|experience|employment(?:\s+history)?|work\s+history|career\s+history|internships?",
    "education": r"education(?:al\s+qualifications?)?|academic\s+background|academic\s+history|academics",
    "skills": r"technical\s+skills|key\s+skills|core\s+competencies|skills|competencies|technologies|tech\s+stack|tools\s+and\s+technologies",
    "summary": r"professional\s+summary|professional\s+profile|summary|profile|about\s+me|career\s+objective|objective",
    "projects": r"personal\s+projects|academic\s+projects|key\s+projects|projects",
    "certifications": r"certifications?|licenses|courses|awards|achievements",
}
_SECTION_RE = {k: re.compile(r"^\W*(?:" + v + r")\b", re.IGNORECASE) for k, v in _SECTION_HEADERS.items()}
CORE_SECTIONS = ("experience", "education", "skills", "summary")

ACTION_VERBS = {
    "developed", "designed", "built", "led", "managed", "created", "implemented", "improved", "optimized",
    "optimised", "launched", "delivered", "automated", "reduced", "increased", "architected", "engineered",
    "deployed", "integrated", "migrated", "analyzed", "analysed", "collaborated", "mentored", "streamlined",
    "established", "spearheaded", "refactored", "tested", "maintained", "resolved", "researched", "trained",
}
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Any digit run with common separators; _has_phone then requires 10-13 digits, which covers
# +91 98765 43210, (555) 123-4567, +1 555 123 4567, 9876543210 but not dates or years.
_PHONE_RE = re.compile(r"(?<![\w])\+?\(?\d[\d \t().-]{7,18}\d(?!\d)")


def _has_phone(text: str) -> bool:
    return any(10 <= len(re.sub(r"\D", "", m.group())) <= 13 for m in _PHONE_RE.finditer(text or ""))
_LINK_RE = re.compile(r"linkedin\.com|github\.com|gitlab\.com|portfolio|https?://", re.IGNORECASE)
_METRIC_RE = re.compile(
    r"\d+(?:[.,]\d+)?\s?(?:%|percent\b|x\b|k\b|\+|million|billion|users|customers|clients|requests|ms\b)|[$₹€£]\s?\d",
    re.IGNORECASE)
_BULLET_RE = re.compile(r"^\s*(?:[-•*▪●·–]|\d+[.)])\s+")


def extract_section_analysis(raw_text: str) -> Dict[str, bool]:
    """Detect real section headers: short lines that start with a known heading."""
    detected = {k: False for k in _SECTION_HEADERS}
    for line in (l.strip() for l in (raw_text or "").splitlines()):
        if not line or len(line) > 60:
            continue
        for section, rx in _SECTION_RE.items():
            if not detected[section] and rx.search(line):
                detected[section] = True
    return detected


def evaluate_ats(raw_text: str, sections: Optional[Dict[str, bool]] = None) -> Dict[str, Any]:
    """Structure/readability score (0-100) with a per-factor breakdown and actionable issues."""
    sections = sections or extract_section_analysis(raw_text)
    words = len((raw_text or "").split())
    issues: List[str] = []
    b: Dict[str, Dict[str, int]] = {}

    def add(key: str, got: int, max_: int):
        b[key] = {"score": got, "max": max_}

    weights = {"experience": 12, "education": 8, "skills": 10, "summary": 5}
    sec = 0
    for name, w in weights.items():
        if sections.get(name):
            sec += w
        else:
            issues.append(f"Missing a clear '{name.title()}' section heading.")
    add("sections", sec, 35)

    has_email = bool(_EMAIL_RE.search(raw_text))
    has_phone = _has_phone(raw_text)
    has_link = bool(_LINK_RE.search(raw_text))
    if not has_email:
        issues.append("No email address found.")
    if not has_phone:
        issues.append("No phone number found.")
    if not has_link:
        issues.append("Add a LinkedIn / GitHub / portfolio link.")
    add("contact", (8 if has_email else 0) + (7 if has_phone else 0) + (5 if has_link else 0), 20)

    if 300 <= words <= 900:
        length = 15
    elif 150 <= words < 300 or 900 < words <= 1200:
        length = 10
        issues.append("Resume length is outside the ideal 300-900 words range.")
    elif 100 <= words < 150:
        length = 6
        issues.append("Resume is very short; add more detail about projects and impact.")
    else:
        length = 2
        issues.append("Resume length is far from the ideal 300-900 words.")
    add("length", length, 15)

    metrics = len(_METRIC_RE.findall(raw_text))
    quant = 10 if metrics >= 3 else 5 if metrics >= 1 else 0
    if metrics < 3:
        issues.append("Quantify achievements (e.g. 'reduced load time by 40%').")
    add("quantified_impact", quant, 10)

    lower_words = set(re.findall(r"[a-z]+", (raw_text or "").lower()))
    verbs = len(lower_words & ACTION_VERBS)
    verb_score = 10 if verbs >= 5 else 5 if verbs >= 2 else 0
    if verbs < 5:
        issues.append("Start bullet points with strong action verbs (built, led, optimized...).")
    add("action_verbs", verb_score, 10)

    bullets = sum(1 for l in (raw_text or "").splitlines() if _BULLET_RE.match(l))
    add("bullet_points", 5 if bullets >= 4 else 2 if bullets >= 1 else 0, 5)
    if bullets < 4:
        issues.append("Use bullet points to make achievements easy to scan.")

    add("projects", 5 if sections.get("projects") else 0, 5)
    if not sections.get("projects"):
        issues.append("Add a Projects section to show practical work.")

    total = sum(v["score"] for v in b.values())
    return {"score": max(0, min(100, total)), "breakdown": b, "issues": issues, "word_count": words}


def calculate_base_ats_score(raw_text: str, sections: Optional[Dict[str, bool]] = None) -> int:
    return evaluate_ats(raw_text, sections)["score"]


# --------------------------------------------------------------------------- match score
def _vocab_similarity(resume_clean: str, jd_clean: str) -> float:
    try:
        vec = CountVectorizer(stop_words="english", ngram_range=(1, 2))
        m = vec.fit_transform([resume_clean, jd_clean])
        return float(cosine_similarity(m[0:1], m[1:2])[0][0]) * 100.0
    except ValueError:  # empty vocabulary
        return 0.0


def calculate_similarity_score(resume_raw: str, jd_raw: str) -> Dict[str, Any]:
    resume_lower = (resume_raw or "").lower()
    jd_skills = extract_skills(jd_raw)
    resume_skills = set(extract_skills(resume_raw))
    matched_skills = [s for s in jd_skills if s in resume_skills]
    missing_skills = [s for s in jd_skills if s not in resume_skills]

    phrases = domain_phrases(jd_raw, 12)
    matched_phrases = [p for p in phrases if phrase_in_text(p, resume_lower)]
    missing_phrases = [p for p in phrases if p not in matched_phrases]

    sim_raw = _vocab_similarity(clean_text(resume_raw), clean_text(jd_raw))
    sim = min(100.0, sim_raw * 1.6)  # raw cosine of two different documents is naturally low

    parts: List[tuple] = []  # (weight, value)
    skill_cov = (len(matched_skills) / len(jd_skills) * 100.0) if jd_skills else None
    phrase_cov = (len(matched_phrases) / len(phrases) * 100.0) if len(phrases) >= 3 else None
    if skill_cov is not None:
        parts.append((0.65, skill_cov))
    if phrase_cov is not None:
        parts.append((0.20, phrase_cov))
    parts.append((0.15 if parts else 1.0, sim))
    total_w = sum(w for w, _ in parts)
    score = sum(w * v for w, v in parts) / total_w

    return {
        "score": round(max(0.0, min(100.0, score)), 1),
        "skill_coverage": round(skill_cov, 1) if skill_cov is not None else None,
        "phrase_coverage": round(phrase_cov, 1) if phrase_cov is not None else None,
        "text_similarity": round(sim, 1),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "matched_phrases": matched_phrases,
        "missing_phrases": missing_phrases,
        "resume_skills": sorted(resume_skills),
        "jd_skills": jd_skills,
    }


def _feedback(score: float) -> str:
    if score >= 70:
        return "Strong match! Your resume covers the core skills and responsibilities this role asks for."
    if score >= 50:
        return "Moderate match. Your background fits the domain, but several skills from the job description are missing."
    return "Low match. Important skills and keywords from the job description are absent from your resume."


def build_suggestions(match: Dict[str, Any], ats: Dict[str, Any]) -> List[str]:
    tips: List[str] = []
    missing = match["missing_skills"]
    if missing:
        top = ", ".join(missing[:5])
        tips.append(f"Add the missing skills you genuinely have ({top}) to your Skills section and project bullets.")
    if match["missing_phrases"]:
        tips.append("Mirror the job description's wording, e.g. " + ", ".join(match["missing_phrases"][:3]) + ".")
    tips.extend(ats["issues"][:4])
    return tips[:8]


def analyze_resume_match(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """Full pipeline used by /analyze_resume."""
    match = calculate_similarity_score(resume_text, jd_text)
    sections = extract_section_analysis(resume_text)
    ats = evaluate_ats(resume_text, sections)
    score = match["score"]
    overall = round(0.7 * score + 0.3 * ats["score"], 1)

    return {
        "score": score,
        "base_score": ats["score"],
        "overall_score": overall,
        "section_analysis": sections,
        "matched_keywords": (match["matched_skills"] + match["matched_phrases"])[:25],
        "missing_keywords": (match["missing_skills"] + match["missing_phrases"])[:25],
        "matched_skills": match["matched_skills"],
        "missing_skills": match["missing_skills"],
        "resume_skills": match["resume_skills"],
        "skills_by_category": _group_by_category(match["resume_skills"]),
        "breakdown": {
            "skill_coverage": match["skill_coverage"],
            "phrase_coverage": match["phrase_coverage"],
            "text_similarity": match["text_similarity"],
            "ats": ats["breakdown"],
        },
        "ats_issues": ats["issues"],
        "suggestions": build_suggestions(match, ats),
        "word_count": ats["word_count"],
        "feedback": _feedback(score),
    }


def _group_by_category(skills: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for s in skills:
        out.setdefault(skill_category(s), []).append(s)
    return out
