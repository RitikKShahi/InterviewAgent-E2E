from __future__ import annotations

import email.message
import os
import smtplib
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
import aiosqlite

from .config import REPO_ROOT, get_settings

EMAIL_LOG_FILE = REPO_ROOT / ".logs" / "recruitment_emails.log"

async def dispatch_notification(
    conn: aiosqlite.Connection,
    recipient_email: str,
    recipient_id: Optional[str],
    notif_type: str,
    subject: str,
    body: str,
    idempotency_key: Optional[str] = None
) -> dict[str, Any]:
    """Send an email notification via SMTP or mock dispatcher with idempotency and audit tracking."""
    settings = get_settings()
    now = datetime.now(timezone.utc).isoformat()

    # Check idempotency: avoid duplicate sending
    if idempotency_key:
        async with conn.execute(
            "SELECT * FROM notifications WHERE idempotency_key = ?",
            (idempotency_key,)
        ) as cursor:
            existing = await cursor.fetchone()
            if existing and existing["status"] == "sent":
                return dict(existing)

    notif_id = f"notif_{uuid.uuid4().hex[:12]}"
    attempts = 1
    status = "sent"
    error_msg = None

    # If real SMTP is configured, attempt delivery
    if settings.smtp_host:
        try:
            msg = email.message.EmailMessage()
            msg["Subject"] = subject
            msg["From"] = settings.smtp_from
            msg["To"] = recipient_email
            msg.set_content(body)

            # Send via smtplib
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_tls:
                    server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        except Exception as exc:
            status = "failed"
            error_msg = str(exc)

    # In dev or simulated mode: write to log file
    os.makedirs(os.path.dirname(EMAIL_LOG_FILE), exist_ok=True)
    with open(EMAIL_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"\n{'='*70}\n")
        f.write(f"TIMESTAMP: {now}\n")
        f.write(f"TO: {recipient_email} (ID: {recipient_id or 'none'})\n")
        f.write(f"TYPE: {notif_type} | STATUS: {status}\n")
        f.write(f"SUBJECT: {subject}\n")
        f.write(f"BODY:\n{body}\n")
        f.write(f"{'='*70}\n")

    # Persist in DB
    await conn.execute(
        """
        INSERT INTO notifications (id, recipient_email, recipient_id, type, subject, body, status, attempts, last_attempt_at, error_message, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(idempotency_key) DO UPDATE SET
            status = excluded.status,
            attempts = notifications.attempts + 1,
            last_attempt_at = excluded.last_attempt_at,
            error_message = excluded.error_message
        """,
        (notif_id, recipient_email, recipient_id, notif_type, subject, body, status, attempts, now, error_msg, idempotency_key, now)
    )
    await conn.commit()

    return {
        "id": notif_id,
        "recipient_email": recipient_email,
        "type": notif_type,
        "subject": subject,
        "status": status,
        "attempts": attempts,
        "created_at": now
    }

async def send_shortlist_notification(
    conn: aiosqlite.Connection,
    candidate_email: str,
    candidate_id: str,
    candidate_name: str,
    job_title: str,
    company_name: str
) -> dict[str, Any]:
    subject = f"Congratulations! You've been shortlisted for {job_title} at {company_name}"
    body = f"""Dear {candidate_name},

Great news! The hiring team at {company_name} reviewed your application and resume for the {job_title} position.

Based on our evaluation, you have been shortlisted for the next stage of our recruitment process.

What happens next:
Our team will be scheduling an AI-conducted technical interview session with you shortly. You will receive an invitation email containing the exact date, time, and your private, secure interview session link.

Thank you for your interest in joining {company_name}!

Best regards,
Talent Acquisition Team
{company_name}"""

    idemp_key = f"shortlist_{candidate_id}_{job_title.lower().replace(' ', '_')}"
    return await dispatch_notification(
        conn, candidate_email, candidate_id, "shortlist", subject, body, idemp_key
    )

async def send_interview_invite_notification(
    conn: aiosqlite.Connection,
    candidate_email: str,
    candidate_id: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    scheduled_start: str,
    duration_minutes: int,
    timezone_str: str,
    secure_link: str
) -> dict[str, Any]:
    subject = f"Interview Invitation: {job_title} at {company_name}"
    body = f"""Dear {candidate_name},

You are invited to an AI Voice Agent Technical Interview for the {job_title} role at {company_name}.

Interview Schedule:
• Date & Time: {scheduled_start} ({timezone_str})
• Duration: {duration_minutes} minutes
• Join URL: {secure_link}

How to prepare:
1. Ensure you are in a quiet room with a reliable internet connection.
2. Allow browser microphone access when prompted.
3. You will interact with our autonomous voice interviewer, who will ask questions tailored to the {job_title} role and your resume background.
4. You may speak naturally or use the interactive text fallback if needed.

If you have any questions or need to reschedule, please notify the recruitment team as soon as possible.

We look forward to speaking with you!

Warm regards,
Recruitment Operations
{company_name}"""

    idemp_key = f"invite_{candidate_id}_{scheduled_start}"
    return await dispatch_notification(
        conn, candidate_email, candidate_id, "interview_invite", subject, body, idemp_key
    )

async def send_decision_notification(
    conn: aiosqlite.Connection,
    candidate_email: str,
    candidate_id: str,
    candidate_name: str,
    job_title: str,
    company_name: str,
    decision: str,
    feedback: Optional[str] = None
) -> dict[str, Any]:
    if decision == "selected":
        subject = f"Offer Update: Selection Decision for {job_title} at {company_name}"
        body = f"""Dear {candidate_name},

We are thrilled to inform you that following your interview evaluation, the hiring committee at {company_name} has selected you for the {job_title} role!

{f"Hiring Team Feedback:\n{feedback}\n" if feedback else ""}
Our team will follow up shortly with details regarding formal offer documentation, compensation, and onboarding.

Congratulations on your exceptional performance!

Best regards,
Hiring Committee
{company_name}"""
    else:
        subject = f"Update on your application for {job_title} at {company_name}"
        body = f"""Dear {candidate_name},

Thank you for taking the time to interview for the {job_title} position at {company_name}.

After careful review of all candidates, we have decided to move forward with other applicants whose background more closely matches our immediate technical priorities at this stage.

{f"Feedback from your interview evaluation:\n{feedback}\n" if feedback else ""}
We appreciate your time, effort, and interest in {company_name}, and wish you continued success in your career.

Warm regards,
Talent Acquisition Team
{company_name}"""

    idemp_key = f"decision_{candidate_id}_{decision}_{job_title.lower().replace(' ', '_')}"
    return await dispatch_notification(
        conn, candidate_email, candidate_id, "selection_decision", subject, body, idemp_key
    )
