from core.analyzer import analyze_resume_match, evaluate_ats, extract_keywords, extract_section_analysis
from core.skills import extract_skills

RESUME = """
John Doe
john.doe@email.com | 123-456-7890 | github.com/johndoe

Professional Summary
Experienced Full Stack Software Engineer with 5 years in Python, React, and PostgreSQL.

Work Experience
Senior Software Engineer at Acme Corp (2021 - Present)
- Developed microservices in Python and FastAPI, reducing latency by 40%.
- Designed scalable React user interfaces with Redux.
- Managed Docker deployments on AWS.

Education
Bachelor of Science in Computer Science, University of Technology (2017 - 2021)

Technical Skills
Python, FastAPI, React, JavaScript, Docker, AWS, PostgreSQL, MongoDB, Git
"""

JD = """
We are looking for a Senior Python Developer with strong React and PostgreSQL skills.
Requirements:
- 3+ years experience with Python and FastAPI or Django
- Hands-on React frontend experience
- Proficiency with Docker and AWS cloud services
- Strong database design skills in PostgreSQL
"""


def test_matching_resume_scores_high():
    r = analyze_resume_match(RESUME, JD)
    assert r["score"] > 60
    assert {"Python", "React", "PostgreSQL", "Docker", "AWS"} <= set(r["matched_skills"])
    assert "Django" in r["missing_skills"]
    assert 0 <= r["base_score"] <= 100 and 0 <= r["overall_score"] <= 100


def test_unrelated_resume_scores_low():
    chef = "Head chef with 10 years of experience in French cuisine, menu design and kitchen management."
    assert analyze_resume_match(chef, JD)["score"] < 30


def test_sections_detected():
    s = extract_section_analysis(RESUME)
    assert s["experience"] and s["education"] and s["skills"] and s["summary"]
    assert not s["projects"]


def test_incidental_words_are_not_headers():
    s = extract_section_analysis("I have education and a lot of experience in many skills.")
    assert not any(s.values())


def test_skill_extraction_keeps_special_names_and_is_word_exact():
    skills = extract_skills("Built apps in C++, C# and Node.js. Strong JavaScript developer. Used CI/CD.")
    assert {"C++", "C#", "Node.js", "JavaScript", "CI/CD"} <= set(skills)
    assert "Java" not in skills  # 'java' must not match inside 'JavaScript'
    assert "Go" not in extract_skills("We want people ready to go the extra mile")


def test_synonyms_map_to_one_skill():
    assert extract_skills("k8s and Postgres and ReactJS") == ["Kubernetes", "PostgreSQL", "React"]


def test_ats_rewards_contact_info_and_penalises_gaps():
    good = evaluate_ats(RESUME)
    bare = evaluate_ats("some words only")
    assert good["score"] > bare["score"]
    assert any("email" in i.lower() for i in bare["issues"])


def test_extract_keywords_returns_skills_first():
    kws = extract_keywords(JD)
    assert "Python" in kws[:8]


def test_empty_inputs_do_not_crash():
    r = analyze_resume_match("x", "y")
    assert r["score"] >= 0


def test_phone_detection_formats():
    from core.analyzer import _has_phone
    found = ["+91 98765 43210", "(555) 123-4567", "+1 555 123 4567", "9876543210", "555.123.4567",
             "phone: 98765 43210\n2019 - 2021"]
    not_found = ["Jan 2019 - Mar 2022", "2019 - 2023", "B.Tech 2020, CGPA 8.5", "reduced latency by 30% for 12000 users"]
    assert all(_has_phone(t) for t in found), [t for t in found if not _has_phone(t)]
    assert not any(_has_phone(t) for t in not_found), [t for t in not_found if _has_phone(t)]
