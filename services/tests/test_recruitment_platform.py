from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from services.candidate_service.main import app as candidate_app
from services.common.database import init_db
from services.common.parser import (
    extract_experience_years,
    extract_skills_from_text,
    parse_job_description,
)
from services.common.scoring import calculate_resume_score
from services.common.security import hash_password, verify_password
from services.recruiter_service.main import app as recruiter_app

import os
from services.common.config import get_settings

@pytest.fixture(autouse=True)
def setup_database():
    import asyncio
    settings = get_settings()
    test_db = str(settings.db_path).replace("recruitment.db", "test_recruitment.db")
    settings.db_path = test_db
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except Exception:
            pass
    asyncio.run(init_db())

# ── 1. Security & Core Engine Tests ──────────────────────────────────────────

def test_password_hashing():
    pw = "supersecret123"
    hashed = hash_password(pw)
    assert hashed.startswith("pbkdf2:sha256:100000$")
    assert verify_password(pw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_resume_parser_skills_and_exp():
    text = """
    Software Engineer with 4.5 years of experience in Python, FastAPI, React, and LiveKit WebRTC.
    Built distributed LLM agent systems and PostgreSQL data layers.
    """
    skills = extract_skills_from_text(text)
    assert "Python" in skills
    assert "FastAPI" in skills
    assert "React" in skills
    assert "LiveKit" in skills
    assert "PostgreSQL" in skills

    exp = extract_experience_years(text)
    assert exp == 4.5

def test_explainable_resume_scoring():
    cand_skills = ["Python", "FastAPI", "React", "LiveKit", "Docker"]
    cand_exp = 5.0
    cand_edu = [{"degree": "B.S. in Computer Science"}]
    cand_text = "5 years experience building FastAPI and LiveKit WebRTC systems."

    jd_skills = ["Python", "FastAPI", "LiveKit", "TypeScript", "PostgreSQL"]
    jd_min_exp = 3.0
    jd_text = "Looking for Senior Engineer with Python, FastAPI, LiveKit experience."

    overall, s_score, e_score, ed_score, r_score, breakdown, explanation, is_eligible = calculate_resume_score(
        candidate_skills=cand_skills,
        candidate_years_exp=cand_exp,
        candidate_education=cand_edu,
        candidate_raw_text=cand_text,
        jd_skills=jd_skills,
        jd_min_years_exp=jd_min_exp,
        jd_raw_text=jd_text
    )

    assert overall > 70.0
    assert "Python" in breakdown.matched_skills
    assert "FastAPI" in breakdown.matched_skills
    assert "TypeScript" in breakdown.missing_skills
    assert len(breakdown.strengths) >= 1
    assert is_eligible is True
    assert "Matched" in explanation

# ── 2. Recruiter Service API Tests ───────────────────────────────────────────

def test_recruiter_flow_and_top_k():
    client = TestClient(recruiter_app)

    # 1. Login with seeded demo recruiter
    login_res = client.post("/api/recruiter/auth/login", json={
        "email": "recruiter@example.com",
        "password": "password123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get profile
    me_res = client.get("/api/recruiter/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "recruiter@example.com"

    # 3. Create a new job opening
    create_job_res = client.post("/api/recruiter/jobs", headers=headers, json={
        "title": "Autonomous Agent Systems Architect",
        "department": "Core AI",
        "location": "San Francisco, CA",
        "job_type": "Full-time",
        "experience_level": "Senior",
        "min_experience_years": 4.0,
        "salary_range": "$190k - $240k",
        "description": "Seeking an Autonomous Agent Architect with strong expertise in Python, FastAPI, LiveKit, WebRTC, and LangGraph.",
        "requirements": "Python, FastAPI, LiveKit, WebRTC, LangGraph, Docker",
        "top_k": 3
    })
    assert create_job_res.status_code == 201
    job_id = create_job_res.json()["id"]
    assert create_job_res.json()["top_k"] == 3

    # 4. List jobs
    jobs_res = client.get("/api/recruiter/jobs", headers=headers)
    assert jobs_res.status_code == 200
    assert len(jobs_res.json()) >= 1

    # 5. Check applicants for seeded Job 1
    seeded_job_id = "job_ai_engineer_01"
    applicants_res = client.get(f"/api/recruiter/jobs/{seeded_job_id}/applicants", headers=headers)
    assert applicants_res.status_code == 200
    apps = applicants_res.json()
    assert len(apps) >= 2

    # 6. Run Top-K shortlisting on seeded Job 1
    topk_res = client.post(f"/api/recruiter/jobs/{seeded_job_id}/top-k", headers=headers, json={
        "job_id": seeded_job_id,
        "top_k": 2
    })
    assert topk_res.status_code == 200
    topk_data = topk_res.json()
    assert len(topk_data["shortlisted_candidates"]) <= 2

    # 7. Manual override on an applicant
    target_app_id = apps[0]["id"]
    override_res = client.post(f"/api/recruiter/applicants/{target_app_id}/override", headers=headers, json={
        "target_status": "shortlisted",
        "override_reason": "Executive referral with exceptional production voice agent expertise"
    })
    assert override_res.status_code == 200
    assert override_res.json()["status"] == "shortlisted"
    assert override_res.json()["manual_override"] is True

    # 8. Schedule Interview for applicant
    schedule_res = client.post("/api/recruiter/interviews/schedule", headers=headers, json={
        "application_id": target_app_id,
        "scheduled_start": "2026-11-01T15:00:00Z",
        "duration_minutes": 45,
        "timezone": "UTC",
        "recruiter_notes": "Validate low-latency audio packet processing."
    })
    assert schedule_res.status_code == 201
    session_data = schedule_res.json()
    assert session_data["status"] == "scheduled"
    assert session_data["secure_link"].startswith("http")

    # 9. Scheduling conflict detection test
    conflict_res = client.post("/api/recruiter/interviews/schedule", headers=headers, json={
        "application_id": target_app_id,
        "scheduled_start": "2026-11-01T15:15:00Z", # Overlaps with 15:00 - 15:45
        "duration_minutes": 45,
        "timezone": "UTC"
    })
    assert conflict_res.status_code == 409

    # 10. Analytics
    analytics_res = client.get("/api/recruiter/analytics", headers=headers)
    assert analytics_res.status_code == 200
    analytics = analytics_res.json()
    assert analytics["total_jobs"] >= 1
    assert "funnel" in analytics

# ── 3. Candidate Service API Tests ───────────────────────────────────────────

def test_candidate_flow_and_duplicate_prevention():
    client = TestClient(candidate_app)

    # 1. Login with seeded candidate
    login_res = client.post("/api/candidate/auth/login", json={
        "email": "alex.morgan@example.com",
        "password": "password123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Browse published jobs
    jobs_res = client.get("/api/candidate/jobs")
    assert jobs_res.status_code == 200
    assert len(jobs_res.json()) >= 1

    # Search jobs
    search_res = client.get("/api/candidate/jobs?q=Systems")
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1

    # 3. Duplicate application check: Alex Morgan already applied to job_ai_engineer_01
    dup_res = client.post("/api/candidate/jobs/job_ai_engineer_01/apply", headers=headers, json={
        "job_id": "job_ai_engineer_01",
        "cover_letter": "I want to apply again."
    })
    assert dup_res.status_code == 409
    assert "Duplicate applications are not permitted" in dup_res.json()["detail"]

    # 4. Apply to Job 2 (Full-stack AI Developer)
    job2_id = "job_fullstack_02"
    apply_res = client.post(f"/api/candidate/jobs/{job2_id}/apply", headers=headers, json={
        "job_id": job2_id,
        "cover_letter": "Excited to bring my full-stack real-time background to this position."
    })
    assert apply_res.status_code == 201
    app_data = apply_res.json()
    assert app_data["status"] == "applied"
    assert app_data["score"] is not None
    assert app_data["score"]["overall_score"] > 0

    # 5. List applications
    my_apps_res = client.get("/api/candidate/applications", headers=headers)
    assert my_apps_res.status_code == 200
    assert len(my_apps_res.json()) >= 2

    # 6. View scheduled interviews
    interviews_res = client.get("/api/candidate/interviews", headers=headers)
    assert interviews_res.status_code == 200
    sessions = interviews_res.json()
    assert len(sessions) >= 1
    assert "secure_link" in sessions[0]

def test_candidate_photo_upload_and_enriched_resume_parsing():
    candidate_client = TestClient(candidate_app)
    recruiter_client = TestClient(recruiter_app)

    # 1. Login as candidate
    cand_login = candidate_client.post("/api/candidate/auth/login", json={
        "email": "alex.morgan@example.com",
        "password": "password123"
    })
    assert cand_login.status_code == 200
    cand_token = cand_login.json()["access_token"]
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    # 2. Upload photo (1x1 valid PNG)
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\r\xefUe\x00\x00\x00\x00IEND\xaeB`\x82"
    upload_photo_res = candidate_client.post(
        "/api/candidate/photo/upload",
        headers=cand_headers,
        files={"photo": ("avatar.png", png_bytes, "image/png")}
    )
    assert upload_photo_res.status_code == 200
    avatar_url = upload_photo_res.json()["avatar_url"]
    assert avatar_url.startswith("/api/candidate/photo/")

    # 3. Retrieve uploaded photo
    photo_file_url = avatar_url
    get_photo_res = candidate_client.get(photo_file_url)
    assert get_photo_res.status_code == 200
    assert get_photo_res.content == png_bytes
    assert "image/png" in get_photo_res.headers["content-type"]

    # 4. Verify /me endpoint includes avatar_url
    me_res = candidate_client.get("/api/candidate/auth/me", headers=cand_headers)
    assert me_res.status_code == 200
    assert me_res.json()["avatar_url"] == avatar_url

    # 5. Upload rich resume with college, experience, projects, achievements
    rich_resume_text = """
    ALEX MORGAN
    alex.morgan@example.com | (555) 234-5678 | San Francisco, CA

    EDUCATION & COLLEGE INFO:
    Stanford University
    B.S. in Computer Science
    Graduation: 2024 | GPA: 3.92

    EXPERIENCE:
    AI Software Engineering Intern - Google
    June 2023 - September 2023
    - Architected low-latency streaming pipeline using FastAPI and WebRTC.
    - Optimized model inferencing latency by 45%.

    PROJECTS:
    Autonomous Interview Agent
    Technologies: Python, LiveKit, FastAPI, WebSockets
    - Developed real-time multimodal voice interview platform.
    - Link: https://github.com/example/interview-agent

    ACHIEVEMENTS & AWARDS:
    - 1st Place Winner - HackMIT 2023
    - AWS Certified Solutions Architect Associate
    - Dean's Honor Roll for academic excellence
    """

    resume_res = candidate_client.post(
        "/api/candidate/resume/upload",
        headers=cand_headers,
        data={"pasted_text": rich_resume_text}
    )
    assert resume_res.status_code == 200
    res_data = resume_res.json()

    # Verify extracted education / college info
    assert len(res_data["parsed_education"]) >= 1
    edu = res_data["parsed_education"][0]
    assert "Stanford" in (edu.get("institution") or edu.get("college_name", ""))
    assert "Bachelor" in (edu.get("degree") or "") or "Computer Science" in (edu.get("field_of_study") or "")

    # Verify extracted experience
    assert len(res_data["parsed_experience"]) >= 1
    exp = res_data["parsed_experience"][0]
    assert "Google" in (exp.get("company") or "") or "Intern" in (exp.get("title") or "")

    # Verify extracted projects
    assert len(res_data["parsed_projects"]) >= 1
    proj = res_data["parsed_projects"][0]
    assert "Interview" in (proj.get("name") or "")

    # Verify extracted achievements
    assert len(res_data["parsed_achievements"]) >= 1
    assert any("HackMIT" in a or "AWS" in a or "Dean" in a for a in res_data["parsed_achievements"])

    # 6. Recruiter view verifies candidate photo and enriched details
    rec_login = recruiter_client.post("/api/recruiter/auth/login", json={
        "email": "recruiter@example.com",
        "password": "password123"
    })
    assert rec_login.status_code == 200
    rec_headers = {"Authorization": f"Bearer {rec_login.json()['access_token']}"}

    applicants_res = recruiter_client.get("/api/recruiter/jobs/job_ai_engineer_01/applicants", headers=rec_headers)
    assert applicants_res.status_code == 200
    apps = applicants_res.json()
    alex_app = next((a for a in apps if a["candidate_email"] == "alex.morgan@example.com"), None)
    assert alex_app is not None
    assert alex_app["candidate_avatar_url"] == avatar_url
    assert len(alex_app["parsed_education"]) >= 1
    assert len(alex_app["parsed_experience"]) >= 1
    assert len(alex_app["parsed_projects"]) >= 1
    assert len(alex_app["parsed_achievements"]) >= 1

