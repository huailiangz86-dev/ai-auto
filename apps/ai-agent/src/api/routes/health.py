# ============================================================
# AI auto - AI Agent Service
# Health Check Routes
# ============================================================

from fastapi import APIRouter
from pydantic import BaseModel

from src.config.settings import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    env: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="ai-agent",
        version="1.0.0",
        env=settings.ENV,
    )
