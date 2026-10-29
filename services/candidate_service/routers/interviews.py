from __future__ import annotations

import json
from typing import Any, List, Optional
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.models import InterviewReportResponse, InterviewSessionResponse
from services.common.security import require_candidate

router = APIRouter(prefix="/api/candidate/interviews", tags=["Candidate Interviews"])

def _build_candidate_session_resp(r: aiosqlite.Row) -> InterviewSessionResponse:
    return InterviewSessionResponse(
        id=r["id"],
        application_id=r["application_id"],
        job_id=r["job_id"],
        job_title=r["job_title"],
        candidate_id=r["candidate_id"],
        candidate_name=r["candidate_name"],
        candidate_email=r["candidate_email"],
        recruiter_id=r["recruiter_id"],
        recruiter_name=r["recruiter_name"],
        company_name=r["company_name"],
        scheduled_start=r["scheduled_start"],
        scheduled_end=r["scheduled_end"],
        duration_minutes=r["duration_minutes"],
        timezone=r["timezone"],
        status=r["status"],
        access_token=r["access_token"],
        secure_link=r["secure_link"],
        recruiter_notes=None, # Private recruiter notes hidden from candidate
        candidate_feedback=r["candidate_feedback"],
        created_at=r["created_at"],
        updated_at=r["updated_at"]
    )

@router.get("/public/{session_id}")
async def get_public_interview_session(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db)
) -> dict[str, Any]:
    """Public lookup for interview live room: returns job title, company name, and candidate avatar."""
    query = """
        SELECT s.id, s.status, j.title as job_title,
               COALESCE(rec.company_name, 'InterviewByte') as company_name,
               u.avatar_url as avatar_url
        FROM interview_sessions s
        JOIN jobs j ON s.job_id = j.id
        LEFT JOIN recruiters rec ON s.recruiter_id = rec.id
        LEFT JOIN users u ON s.candidate_id = u.id
        WHERE s.id = ?
    """
    async with db.execute(query, (session_id,)) as cur:
        row = await cur.fetchone()
        if not row:
            return {"id": session_id, "job_title": "AI Technical Interview", "company_name": "InterviewByte", "avatar_url": None}
        return dict(row)

@router.get("", response_model=List[InterviewSessionResponse])
async def list_candidate_interviews(
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> List[InterviewSessionResponse]:
    cand_id = current_user["sub"]
    query = """
        SELECT s.*, j.title as job_title, rec.company_name,
               u_cand.full_name as candidate_name, u_cand.email as candidate_email,
               u_rec.full_name as recruiter_name
        FROM interview_sessions s
        JOIN jobs j ON s.job_id = j.id
        LEFT JOIN recruiters rec ON s.recruiter_id = rec.id
        JOIN users u_cand ON s.candidate_id = u_cand.id
        JOIN users u_rec ON s.recruiter_id = u_rec.id
        WHERE s.candidate_id = ?
        ORDER BY s.scheduled_start ASC
    """
    async with db.execute(query, (cand_id,)) as cur:
        rows = await cur.fetchall()
        return [_build_candidate_session_resp(r) for r in rows]

@router.get("/{session_id}", response_model=InterviewSessionResponse)
async def get_candidate_interview(
    session_id: str,
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> InterviewSessionResponse:
    cand_id = current_user["sub"]
    query = """
        SELECT s.*, j.title as job_title, rec.company_name,
               u_cand.full_name as candidate_name, u_cand.email as candidate_email,
               u_rec.full_name as recruiter_name
        FROM interview_sessions s
        JOIN jobs j ON s.job_id = j.id
        LEFT JOIN recruiters rec ON s.recruiter_id = rec.id
        JOIN users u_cand ON s.candidate_id = u_cand.id
        JOIN users u_rec ON s.recruiter_id = u_rec.id
        WHERE s.id = ? AND s.candidate_id = ?
    """
    async with db.execute(query, (session_id, cand_id)) as cur:
        r = await cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Interview session not found or unauthorized.")
        return _build_candidate_session_resp(r)

@router.get("/{session_id}/feedback")
async def get_candidate_interview_feedback(
    session_id: str,
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> dict[str, Any]:
    cand_id = current_user["sub"]
    query = """
        SELECT rep.*, j.title as job_title, rec.company_name
        FROM interview_reports rep
        JOIN interview_sessions sess ON rep.session_id = sess.id
        JOIN jobs j ON sess.job_id = j.id
        LEFT JOIN recruiters rec ON sess.recruiter_id = rec.id
        WHERE rep.session_id = ? AND sess.candidate_id = ?
    """
    async with db.execute(query, (session_id, cand_id)) as cur:
        r = await cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="No evaluation feedback found for this interview yet.")

        if not r["is_shared_with_candidate"]:
            return {
                "shared": False,
                "message": "Evaluation feedback has not yet been published by the hiring team."
            }

        return {
            "shared": True,
            "job_title": r["job_title"],
            "company_name": r["company_name"],
            "overall_score": r["overall_score"],
            "competency_scores": json.loads(r["competency_scores"]) if r["competency_scores"] else {},
            "strengths": json.loads(r["strengths"]) if r["strengths"] else [],
            "feedback": r["recruiter_shared_feedback"]
        }
