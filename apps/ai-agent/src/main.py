# ============================================================
# AI auto - AI Agent Service (FastAPI)
# Main entry point
# ============================================================

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import sentry_sdk

from src.config.settings import settings
from src.api import router as api_router
from src.tasks.celery_app import celery_app

# Sentry for error tracking
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV,
        traces_sample_rate=0.1,
    )

# Structured logging
structlog = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    structlog.info("ai-agent-service.starting", env=settings.ENV, port=settings.PORT)
    yield
    # Shutdown
    structlog.info("ai-agent-service.stopping")


app = FastAPI(
    title="AI auto - AI Agent Service",
    description="AI-powered campaign configuration, content generation, and optimization",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-agent", "version": "1.0.0"}


@app.get("/")
async def root():
    return {
        "service": "AI auto - AI Agent Service",
        "version": "1.0.0",
        "docs": "/docs",
    }
