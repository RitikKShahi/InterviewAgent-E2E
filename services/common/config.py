from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    app_env: str = "development"
    
    # Database
    db_path: str = str(REPO_ROOT / "services" / "data" / "recruitment.db")
    database_url: str = ""
    
    # Security
    jwt_secret: str = "deepinterview-recruitment-production-secret-key-32chars"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours
    
    # Service ports
    recruiter_service_port: int = 8002
    candidate_service_port: int = 8003
    agent_api_url: str = "http://localhost:8000"
    web_app_url: str = "http://localhost:3000"
    
    # Email / SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "recruitment@deepinterview.ai"
    smtp_tls: bool = True
    
    # Upload storage
    upload_dir: str = str(REPO_ROOT / "services" / "data" / "uploads")
    
    # Internal secret
    internal_api_secret: str = ""
    gemini_api_key: str = ""

    model_config = {
        "env_file": str(REPO_ROOT / ".env"),
        "extra": "ignore"
    }

_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        os.makedirs(_settings.upload_dir, exist_ok=True)
        os.makedirs(os.path.dirname(_settings.db_path), exist_ok=True)
    return _settings
