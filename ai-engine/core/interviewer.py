"""Interview question generation and answer evaluation (rule-based engine used when the LLM is unavailable)."""
import random
import re
from typing import Dict, List, Optional

from core.skills import extract_skills

BEHAVIORAL = [
    "Tell me about yourself and what drew you to this role.",
    "Describe a time you faced a difficult challenge at work or in a project and how you overcame it.",
    "Tell me about a time you disagreed with a teammate. How did you handle it?",
    "Describe a situation where you had to learn a new technology quickly.",
    "What accomplishment are you most proud of, and why?",
    "Tell me about a time you missed a deadline or made a mistake. What did you learn?",
]

TECHNICAL_TEMPLATES = [
    "Can you walk me through a project where you used {s}? What was your specific contribution?",
    "What are the common pitfalls or best practices when working with {s}?",
    "How would you decide whether {s} is the right choice for a new feature? Which trade-offs matter?",
    "Describe a bug or performance issue you debugged involving {s}. How did you find the root cause?",
    "How would you explain {s} to a teammate who has never used it?",
]


def extract_key_skills_from_jd(jd_text: str, limit: int = 10) -> List[str]:
    return extract_skills(jd_text)[:limit]


def generate_interview_questions(job_description: str, num_questions: int = 5, seed: Optional[int] = None) -> List[str]:
    """Mix of role-specific technical questions (from the JD's skills) and behavioural questions."""
    rng = random.Random(seed)
    num_questions = max(1, num_questions)
    skills = [s for s in extract_key_skills_from_jd(job_description) if s not in {"Communication", "Teamwork", "Leadership", "Problem Solving", "Agile"}]
    num_general = min(2, num_questions) if skills else num_questions
    num_technical = min(num_questions - num_general, len(skills))

    questions: List[str] = []
    templates = TECHNICAL_TEMPLATES[:]
    rng.shuffle(templates)
    for i in range(num_technical):
        questions.append(templates[i % len(templates)].format(s=skills[i]))

    pool = BEHAVIORAL[:]
    rng.shuffle(pool)
    questions.extend(pool[: num_questions - len(questions)])
    # still short (num_questions > available)? stop - never repeat or invent filler
    return questions[:num_questions]


_STAR = {
    "situation": r"\b(situation|context|background|when i|at my|in my (?:previous|last)|our team|the project|we were)\b",
    "task": r"\b(task|goal|objective|responsib\w+|needed to|had to|my role|assigned|required)\b",
    "action": r"\b(i (?:built|designed|implemented|created|led|decided|wrote|developed|analy[sz]ed|organi[sz]ed|fixed|proposed|worked)|i \w+ed)\b",
    "result": r"\b(result|outcome|as a result|improved|reduced|increased|achieved|delivered|saved|learn(?:ed|t)|impact)\b",
}
_METRIC = re.compile(r"\d+(?:[.,]\d+)?\s?(?:%|x\b|k\b|percent|ms\b|hours?|days?|users|customers)|[$₹€£]\s?\d", re.IGNORECASE)
_FILLER = re.compile(r"\b(um+|uh+|like|you know|basically|kind of|sort of|stuff|things)\b", re.IGNORECASE)
_STOP = set("a an the and or of to in for on with is are was were be been it this that how what why when your you do does did can could would should about me my i we they as at by from".split())


def _content_words(text: str) -> set:
    return {w for w in re.findall(r"[a-z0-9+#.]{3,}", text.lower()) if w not in _STOP}


def evaluate_answer(question: str, user_answer: str, expected_keywords: Optional[List[str]] = None) -> Dict:
    """Transparent rubric (0-100): length, STAR structure, evidence, relevance, keywords, clarity."""
    answer = (user_answer or "").strip()
    words = re.findall(r"[A-Za-z0-9+#'-]+", answer)
    wc = len(words)
    low = answer.lower()
    if wc == 0:
        return {"score": 0, "feedback": "No answer provided.", "matched_keywords": [],
                "breakdown": {}, "strengths": [], "improvements": ["Write an answer before requesting feedback."]}

    unique_ratio = len({w.lower() for w in words}) / wc
    alpha_ratio = sum(c.isalpha() or c.isspace() for c in answer) / max(len(answer), 1)
    gibberish = wc >= 5 and (unique_ratio < 0.35 or alpha_ratio < 0.6)

    # length (20)
    if wc < 15:
        length = 4
    elif wc < 40:
        length = 10
    elif wc <= 180:
        length = 20
    else:
        length = 14
    # STAR structure (30)
    star_hits = [k for k, rx in _STAR.items() if re.search(rx, low)]
    star = len(star_hits) * 7 + (2 if len(star_hits) == 4 else 0)
    # evidence (15)
    metrics = len(_METRIC.findall(answer))
    evidence = 15 if metrics >= 2 else 9 if metrics == 1 else 0
    # relevance to the question (15)
    q_words = _content_words(question)
    overlap = len(q_words & _content_words(answer)) / max(len(q_words), 1)
    relevance = round(min(1.0, overlap * 2.0) * 15)
    # keywords (10)
    kws = [k for k in (expected_keywords or []) if k.strip()]
    matched = [k for k in kws if re.search(r"(?<![A-Za-z0-9])" + re.escape(k.lower()) + r"(?![A-Za-z0-9])", low)]
    keyword = round(len(matched) / len(kws) * 10) if kws else 5
    # clarity (10)
    fillers = len(_FILLER.findall(answer))
    clarity = max(0, 10 - fillers * 2)

    score = length + star + evidence + relevance + keyword + clarity
    if gibberish:
        score = min(score, 15)
    score = int(max(0, min(100, score)))

    strengths, improvements = [], []
    if wc >= 40:
        strengths.append("Good level of detail.")
    if len(star_hits) >= 3:
        strengths.append("Clear structure (Situation, Task, Action, Result).")
    if metrics:
        strengths.append("You backed claims with measurable results.")
    if matched:
        strengths.append("Covered relevant keywords: " + ", ".join(matched) + ".")
    if wc < 40:
        improvements.append("Add more detail; aim for 60-150 words.")
    if wc > 180:
        improvements.append("Be more concise; focus on the most relevant points.")
    for part in ("situation", "task", "action", "result"):
        if part not in star_hits:
            improvements.append(f"Make the {part.title()} part of your story explicit (STAR method).")
    if not metrics:
        improvements.append("Include a concrete number or outcome (e.g. 'cut response time by 30%').")
    missed = [k for k in kws if k not in matched]
    if missed:
        improvements.append("Consider mentioning: " + ", ".join(missed[:5]) + ".")
    if fillers >= 2:
        improvements.append("Reduce filler words to sound more confident.")
    if gibberish:
        improvements = ["This answer looks repetitive or unclear. Write a real, specific example."]

    feedback = (strengths[0] if strengths else "Your answer needs more substance.")
    if improvements:
        feedback += " " + improvements[0]
    return {
        "score": score,
        "feedback": feedback,
        "matched_keywords": matched,
        "breakdown": {"length": length, "structure": star, "evidence": evidence,
                      "relevance": relevance, "keywords": keyword, "clarity": clarity},
        "strengths": strengths,
        "improvements": improvements[:5],
    }
