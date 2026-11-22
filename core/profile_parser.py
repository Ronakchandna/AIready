"""Offline (no-LLM) resume parsing, plus normalisation of LLM-produced profiles."""
import re
from typing import Any, Dict, List, Optional

from core.analyzer import _EMAIL_RE, _SECTION_RE
from core.skills import extract_skills

_PHONE = re.compile(r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,5}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?!\d)")
_LINKEDIN = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/[^\s,|;)]+", re.IGNORECASE)
_PORTFOLIO = re.compile(r"(?:https?://)?(?:www\.)?(?:github\.com|gitlab\.com|[\w-]+\.(?:dev|io|me|xyz|vercel\.app|netlify\.app))/?[^\s,|;)]*", re.IGNORECASE)
_YEAR = re.compile(r"(?:19|20)\d{2}")
_BULLET = re.compile(r"^\s*(?:[-•*▪●·–]|\d+[.)])\s*")

EMPTY_PROFILE: Dict[str, Any] = {
    "contact": {"fullName": "", "email": "", "phone": "", "linkedin": "", "portfolio": ""},
    "summary": "", "experience": [], "education": [], "projects": [], "skills": [],
}


def split_sections(text: str) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {"_top": []}
    current = "_top"
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        key = None
        if len(s) <= 60:
            for name, rx in _SECTION_RE.items():
                if rx.search(s):
                    key = name
                    break
        if key:
            current = key
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(s)
    return sections


def heuristic_profile(text: str) -> Dict[str, Any]:
    secs = split_sections(text)
    top = secs.get("_top", [])
    profile = {k: (dict(v) if isinstance(v, dict) else list(v) if isinstance(v, list) else v)
               for k, v in EMPTY_PROFILE.items()}

    name = ""
    for line in top[:5]:
        if "@" not in line and not re.search(r"\d", line) and 1 <= len(line.split()) <= 5:
            name = line.strip()
            break
    email = _EMAIL_RE.search(text)
    phone = _PHONE.search(text)
    li = _LINKEDIN.search(text)
    pf = next((m for m in _PORTFOLIO.finditer(text) if "linkedin" not in m.group(0).lower()), None)
    profile["contact"] = {
        "fullName": name,
        "email": email.group(0) if email else "",
        "phone": phone.group(0).strip() if phone else "",
        "linkedin": li.group(0) if li else "",
        "portfolio": pf.group(0) if pf else "",
    }
    profile["summary"] = " ".join(secs.get("summary", []))[:700]

    exp = secs.get("experience", [])
    if exp:
        years = _YEAR.findall(" ".join(exp[:3]))
        profile["experience"] = [{
            "id": "exp-1", "company": "", "role": exp[0] if len(exp[0]) < 80 else "",
            "startDate": years[0] if years else "", "endDate": years[1] if len(years) > 1 else "",
            "description": "\n".join(_BULLET.sub("", l) for l in exp[1:] if l),
        }]
    edu = secs.get("education", [])
    if edu:
        years = _YEAR.findall(" ".join(edu))
        profile["education"] = [{
            "id": "edu-1", "institution": edu[0], "degree": edu[1] if len(edu) > 1 else "",
            "year": years[-1] if years else "",
        }]
    proj = secs.get("projects", [])
    if proj:
        profile["projects"] = [{"id": "proj-1", "title": proj[0][:80], "link": "",
                                "description": "\n".join(_BULLET.sub("", l) for l in proj[1:])}]
    profile["skills"] = extract_skills(text)
    return profile


def normalize_profile(data: Any) -> Dict[str, Any]:
    """Coerce an LLM profile into the exact expected schema (raises ValueError if unusable)."""
    if not isinstance(data, dict):
        raise ValueError("profile is not an object")

    def s(v: Any) -> str:
        return v.strip() if isinstance(v, str) else ("" if v is None else str(v))

    def lst(key: str, fields: List[str], prefix: str) -> List[Dict[str, str]]:
        out = []
        for i, item in enumerate(data.get(key) or [], 1):
            if isinstance(item, dict):
                row = {f: s(item.get(f)) for f in fields}
                row["id"] = row.get("id") or f"{prefix}-{i}"
                out.append(row)
        return out

    contact = data.get("contact") if isinstance(data.get("contact"), dict) else {}
    skills = data.get("skills") if isinstance(data.get("skills"), list) else []
    return {
        "contact": {k: s(contact.get(k)) for k in EMPTY_PROFILE["contact"]},
        "summary": s(data.get("summary")),
        "experience": lst("experience", ["id", "company", "role", "startDate", "endDate", "description"], "exp"),
        "education": lst("education", ["id", "institution", "degree", "year"], "edu"),
        "projects": lst("projects", ["id", "title", "link", "description"], "proj"),
        "skills": [s(x) for x in skills if s(x)][:60],
    }
