from __future__ import annotations

from typing import Any
import aiosqlite
from fastapi import APIRouter, Depends

from services.common.database import get_db
from services.common.models import RecruiterAnalyticsResponse
from services.common.security import require_recruiter

router = APIRouter(prefix="/api/recruiter", tags=["Recruiter Analytics"])

@router.get("/analytics", response_model=RecruiterAnalyticsResponse)
async def get_recruiter_analytics(
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> RecruiterAnalyticsResponse:
    recruiter_id = current_user["sub"]

    # 1. Job counts
    async with db.execute(
        "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as active FROM jobs WHERE recruiter_id = ?",
        (recruiter_id,)
    ) as cur:
        job_stats = await cur.fetchone()
        total_jobs = job_stats["total"] or 0
        active_jobs = job_stats["active"] or 0

    # 2. Application and status funnel counts
    query = """
        SELECT a.status, COUNT(*) as count
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.recruiter_id = ?
        GROUP BY a.status
    """
    funnel = {
        "applied": 0,
        "under_review": 0,
        "shortlisted": 0,
        "interview_scheduled": 0,
        "interview_in_progress": 0,
        "interview_completed": 0,
        "selected": 0,
        "rejected": 0
    }
    total_applicants = 0
    shortlisted_count = 0
    selected_count = 0

    async with db.execute(query, (recruiter_id,)) as cur:
        rows = await cur.fetchall()
        for r in rows:
            st = r["status"]
            cnt = r["count"]
            if st in funnel:
                funnel[st] = cnt
            total_applicants += cnt
            if st == "shortlisted":
                shortlisted_count += cnt
            elif st == "selected":
                selected_count += cnt

    # 3. Interview session counts
    async with db.execute(
        """
        SELECT COUNT(*) as total_scheduled,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM interview_sessions
        WHERE recruiter_id = ?
        """,
        (recruiter_id,)
    ) as cur:
        sess_stats = await cur.fetchone()
        scheduled_interviews = sess_stats["total_scheduled"] or 0
        completed_interviews = sess_stats["completed"] or 0

    # 4. Average score
    async with db.execute(
        """
        SELECT AVG(rs.overall_score) as avg_score
        FROM resume_scores rs
        JOIN applications a ON rs.application_id = a.id
        JOIN jobs j ON a.job_id = j.id
        WHERE j.recruiter_id = ?
        """,
        (recruiter_id,)
    ) as cur:
        avg_row = await cur.fetchone()
        avg_score = round(avg_row["avg_score"] or 75.0, 1) if avg_row else 75.0

    return RecruiterAnalyticsResponse(
        total_jobs=total_jobs,
        active_jobs=active_jobs,
        total_applicants=total_applicants,
        shortlisted_applicants=shortlisted_count,
        interviews_scheduled=scheduled_interviews,
        interviews_completed=completed_interviews,
        candidates_selected=selected_count,
        avg_resume_score=avg_score,
        funnel=funnel
    )
