from __future__ import annotations

import json
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
import aiosqlite
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from services.common.config import get_settings
from services.common.database import get_db
from services.common.models import ResumeResponse
from services.common.parser import parse_resume_document
from services.common.security import require_candidate

router = APIRouter(prefix="/api/candidate", tags=["Candidate Profile & Resume"])

MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024   # 5 MB

@router.post("/resume/upload", response_model=ResumeResponse)
async def upload_candidate_resume(
    file: Optional[UploadFile] = File(None),
    pasted_text: Optional[str] = Form(None),
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> ResumeResponse:
    settings = get_settings()
    cand_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    resume_id = f"res_{uuid.uuid4().hex[:12]}"
    filename = "pasted_resume.txt"
    mime_type = "text/plain"
    file_size = 0
    os.makedirs(settings.upload_dir, exist_ok=True)
    save_path = os.path.join(settings.upload_dir, f"{resume_id}_{filename}")

    if file:
        filename = file.filename or "resume.pdf"
        mime_type = file.content_type or "application/octet-stream"

        # Validate file extensions
        valid_exts = (".pdf", ".docx", ".doc", ".txt")
        if not any(filename.lower().endswith(ext) for ext in valid_exts):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format. Please upload PDF, DOCX, or TXT (received: {filename})"
            )

        content = await file.read()
        file_size = len(content)
        if file_size > MAX_RESUME_SIZE:
            raise HTTPException(status_code=413, detail="Resume file exceeds 10MB limit.")

        save_path = os.path.join(settings.upload_dir, f"{resume_id}_{filename}")
        with open(save_path, "wb") as f:
            f.write(content)
    elif pasted_text and len(pasted_text.strip()) > 20:
        content_bytes = pasted_text.strip().encode("utf-8")
        file_size = len(content_bytes)
        with open(save_path, "wb") as f:
            f.write(content_bytes)
    else:
        raise HTTPException(status_code=400, detail="Please upload a resume file (PDF/DOCX/TXT) or provide pasted text.")

    # Parse document structure
    parsed = parse_resume_document(save_path, mime_type)

    await db.execute(
        """
        INSERT INTO resumes (id, candidate_id, filename, file_path, file_size, mime_type, raw_text,
                             parsed_skills, parsed_experience, parsed_education, parsed_projects, parsed_achievements, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            resume_id, cand_id, filename, save_path, file_size, mime_type, parsed["raw_text"],
            json.dumps(parsed["parsed_skills"]), json.dumps(parsed["parsed_experience"]),
            json.dumps(parsed["parsed_education"]), json.dumps(parsed["parsed_projects"]),
            json.dumps(parsed.get("parsed_achievements", [])), now
        )
    )

    # Update candidate record with discovered years of experience and latest resume
    await db.execute(
        "UPDATE candidates SET years_experience = COALESCE(NULLIF(?, 0), years_experience), resume_url = ? WHERE id = ?",
        (parsed["years_experience"], save_path, cand_id)
    )
    # Link candidate's applications to the updated resume
    await db.execute(
        "UPDATE applications SET resume_id = ? WHERE candidate_id = ?",
        (resume_id, cand_id)
    )

    await db.commit()

    return ResumeResponse(
        id=resume_id,
        candidate_id=cand_id,
        filename=filename,
        file_size=file_size,
        mime_type=mime_type,
        raw_text=parsed["raw_text"],
        parsed_skills=parsed["parsed_skills"],
        parsed_experience=parsed["parsed_experience"],
        parsed_education=parsed["parsed_education"],
        parsed_projects=parsed["parsed_projects"],
        parsed_achievements=parsed.get("parsed_achievements", []),
        created_at=now
    )

@router.get("/resume", response_model=Optional[ResumeResponse])
async def get_candidate_resume(
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> Optional[ResumeResponse]:
    async with db.execute(
        "SELECT * FROM resumes WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1",
        (current_user["sub"],)
    ) as cur:
        r = await cur.fetchone()
        if not r:
            return None

        keys = r.keys()
        achievements = []
        if "parsed_achievements" in keys and r["parsed_achievements"]:
            try:
                achievements = json.loads(r["parsed_achievements"])
            except Exception:
                achievements = []

        return ResumeResponse(
            id=r["id"],
            candidate_id=r["candidate_id"],
            filename=r["filename"],
            file_size=r["file_size"],
            mime_type=r["mime_type"],
            raw_text=r["raw_text"],
            parsed_skills=json.loads(r["parsed_skills"]) if r["parsed_skills"] else [],
            parsed_experience=json.loads(r["parsed_experience"]) if r["parsed_experience"] else [],
            parsed_education=json.loads(r["parsed_education"]) if r["parsed_education"] else [],
            parsed_projects=json.loads(r["parsed_projects"]) if r["parsed_projects"] else [],
            parsed_achievements=achievements,
            created_at=r["created_at"]
        )

# ── Student / Candidate Photo Upload & Retrieval ─────────────────────────────

@router.post("/photo/upload")
async def upload_candidate_photo(
    photo: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> dict[str, Any]:
    """Upload and set student / candidate profile photo."""
    upload_item = photo or file
    if not upload_item:
        raise HTTPException(status_code=400, detail="No photo file provided.")

    cand_id = current_user["sub"]
    settings = get_settings()

    filename = upload_item.filename or "student_photo.jpg"
    valid_exts = (".jpg", ".jpeg", ".png", ".webp")
    if not any(filename.lower().endswith(ext) for ext in valid_exts):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image format. Please upload JPG, PNG, or WEBP (received: {filename})"
        )

    content = await upload_item.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=413, detail="Photo file exceeds 5MB limit.")

    photos_dir = os.path.join(settings.upload_dir, "photos")
    os.makedirs(photos_dir, exist_ok=True)

    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    clean_cand = cand_id.replace("user_", "")
    photo_filename = f"photo_{clean_cand}_{uuid.uuid4().hex[:8]}{ext}"
    photo_path = os.path.join(photos_dir, photo_filename)

    with open(photo_path, "wb") as f:
        f.write(content)

    avatar_url = f"/api/candidate/photo/{photo_filename}"
    now = datetime.now(timezone.utc).isoformat()

    await db.execute("UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?", (avatar_url, now, cand_id))
    await db.commit()

    return {
        "status": "ok",
        "avatar_url": avatar_url,
        "message": "Student photo uploaded successfully!"
    }

@router.get("/photo/{filename}")
async def get_candidate_photo(filename: str):
    """Serve uploaded student photo files publicly for display."""
    settings = get_settings()
    clean_filename = os.path.basename(filename)
    photo_path = os.path.join(settings.upload_dir, "photos", clean_filename)
    if not os.path.exists(photo_path):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    mime, _ = mimetypes.guess_type(photo_path)
    return FileResponse(photo_path, media_type=mime or "image/jpeg")
