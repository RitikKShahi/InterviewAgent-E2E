from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, List
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.models import (
    JobCreateRequest,
    JobDetailResponse,
    JobResponse,
    JobUpdateRequest,
)
from services.common.parser import parse_job_description
from services.common.security import require_recruiter

router = APIRouter(prefix="/api/recruiter/jobs", tags=["Recruiter Jobs"])

@router.get("", response_model=List[JobResponse])
async def list_recruiter_jobs(
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> List[JobResponse]:
    recruiter_id = current_user["sub"]
    query = """
        SELECT j.*, u.full_name as recruiter_name, r.company_name,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'shortlisted') as shortlisted_count
        FROM jobs j
        JOIN users u ON j.recruiter_id = u.id
        LEFT JOIN recruiters r ON u.id = r.id
        WHERE j.recruiter_id = ?
        ORDER BY j.created_at DESC
    """
    async with db.execute(query, (recruiter_id,)) as cursor:
        rows = await cursor.fetchall()
        jobs = []
        for r in rows:
            jobs.append(JobResponse(
                id=r["id"],
                recruiter_id=r["recruiter_id"],
                recruiter_name=r["recruiter_name"],
                company_name=r["company_name"],
                title=r["title"],
                department=r["department"],
                location=r["location"],
                job_type=r["job_type"],
                experience_level=r["experience_level"],
                min_experience_years=r["min_experience_years"],
                salary_range=r["salary_range"],
                description=r["description"],
                requirements=r["requirements"],
                status=r["status"],
                top_k=r["top_k"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                applicant_count=r["applicant_count"],
                shortlisted_count=r["shortlisted_count"]
            ))
        return jobs

@router.post("", response_model=JobDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    req: JobCreateRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> JobDetailResponse:
    recruiter_id = current_user["sub"]
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    # Parse JD text into structured attributes
    parsed = parse_job_description(req.description + "\n" + (req.requirements or ""))

    await db.execute(
        """
        INSERT INTO jobs (id, recruiter_id, title, department, location, job_type, experience_level,
                          min_experience_years, salary_range, description, requirements, status, top_k, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job_id,
            recruiter_id,
            req.title,
            req.department or "Engineering",
            req.location or "Remote",
            req.job_type or "Full-time",
            req.experience_level or "Mid-Senior",
            req.min_experience_years,
            req.salary_range,
            req.description,
            req.requirements or ", ".join(parsed["parsed_skills"]),
            req.status or "published",
            req.top_k,
            now,
            now
        )
    )

    jd_id = f"jd_{uuid.uuid4().hex[:12]}"
    await db.execute(
        """
        INSERT INTO job_descriptions (id, job_id, raw_text, parsed_skills, required_qualifications, responsibilities, role_overview, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            jd_id,
            job_id,
            req.description,
            json.dumps(parsed["parsed_skills"]),
            json.dumps(parsed["required_qualifications"]),
            json.dumps(parsed["responsibilities"]),
            parsed["role_overview"],
            now
        )
    )

    await db.commit()

    return await get_job_detail(job_id, current_user, db)

@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job_detail(
    job_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> JobDetailResponse:
    query = """
        SELECT j.*, u.full_name as recruiter_name, r.company_name,
               jd.parsed_skills, jd.required_qualifications, jd.responsibilities, jd.role_overview,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'shortlisted') as shortlisted_count
        FROM jobs j
        JOIN users u ON j.recruiter_id = u.id
        LEFT JOIN recruiters r ON u.id = r.id
        LEFT JOIN job_descriptions jd ON j.id = jd.job_id
        WHERE j.id = ? AND j.recruiter_id = ?
    """
    async with db.execute(query, (job_id, current_user["sub"])) as cursor:
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Job opening not found or access denied")

        parsed_skills = json.loads(r["parsed_skills"]) if r["parsed_skills"] else []
        qualifications = json.loads(r["required_qualifications"]) if r["required_qualifications"] else []
        responsibilities = json.loads(r["responsibilities"]) if r["responsibilities"] else []

        return JobDetailResponse(
            id=r["id"],
            recruiter_id=r["recruiter_id"],
            recruiter_name=r["recruiter_name"],
            company_name=r["company_name"],
            title=r["title"],
            department=r["department"],
            location=r["location"],
            job_type=r["job_type"],
            experience_level=r["experience_level"],
            min_experience_years=r["min_experience_years"],
            salary_range=r["salary_range"],
            description=r["description"],
            requirements=r["requirements"],
            status=r["status"],
            top_k=r["top_k"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            applicant_count=r["applicant_count"],
            shortlisted_count=r["shortlisted_count"],
            parsed_skills=parsed_skills,
            required_qualifications=qualifications,
            responsibilities=responsibilities,
            role_overview=r["role_overview"]
        )

@router.put("/{job_id}", response_model=JobDetailResponse)
async def update_job(
    job_id: str,
    req: JobUpdateRequest,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> JobDetailResponse:
    recruiter_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    updates = ["updated_at = ?"]
    params: List[Any] = [now]

    if req.title is not None:
        updates.append("title = ?")
        params.append(req.title)
    if req.department is not None:
        updates.append("department = ?")
        params.append(req.department)
    if req.location is not None:
        updates.append("location = ?")
        params.append(req.location)
    if req.job_type is not None:
        updates.append("job_type = ?")
        params.append(req.job_type)
    if req.experience_level is not None:
        updates.append("experience_level = ?")
        params.append(req.experience_level)
    if req.min_experience_years is not None:
        updates.append("min_experience_years = ?")
        params.append(req.min_experience_years)
    if req.salary_range is not None:
        updates.append("salary_range = ?")
        params.append(req.salary_range)
    if req.description is not None:
        updates.append("description = ?")
        params.append(req.description)
    if req.requirements is not None:
        updates.append("requirements = ?")
        params.append(req.requirements)
    if req.top_k is not None:
        updates.append("top_k = ?")
        params.append(req.top_k)
    if req.status is not None:
        updates.append("status = ?")
        params.append(req.status)

    params.extend([job_id, recruiter_id])
    res = await db.execute(f"UPDATE jobs SET {', '.join(updates)} WHERE id = ? AND recruiter_id = ?", params)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job opening not found or access denied")

    await db.commit()
    return await get_job_detail(job_id, current_user, db)

@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> dict[str, bool]:
    res = await db.execute("DELETE FROM jobs WHERE id = ? AND recruiter_id = ?", (job_id, current_user["sub"]))
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Job not found or access denied")
    await db.commit()
    return {"deleted": True}
