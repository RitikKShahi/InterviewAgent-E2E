-- Recruitment Platform Production Database Schema
-- Compatible with SQLite (default) and PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('recruiter', 'candidate')),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recruiters (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    department TEXT,
    phone TEXT,
    website TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,
    location TEXT,
    current_title TEXT,
    years_experience REAL DEFAULT 0,
    headline TEXT,
    bio TEXT,
    resume_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    recruiter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    department TEXT,
    location TEXT DEFAULT 'Remote',
    job_type TEXT DEFAULT 'Full-time',
    experience_level TEXT DEFAULT 'Mid-Senior',
    min_experience_years REAL DEFAULT 2.0,
    salary_range TEXT,
    description TEXT NOT NULL,
    requirements TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published', 'closed')),
    top_k INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_descriptions (
    id TEXT PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    parsed_skills TEXT DEFAULT '[]', -- JSON array of strings
    required_qualifications TEXT DEFAULT '[]', -- JSON array of strings
    responsibilities TEXT DEFAULT '[]', -- JSON array of strings
    role_overview TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_skills TEXT DEFAULT '[]', -- JSON array
    parsed_experience TEXT DEFAULT '[]', -- JSON array of objects
    parsed_education TEXT DEFAULT '[]', -- JSON array of objects
    parsed_projects TEXT DEFAULT '[]', -- JSON array of objects
    parsed_achievements TEXT DEFAULT '[]', -- JSON array of strings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
    cover_letter TEXT,
    status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN (
        'applied',
        'under_review',
        'shortlisted',
        'interview_scheduled',
        'interview_in_progress',
        'interview_completed',
        'selected',
        'rejected'
    )),
    manual_override BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, candidate_id) -- Enforces 1 application per candidate per job
);

CREATE TABLE IF NOT EXISTS resume_scores (
    id TEXT PRIMARY KEY,
    application_id TEXT UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    overall_score REAL NOT NULL,
    skills_score REAL NOT NULL,
    experience_score REAL NOT NULL,
    education_score REAL NOT NULL,
    relevance_score REAL NOT NULL,
    scoring_breakdown TEXT NOT NULL, -- JSON detailed breakdown
    match_explanation TEXT,
    is_eligible BOOLEAN DEFAULT 1,
    ranked_position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shortlists (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    application_id TEXT UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    is_auto_shortlisted BOOLEAN DEFAULT 1,
    override_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id TEXT PRIMARY KEY, -- e.g. sess_xxxx matching agent format
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recruiter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_start TIMESTAMP NOT NULL,
    scheduled_end TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 45,
    timezone TEXT DEFAULT 'UTC',
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN (
        'scheduled',
        'ready',
        'in_progress',
        'completed',
        'cancelled',
        'expired'
    )),
    access_token TEXT UNIQUE NOT NULL,
    secure_link TEXT NOT NULL,
    recruiter_notes TEXT,
    candidate_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_reports (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    overall_score REAL NOT NULL,
    competency_scores TEXT NOT NULL, -- JSON map
    strengths TEXT DEFAULT '[]', -- JSON array
    gaps TEXT DEFAULT '[]', -- JSON array
    recommendations TEXT DEFAULT '[]', -- JSON array
    full_transcript TEXT DEFAULT '[]', -- JSON array
    recruiter_shared_feedback TEXT,
    is_shared_with_candidate BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    recipient_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN (
        'shortlist',
        'interview_invite',
        'interview_rescheduled',
        'interview_reminder',
        'status_change',
        'selection_decision'
    )),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    error_message TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT, -- JSON
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_resume_scores_app ON resume_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_cand ON interview_sessions(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_rec ON interview_sessions(recruiter_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
