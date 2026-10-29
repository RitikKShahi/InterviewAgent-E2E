from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, List
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.models import (
    ApplicationCreateRequest,
    ApplicationResponse,
    ResumeScoreResponse,
    ScoreBreakdown,
)
from services.common.scoring import calculate_resume_score
from services.common.security import require_candidate

router = APIRouter(prefix="/api/candidate", tags=["Candidate Applications"])

def _build_candidate_app_response(r: aiosqlite.Row) -> ApplicationResponse:
    score_resp = None
    if r["score_id"]:
        raw_bd = json.loads(r["scoring_breakdown"]) if r["scoring_breakdown"] else {}
        breakdown = ScoreBreakdown(
            matched_skills=raw_bd.get("matched_skills", []),
            missing_skills=raw_bd.get("missing_skills", []),
            skills_match_pct=raw_bd.get("skills_match_pct", 0.0),
            experience_years_found=raw_bd.get("experience_years_found", 0.0),
            experience_years_required=raw_bd.get("experience_years_required", 0.0),
            experience_match_pct=raw_bd.get("experience_match_pct", 0.0),
            education_degree=raw_bd.get("education_degree"),
            education_match_pct=raw_bd.get("education_match_pct", 0.0),
            relevance_match_pct=raw_bd.get("relevance_match_pct", 0.0),
            strengths=raw_bd.get("strengths", []),
            gaps=raw_bd.get("gaps", [])
        )
        score_resp = ResumeScoreResponse(
            id=r["score_id"],
            application_id=r["id"],
            overall_score=r["overall_score"],
            skills_score=r["skills_score"],
            experience_score=r["experience_score"],
            education_score=r["education_score"],
            relevance_score=r["relevance_score"],
            scoring_breakdown=breakdown,
            match_explanation=r["match_explanation"],
            is_eligible=bool(r["is_eligible"]),
            ranked_position=r["ranked_position"],
            created_at=r["score_created_at"]
        )

    keys = r.keys()
    avatar_url = r["candidate_avatar_url"] if "candidate_avatar_url" in keys else None

    return ApplicationResponse(
        id=r["id"],
        job_id=r["job_id"],
        job_title=r["job_title"],
        company_name=r["company_name"],
        candidate_id=r["candidate_id"],
        candidate_name=r["candidate_name"],
        candidate_email=r["candidate_email"],
        candidate_phone=r["candidate_phone"],
        candidate_location=r["candidate_location"],
        candidate_experience=r["candidate_experience"],
        candidate_avatar_url=avatar_url,
        resume_id=r["resume_id"],
        resume_filename=r["resume_filename"],
        cover_letter=r["cover_letter"],
        status=r["status"],
        manual_override=bool(r["manual_override"]),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
        score=score_resp,
        interview_session_id=r["session_id"],
        interview_status=r["session_status"]
    )

@router.post("/jobs/{job_id}/apply", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_job(
    job_id: str,
    req: ApplicationCreateRequest,
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> ApplicationResponse:
    cand_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    # 1. Verify job is published
    async with db.execute(
        """
        SELECT j.*, jd.raw_text as jd_raw_text, jd.parsed_skills as jd_parsed_skills,
               r.company_name
        FROM jobs j
        LEFT JOIN recruiters r ON j.recruiter_id = r.id
        LEFT JOIN job_descriptions jd ON j.id = jd.job_id
        WHERE j.id = ? AND j.status = 'published'
        """,
        (job_id,)
    ) as cur:
        job = await cur.fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job opening not found or no longer accepting applications.")

    # 2. Check for duplicate application
    async with db.execute(
        "SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?",
        (job_id, cand_id)
    ) as cur:
        if await cur.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already submitted an application for this position. Duplicate applications are not permitted."
            )

    # 3. Resolve resume
    resume_id = req.resume_id
    if not resume_id:
        async with db.execute(
            "SELECT id FROM resumes WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1",
            (cand_id,)
        ) as cur:
            res_row = await cur.fetchone()
            if not res_row:
                raise HTTPException(
                    status_code=400,
                    detail="Please upload a resume first before applying for this position."
                )
            resume_id = res_row["id"]

    # Fetch resume details for scoring
    async with db.execute("SELECT * FROM resumes WHERE id = ? AND candidate_id = ?", (resume_id, cand_id)) as cur:
        resume = await cur.fetchone()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume record not found.")

    app_id = f"app_{uuid.uuid4().hex[:12]}"
    await db.execute(
        """
        INSERT INTO applications (id, job_id, candidate_id, resume_id, cover_letter, status, manual_override, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'applied', 0, ?, ?)
        """,
        (app_id, job_id, cand_id, resume_id, req.cover_letter, now, now)
    )

    # 4. Immediate Explainable Resume Scoring
    cand_skills = json.loads(resume["parsed_skills"]) if resume["parsed_skills"] else []
    cand_edu = json.loads(resume["parsed_education"]) if resume["parsed_education"] else []
    jd_skills = json.loads(job["jd_parsed_skills"]) if job["jd_parsed_skills"] else []

    # Get candidate experience
    async with db.execute("SELECT years_experience FROM candidates WHERE id = ?", (cand_id,)) as cur:
        c_row = await cur.fetchone()
        cand_exp = c_row["years_experience"] if c_row else 1.0

    overall, s_score, e_score, ed_score, r_score, breakdown, explanation, is_eligible = calculate_resume_score(
        candidate_skills=cand_skills,
        candidate_years_exp=cand_exp or 1.0,
        candidate_education=cand_edu,
        candidate_raw_text=resume["raw_text"],
        jd_skills=jd_skills,
        jd_min_years_exp=job["min_experience_years"],
        jd_raw_text=job["jd_raw_text"] or job["description"]
    )

    score_id = f"score_{app_id}"
    await db.execute(
        """
        INSERT INTO resume_scores (id, application_id, overall_score, skills_score, experience_score,
                                  education_score, relevance_score, scoring_breakdown, match_explanation, is_eligible, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            score_id, app_id, overall, s_score, e_score, ed_score, r_score,
            breakdown.model_dump_json(), explanation, 1 if is_eligible else 0, now
        )
    )

    # Audit log
    await db.execute(
        """
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, 'apply_job', 'application', ?, ?, ?)
        """,
        (f"audit_apply_{app_id}", cand_id, app_id, json.dumps({"job_id": job_id, "score": overall}), now)
    )

    await db.commit()
    return await get_candidate_application(app_id, current_user, db)

@router.get("/applications", response_model=List[ApplicationResponse])
async def list_candidate_applications(
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> List[ApplicationResponse]:
    cand_id = current_user["sub"]
    query = """
        SELECT a.*, j.title as job_title, rec.company_name,
               u.full_name as candidate_name, u.email as candidate_email, u.avatar_url as candidate_avatar_url,
               c.phone as candidate_phone, c.location as candidate_location, c.years_experience as candidate_experience,
               res.filename as resume_filename,
               rs.id as score_id, rs.overall_score, rs.skills_score, rs.experience_score,
               rs.education_score, rs.relevance_score, rs.scoring_breakdown, rs.match_explanation,
               rs.is_eligible, rs.ranked_position, rs.created_at as score_created_at,
               sess.id as session_id, sess.status as session_status
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN recruiters rec ON j.recruiter_id = rec.id
        JOIN users u ON a.candidate_id = u.id
        LEFT JOIN candidates c ON u.id = c.id
        LEFT JOIN resumes res ON a.resume_id = res.id
        LEFT JOIN resume_scores rs ON a.id = rs.application_id
        LEFT JOIN interview_sessions sess ON a.id = sess.application_id
        WHERE a.candidate_id = ?
        ORDER BY a.created_at DESC
    """
    async with db.execute(query, (cand_id,)) as cur:
        rows = await cur.fetchall()
        return [_build_candidate_app_response(r) for r in rows]

@router.get("/applications/{application_id}", response_model=ApplicationResponse)
async def get_candidate_application(
    application_id: str,
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> ApplicationResponse:
    cand_id = current_user["sub"]
    query = """
        SELECT a.*, j.title as job_title, rec.company_name,
               u.full_name as candidate_name, u.email as candidate_email, u.avatar_url as candidate_avatar_url,
               c.phone as candidate_phone, c.location as candidate_location, c.years_experience as candidate_experience,
               res.filename as resume_filename,
               rs.id as score_id, rs.overall_score, rs.skills_score, rs.experience_score,
               rs.education_score, rs.relevance_score, rs.scoring_breakdown, rs.match_explanation,
               rs.is_eligible, rs.ranked_position, rs.created_at as score_created_at,
               sess.id as session_id, sess.status as session_status
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN recruiters rec ON j.recruiter_id = rec.id
        JOIN users u ON a.candidate_id = u.id
        LEFT JOIN candidates c ON u.id = c.id
        LEFT JOIN resumes res ON a.resume_id = res.id
        LEFT JOIN resume_scores rs ON a.id = rs.application_id
        LEFT JOIN interview_sessions sess ON a.id = sess.application_id
        WHERE a.id = ? AND a.candidate_id = ?
    """
    async with db.execute(query, (application_id, cand_id)) as cur:
        r = await cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Application not found or unauthorized")
        return _build_candidate_app_response(r)
