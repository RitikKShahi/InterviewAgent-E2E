from __future__ import annotations

import base64
from typing import Any, Optional
import httpx

from .config import get_settings

class AgentClient:
    """Adapter for communicating with the DeepInterview live voice agent API."""

    def __init__(self, base_url: Optional[str] = None) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.agent_api_url).rstrip("/")
        self.secret = settings.internal_api_secret

    def _headers(self) -> dict[str, str]:
        headers = {"content-type": "application/json"}
        if self.secret:
            headers["x-internal-secret"] = self.secret
        return headers

    async def check_health(self) -> bool:
        """Ping agent API health endpoint."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/health")
                return res.status_code == 200
        except Exception:
            return False

    async def initialize_session(
        self,
        cv_text: str,
        jd_text: str,
        company: str,
        user_id: Optional[str] = None
    ) -> str:
        """Call POST /api/prep to start prep pipeline and mint session_id."""
        # Convert plain cv_text to data URL so markitdown/extractor can read it seamlessly
        cv_b64 = base64.b64encode(cv_text.encode("utf-8")).decode("ascii")
        cv_url = f"data:text/plain;charset=utf-8;base64,{cv_b64}"

        payload = {
            "cv_url": cv_url,
            "jd_text": jd_text,
            "company": company,
            "language_mode": {"primary": "en", "mixed": False},
            "user_id": user_id
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    f"{self.base_url}/api/prep",
                    json=payload,
                    headers=self._headers()
                )
                if res.status_code == 200:
                    data = res.json()
                    return data.get("session_id", "")
        except Exception:
            pass

        return ""

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Fetch session status, context, transcript, and scorecard from GET /api/session/{id}."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    f"{self.base_url}/api/session/{session_id}",
                    headers=self._headers()
                )
                if res.status_code == 200:
                    return res.json()
        except Exception:
            pass
        return None

    async def trigger_score(self, session_id: str) -> dict[str, Any] | None:
        """Trigger POST /api/score for a completed interview."""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    f"{self.base_url}/api/score",
                    json={"session_id": session_id},
                    headers=self._headers()
                )
                if res.status_code == 200:
                    return res.json()
        except Exception:
            pass
        return None

_agent_client: AgentClient | None = None

def get_agent_client() -> AgentClient:
    global _agent_client
    if _agent_client is None:
        _agent_client = AgentClient()
    return _agent_client
