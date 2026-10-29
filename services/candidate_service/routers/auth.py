from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.models import (
    CandidateProfileUpdate,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from services.common.security import (
    create_access_token,
    hash_password,
    require_candidate,
    verify_password,
)

router = APIRouter(prefix="/api/candidate/auth", tags=["Candidate Auth"])

@router.post("/register", response_model=TokenResponse)
async def register_candidate(
    req: UserRegisterRequest,
    db: aiosqlite.Connection = Depends(get_db)
) -> TokenResponse:
    if req.role != "candidate":
        raise HTTPException(status_code=400, detail="Role must be 'candidate'")

    async with db.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),)) as cursor:
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="An account with this email already exists")

    user_id = f"user_cand_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    pw_hash = hash_password(req.password)

    await db.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'candidate', ?, ?)
        """,
        (user_id, req.email.lower(), pw_hash, req.full_name, now, now)
    )

    await db.execute(
        """
        INSERT INTO candidates (id, phone, location, current_title, years_experience, headline, bio, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            "",
            req.location or "Remote",
            req.current_title or "Software Engineer",
            req.years_experience or 0.0,
            f"{req.current_title or 'Software Engineer'} with {req.years_experience or 0.0} yrs experience",
            "",
            now
        )
    )
    await db.commit()

    token = create_access_token({"sub": user_id, "email": req.email.lower(), "role": "candidate", "name": req.full_name})
    user_resp = UserResponse(
        id=user_id,
        email=req.email.lower(),
        full_name=req.full_name,
        role="candidate",
        location=req.location,
        current_title=req.current_title,
        years_experience=req.years_experience,
        created_at=now
    )
    return TokenResponse(access_token=token, user=user_resp)

@router.post("/login", response_model=TokenResponse)
async def login_candidate(
    req: UserLoginRequest,
    db: aiosqlite.Connection = Depends(get_db)
) -> TokenResponse:
    async with db.execute(
        """
        SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.created_at,
               c.phone, c.location, c.current_title, c.years_experience, c.headline, c.bio
        FROM users u
        LEFT JOIN candidates c ON u.id = c.id
        WHERE u.email = ? AND u.role = 'candidate'
        """,
        (req.email.lower(),)
    ) as cursor:
        row = await cursor.fetchone()
        if not row or not verify_password(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token({"sub": row["id"], "email": row["email"], "role": "candidate", "name": row["full_name"]})
        user_resp = UserResponse(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            role="candidate",
            location=row["location"],
            current_title=row["current_title"],
            years_experience=row["years_experience"],
            headline=row["headline"],
            bio=row["bio"],
            created_at=row["created_at"]
        )
        return TokenResponse(access_token=token, user=user_resp)

@router.get("/me", response_model=UserResponse)
async def get_candidate_me(
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> UserResponse:
    async with db.execute(
        """
        SELECT u.id, u.email, u.full_name, u.role, u.avatar_url, u.created_at,
               c.phone, c.location, c.current_title, c.years_experience, c.headline, c.bio, c.resume_url
        FROM users u
        LEFT JOIN candidates c ON u.id = c.id
        WHERE u.id = ?
        """,
        (current_user["sub"],)
    ) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Candidate not found")
        return UserResponse(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            role="candidate",
            avatar_url=row["avatar_url"],
            location=row["location"],
            current_title=row["current_title"],
            years_experience=row["years_experience"],
            headline=row["headline"],
            bio=row["bio"],
            created_at=row["created_at"]
        )

@router.put("/profile", response_model=UserResponse)
async def update_candidate_profile(
    req: CandidateProfileUpdate,
    current_user: dict[str, Any] = Depends(require_candidate),
    db: aiosqlite.Connection = Depends(get_db)
) -> UserResponse:
    uid = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    if req.full_name:
        await db.execute("UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?", (req.full_name, now, uid))

    updates = []
    params = []
    if req.phone is not None:
        updates.append("phone = ?")
        params.append(req.phone)
    if req.location is not None:
        updates.append("location = ?")
        params.append(req.location)
    if req.current_title is not None:
        updates.append("current_title = ?")
        params.append(req.current_title)
    if req.years_experience is not None:
        updates.append("years_experience = ?")
        params.append(req.years_experience)
    if req.headline is not None:
        updates.append("headline = ?")
        params.append(req.headline)
    if req.bio is not None:
        updates.append("bio = ?")
        params.append(req.bio)

    if updates:
        params.append(uid)
        await db.execute(f"UPDATE candidates SET {', '.join(updates)} WHERE id = ?", params)

    await db.commit()
    return await get_candidate_me(current_user, db)
