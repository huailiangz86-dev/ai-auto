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
    # Qwen is the default text provider. Anthropic remains an explicit fallback.
    DEFAULT_LLM_PROVIDER: str = "qwen"
    LLM_FALLBACK_PROVIDER: str = "doubao"
    LLM_TIMEOUT_SECONDS: int = 60
    LLM_MAX_RETRIES: int = 2

    # Alibaba Cloud Model Studio / DashScope
    DASHSCOPE_API_KEY: Optional[str] = None
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"
    DASHSCOPE_TEXT_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_IMAGE_BASE_URL: str = "https://dashscope.aliyuncs.com/api/v1"
    QWEN_DEFAULT_MODEL: str = "qwen-plus"
    QWEN_IMAGE_MODEL: str = "qwen-image-3.0"

    # Volcano Engine Ark / Doubao
    DOUBAO_API_KEY: Optional[str] = None
    DOUBAO_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    DOUBAO_DEFAULT_MODEL: str = "doubao-seed-2-0-lite-260215"
    SEEDANCE_MODEL: str = "doubao-seedance-2-0-260128"
    SEEDANCE_GENERATE_AUDIO: bool = True

    # Legacy/optional providers
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-haiku-latest"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_IMAGE_MODEL: str = "gpt-image-1"
    OPENAI_VIDEO_MODEL: str = "sora-2"
    # Browser-reachable address used when a completed video is served through
    # this service. Override it in deployment; localhost is only for local dev.
    AI_AGENT_PUBLIC_URL: str = "http://localhost:8000"
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
