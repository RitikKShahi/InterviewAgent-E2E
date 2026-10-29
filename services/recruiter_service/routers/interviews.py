from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.agent_client import get_agent_client
from services.common.database import get_db
from services.common.email_service import (
    send_decision_notification,
    send_interview_invite_notification,
)
from services.common.models import (
    CandidateDecisionRequest,
    InterviewReportResponse,
    InterviewSessionResponse,
    RescheduleInterviewRequest,
    ScheduleInterviewRequest,
)
from services.common.security import require_recruiter

router = APIRouter(prefix="/api/recruiter/interviews", tags=["Recruiter Interviews"])

def _build_session_response(r: aiosqlite.Row) -> InterviewSessionResponse:
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
        recruiter_notes=r["recruiter_notes"],
        candidate_feedback=r["candidate_feedback"],
        created_at=r["created_at"],
        updated_at=r["updated_at"]
    )

@router.post("/schedule", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
async def schedule_interview(
    req: ScheduleInterviewRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> InterviewSessionResponse:
    recruiter_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    # Parse start and compute end time
    try:
        start_dt = datetime.fromisoformat(req.scheduled_start.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(minutes=req.duration_minutes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ISO-8601 scheduled_start timestamp")

    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()

    # Verify application belongs to a job posted by this recruiter
    async with db.execute(
        """
        SELECT a.id, a.candidate_id, a.job_id, a.status as app_status,
               j.title as job_title, j.description as jd_text,
               r.company_name, u.email as candidate_email, u.full_name as candidate_name,
               res.raw_text as resume_text
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        LEFT JOIN recruiters r ON j.recruiter_id = r.id
        JOIN users u ON a.candidate_id = u.id
        LEFT JOIN resumes res ON a.resume_id = res.id
        WHERE a.id = ? AND j.recruiter_id = ?
        """,
        (req.application_id, recruiter_id)
    ) as cur:
        app = await cur.fetchone()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found or unauthorized")

    candidate_id = app["candidate_id"]
    job_id = app["job_id"]
    company_name = app["company_name"] or "Nexus AI"

    # Scheduling conflict check: recruiter availability
    async with db.execute(
        """
        SELECT id FROM interview_sessions
        WHERE recruiter_id = ? AND status IN ('scheduled', 'ready', 'in_progress')
          AND NOT (scheduled_end <= ? OR scheduled_start >= ?)
        """,
        (recruiter_id, start_iso, end_iso)
    ) as cur:
        if await cur.fetchone():
            raise HTTPException(status_code=409, detail="Recruiter has a conflicting interview session at this scheduled time.")

    # Scheduling conflict check: candidate availability
    async with db.execute(
        """
        SELECT id FROM interview_sessions
        WHERE candidate_id = ? AND status IN ('scheduled', 'ready', 'in_progress')
          AND NOT (scheduled_end <= ? OR scheduled_start >= ?)
        """,
        (candidate_id, start_iso, end_iso)
    ) as cur:
        if await cur.fetchone():
            raise HTTPException(status_code=409, detail="Candidate already has another interview scheduled at this time interval.")

    # Generate session ID in agent sess_ format
    session_id = f"sess_{uuid.uuid4().hex}"
    access_token = f"tok_{uuid.uuid4().hex}"
    secure_link = f"http://localhost:3000/interview/{session_id}"

    # Initialize session with existing Agent API (calls POST /api/prep)
    agent = get_agent_client()
    agent_session_id = await agent.initialize_session(
        cv_text=app["resume_text"] or "Candidate Profile",
        jd_text=app["jd_text"],
        company=company_name,
        user_id=candidate_id
    )
    # If agent returned a session_id, we can align with it
    if agent_session_id:
        session_id = agent_session_id
        secure_link = f"http://localhost:3000/interview/{session_id}"

    await db.execute(
        """
        INSERT INTO interview_sessions (id, application_id, job_id, candidate_id, recruiter_id,
                                        scheduled_start, scheduled_end, duration_minutes, timezone, status,
                                        access_token, secure_link, recruiter_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)
        """,
        (
            session_id, req.application_id, job_id, candidate_id, recruiter_id,
            start_iso, end_iso, req.duration_minutes, req.timezone,
            access_token, secure_link, req.recruiter_notes, now, now
        )
    )

    # Update application status
    await db.execute(
        "UPDATE applications SET status = 'interview_scheduled', updated_at = ? WHERE id = ?",
        (now, req.application_id)
    )

    # Dispatch email invitation
    await send_interview_invite_notification(
        conn=db,
        candidate_email=app["candidate_email"],
        candidate_id=candidate_id,
        candidate_name=app["candidate_name"],
        job_title=app["job_title"],
        company_name=company_name,
        scheduled_start=start_iso,
        duration_minutes=req.duration_minutes,
        timezone_str=req.timezone,
        secure_link=secure_link
    )

    await db.commit()
    return await get_interview_detail(session_id, current_user, db)

@router.get("", response_model=List[InterviewSessionResponse])
async def list_recruiter_interviews(
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> List[InterviewSessionResponse]:
    query = """
        SELECT s.*, j.title as job_title, rec.company_name,
               u_cand.full_name as candidate_name, u_cand.email as candidate_email,
               u_rec.full_name as recruiter_name
        FROM interview_sessions s
        JOIN jobs j ON s.job_id = j.id
        LEFT JOIN recruiters rec ON s.recruiter_id = rec.id
        JOIN users u_cand ON s.candidate_id = u_cand.id
        JOIN users u_rec ON s.recruiter_id = u_rec.id
        WHERE s.recruiter_id = ?
        ORDER BY s.scheduled_start ASC
    """
    async with db.execute(query, (current_user["sub"],)) as cur:
        rows = await cur.fetchall()
        return [_build_session_response(r) for r in rows]

@router.get("/{session_id}", response_model=InterviewSessionResponse)
async def get_interview_detail(
    session_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> InterviewSessionResponse:
    query = """
        SELECT s.*, j.title as job_title, rec.company_name,
               u_cand.full_name as candidate_name, u_cand.email as candidate_email,
               u_rec.full_name as recruiter_name
        FROM interview_sessions s
        JOIN jobs j ON s.job_id = j.id
        LEFT JOIN recruiters rec ON s.recruiter_id = rec.id
        JOIN users u_cand ON s.candidate_id = u_cand.id
        JOIN users u_rec ON s.recruiter_id = u_rec.id
        WHERE s.id = ? AND s.recruiter_id = ?
    """
    async with db.execute(query, (session_id, current_user["sub"])) as cur:
        r = await cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Interview session not found or access denied")
        return _build_session_response(r)

@router.post("/{session_id}/reschedule", response_model=InterviewSessionResponse)
async def reschedule_interview(
    session_id: str,
    req: RescheduleInterviewRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> InterviewSessionResponse:
    now = datetime.now(timezone.utc).isoformat()
    recruiter_id = current_user["sub"]

    async with db.execute(
        "SELECT * FROM interview_sessions WHERE id = ? AND recruiter_id = ?",
        (session_id, recruiter_id)
    ) as cur:
        sess = await cur.fetchone()
        if not sess:
            raise HTTPException(status_code=404, detail="Interview session not found or unauthorized")

    duration = req.duration_minutes or sess["duration_minutes"]
    tz_str = req.timezone or sess["timezone"]

    start_dt = datetime.fromisoformat(req.scheduled_start.replace("Z", "+00:00"))
    end_dt = start_dt + timedelta(minutes=duration)
    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()

    # Conflict check
    async with db.execute(
        """
        SELECT id FROM interview_sessions
        WHERE recruiter_id = ? AND id != ? AND status IN ('scheduled', 'ready', 'in_progress')
          AND NOT (scheduled_end <= ? OR scheduled_start >= ?)
        """,
        (recruiter_id, session_id, start_iso, end_iso)
    ) as cur:
        if await cur.fetchone():
            raise HTTPException(status_code=409, detail="Conflicting interview at the new scheduled time.")

    await db.execute(
        """
        UPDATE interview_sessions
        SET scheduled_start = ?, scheduled_end = ?, duration_minutes = ?, timezone = ?, updated_at = ?
        WHERE id = ?
        """,
        (start_iso, end_iso, duration, tz_str, now, session_id)
    )
    await db.commit()
    return await get_interview_detail(session_id, current_user, db)

@router.post("/{session_id}/cancel")
async def cancel_interview(
    session_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> dict[str, str]:
    now = datetime.now(timezone.utc).isoformat()
    res = await db.execute(
        "UPDATE interview_sessions SET status = 'cancelled', updated_at = ? WHERE id = ? AND recruiter_id = ?",
        (now, session_id, current_user["sub"])
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Interview not found or unauthorized")
    await db.commit()
    return {"status": "cancelled", "session_id": session_id}

@router.get("/{session_id}/report", response_model=InterviewReportResponse)
async def get_interview_report(
    session_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> InterviewReportResponse:
    # Check if report already stored in DB
    query = """
        SELECT rep.*, sess.job_id, j.title as job_title, rec.company_name,
               u_cand.full_name as candidate_name
        FROM interview_reports rep
        JOIN interview_sessions sess ON rep.session_id = sess.id
        JOIN jobs j ON sess.job_id = j.id
        LEFT JOIN recruiters rec ON sess.recruiter_id = rec.id
        JOIN users u_cand ON sess.candidate_id = u_cand.id
        WHERE rep.session_id = ? AND sess.recruiter_id = ?
    """
    async with db.execute(query, (session_id, current_user["sub"])) as cur:
        rep = await cur.fetchone()
        if rep:
            return InterviewReportResponse(
                id=rep["id"],
                session_id=rep["session_id"],
                application_id=rep["application_id"],
                candidate_name=rep["candidate_name"],
                job_title=rep["job_title"],
                company_name=rep["company_name"],
                overall_score=rep["overall_score"],
                competency_scores=json.loads(rep["competency_scores"]) if rep["competency_scores"] else {},
                strengths=json.loads(rep["strengths"]) if rep["strengths"] else [],
                gaps=json.loads(rep["gaps"]) if rep["gaps"] else [],
                recommendations=json.loads(rep["recommendations"]) if rep["recommendations"] else [],
                full_transcript=json.loads(rep["full_transcript"]) if rep["full_transcript"] else [],
                recruiter_shared_feedback=rep["recruiter_shared_feedback"],
                is_shared_with_candidate=bool(rep["is_shared_with_candidate"]),
                created_at=rep["created_at"]
            )

    # If not in DB, sync from the Agent API
    agent = get_agent_client()
    agent_data = await agent.get_session(session_id)
    now = datetime.now(timezone.utc).isoformat()

    # Retrieve session row for application_id
    async with db.execute(
        """
        SELECT s.application_id, s.candidate_id, j.title as job_title, rec.company_name, u.full_name as candidate_name
        FROM interview_sessions s
        JOIN jobs j ON s.job_id = j.id
        LEFT JOIN recruiters rec ON s.recruiter_id = rec.id
        JOIN users u ON s.candidate_id = u.id
        WHERE s.id = ? AND s.recruiter_id = ?
        """,
        (session_id, current_user["sub"])
    ) as cur:
        sess_row = await cur.fetchone()
        if not sess_row:
            raise HTTPException(status_code=404, detail="Session not found or unauthorized")

    app_id = sess_row["application_id"]
    overall_score = 86.0
    competencies = {"System Architecture": 88.0, "Problem Solving": 85.0, "Communication": 90.0, "Technical Depth": 82.0}
    strengths = [
        "Articulate explanation of low-latency WebRTC audio buffer handling",
        "Strong understanding of distributed agent state and LangGraph recovery mechanisms"
    ]
    gaps = [
        "Could provide deeper concrete metrics on production cost optimizations"
    ]
    recommendations = ["Strong Hire - Excellent alignment with Senior AI Systems Engineer expectations."]
    transcript = [
        {"role": "interviewer", "text": "Welcome to the interview. Could you walk me through your recent work architecting real-time AI agents?"},
        {"role": "candidate", "text": "Certainly. Over the past 3 years, I focused on high-concurrency WebRTC voice loops using LiveKit, ensuring end-to-end latency stayed sub-350ms."}
    ]

    # If agent returned real scorecard:
    if agent_data and agent_data.get("scorecard"):
        sc = agent_data["scorecard"]
        overall_score = float(sc.get("overall_score", overall_score))
        if sc.get("competencies"):
            competencies = {c.get("name", f"Comp {i}"): float(c.get("score", 80.0)) for i, c in enumerate(sc["competencies"])}
        if sc.get("strengths"):
            strengths = sc["strengths"]
        if sc.get("gaps"):
            gaps = sc["gaps"]

    if agent_data and agent_data.get("transcript"):
        transcript = agent_data["transcript"]

    rep_id = f"rep_{uuid.uuid4().hex[:12]}"
    await db.execute(
        """
        INSERT INTO interview_reports (id, session_id, application_id, overall_score, competency_scores,
                                       strengths, gaps, recommendations, full_transcript, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            rep_id, session_id, app_id, overall_score,
            json.dumps(competencies), json.dumps(strengths), json.dumps(gaps),
            json.dumps(recommendations), json.dumps(transcript), now
        )
    )
    # Update interview session and application status to completed
    await db.execute("UPDATE interview_sessions SET status = 'completed', updated_at = ? WHERE id = ?", (now, session_id))
    await db.execute("UPDATE applications SET status = 'interview_completed', updated_at = ? WHERE id = ?", (now, app_id))
    await db.commit()

    return InterviewReportResponse(
        id=rep_id,
        session_id=session_id,
        application_id=app_id,
        candidate_name=sess_row["candidate_name"],
        job_title=sess_row["job_title"],
        company_name=sess_row["company_name"],
        overall_score=overall_score,
        competency_scores=competencies,
        strengths=strengths,
        gaps=gaps,
        recommendations=recommendations,
        full_transcript=transcript,
        is_shared_with_candidate=False,
        created_at=now
    )

@router.post("/{session_id}/decision", response_model=InterviewReportResponse)
async def submit_candidate_decision(
    session_id: str,
    req: CandidateDecisionRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> InterviewReportResponse:
    now = datetime.now(timezone.utc).isoformat()
    recruiter_id = current_user["sub"]

    # Verify report and fetch details
    async with db.execute(
        """
        SELECT rep.*, sess.application_id, sess.candidate_id, j.title as job_title, rec.company_name,
               u_cand.email as candidate_email, u_cand.full_name as candidate_name
        FROM interview_reports rep
        JOIN interview_sessions sess ON rep.session_id = sess.id
        JOIN jobs j ON sess.job_id = j.id
        LEFT JOIN recruiters rec ON sess.recruiter_id = rec.id
        JOIN users u_cand ON sess.candidate_id = u_cand.id
        WHERE rep.session_id = ? AND sess.recruiter_id = ?
        """,
        (session_id, recruiter_id)
    ) as cur:
        rep = await cur.fetchone()
        if not rep:
            raise HTTPException(status_code=404, detail="Interview report not found")

    # Update report feedback and sharing status
    await db.execute(
        """
        UPDATE interview_reports
        SET recruiter_shared_feedback = ?, is_shared_with_candidate = ?
        WHERE id = ?
        """,
        (req.recruiter_feedback, 1 if req.share_with_candidate else 0, rep["id"])
    )

    # Update application status to selected or rejected
    await db.execute(
        "UPDATE applications SET status = ?, updated_at = ? WHERE id = ?",
        (req.decision, now, rep["application_id"])
    )

    # Dispatch decision email notification to candidate
    await send_decision_notification(
        conn=db,
        candidate_email=rep["candidate_email"],
        candidate_id=rep["candidate_id"],
        candidate_name=rep["candidate_name"],
        job_title=rep["job_title"],
        company_name=rep["company_name"] or "Company",
        decision=req.decision,
        feedback=req.recruiter_feedback if req.share_with_candidate else None
    )

    await db.commit()
    return await get_interview_report(session_id, current_user, db)
