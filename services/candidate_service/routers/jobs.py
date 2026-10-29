from __future__ import annotations

import json
from typing import Any, List, Optional
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query

from services.common.database import get_db
from services.common.models import JobDetailResponse, JobResponse
from services.common.security import get_current_user_optional

router = APIRouter(prefix="/api/candidate/jobs", tags=["Candidate Job Discovery"])

@router.get("", response_model=List[JobResponse])
async def search_and_browse_jobs(
    q: Optional[str] = Query(None, description="Search keyword in title or description"),
    department: Optional[str] = Query(None, description="Filter by department"),
    location: Optional[str] = Query(None, description="Filter by location"),
    job_type: Optional[str] = Query(None, description="Filter by job type"),
    experience_level: Optional[str] = Query(None, description="Filter by seniority"),
    db: aiosqlite.Connection = Depends(get_db)
) -> List[JobResponse]:
    conditions = ["j.status = 'published'"]
    params: List[Any] = []

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        conditions.append("(LOWER(j.title) LIKE ? OR LOWER(j.description) LIKE ? OR LOWER(j.requirements) LIKE ?)")
        params.extend([term, term, term])

    if department:
        conditions.append("LOWER(j.department) = LOWER(?)")
        params.append(department)

    if location:
        conditions.append("LOWER(j.location) LIKE LOWER(?)")
        params.append(f"%{location}%")

    if job_type:
        conditions.append("LOWER(j.job_type) = LOWER(?)")
        params.append(job_type)

    if experience_level:
        conditions.append("LOWER(j.experience_level) = LOWER(?)")
        params.append(experience_level)

    query = f"""
        SELECT j.*, u.full_name as recruiter_name, r.company_name,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count,
               (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'shortlisted') as shortlisted_count
        FROM jobs j
        JOIN users u ON j.recruiter_id = u.id
        LEFT JOIN recruiters r ON u.id = r.id
        WHERE {' AND '.join(conditions)}
        ORDER BY j.created_at DESC
    """

    async with db.execute(query, params) as cursor:
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

@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_candidate_job_detail(
    job_id: str,
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
        WHERE j.id = ? AND j.status = 'published'
    """
    async with db.execute(query, (job_id,)) as cursor:
        r = await cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Job opening not found or no longer active")

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
