# ============================================================
# AI auto - AI Agent Service
# API Router
# ============================================================

from fastapi import APIRouter

from src.api.routes import campaign, content, health, moderation

router = APIRouter()

# Include sub-routers
router.include_router(health.router, tags=["health"])
router.include_router(campaign.router, prefix="/campaign", tags=["campaign"])
router.include_router(content.router, prefix="/content", tags=["content"])
router.include_router(moderation.router, prefix="/moderation", tags=["moderation"])
