from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status

from services.common.database import get_db
from services.common.models import (
    RecruiterProfileUpdate,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from services.common.security import (
    create_access_token,
    hash_password,
    require_recruiter,
    verify_password,
)

router = APIRouter(prefix="/api/recruiter/auth", tags=["Recruiter Auth"])

@router.post("/register", response_model=TokenResponse)
async def register_recruiter(
    req: UserRegisterRequest,
    db: aiosqlite.Connection = Depends(get_db)
) -> TokenResponse:
    if req.role != "recruiter":
        raise HTTPException(status_code=400, detail="Role must be 'recruiter'")
        
    # Check if email taken
    async with db.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),)) as cursor:
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="An account with this email already exists")

    user_id = f"user_rec_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    pw_hash = hash_password(req.password)

    await db.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'recruiter', ?, ?)
        """,
        (user_id, req.email.lower(), pw_hash, req.full_name, now, now)
    )

    company = req.company_name or "Independent Recruiter"
    dept = req.department or "Talent Acquisition"
    await db.execute(
        """
        INSERT INTO recruiters (id, company_name, department, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, company, dept, now)
    )
    await db.commit()

    token = create_access_token({"sub": user_id, "email": req.email.lower(), "role": "recruiter", "name": req.full_name})
    user_resp = UserResponse(
        id=user_id,
        email=req.email.lower(),
        full_name=req.full_name,
        role="recruiter",
        company_name=company,
        department=dept,
        created_at=now
    )
    return TokenResponse(access_token=token, user=user_resp)

@router.post("/login", response_model=TokenResponse)
async def login_recruiter(
    req: UserLoginRequest,
    db: aiosqlite.Connection = Depends(get_db)
) -> TokenResponse:
    async with db.execute(
        """
        SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.created_at,
               r.company_name, r.department
        FROM users u
        LEFT JOIN recruiters r ON u.id = r.id
        WHERE u.email = ? AND u.role = 'recruiter'
        """,
        (req.email.lower(),)
    ) as cursor:
        row = await cursor.fetchone()
        if not row or not verify_password(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token({"sub": row["id"], "email": row["email"], "role": "recruiter", "name": row["full_name"]})
        user_resp = UserResponse(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            role="recruiter",
            company_name=row["company_name"],
            department=row["department"],
            created_at=row["created_at"]
        )
        return TokenResponse(access_token=token, user=user_resp)

@router.get("/me", response_model=UserResponse)
async def get_recruiter_me(
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> UserResponse:
    async with db.execute(
        """
        SELECT u.id, u.email, u.full_name, u.role, u.avatar_url, u.created_at,
               r.company_name, r.department, r.phone, r.website
        FROM users u
        LEFT JOIN recruiters r ON u.id = r.id
        WHERE u.id = ?
        """,
        (current_user["sub"],)
    ) as cursor:
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            role="recruiter",
            avatar_url=row["avatar_url"],
            company_name=row["company_name"],
            department=row["department"],
            created_at=row["created_at"]
        )

@router.put("/profile", response_model=UserResponse)
async def update_recruiter_profile(
    req: RecruiterProfileUpdate,
    current_user: dict[str, Any] = Depends(require_recruiter),
    db: aiosqlite.Connection = Depends(get_db)
) -> UserResponse:
    uid = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    if req.full_name:
        await db.execute("UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?", (req.full_name, now, uid))
    
    updates = []
    params = []
    if req.company_name is not None:
        updates.append("company_name = ?")
        params.append(req.company_name)
    if req.department is not None:
        updates.append("department = ?")
        params.append(req.department)
    if req.phone is not None:
        updates.append("phone = ?")
        params.append(req.phone)
    if req.website is not None:
        updates.append("website = ?")
        params.append(req.website)

    if updates:
        params.append(uid)
        await db.execute(f"UPDATE recruiters SET {', '.join(updates)} WHERE id = ?", params)

    await db.commit()
    return await get_recruiter_me(current_user, db)
