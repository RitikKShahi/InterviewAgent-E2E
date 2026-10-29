from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, List
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.email_service import send_shortlist_notification
from services.common.models import (
    ApplicationResponse,
    ApplicationStatusUpdate,
    ManualOverrideRequest,
    ResumeScoreResponse,
    ScoreBreakdown,
)
from services.common.security import require_recruiter

router = APIRouter(prefix="/api/recruiter", tags=["Recruiter Applicants"])

def _build_application_response(r: aiosqlite.Row) -> ApplicationResponse:
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
    parsed_skills = json.loads(r["parsed_skills"]) if "parsed_skills" in keys and r["parsed_skills"] else []
    parsed_experience = json.loads(r["parsed_experience"]) if "parsed_experience" in keys and r["parsed_experience"] else []
    parsed_education = json.loads(r["parsed_education"]) if "parsed_education" in keys and r["parsed_education"] else []
    parsed_projects = json.loads(r["parsed_projects"]) if "parsed_projects" in keys and r["parsed_projects"] else []
    parsed_achievements = json.loads(r["parsed_achievements"]) if "parsed_achievements" in keys and r["parsed_achievements"] else []
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
        interview_status=r["session_status"],
        parsed_skills=parsed_skills,
        parsed_experience=parsed_experience,
        parsed_education=parsed_education,
        parsed_projects=parsed_projects,
        parsed_achievements=parsed_achievements
    )

@router.get("/jobs/{job_id}/applicants", response_model=List[ApplicationResponse])
async def list_job_applicants(
    job_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> List[ApplicationResponse]:
    # Check job ownership
    async with db.execute("SELECT id FROM jobs WHERE id = ? AND recruiter_id = ?", (job_id, current_user["sub"])) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=404, detail="Job not found or access denied")

    query = """
        SELECT a.*, j.title as job_title, rec.company_name,
               u.full_name as candidate_name, u.email as candidate_email, u.avatar_url as candidate_avatar_url,
               c.phone as candidate_phone, c.location as candidate_location, c.years_experience as candidate_experience,
               res.filename as resume_filename, res.parsed_skills, res.parsed_experience, res.parsed_education, res.parsed_projects, res.parsed_achievements,
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
        WHERE a.job_id = ?
        ORDER BY COALESCE(rs.overall_score, 0) DESC, a.created_at DESC
    """
    async with db.execute(query, (job_id,)) as cursor:
        rows = await cursor.fetchall()
        return [_build_application_response(r) for r in rows]

@router.get("/applicants/{application_id}", response_model=ApplicationResponse)
async def get_applicant_detail(
    application_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> ApplicationResponse:
    query = """
        SELECT a.*, j.title as job_title, rec.company_name,
               u.full_name as candidate_name, u.email as candidate_email, u.avatar_url as candidate_avatar_url,
               c.phone as candidate_phone, c.location as candidate_location, c.years_experience as candidate_experience,
               res.filename as resume_filename, res.parsed_skills, res.parsed_experience, res.parsed_education, res.parsed_projects, res.parsed_achievements,
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
        WHERE a.id = ? AND j.recruiter_id = ?
    """
    async with db.execute(query, (application_id, current_user["sub"])) as cursor:
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Application not found or access denied")
        return _build_application_response(r)

@router.post("/applicants/{application_id}/override", response_model=ApplicationResponse)
async def manual_override_applicant(
    application_id: str,
    req: ManualOverrideRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> ApplicationResponse:
    now = datetime.now(timezone.utc).isoformat()
    recruiter_id = current_user["sub"]

    # Verify ownership
    async with db.execute(
        """
        SELECT a.*, j.title as job_title, r.company_name, u.email as candidate_email, u.full_name as candidate_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN recruiters r ON j.recruiter_id = r.id
        JOIN users u ON a.candidate_id = u.id
        WHERE a.id = ? AND j.recruiter_id = ?
        """,
        (application_id, recruiter_id)
    ) as cursor:
        app = await cursor.fetchone()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found or unauthorized")

    # Update application status with manual_override flag = 1
    await db.execute(
        "UPDATE applications SET status = ?, manual_override = 1, updated_at = ? WHERE id = ?",
        (req.target_status, now, application_id)
    )

    # Manage shortlists table
    if req.target_status == "shortlisted":
        # Check if already in shortlists
        async with db.execute("SELECT id FROM shortlists WHERE application_id = ?", (application_id,)) as cur:
            exists = await cur.fetchone()
            if not exists:
                # Get next rank
                async with db.execute("SELECT COALESCE(MAX(rank), 0) + 1 as next_rank FROM shortlists WHERE job_id = ?", (app["job_id"],)) as rcur:
                    rank_row = await rcur.fetchone()
                    rank = rank_row["next_rank"]
                await db.execute(
                    """
                    INSERT INTO shortlists (id, job_id, application_id, rank, is_auto_shortlisted, override_reason, created_at)
                    VALUES (?, ?, ?, ?, 0, ?, ?)
                    """,
                    (f"shortlist_{application_id}", app["job_id"], application_id, rank, req.override_reason, now)
                )

        # Trigger shortlist email
        await send_shortlist_notification(
            db,
            app["candidate_email"],
            app["candidate_id"],
            app["candidate_name"],
            app["job_title"],
            app["company_name"] or "Nexus AI"
        )
    else:
        # Removed from shortlist
        await db.execute("DELETE FROM shortlists WHERE application_id = ?", (application_id,))

    # Log audit trail
    await db.execute(
        """
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, 'manual_override', 'application', ?, ?, ?)
        """,
        (f"audit_{application_id}_{now}", recruiter_id, application_id, json.dumps({"target_status": req.target_status, "reason": req.override_reason}), now)
    )

    await db.commit()
    return await get_applicant_detail(application_id, current_user, db)
