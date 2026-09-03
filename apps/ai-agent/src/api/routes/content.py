# ============================================================
# AI auto - AI Agent Service
# Content Routes (AI-powered content generation)
# ============================================================

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optionaldiff --git a/apps/ai-agent/src/api/routes/content.py b/apps/ai-agent/src/api/routes/content.py
from uuid import uuid4
import asyncio
import hashlib
import httpx
import structlog

from src.services.anthropic_json import (
    AIProviderResponseError,
    AIProviderUnavailableError,
    generate_json,
)
from src.config.settings import settings

router = APIRouter()
logger = structlog.get_logger()


# ---------- Copywriting ----------
class CopywritingRequest(BaseModel):
    coupon_id: str
    campaign_id: str
    agent_id: str
    platform: str = Field(..., description="wechat_moments|wechat_group|douyin|xiaohongshu|video_account")
    tone: Optional[str] = Field(None, description="enthusiastic|casual|formal, defaults to varies per option")
    count: int = Field(default=3, ge=1, le=5)


class CopywritingOption(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    option_id: int
    text: str = Field(validation_alias="copy", serialization_alias="copy")
    tone: str
    estimated_token_cost: float
    tracking_url: str


class CopywritingResponse(BaseModel):
    request_id: str
    coupon_id: str
    platform: str
    options: list[CopywritingOption]
    total_token_cost: float
    usage: dict


@router.post("/copywriting", response_model=CopywritingResponse, status_code=status.HTTP_200_OK)
async def generate_copywriting(request: CopywritingRequest):
    """
    Generate promotional copy for sharing agents.

    AI generates 3-5 copy variations with different tones. Token cost is
    displayed before generation and deducted from agent's commission balance.
    """
    try:
        logger.info("content.copywriting.request", agent_id=request.agent_id, coupon_id=request.coupon_id)
        result, usage = await generate_json(
            system=(
                "You write compliant Chinese promotional copy. Return only valid JSON. "
                "Never make unverifiable claims, use false urgency, or include a URL; the platform appends tracking links."
            ),
            prompt=(
                "Create the requested number of distinct promotional copy variants. Use this exact JSON object shape: "
                '{"options":[{"option_id":1,"copy":"string","tone":"string"}]}. '
                f"Coupon ID: {request.coupon_id}\nCampaign ID: {request.campaign_id}\n"
                f"Platform: {request.platform}\nPreferred tone: {request.tone or 'varied'}\nCount: {request.count}"
            ),
            max_tokens=1200,
        )
        options = result.get("options", [])
        if len(options) != request.count:
            raise AIProviderResponseError("AI provider did not return the requested number of copy variants")
        return CopywritingResponse(
            request_id=str(uuid4()),
            coupon_id=request.coupon_id,
            platform=request.platform,
            options=[
                CopywritingOption(
                    option_id=int(option.get("option_id", index + 1)),
                    text=str(option["copy"]),
                    tone=str(option.get("tone") or request.tone or "热情"),
                    estimated_token_cost=0.0,
                    tracking_url="",
                )
                for index, option in enumerate(options)
            ],
            total_token_cost=0.0,
            usage=usage,
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (AIProviderResponseError, KeyError, TypeError, ValueError) as error:
        logger.warning("content.copywriting.invalid_response", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试") from error
    except HTTPException:
        raise
    except Exception as e:
        logger.error("content.copywriting.error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ---------- Video Generation ----------
class VideoGenerationRequest(BaseModel):
    coupon_id: str
    campaign_id: str
    agent_id: str
    platform: str
    duration_seconds: int = Field(default=8, ge=4, le=12)
    style: Optional[str] = None  # 口播|种草|tutorial


class VideoGenerationResponse(BaseModel):
    request_id: str
    status: str  # generating|ready|failed
    task_id: Optional[str] = None
    estimated_completion_seconds: Optional[int] = None
    cost: Optional[float] = None
    usage: Optional[dict] = None


def _ark_headers() -> dict[str, str]:
    if not settings.DOUBAO_API_KEY:
        raise AIProviderUnavailableError("DOUBAO_API_KEY is not configured")
    return {"Authorization": f"Bearer {settings.DOUBAO_API_KEY}", "Content-Type": "application/json"}


def _dashscope_headers() -> dict[str, str]:
    if not settings.DASHSCOPE_API_KEY:
        raise AIProviderUnavailableError("DASHSCOPE_API_KEY is not configured")
    return {"Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}", "Content-Type": "application/json"}


def _video_seconds(value: int) -> int:
    if not 4 <= value <= 15:
        raise ValueError("Seedance 视频时长仅支持 4 至 15 秒")
    return value


def _video_status(provider_status: str) -> str:
    return {
        "queued": "generating",
        "running": "generating",
        "succeeded": "ready",
        "failed": "failed",
        "expired": "failed",
    }.get(provider_status, "generating")


def _seedance_task_url(task_id: str = "") -> str:
    base = f"{settings.DOUBAO_BASE_URL.rstrip('/')}/contents/generations/tasks"
    return f"{base}/{task_id}" if task_id else base


def _seedance_safety_identifier(agent_id: str) -> str:
    return hashlib.sha256(agent_id.encode("utf-8")).hexdigest()[:64]


def _seedance_video_url(job: dict) -> str | None:
    for parent in (job, job.get("output"), job.get("result"), job.get("content")):
        if isinstance(parent, dict) and isinstance(parent.get("video_url"), str):
            return parent["video_url"]
    return None


async def _get_seedance_task(task_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(_seedance_task_url(task_id), headers=_ark_headers())
    if response.status_code == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="视频任务不存在")
    if response.is_error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="无法查询视频任务")
    body = response.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="视频供应商返回格式无效")
    return body


@router.post("/video", response_model=VideoGenerationResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_video(request: VideoGenerationRequest):
    """Create an asynchronous Seedance 2.0 promotional-video task."""
    try:
        logger.info("content.video.request", agent_id=request.agent_id, duration=request.duration_seconds)
        prompt = (
            "生成竖版中文社交媒体推广视频。画面中不要出现 URL 或二维码，并在下三分之一处保留干净区域"
            "供平台叠加行动号召。"
            f"活动：{request.campaign_id}；优惠券：{request.coupon_id}；平台：{request.platform}；"
            f"风格：{request.style or '真实生活方式种草'}。"
        )
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                _seedance_task_url(),
                headers=_ark_headers(),
                json={
                    "model": settings.SEEDANCE_MODEL,
                    "content": [{"type": "text", "text": prompt}],
                    "ratio": "9:16",
                    "duration": _video_seconds(request.duration_seconds),
                    "resolution": "720p",
                    "generate_audio": settings.SEEDANCE_GENERATE_AUDIO,
                    "watermark": False,
                    "safety_identifier": _seedance_safety_identifier(request.agent_id),
                },
            )
        if response.is_error:
            logger.warning("content.video.provider_error", status=response.status_code)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="视频供应商未接受生成任务")
        job = response.json()
        task_id = job.get("id") if isinstance(job, dict) else None
        if not isinstance(task_id, str) or not task_id:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="视频供应商未返回任务 ID")
        return VideoGenerationResponse(
            request_id=str(uuid4()),
            task_id=task_id,
            status="generating",
            usage={"provider": "seedance", "model": settings.SEEDANCE_MODEL},
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as error:
        logger.error("content.video.error", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="视频生成请求失败") from error


@router.get("/video/{task_id}")
async def get_video_status(task_id: str):
    """Poll a Seedance task without disclosing the provider URL to clients."""
    try:
        job = await _get_seedance_task(task_id)
        provider_status = str(job.get("status", "queued"))
        completed = provider_status == "succeeded" and _seedance_video_url(job) is not None
        return {
            "task_id": task_id,
            "status": _video_status(provider_status),
            "progress": int(job.get("progress", 100 if completed else 0)),
            "video_url": f"{settings.AI_AGENT_PUBLIC_URL.rstrip('/')}/api/v1/content/video/{task_id}/content" if completed else None,
            "error": job.get("error", {}).get("message") if isinstance(job.get("error"), dict) else None,
        }
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@router.get("/video/{task_id}/content")
async def download_video_content(task_id: str):
    """Proxy the short-lived Seedance result URL so clients do not receive provider credentials."""
    try:
        job = await _get_seedance_task(task_id)
        video_url = _seedance_video_url(job)
        if str(job.get("status")) != "succeeded" or not video_url:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="视频尚未生成完成")
        async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
            response = await client.get(video_url)
        if response.is_error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="视频文件暂不可下载")
        return Response(content=response.content, media_type=response.headers.get("content-type", "video/mp4"))
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
# ---------- Poster Generation ----------
class PosterGenerationRequest(BaseModel):
    coupon_id: str
    agent_id: str
    platform: str
    style: Optional[str] = None
    color_scheme: Optional[str] = None


class PosterGenerationResponse(BaseModel):
    request_id: str
    options: list[dict]  # [{option_id, image_url, thumbnail_url}]
    cost: float
    usage: dict


@router.post("/poster", response_model=PosterGenerationResponse, status_code=status.HTTP_200_OK)
async def generate_poster(request: PosterGenerationRequest):
    """Generate three promotional posters with the native Qwen-Image API."""
    try:
        logger.info("content.poster.request", agent_id=request.agent_id, platform=request.platform)
        size = "1024*1024" if request.platform == "wechat" else "1024*1536"
        prompt = (
            "为本地商家优惠券活动设计精致、可读的中文推广海报。使用清晰的主视觉与编辑式排版，"
            "右下角留出干净方形区域给平台后续叠加二维码。不要渲染 URL、二维码或未经证实的折扣。"
            f"优惠券参考：{request.coupon_id}；平台：{request.platform}；"
            f"风格：{request.style or '促销'}；配色：{request.color_scheme or '暖色'}。"
        )
        payload = {
            "model": settings.QWEN_IMAGE_MODEL,
            "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
            "parameters": {"size": size, "watermark": False, "prompt_extend": True},
        }
        endpoint = (
            f"{settings.DASHSCOPE_IMAGE_BASE_URL.rstrip('/')}/"
            "services/aigc/multimodal-generation/generation"
        )
        async with httpx.AsyncClient(timeout=120) as client:
            responses = await asyncio.gather(
                *(client.post(endpoint, headers=_dashscope_headers(), json=payload) for _ in range(3))
            )
        options: list[dict] = []
        for index, response in enumerate(responses, start=1):
            if response.is_error:
                logger.warning("content.poster.provider_error", status=response.status_code)
                continue
            body = response.json()
            output = body.get("output") if isinstance(body, dict) else None
            choices = output.get("choices") if isinstance(output, dict) else None
            message = choices[0].get("message") if isinstance(choices, list) and choices else None
            items = message.get("content") if isinstance(message, dict) else None
            image_url = next(
                (
                    item.get("image")
                    for item in items or []
                    if isinstance(item, dict) and isinstance(item.get("image"), str)
                ),
                None,
            )
            if image_url:
                options.append(
                    {
                        "option_id": index,

                        "image_url": image_url,
                        "thumbnail_url": image_url,
                        "style": request.style or "promotional",
                    }
                )
        if not options:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="海报供应商未返回可用图片")
        return PosterGenerationResponse(
            request_id=str(uuid4()),
            options=options,
            cost=0.0,
            usage={"provider": "qwen-image", "model": settings.QWEN_IMAGE_MODEL, "images": len(options)},
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except HTTPException:
        raise
    except httpx.HTTPError as error:
        logger.error("content.poster.error", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="海报生成请求失败") from error
# ---------- Distribution Scheduling ----------
class DistributionRequest(BaseModel):
    content_id: str
    agent_id: str
    platforms: list[str]
    schedule_time: Optional[str] = None  # ISO8601, None = publish immediately


class DistributionResponse(BaseModel):
    request_id: str
    distribution_tasks: list[dict]  # [{platform, status, scheduled_time}]
    usage: dict


@router.post("/distribute", response_model=DistributionResponse, status_code=status.HTTP_200_OK)
async def distribute_content(request: DistributionRequest):
    """
    Distribute AI-generated content to multiple platforms.

    Schedules content publishing across selected platforms with auto-embedded
    tracking parameters.
    """
    # TODO: Implement multi-platform distribution (STORY-AI-023)
    return DistributionResponse(
        request_id="placeholder",
        distribution_tasks=[],
        usage={"input_tokens": 0, "output_tokens": 0},
    )

# ---------- Creator Studio ----------
class CreatorStudioRequest(BaseModel):
    action: Literal["generate", "rewrite", "score", "publish_advice"]
    creator_task_id: str
    campaign_id: str
    agent_id: str
    task_brief: str = Field(..., max_length=10000)
    platform: Optional[str] = None
    content: Optional[str] = Field(None, max_length=5000)
    tone: Optional[str] = Field(None, max_length=50)
    instructions: Optional[str] = Field(None, max_length=2000)
    publishMode: Optional[str] = None


@router.post("/creator-studio", status_code=status.HTTP_200_OK)
async def run_creator_studio(request: CreatorStudioRequest):
    """Return structured task-aware Creator Studio output for one funded action."""
    response_shape = {
        "generate": '{"options":[{"copy":"string","tone":"string"}]}',
        "rewrite": '{"rewritten_content":"string","changes":["string"]}',
        "score": '{"score":number,"strengths":["string"],"improvements":["string"]}',
        "publish_advice": '{"recommended_time":"string","hashtags":["string"],"checklist":["string"]}',
    }[request.action]
    try:
        result, usage = await generate_json(
            system=(
                "You are a compliant Chinese creator assistant. Return only valid JSON matching the requested "
                "shape. Do not make unverifiable claims, include a tracking URL, or recommend automatic publishing."
            ),
            prompt=(
                f"Action: {request.action}. Return exactly this JSON shape: {response_shape}.\n"
                f"Task brief: {request.task_brief}\nCampaign: {request.campaign_id}\n"
                f"Platform: {request.platform or 'unspecified'}\nTone: {request.tone or 'unspecified'}\n"
                f"Instructions: {request.instructions or 'none'}\nContent: {request.content or 'none'}"
            ),
            max_tokens=1200,
        )
        return {
            "request_id": str(uuid4()),
            "action": request.action,
            "result": result,
            "usage": usage,
        }
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (AIProviderResponseError, TypeError, ValueError) as error:
        logger.warning("content.creator_studio.invalid_response", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试") from error
