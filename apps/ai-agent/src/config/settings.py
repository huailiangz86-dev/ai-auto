# ============================================================
# AI auto - AI Agent Service
# Application Settings (Pydantic)
# ============================================================

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "ai-auto-ai-agent"
    ENV: str = "development"
    PORT: int = 8000
    DEBUG: bool = False

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ai_auto:ai_auto_dev@localhost:5432/ai_auto_dev"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/1"

    # JWT (for internal API auth)
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"

    # AI Providers
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    KIMI_API_KEY: Optional[str] = None

    # RunningHub (AI Video)
    RUNNINGHUB_API_KEY: Optional[str] = None
    RUNNINGHUB_API_URL: str = "https://api.runninghub.com"

    # AI Agent Service
    AI_AGENT_SERVICE_URL: str = "http://localhost:8000"

    # Content Moderation
    ALIYUN_CONTENT_SECURITY: bool = False
    ALIYUN_ACCESS_KEY: Optional[str] = None
    ALIYUN_ACCESS_SECRET: Optional[str] = None
    ALIYUN_REGION: str = "cn-shanghai"

    # Sentry
    SENTRY_DSN: Optional[str] = None

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/2"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/3"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 30

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
