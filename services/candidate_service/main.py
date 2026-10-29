from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.common.config import get_settings
from services.common.database import init_db
from .routers import applications, auth, interviews, jobs, profile

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Ensure DB schema and seed data are initialized
    await init_db()
    yield

def create_candidate_app() -> FastAPI:
    app = FastAPI(
        title="DeepInterview — Candidate Service API",
        description="Production backend service for job seekers to manage profiles, upload resumes, discover published jobs, submit duplicate-safe applications, and access scheduled live interviews.",
        version="1.0.0",
        lifespan=lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"service": "candidate_service", "status": "ok", "version": "1.0.0"}

    app.include_router(auth.router)
    app.include_router(profile.router)
    app.include_router(jobs.router)
    app.include_router(applications.router)
    app.include_router(interviews.router)

    return app

app = create_candidate_app()

def main() -> None:
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host="0.0.0.0", port=settings.candidate_service_port)

if __name__ == "__main__":
    main()
