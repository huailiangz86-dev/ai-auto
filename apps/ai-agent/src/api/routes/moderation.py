# ============================================================
# AI auto - AI Agent Service
# Content Moderation Routes
# ============================================================

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
import asyncio
from uuid import uuid4
import structlog

from src.services.anthropic_json import (
    AIProviderResponseError,
    AIProviderUnavailableError,
    generate_json,
)

router = APIRouter()
logger = structlog.get_logger()


class ModerationRequest(BaseModel):
    content_type: str = Field(..., description="text|image|video")
    content: Optional[str] = None  # For text content
    media_url: Optional[str] = None  # For image/video content


class ModerationResult(BaseModel):
    passed: bool
    score: float = Field(..., ge=0, le=1)
    violations: list[str] = Field(default_factory=list)
    categories: dict = Field(default_factory=dict)  # {prohibited_keywords: [], policy_violations: [], sensitive_content: []}
    action: str = Field(..., description="pass|flag|block")
    message: str


class ModerationResponse(BaseModel):
    request_id: str
    content_type: str
    result: ModerationResult
    model: str  # Which moderation model was used
    processing_time_ms: int


class BatchModerationResponse(BaseModel):
    results: list[ModerationResponse | dict]
    total_processed: int
    total_failed: int


@router.post("/check", response_model=ModerationResponse, status_code=status.HTTP_200_OK)
async def moderate_content(request: ModerationRequest):
    """
    AI-powered content moderation.

    Scans all AI-generated content for prohibited keywords, policy violations,
    and sensitive content. Flags violations for review or blocks before publishing.
    """
    try:
        logger.info("moderation.check", content_type=request.content_type)
        if request.content_type != "text":
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="图片与视频审核需配置媒体审核服务后启用",
            )
        if not request.content or not request.content.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="文本审核需要 content")

        result, usage = await generate_json(
            system=(
                "You are a strict Chinese content safety reviewer. Return only valid JSON. "
                "Do not rewrite the submitted content and do not expose private data."
            ),
            prompt=(
                "Assess the following Chinese promotional text for prohibited, misleading, illegal, sexual, violent, "
                "or discriminatory content. Use this exact JSON object shape: "
                '{"passed":boolean,"score":number,"violations":["string"],'
                '"categories":{"prohibited_keywords":["string"],"policy_violations":["string"],"sensitive_content":["string"]},'
                '"action":"pass|flag|block","message":"string"}.\n\nText:\n'
                f"{request.content}"
            ),
            max_tokens=800,
        )
        moderation_result = ModerationResult.model_validate(result)
        return ModerationResponse(
            request_id=str(uuid4()),
            content_type=request.content_type,
            result=moderation_result,
            model=str(usage["model"]),
            processing_time_ms=0,
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (AIProviderResponseError, ValueError) as error:
        logger.warning("moderation.invalid_response", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试") from error
    except HTTPException:
        raise
    except Exception as e:
        logger.error("moderation.error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/batch", response_model=BatchModerationResponse)
async def moderate_batch(requests: list[ModerationRequest]):
    """
    Batch content moderation.

    For checking multiple pieces of content in one request.
    """
    if not requests:
        return BatchModerationResponse(results=[], total_processed=0, total_failed=0)
    if len(requests) > 20:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="单次最多审核 20 条内容",
        )

    results = await asyncio.gather(
        *(moderate_content(request) for request in requests),
        return_exceptions=True,
    )
    items: list[ModerationResponse | dict] = []
    failed = 0
    for index, result in enumerate(results):
        if isinstance(result, HTTPException):
            failed += 1
            items.append({"index": index, "status_code": result.status_code, "error": result.detail})
        elif isinstance(result, Exception):
            failed += 1
            logger.exception("moderation.batch_item_failed", index=index, error=str(result))
            items.append({"index": index, "status_code": 500, "error": "审核服务异常"})
        else:
            items.append(result)
    return BatchModerationResponse(
        results=items,
        total_processed=len(items),
        total_failed=failed,
    )
