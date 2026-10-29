from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, List
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.email_service import send_shortlist_notification
from services.common.models import ShortlistResponse, TopKRunRequest
from services.common.scoring import calculate_resume_score
from services.common.security import require_recruiter
from .applicants import list_job_applicants

router = APIRouter(prefix="/api/recruiter/jobs", tags=["Top-K Shortlisting"])

@router.post("/{job_id}/top-k", response_model=ShortlistResponse)
async def run_top_k_shortlisting(
    job_id: str,
    req: TopKRunRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> ShortlistResponse:
    recruiter_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    # Verify job ownership and fetch JD details
    async with db.execute(
        """
        SELECT j.*, jd.raw_text as jd_raw_text, jd.parsed_skills as jd_parsed_skills,
               r.company_name
        FROM jobs j
        LEFT JOIN recruiters r ON j.recruiter_id = r.id
        LEFT JOIN job_descriptions jd ON j.id = jd.job_id
        WHERE j.id = ? AND j.recruiter_id = ?
        """,
        (job_id, recruiter_id)
    ) as cur:
        job = await cur.fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job opening not found or access denied")

    top_k = req.top_k or job["top_k"]
    min_score = req.min_threshold_score if req.min_threshold_score is not None else 50.0

    jd_skills = json.loads(job["jd_parsed_skills"]) if job["jd_parsed_skills"] else []
    jd_raw_text = job["jd_raw_text"] or job["description"]
    jd_min_years = job["min_experience_years"]
    company_name = job["company_name"] or "Company"

    # Fetch all applications and their resumes
    query = """
        SELECT a.id as app_id, a.candidate_id, a.status as app_status, a.manual_override,
               u.email as candidate_email, u.full_name as candidate_name,
               c.years_experience as cand_exp,
               res.id as resume_id, res.raw_text as resume_raw_text,
               res.parsed_skills, res.parsed_education,
               rs.id as existing_score_id, rs.overall_score
        FROM applications a
        JOIN users u ON a.candidate_id = u.id
        LEFT JOIN candidates c ON u.id = c.id
        LEFT JOIN resumes res ON a.resume_id = res.id
        LEFT JOIN resume_scores rs ON a.id = rs.application_id
        WHERE a.job_id = ?
    """
    async with db.execute(query, (job_id,)) as cur:
        applications = await cur.fetchall()

    if not applications:
        return ShortlistResponse(
            job_id=job_id,
            top_k_applied=top_k,
            shortlisted_candidates=[],
            total_evaluated=0,
            message="No applicants found for this job opening."
        )

    evaluated_candidates = []

    for app in applications:
        app_id = app["app_id"]
        cand_skills = json.loads(app["parsed_skills"]) if app["parsed_skills"] else []
        cand_edu = json.loads(app["parsed_education"]) if app["parsed_education"] else []
        cand_exp = app["cand_exp"] or 1.0
        resume_text = app["resume_raw_text"] or ""

        # Compute or reuse explainable score
        overall, s_score, e_score, ed_score, r_score, breakdown, explanation, is_eligible = calculate_resume_score(
            candidate_skills=cand_skills,
            candidate_years_exp=cand_exp,
            candidate_education=cand_edu,
            candidate_raw_text=resume_text,
            jd_skills=jd_skills,
            jd_min_years_exp=jd_min_years,
            jd_raw_text=jd_raw_text
        )

        score_id = app["existing_score_id"] or f"score_{app_id}"
        await db.execute(
            """
            INSERT INTO resume_scores (id, application_id, overall_score, skills_score, experience_score,
                                      education_score, relevance_score, scoring_breakdown, match_explanation, is_eligible, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(application_id) DO UPDATE SET
                overall_score = excluded.overall_score,
                skills_score = excluded.skills_score,
                experience_score = excluded.experience_score,
                education_score = excluded.education_score,
                relevance_score = excluded.relevance_score,
                scoring_breakdown = excluded.scoring_breakdown,
                match_explanation = excluded.match_explanation,
                is_eligible = excluded.is_eligible
            """,
            (
                score_id, app_id, overall, s_score, e_score, ed_score, r_score,
                breakdown.model_dump_json(), explanation, 1 if is_eligible else 0, now
            )
        )

        evaluated_candidates.append({
            "app_id": app_id,
            "candidate_id": app["candidate_id"],
            "candidate_email": app["candidate_email"],
            "candidate_name": app["candidate_name"],
            "overall_score": overall,
            "is_eligible": is_eligible and (overall >= min_score),
            "manual_override": bool(app["manual_override"]),
            "current_status": app["app_status"]
        })

    # Sort descending by overall score
    evaluated_candidates.sort(key=lambda x: x["overall_score"], reverse=True)

    # Clear previous auto-shortlists (keep manual overrides)
    await db.execute("DELETE FROM shortlists WHERE job_id = ? AND is_auto_shortlisted = 1", (job_id,))

    # Rank and select Top K
    rank = 1
    shortlisted_apps = []
    for cand in evaluated_candidates:
        app_id = cand["app_id"]
        # Update rank position on resume_scores
        await db.execute("UPDATE resume_scores SET ranked_position = ? WHERE application_id = ?", (rank, app_id))

        if rank <= top_k and cand["is_eligible"]:
            # If not manually overridden to rejected/under_review
            if not cand["manual_override"] or cand["current_status"] == "shortlisted":
                await db.execute(
                    """
                    INSERT INTO shortlists (id, job_id, application_id, rank, is_auto_shortlisted, override_reason, created_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    ON CONFLICT(application_id) DO UPDATE SET rank = excluded.rank
                    """,
                    (f"shortlist_{app_id}", job_id, app_id, rank, f"Top {rank} candidate with score {cand['overall_score']}", now)
                )

                if cand["current_status"] != "shortlisted":
                    await db.execute("UPDATE applications SET status = 'shortlisted', updated_at = ? WHERE id = ?", (now, app_id))
                    # Trigger shortlist notification
                    await send_shortlist_notification(
                        db, cand["candidate_email"], cand["candidate_id"], cand["candidate_name"],
                        job["title"], company_name
                    )
            shortlisted_apps.append(app_id)
        elif not cand["manual_override"]:
            # Candidate not in top-k
            if cand["current_status"] in ("applied", "shortlisted"):
                await db.execute("UPDATE applications SET status = 'under_review', updated_at = ? WHERE id = ?", (now, app_id))

        rank += 1

    # Record audit log
    await db.execute(
        """
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, 'run_top_k_shortlisting', 'job', ?, ?, ?)
        """,
        (f"audit_topk_{job_id}_{now}", recruiter_id, job_id, json.dumps({"top_k": top_k, "evaluated": len(evaluated_candidates), "shortlisted": len(shortlisted_apps)}), now)
    )

    await db.commit()

    # Return refreshed applicant list
    all_applicants = await list_job_applicants(job_id, current_user, db)
    shortlisted_only = [a for a in all_applicants if a.status == "shortlisted"]

    return ShortlistResponse(
        job_id=job_id,
        top_k_applied=top_k,
        shortlisted_candidates=shortlisted_only,
        total_evaluated=len(evaluated_candidates),
        message=f"Successfully evaluated {len(evaluated_candidates)} applicants and shortlisted top {len(shortlisted_only)} candidates."
    )
