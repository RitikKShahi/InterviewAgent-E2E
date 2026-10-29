from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
import aiosqlite

from .config import REPO_ROOT, get_settings
from .security import hash_password

SCHEMA_FILE = REPO_ROOT / "services" / "common" / "schema.sql"

async def get_db_connection() -> aiosqlite.Connection:
    settings = get_settings()
    conn = await aiosqlite.connect(settings.db_path)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON;")
    await conn.execute("PRAGMA journal_mode = WAL;")
    return conn

async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    conn = await get_db_connection()
    try:
        yield conn
    finally:
        await conn.close()

async def init_db() -> None:
    """Initialize schema and seed initial demo data if tables are empty."""
    settings = get_settings()
    os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)
    
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = await get_db_connection()
    try:
        await conn.executescript(schema_sql)
        try:
            await conn.execute("ALTER TABLE resumes ADD COLUMN parsed_achievements TEXT DEFAULT '[]';")
        except Exception:
            pass
        await conn.commit()
        await seed_demo_data(conn)
    finally:
        await conn.close()

async def seed_demo_data(conn: aiosqlite.Connection) -> None:
    """Populate initial realistic recruitment data if empty."""
    cursor = await conn.execute("SELECT count(*) as count FROM users")
    row = await cursor.fetchone()
    if row and row["count"] > 0:
        return

    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    default_pw = hash_password("password123")

    # 1. Recruiter
    recruiter_id = "user_recruiter_01"
    await conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'recruiter', ?, ?)
        """,
        (recruiter_id, "recruiter@example.com", default_pw, "Sarah Connor", now_str, now_str),
    )
    await conn.execute(
        """
        INSERT INTO recruiters (id, company_name, department, phone, website, created_at)
        VALUES (?, 'Anthropic Nexus AI', 'Talent Acquisition', '+1 (555) 321-7890', 'https://nexus.ai', ?)
        """,
        (recruiter_id, now_str),
    )

    # 2. Candidates
    cand1_id = "user_cand_alex"
    await conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'candidate', ?, ?)
        """,
        (cand1_id, "alex.morgan@example.com", default_pw, "Alex Morgan", now_str, now_str),
    )
    await conn.execute(
        """
        INSERT INTO candidates (id, phone, location, current_title, years_experience, headline, bio, created_at)
        VALUES (?, '+1 (555) 890-1234', 'San Francisco, CA', 'Lead AI Platform Engineer', 6.5,
                'Full-Stack AI & LLM Systems Architect', 'Specializing in real-time WebRTC voice agents and high-scale inference.', ?)
        """,
        (cand1_id, now_str),
    )

    cand2_id = "user_cand_marcus"
    await conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'candidate', ?, ?)
        """,
        (cand2_id, "marcus.chen@example.com", default_pw, "Marcus Chen", now_str, now_str),
    )
    await conn.execute(
        """
        INSERT INTO candidates (id, phone, location, current_title, years_experience, headline, bio, created_at)
        VALUES (?, '+1 (555) 456-7890', 'Seattle, WA', 'Senior Machine Learning Engineer', 5.0,
                'PyTorch, LangGraph & Distributed Systems Specialist', '5+ years building production multi-agent systems and low-latency pipelines.', ?)
        """,
        (cand2_id, now_str),
    )

    cand3_id = "user_cand_elena"
    await conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'candidate', ?, ?)
        """,
        (cand3_id, "elena.rostova@example.com", default_pw, "Elena Rostova", now_str, now_str),
    )
    await conn.execute(
        """
        INSERT INTO candidates (id, phone, location, current_title, years_experience, headline, bio, created_at)
        VALUES (?, '+1 (555) 765-4321', 'New York, NY', 'Full Stack TypeScript / AI Engineer', 3.5,
                'Next.js 15, FastAPI & LiveKit Specialist', 'Passionate about conversational voice UX and scalable real-time architectures.', ?)
        """,
        (cand3_id, now_str),
    )

    cand4_id = "user_cand_priya"
    await conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'candidate', ?, ?)
        """,
        (cand4_id, "priya.patel@example.com", default_pw, "Priya Patel", now_str, now_str),
    )
    await conn.execute(
        """
        INSERT INTO candidates (id, phone, location, current_title, years_experience, headline, bio, created_at)
        VALUES (?, '+1 (555) 234-5678', 'Austin, TX', 'Junior Python / AI Developer', 1.5,
                'Aspiring AI Engineer with strong Python & prompt engineering foundation.', 'Graduate in CS with hands-on projects in LangChain & RAG.', ?)
        """,
        (cand4_id, now_str),
    )

    # 3. Jobs
    job1_id = "job_ai_engineer_01"
    job1_desc = """We are seeking a Senior AI Systems Engineer to architect and build our next-generation conversational AI recruitment agents.

Key Requirements:
- 4+ years software engineering experience with Python and TypeScript.
- Strong proficiency with LLM inference, LangGraph/LangChain, and real-time audio/WebRTC pipelines (LiveKit).
- Experience with FastAPI, modern asynchronous programming, and PostgreSQL/SQLite.
- Demonstrated track record deploying production AI systems with robust observability and safety guardrails.
- Excellent communication skills and user-centric problem solving."""
    
    await conn.execute(
        """
        INSERT INTO jobs (id, recruiter_id, title, department, location, job_type, experience_level, min_experience_years, salary_range, description, requirements, status, top_k, created_at, updated_at)
        VALUES (?, ?, 'Senior AI Systems Engineer', 'AI Research & Platform', 'San Francisco, CA (Hybrid)', 'Full-time', 'Senior', 4.0, '$180,000 - $230,000 + Equity', ?, 'Python, FastAPI, LiveKit, WebRTC, LangGraph, LLM Agents, TypeScript', 'published', 2, ?, ?)
        """,
        (job1_id, recruiter_id, job1_desc, now_str, now_str),
    )

    job1_skills = ["Python", "FastAPI", "LiveKit", "WebRTC", "LangGraph", "LLM Agents", "TypeScript", "PostgreSQL", "Observability"]
    job1_quals = ["B.S. or M.S. in Computer Science or related field", "4+ years software engineering experience", "Production AI deployment experience"]
    job1_resps = ["Design low-latency real-time voice and agentic interview loops", "Collaborate with product and frontend engineering teams", "Maintain 99.9% pipeline reliability and unit test coverage"]
    
    await conn.execute(
        """
        INSERT INTO job_descriptions (id, job_id, raw_text, parsed_skills, required_qualifications, responsibilities, role_overview, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Lead the architectural design of autonomous interview agents.', ?)
        """,
        ("jd_ai_eng_01", job1_id, job1_desc, json.dumps(job1_skills), json.dumps(job1_quals), json.dumps(job1_resps), now_str),
    )

    job2_id = "job_fullstack_02"
    job2_desc = """Looking for a Full-Stack AI Application Developer to craft responsive, sleek, and high-performance interfaces for recruiter and candidate workflows.

Key Requirements:
- 3+ years experience with Next.js, React, TypeScript, and modern CSS/Tailwind.
- Experience consuming RESTful and WebRTC APIs.
- Familiarity with Python, FastAPI, and asynchronous backend integration.
- Passion for pristine UX, responsive typography, and micro-animations."""
    
    await conn.execute(
        """
        INSERT INTO jobs (id, recruiter_id, title, department, location, job_type, experience_level, min_experience_years, salary_range, description, requirements, status, top_k, created_at, updated_at)
        VALUES (?, ?, 'Full-Stack AI Application Developer', 'Frontend & Product', 'Remote (Global)', 'Full-time', 'Mid-Level', 3.0, '$135,000 - $165,000', ?, 'Next.js, React, TypeScript, TailwindCSS, FastAPI, WebRTC', 'published', 2, ?, ?)
        """,
        (job2_id, recruiter_id, job2_desc, now_str, now_str),
    )

    # 4. Resumes
    res1_id = "res_alex_01"
    res1_text = """Alex Morgan - Lead AI Platform Engineer
Email: alex.morgan@example.com | Phone: +1 555-890-1234 | San Francisco, CA

PROFESSIONAL SUMMARY
6.5 years of experience architecting distributed AI services, low-latency WebRTC audio streaming, and high-throughput LLM pipelines.

SKILLS
Python, FastAPI, TypeScript, React, LiveKit, WebRTC, LangGraph, LLM Agents, PyTorch, Docker, Kubernetes, PostgreSQL, Redis, CI/CD

EXPERIENCE
Lead AI Platform Engineer — Synthetix AI (2022 - Present)
- Architected conversational voice agent infrastructure handling 50k+ daily concurrent sessions using LiveKit and custom WebRTC streaming.
- Built FastAPI microservices with LangGraph workflows reducing response latency by 45%.

Senior Software Engineer — CloudCore Systems (2019 - 2022)
- Built scalable event-driven backend services in Python and Go with PostgreSQL.

EDUCATION
B.S. in Computer Science, UC Berkeley (2019)"""

    res1_skills = ["Python", "FastAPI", "TypeScript", "React", "LiveKit", "WebRTC", "LangGraph", "LLM Agents", "PyTorch", "Docker", "PostgreSQL"]
    res1_exp = [{"title": "Lead AI Platform Engineer", "company": "Synthetix AI", "duration": "2022 - Present", "description": "Architected conversational voice agent infrastructure handling 50k+ daily concurrent sessions using LiveKit and custom WebRTC streaming."}]
    res1_edu = [{"degree": "B.S. in Computer Science", "institution": "UC Berkeley", "college_name": "UC Berkeley", "field_of_study": "Computer Science", "graduation_year": "2019", "gpa": "3.85"}]
    res1_proj = [{"name": "LiveVoice AI", "technologies": ["LiveKit", "FastAPI", "WebRTC"], "description": "High-throughput real-time voice streaming interview assistant."}]
    res1_ach = ["1st Place Winner - HackMIT 2023", "AWS Certified Solutions Architect Associate", "Dean's Honor List"]

    await conn.execute(
        """
        INSERT INTO resumes (id, candidate_id, filename, file_path, file_size, mime_type, raw_text, parsed_skills, parsed_experience, parsed_education, parsed_projects, parsed_achievements, created_at)
        VALUES (?, ?, 'alex_morgan_resume.pdf', '/uploads/alex_morgan_resume.pdf', 1048576, 'application/pdf', ?, ?, ?, ?, ?, ?, ?)
        """,
        (res1_id, cand1_id, res1_text, json.dumps(res1_skills), json.dumps(res1_exp), json.dumps(res1_edu), json.dumps(res1_proj), json.dumps(res1_ach), now_str),
    )

    res2_id = "res_marcus_02"
    res2_text = """Marcus Chen - Senior Machine Learning Engineer
Email: marcus.chen@example.com | Seattle, WA

SUMMARY
5 years experience specializing in fine-tuning, retrieval-augmented generation (RAG), and agentic tool use.

SKILLS
Python, PyTorch, LangGraph, FastAPI, Docker, SQL, LLM Agents, Prompt Engineering, Git

EXPERIENCE
Senior ML Engineer — Apex AI (2021 - Present)
- Designed autonomous multi-agent pipelines with LangGraph and FastAPI.
- Implemented vector retrieval systems and evaluation benchmarks.

EDUCATION
M.S. in Artificial Intelligence, University of Washington (2021)"""

    res2_skills = ["Python", "PyTorch", "LangGraph", "FastAPI", "Docker", "SQL", "LLM Agents"]
    res2_exp = [{"title": "Senior ML Engineer", "company": "Apex AI", "duration": "2021 - Present", "description": "Designed autonomous multi-agent pipelines with LangGraph and FastAPI."}]
    res2_edu = [{"degree": "M.S. in Artificial Intelligence", "institution": "University of Washington", "college_name": "University of Washington", "field_of_study": "Artificial Intelligence", "graduation_year": "2021"}]
    res2_proj = [{"name": "Agentic Graph RAG", "technologies": ["LangGraph", "PyTorch", "FastAPI"], "description": "Multi-agent graph-based retrieval augmented generation system."}]
    res2_ach = ["NeurIPS Workshop Best Paper 2022", "Kaggle Grandmaster (Competitions)"]

    await conn.execute(
        """
        INSERT INTO resumes (id, candidate_id, filename, file_path, file_size, mime_type, raw_text, parsed_skills, parsed_experience, parsed_education, parsed_projects, parsed_achievements, created_at)
        VALUES (?, ?, 'marcus_chen_cv.docx', '/uploads/marcus_chen_cv.docx', 524288, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ?, ?, ?, ?, ?, ?, ?)
        """,
        (res2_id, cand2_id, res2_text, json.dumps(res2_skills), json.dumps(res2_exp), json.dumps(res2_edu), json.dumps(res2_proj), json.dumps(res2_ach), now_str),
    )

    res3_id = "res_elena_03"
    res3_text = """Elena Rostova - Full Stack Engineer
Email: elena.rostova@example.com | New York, NY

SKILLS
TypeScript, JavaScript, Next.js, React, TailwindCSS, Node.js, WebSockets, HTML5, CSS3, Python

EXPERIENCE
Full Stack Developer — Frontend Innovations (2022 - Present)
- Created responsive SaaS dashboards using Next.js 14 and TailwindCSS.
- Integrated WebRTC and WebSocket real-time audio/video feeds.

EDUCATION
B.S. in Software Engineering, NYU (2022)"""

    res3_skills = ["TypeScript", "Next.js", "React", "TailwindCSS", "Node.js", "WebSockets", "Python"]
    res3_exp = [{"title": "Full Stack Developer", "company": "Frontend Innovations", "duration": "2022 - Present", "description": "Created responsive SaaS dashboards using Next.js 14 and TailwindCSS."}]
    res3_edu = [{"degree": "B.S. in Software Engineering", "institution": "NYU", "college_name": "NYU", "field_of_study": "Software Engineering", "graduation_year": "2022"}]
    res3_proj = [{"name": "Real-time SaaS Telemetry", "technologies": ["Next.js", "WebSockets", "TailwindCSS"], "description": "Low-latency browser telemetry dashboard."}]
    res3_ach = ["Grace Hopper Conference Scholar 2022"]

    await conn.execute(
        """
        INSERT INTO resumes (id, candidate_id, filename, file_path, file_size, mime_type, raw_text, parsed_skills, parsed_experience, parsed_education, parsed_projects, parsed_achievements, created_at)
        VALUES (?, ?, 'elena_rostova.pdf', '/uploads/elena_rostova.pdf', 342100, 'application/pdf', ?, ?, ?, ?, ?, ?, ?)
        """,
        (res3_id, cand3_id, res3_text, json.dumps(res3_skills), json.dumps(res3_exp), json.dumps(res3_edu), json.dumps(res3_proj), json.dumps(res3_ach), now_str),
    )

    # 5. Applications for Job 1
    app1_id = "app_alex_job1"
    await conn.execute(
        """
        INSERT INTO applications (id, job_id, candidate_id, resume_id, cover_letter, status, manual_override, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'I have spent the last 3 years building real-time WebRTC LiveKit voice agents and would love to contribute to Anthropic Nexus.', 'shortlisted', 0, ?, ?)
        """,
        (app1_id, job1_id, cand1_id, res1_id, now_str, now_str),
    )

    app1_breakdown = {
        "matched_skills": ["Python", "FastAPI", "LiveKit", "WebRTC", "LangGraph", "LLM Agents", "TypeScript", "PostgreSQL"],
        "missing_skills": ["Observability"],
        "skills_match_pct": 89.0,
        "experience_years_found": 6.5,
        "experience_years_required": 4.0,
        "experience_match_pct": 100.0,
        "education_degree": "B.S. in Computer Science",
        "education_match_pct": 95.0,
        "relevance_match_pct": 94.0,
        "strengths": [
            "Extensive direct experience with LiveKit and WebRTC voice pipelines",
            "Strong track record in LangGraph autonomous workflows",
            "6.5 years verified engineering experience exceeds 4.0 year minimum"
        ],
        "gaps": ["No explicit mention of production OpenTelemetry / Sentry instrumentation"]
    }
    await conn.execute(
        """
        INSERT INTO resume_scores (id, application_id, overall_score, skills_score, experience_score, education_score, relevance_score, scoring_breakdown, match_explanation, is_eligible, ranked_position, created_at)
        VALUES (?, ?, 93.5, 92.0, 98.0, 92.0, 91.0, ?, 'Exceptional alignment across real-time WebRTC, LiveKit, Python/FastAPI, and autonomous agent frameworks.', 1, 1, ?)
        """,
        ("score_app1", app1_id, json.dumps(app1_breakdown), now_str),
    )

    app2_id = "app_marcus_job1"
    await conn.execute(
        """
        INSERT INTO applications (id, job_id, candidate_id, resume_id, cover_letter, status, manual_override, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Deeply passionate about multi-agent orchestration and low-latency agent evaluation.', 'shortlisted', 0, ?, ?)
        """,
        (app2_id, job1_id, cand2_id, res2_id, now_str, now_str),
    )

    app2_breakdown = {
        "matched_skills": ["Python", "FastAPI", "LangGraph", "LLM Agents", "Docker"],
        "missing_skills": ["LiveKit", "WebRTC", "TypeScript"],
        "skills_match_pct": 68.0,
        "experience_years_found": 5.0,
        "experience_years_required": 4.0,
        "experience_match_pct": 90.0,
        "education_degree": "M.S. in Artificial Intelligence",
        "education_match_pct": 98.0,
        "relevance_match_pct": 84.0,
        "strengths": ["Advanced M.S. degree in AI", "Solid production LangGraph and FastAPI agent experience"],
        "gaps": ["Lacks direct LiveKit/WebRTC streaming audio experience on resume"]
    }
    await conn.execute(
        """
        INSERT INTO resume_scores (id, application_id, overall_score, skills_score, experience_score, education_score, relevance_score, scoring_breakdown, match_explanation, is_eligible, ranked_position, created_at)
        VALUES (?, ?, 81.2, 70.0, 92.0, 96.0, 80.0, ?, 'Strong AI/ML and agent foundation with relevant Python backend stack; lacks WebRTC audio background.', 1, 2, ?)
        """,
        ("score_app2", app2_id, json.dumps(app2_breakdown), now_str),
    )

    app3_id = "app_elena_job1"
    await conn.execute(
        """
        INSERT INTO applications (id, job_id, candidate_id, resume_id, cover_letter, status, manual_override, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Applying for the Senior AI Systems Engineer role.', 'under_review', 0, ?, ?)
        """,
        (app3_id, job1_id, cand3_id, res3_id, now_str, now_str),
    )

    app3_breakdown = {
        "matched_skills": ["TypeScript", "WebSockets", "Python"],
        "missing_skills": ["FastAPI", "LiveKit", "LangGraph", "LLM Agents", "PostgreSQL"],
        "skills_match_pct": 42.0,
        "experience_years_found": 3.5,
        "experience_years_required": 4.0,
        "experience_match_pct": 72.0,
        "education_degree": "B.S. in Software Engineering",
        "education_match_pct": 88.0,
        "relevance_match_pct": 55.0,
        "strengths": ["Strong TypeScript and real-time WebSocket foundation"],
        "gaps": ["Under the 4.0-year minimum threshold; lacks primary LLM agent and Python framework experience"]
    }
    await conn.execute(
        """
        INSERT INTO resume_scores (id, application_id, overall_score, skills_score, experience_score, education_score, relevance_score, scoring_breakdown, match_explanation, is_eligible, ranked_position, created_at)
        VALUES (?, ?, 59.8, 45.0, 75.0, 85.0, 52.0, ?, 'Candidate has strong frontend/real-time skills but falls short of core Python AI systems seniority requirements.', 1, 3, ?)
        """,
        ("score_app3", app3_id, json.dumps(app3_breakdown), now_str),
    )

    # 6. Shortlists for Job 1 (Top-K = 2)
    await conn.execute(
        """
        INSERT INTO shortlists (id, job_id, application_id, rank, is_auto_shortlisted, override_reason, created_at)
        VALUES ('shortlist_1', ?, ?, 1, 1, 'Top 1 match with 93.5 score', ?)
        """,
        (job1_id, app1_id, now_str),
    )
    await conn.execute(
        """
        INSERT INTO shortlists (id, job_id, application_id, rank, is_auto_shortlisted, override_reason, created_at)
        VALUES ('shortlist_2', ?, ?, 2, 1, 'Top 2 match with 81.2 score', ?)
        """,
        (job1_id, app2_id, now_str),
    )

    # 7. Scheduled Interview Session for Alex Morgan
    session_id = f"sess_{uuid.uuid4().hex}"
    access_token = f"tok_{uuid.uuid4().hex}"
    interview_start = (now + timedelta(days=1, hours=2)).isoformat()
    interview_end = (now + timedelta(days=1, hours=2, minutes=45)).isoformat()
    secure_link = f"http://localhost:3000/interview/{session_id}"

    await conn.execute(
        """
        INSERT INTO interview_sessions (id, application_id, job_id, candidate_id, recruiter_id, scheduled_start, scheduled_end, duration_minutes, timezone, status, access_token, secure_link, recruiter_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 45, 'America/Los_Angeles', 'scheduled', ?, ?, 'Candidate has stellar WebRTC voice experience. Focus questions on edge-case recovery in live audio pipelines.', ?, ?)
        """,
        (session_id, app1_id, job1_id, cand1_id, recruiter_id, interview_start, interview_end, access_token, secure_link, now_str, now_str),
    )

    # Also insert an interview notification
    invite_body = f"""Dear Alex Morgan,

We are pleased to invite you to an AI Agent Technical Interview for the Senior AI Systems Engineer position at Anthropic Nexus AI.

Date & Time: Tomorrow at 2:00 PM (America/Los_Angeles)
Duration: 45 Minutes
Join Interview: {secure_link}

Instructions:
Please join in a quiet environment with a working microphone. You will interact with our autonomous voice interview agent powered by DeepInterview.

Best regards,
Sarah Connor
Nexus AI Recruitment Team"""

    await conn.execute(
        """
        INSERT INTO notifications (id, recipient_email, recipient_id, type, subject, body, status, attempts, last_attempt_at, idempotency_key, created_at)
        VALUES ('notif_invite_alex', 'alex.morgan@example.com', ?, 'interview_invite', 'Interview Invitation: Senior AI Systems Engineer at Nexus AI', ?, 'sent', 1, ?, 'idemp_alex_interview_01', ?)
        """,
        (cand1_id, invite_body, now_str, now_str),
    )

    await conn.commit()
