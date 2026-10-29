from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, EmailStr, Field

# ── User & Auth Models ─────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2)
    role: str = Field(pattern="^(recruiter|candidate)$")
    # Optional recruiter profile fields
    company_name: Optional[str] = None
    department: Optional[str] = None
    # Optional candidate profile fields
    location: Optional[str] = None
    current_title: Optional[str] = None
    years_experience: Optional[float] = 0.0

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
    # Included details based on role
    company_name: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    current_title: Optional[str] = None
    years_experience: Optional[float] = None
    headline: Optional[str] = None
    bio: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CandidateProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    current_title: Optional[str] = None
    years_experience: Optional[float] = None
    headline: Optional[str] = None
    bio: Optional[str] = None

class RecruiterProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None

# ── Job Models ────────────────────────────────────────────────────────────────

class JobCreateRequest(BaseModel):
    title: str = Field(min_length=3)
    department: Optional[str] = "Engineering"
    location: Optional[str] = "Remote"
    job_type: Optional[str] = "Full-time"
    experience_level: Optional[str] = "Mid-Senior"
    min_experience_years: float = 2.0
    salary_range: Optional[str] = None
    description: str = Field(min_length=20)
    requirements: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=50)
    status: Optional[str] = "published"

class JobUpdateRequest(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    min_experience_years: Optional[float] = None
    salary_range: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    top_k: Optional[int] = None
    status: Optional[str] = None

class JobResponse(BaseModel):
    id: str
    recruiter_id: str
    recruiter_name: Optional[str] = None
    company_name: Optional[str] = None
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    min_experience_years: float
    salary_range: Optional[str] = None
    description: str
    requirements: Optional[str] = None
    status: str
    top_k: int
    created_at: str
    updated_at: str
    applicant_count: int = 0
    shortlisted_count: int = 0

class JobDetailResponse(JobResponse):
    parsed_skills: List[str] = []
    required_qualifications: List[str] = []
    responsibilities: List[str] = []
    role_overview: Optional[str] = None

# ── Resume & Application Models ───────────────────────────────────────────────

class ResumeResponse(BaseModel):
    id: str
    candidate_id: str
    filename: str
    file_size: int
    mime_type: str
    raw_text: str
    parsed_skills: List[str] = []
    parsed_experience: List[dict[str, Any]] = []
    parsed_education: List[dict[str, Any]] = []
    parsed_projects: List[dict[str, Any]] = []
    parsed_achievements: List[str] = []
    created_at: str

class ApplicationCreateRequest(BaseModel):
    job_id: str
    cover_letter: Optional[str] = None
    # If candidate already has an uploaded resume, can reference it or upload new
    resume_id: Optional[str] = None

class ScoreBreakdown(BaseModel):
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    skills_match_pct: float = 0.0
    experience_years_found: float = 0.0
    experience_years_required: float = 0.0
    experience_match_pct: float = 0.0
    education_degree: Optional[str] = None
    education_match_pct: float = 0.0
    relevance_match_pct: float = 0.0
    strengths: List[str] = []
    gaps: List[str] = []

class ResumeScoreResponse(BaseModel):
    id: str
    application_id: str
    overall_score: float
    skills_score: float
    experience_score: float
    education_score: float
    relevance_score: float
    scoring_breakdown: ScoreBreakdown
    match_explanation: Optional[str] = None
    is_eligible: bool = True
    ranked_position: Optional[int] = None
    created_at: str

class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    candidate_id: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    candidate_location: Optional[str] = None
    candidate_experience: Optional[float] = None
    candidate_avatar_url: Optional[str] = None
    resume_id: Optional[str] = None
    resume_filename: Optional[str] = None
    cover_letter: Optional[str] = None
    status: str
    manual_override: bool = False
    created_at: str
    updated_at: str
    score: Optional[ResumeScoreResponse] = None
    interview_session_id: Optional[str] = None
    interview_status: Optional[str] = None
    # Rich parsed resume details
    parsed_skills: Optional[List[str]] = None
    parsed_experience: Optional[List[dict[str, Any]]] = None
    parsed_education: Optional[List[dict[str, Any]]] = None
    parsed_projects: Optional[List[dict[str, Any]]] = None
    parsed_achievements: Optional[List[str]] = None

class ApplicationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(applied|under_review|shortlisted|interview_scheduled|interview_in_progress|interview_completed|selected|rejected)$")
    notes: Optional[str] = None

class ManualOverrideRequest(BaseModel):
    target_status: str = Field(pattern="^(shortlisted|under_review|rejected)$")
    override_reason: str = Field(min_length=3)

# ── Top-K Shortlisting Models ─────────────────────────────────────────────────

class TopKRunRequest(BaseModel):
    job_id: str
    top_k: Optional[int] = None  # If not provided, uses job's configured top_k
    min_threshold_score: Optional[float] = 50.0

class ShortlistResponse(BaseModel):
    job_id: str
    top_k_applied: int
    shortlisted_candidates: List[ApplicationResponse]
    total_evaluated: int
    message: str

# ── Interview Scheduling Models ───────────────────────────────────────────────

class ScheduleInterviewRequest(BaseModel):
    application_id: str
    scheduled_start: str  # ISO-8601 string
    duration_minutes: int = Field(default=45, ge=15, le=120)
    timezone: str = "UTC"
    recruiter_notes: Optional[str] = None

class RescheduleInterviewRequest(BaseModel):
    scheduled_start: str
    duration_minutes: Optional[int] = None
    timezone: Optional[str] = None
    reason: Optional[str] = None

class InterviewSessionResponse(BaseModel):
    id: str
    application_id: str
    job_id: str
    job_title: Optional[str] = None
    candidate_id: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    recruiter_id: str
    recruiter_name: Optional[str] = None
    company_name: Optional[str] = None
    scheduled_start: str
    scheduled_end: str
    duration_minutes: int
    timezone: str
    status: str
    access_token: str
    secure_link: str
    recruiter_notes: Optional[str] = None
    candidate_feedback: Optional[str] = None
    created_at: str
    updated_at: str

# ── Evaluation & Selection Models ─────────────────────────────────────────────

class InterviewReportResponse(BaseModel):
    id: str
    session_id: str
    application_id: str
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    overall_score: float
    competency_scores: dict[str, float] = {}
    strengths: List[str] = []
    gaps: List[str] = []
    recommendations: List[str] = []
    full_transcript: List[dict[str, Any]] = []
    recruiter_shared_feedback: Optional[str] = None
    is_shared_with_candidate: bool = False
    created_at: str

class CandidateDecisionRequest(BaseModel):
    decision: str = Field(pattern="^(selected|rejected)$")
    recruiter_feedback: Optional[str] = None
    share_with_candidate: bool = False

# ── Analytics Models ──────────────────────────────────────────────────────────

class RecruiterAnalyticsResponse(BaseModel):
    total_jobs: int
    active_jobs: int
    total_applicants: int
    shortlisted_applicants: int
    interviews_scheduled: int
    interviews_completed: int
    candidates_selected: int
    avg_resume_score: float
    funnel: dict[str, int]
