from core.interviewer import evaluate_answer, generate_interview_questions

Q = "Tell me about a time you improved the performance of a system."
GOOD = ("In my last project our team had a slow API, so my task was to cut response time. I profiled the "
        "service, added Redis caching and rewrote two queries. As a result latency dropped by 45% and we "
        "handled 3x more users, and I learned to measure before optimising.")


def test_good_answer_beats_gibberish_and_short():
    good = evaluate_answer(Q, GOOD, ["Redis", "caching"])
    junk = evaluate_answer(Q, "asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf")
    short = evaluate_answer(Q, "I made it faster.")
    assert good["score"] >= 70
    assert junk["score"] <= 15
    assert short["score"] < good["score"]
    assert good["matched_keywords"] == ["Redis", "caching"]


def test_empty_answer_scores_zero():
    assert evaluate_answer(Q, "   ")["score"] == 0


def test_questions_use_jd_skills_and_respect_count():
    qs = generate_interview_questions("Looking for a Python and Docker engineer with PostgreSQL.", 5, seed=1)
    assert len(qs) == 5 and len(set(qs)) == 5
    assert any("Python" in q or "Docker" in q or "PostgreSQL" in q for q in qs)


def test_questions_without_skills_are_behavioural():
    qs = generate_interview_questions("Friendly person wanted", 3, seed=1)
    assert len(qs) == 3
