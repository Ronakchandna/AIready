import json

from core import llm

RESUME = ("Jane Roe\njane@example.com | +1 555 123 4567\n\nSummary\nBackend engineer.\n\nExperience\n"
          "- Built Python and FastAPI services, cut latency by 30%.\n\nEducation\nB.Tech Computer Science 2020\n\n"
          "Skills\nPython, FastAPI, Docker, PostgreSQL")
JD = "Python developer with FastAPI, Docker and PostgreSQL experience."


def test_public_endpoints(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/").status_code == 200
    assert client.get("/ui").status_code == 200


def test_auth_required(client):
    r = client.post("/extract_keywords", json={"job_description": JD})
    assert r.status_code == 401 and r.json()["success"] is False
    r = client.post("/extract_keywords", json={"job_description": JD}, headers={"x-api-key": "wrong"})
    assert r.status_code == 401


def test_analyze_with_text(client, auth):
    r = client.post("/analyze_resume", data={"job_description": JD, "resume_text": RESUME}, headers=auth)
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["score"] > 60 and "Python" in d["matched_skills"]


def test_client_errors_are_not_500(client, auth):
    assert client.post("/analyze_resume", data={"job_description": JD}, headers=auth).status_code == 400
    assert client.post("/analyze_resume", data={"job_description": "  ", "resume_text": RESUME}, headers=auth).status_code == 400
    bad = client.post("/analyze_resume", data={"job_description": JD}, headers=auth,
                      files={"resume_file": ("cv.pdf", b"not a pdf", "application/pdf")})
    assert bad.status_code == 400
    txt = client.post("/parse_resume", headers=auth, files={"file": ("cv.txt", b"hello", "text/plain")})
    assert txt.status_code == 400
    assert client.post("/generate_questions", json={"job_description": JD, "num_questions": 999}, headers=auth).status_code == 422
    assert client.post("/enhance_bullet", json={"bullet_point": "   "}, headers=auth).status_code == 422


def test_pdf_upload_without_pdf_extension(client, auth):
    """Phones often send 'document' with no extension: the PDF signature decides, not the name."""
    import fitz
    doc = fitz.open()
    doc.new_page().insert_text((72, 72), RESUME, fontsize=10)
    pdf = doc.tobytes()
    r = client.post("/analyze_resume", data={"job_description": JD}, headers=auth,
                    files={"resume_file": ("document", pdf, "application/octet-stream")})
    assert r.status_code == 200 and "Python" in r.json()["data"]["matched_skills"]


def test_offline_fallback_is_honest(client, auth):
    r = client.post("/enhance_bullet", json={"bullet_point": "worked on the website"}, headers=auth).json()
    assert r["success"] and r["fallback"] is True and r["ai_used"] is False and "warning" in r
    assert r["enhanced_bullet"].startswith("Contributed to")

    rank = client.post("/evaluate_global_rank", json={"resume_text": RESUME}, headers=auth).json()
    assert rank["fallback"] is True and 0 <= rank["data"]["rankScore"] <= 100

    letter = client.post("/generate_cover_letter", json={"resume_text": RESUME, "job_description": JD}, headers=auth).json()
    assert "Jane Roe" in letter["cover_letter"] and "Python" in letter["cover_letter"]

    qs = client.post("/generate_questions", json={"job_description": JD, "num_questions": 4}, headers=auth).json()
    assert len(qs["questions"]) == 4 and qs["fallback"] is True

    ev = client.post("/evaluate_answer", json={"question": "Why Python?", "user_answer": "x"}, headers=auth).json()
    assert ev["data"]["score"] < 50


def test_llm_success_path(client, auth, monkeypatch):
    monkeypatch.setattr(llm, "complete", lambda *a, **k: "Optimized API latency by 30% using caching.")
    r = client.post("/enhance_bullet", json={"bullet_point": "made api faster"}, headers=auth).json()
    assert r["ai_used"] is True and r["fallback"] is False and r["enhanced_bullet"].startswith("Optimized")


def test_llm_json_validation_falls_back(client, auth, monkeypatch):
    monkeypatch.setattr(llm, "complete", lambda *a, **k: "this is not json")
    monkeypatch.setattr(llm, "is_configured", lambda: True)
    r = client.post("/evaluate_global_rank", json={"resume_text": RESUME}, headers=auth).json()
    assert r["fallback"] is True


def test_llm_valid_json_is_clamped(client, auth, monkeypatch):
    payload = json.dumps({"totalYearsExperience": 999, "educationTier": "masters", "skillRarity": 50,
                          "impactMetricsCount": 3, "projectComplexity": 0})
    monkeypatch.setattr(llm, "complete", lambda *a, **k: payload)
    d = client.post("/evaluate_global_rank", json={"resume_text": RESUME}, headers=auth).json()["data"]
    assert d["totalYearsExperience"] == 50 and d["educationTier"] == "Masters"
    assert d["skillRarity"] == 10 and d["projectComplexity"] == 1


def test_ssrf_url_is_blocked_but_request_succeeds(client, auth):
    r = client.post("/generate_questions", headers=auth,
                    json={"job_description": JD, "num_questions": 2, "resume_url": "http://127.0.0.1:9/cv.pdf"})
    assert r.status_code == 200
    assert "Resume URL ignored" in r.json()["input_warning"]


def test_career_chat_fallback_and_validation(client, auth):
    msgs = [{"role": "user", "content": "How do I negotiate my salary offer?"}]
    r = client.post("/career_chat", json={"messages": msgs}, headers=auth).json()
    assert r["success"] and r["fallback"] is True and "negotiat" in r["reply"].lower()

    # last message must be from the user; roles are restricted; empty list rejected
    bad = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}]
    assert client.post("/career_chat", json={"messages": bad}, headers=auth).status_code == 422
    assert client.post("/career_chat", json={"messages": [{"role": "system", "content": "x"}]}, headers=auth).status_code == 422
    assert client.post("/career_chat", json={"messages": []}, headers=auth).status_code == 422
    assert client.post("/career_chat", json={"messages": msgs}).status_code == 401


def test_career_chat_uses_history_and_resume(client, auth, monkeypatch):
    seen = {}

    def fake_chat(system, history, **kw):
        seen["system"], seen["history"] = system, history
        return "Focus on Kubernetes next."

    monkeypatch.setattr(llm, "chat", fake_chat)
    msgs = [{"role": "user", "content": "What should I learn?"}, {"role": "assistant", "content": "What role?"},
            {"role": "user", "content": "DevOps"}]
    r = client.post("/career_chat", json={"messages": msgs, "resume_text": RESUME}, headers=auth).json()
    assert r["ai_used"] is True and r["reply"] == "Focus on Kubernetes next."
    assert "<resume>" in seen["system"] and "Jane Roe" in seen["system"]
    assert [m["role"] for m in seen["history"]] == ["user", "assistant", "user"]


def test_ai_insights_flag_without_llm(client, auth):
    r = client.post("/analyze_resume", data={"job_description": JD, "resume_text": RESUME, "use_ai": "true"}, headers=auth).json()
    assert r["ai_used"] is False and r["data"]["ai_suggestions"] is None
