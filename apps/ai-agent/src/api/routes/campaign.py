# ============================================================
# AI auto - AI Agent Service
# Campaign Routes (AI-powered campaign configuration)
# ============================================================

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Any, Optional
from uuid import uuid4
import structlog

from src.services.anthropic_json import (
    AIProviderResponseError,
    AIProviderUnavailableError,
    generate_json,
)

router = APIRouter()
logger = structlog.get_logger()


class CampaignConfigRequest(BaseModel):
    """Request to parse natural language into campaign configuration."""
    description: str = Field(..., description="Merchant's natural language campaign description")
    merchant_id: str
    store_id: Optional[str] = None
    language: str = "zh-CN"


class CampaignOption(BaseModel):
    """One of 3 AI-generated configuration options."""
    option_id: int
    campaign_type: str
    discount_amount: Optional[float] = None
    min_purchase: Optional[float] = None
    cash_reward: Optional[float] = None
    target_audience: str
    duration_days: int
    budget: float
    description: str = Field(..., description="Explanation of expected outcome")
    confidence: float = Field(..., ge=0, le=1)


class CampaignConfigResponse(BaseModel):
    """Response with 3 AI-generated campaign configuration options."""
    request_id: str
    parsed_intent: dict
    options: list[CampaignOption]
    usage: dict  # token usage info


class CampaignOptimizationRequest(BaseModel):
    campaign_id: str
    current_metrics: dict
    target_metric: Optional[str] = None


class CampaignOptimizationResponse(BaseModel):
    campaign_id: str
    recommendations: list[dict]
    auto_adjustments: list[dict]  # Changes that need merchant approval
    predicted_improvement: float
    usage: dict


class HolidayContext(BaseModel):
    id: str
    name: str
    date: str
    days_away: int = Field(..., ge=0)


class CampaignRecommendationRequest(BaseModel):
    """Aggregated inputs only; no customer-level data leaves the Core API."""
    merchant_id: str
    holidays: list[HolidayContext] = Field(default_factory=list)
    history: dict[str, Any] = Field(default_factory=dict)
    customer_profile: dict[str, Any] = Field(default_factory=dict)
    peer_benchmark: dict[str, Any] = Field(default_factory=dict)


class CampaignRecommendation(BaseModel):
    title: str
    rationale: str
    benchmark: str


class CampaignRecommendationResponse(BaseModel):
    merchant_id: str
    recommendations: list[CampaignRecommendation]
    usage: dict


@router.post("/configure", response_model=CampaignConfigResponse, status_code=status.HTTP_200_OK)
async def configure_campaign(request: CampaignConfigRequest):
    """
    Parse natural language campaign description and generate 3 configuration options.

    This is the core AI Agent endpoint - merchants describe campaigns in plain Chinese
    and the AI generates structured configuration options.
    """
    try:
        logger.info("campaign.configure.request", merchant_id=request.merchant_id, desc=request.description[:50])
        result, usage = await generate_json(
            system=(
                "You are a Chinese local-business marketing strategist. Return only valid JSON. "
                "Do not invent legal, financial, or customer facts."
            ),
            prompt=(
                "Turn the following merchant request into exactly three safe, practical campaign options. "
                "Use this exact JSON object shape: "
                '{"parsed_intent":{"activity_type":"string","target_audience":"string","duration_days":number,'
                '"budget":number},"options":[{"option_id":1,"campaign_type":"DISCOUNT|CASH_REWARD|COMBO",'
                '"discount_amount":number|null,"min_purchase":number|null,"cash_reward":number|null,'
                '"target_audience":"string","duration_days":number,"budget":number,"description":"string",'
                '"confidence":number}]}. All copy must be in Chinese.\n\n'
                f"Merchant ID: {request.merchant_id}\nStore ID: {request.store_id or 'not provided'}\n"
                f"Language: {request.language}\nRequest: {request.description}"
            ),
        )
        options = [CampaignOption.model_validate(option) for option in result.get("options", [])]
        if len(options) != 3:
            raise AIProviderResponseError("AI provider did not return exactly three campaign options")
        return CampaignConfigResponse(
            request_id=str(uuid4()),
            parsed_intent=result.get("parsed_intent", {}),
            options=options,
            usage=usage,
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (AIProviderResponseError, ValueError) as error:
        logger.warning("campaign.configure.invalid_response", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试") from error
    except HTTPException:
        raise
    except Exception as e:
        logger.error("campaign.configure.error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/optimize", response_model=CampaignOptimizationResponse, status_code=status.HTTP_200_OK)
async def optimize_campaign(request: CampaignOptimizationRequest):
    """
    Analyze campaign performance and generate optimization recommendations.

    AI monitors click rate, redemption rate, ROI, and generates automatic
    optimization suggestions with optional auto-adjustment.
    """
    try:
        logger.info("campaign.optimize.request", campaign_id=request.campaign_id)
        result, usage = await generate_json(
            system=(
                "You are a cautious Chinese marketing analyst. Return only valid JSON. "
                "Every recommendation must require merchant confirmation before any change."
            ),
            prompt=(
                "Analyze these campaign metrics and return this exact JSON object shape: "
                '{"recommendations":[{"title":"string","reason":"string","priority":"high|medium|low"}],'
                '"auto_adjustments":[{"field":"string","current_value":"string|number","proposed_value":"string|number",'
                '"reason":"string","requires_merchant_confirmation":true}],"predicted_improvement":number}. '
                f"Campaign ID: {request.campaign_id}\nTarget metric: {request.target_metric or 'ROI'}\n"
                f"Metrics: {request.current_metrics}"
            ),
        )
        return CampaignOptimizationResponse(
            campaign_id=request.campaign_id,
            recommendations=result.get("recommendations", []),
            auto_adjustments=result.get("auto_adjustments", []),
            predicted_improvement=float(result.get("predicted_improvement", 0)),
            usage=usage,
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except (AIProviderResponseError, ValueError, TypeError) as error:
        logger.warning("campaign.optimize.invalid_response", error=str(error))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试") from error
    except HTTPException:
        raise
    except Exception as e:
        logger.error("campaign.optimize.error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/recommendations", response_model=CampaignRecommendationResponse, status_code=status.HTTP_200_OK)
async def get_campaign_recommendations(request: CampaignRecommendationRequest):
    """
    Get AI-generated campaign recommendations based on holidays and merchant history.

    Proactively recommends marketing activity ideas aligned with upcoming holidays
    and trends, with explanations and expected ROI.
    """
    # This endpoint deliberately receives only aggregated merchant history and
    # anonymised peer benchmarks. The Core API owns the launchable configuration.
    # It therefore remains safe to use a future LLM here for copy refinement.
    preferred = request.customer_profile.get("preferredCampaignType", "DISCOUNT")
    coupon_label = "现金券" if preferred == "CASH_REWARD" else "满减券"
    historical_rate = request.history.get("bestRedemptionRate", 0)
    peer_rate = request.peer_benchmark.get("redemptionRate", 12)
    returning_rate = request.customer_profile.get("returningCustomerRate", 0)
    benchmark = request.peer_benchmark.get("description", "平台同类活动基准估算")

    recommendations = []
    for holiday in request.holidays[:6]:
        title = f"{holiday.name}{'返现' if preferred == 'CASH_REWARD' else '满减'}拉新活动"
        rationale = (
            f"距{holiday.name}{holiday.days_away}天；历史最佳活动核销率为 {historical_rate}%，"
            f"当前复购客占比 {returning_rate}%，建议用{coupon_label}提前触达。"
        )
        recommendations.append(CampaignRecommendation(
            title=title,
            rationale=rationale,
            benchmark=f"{benchmark}：同类活动平均核销率 {peer_rate}%",
        ))

    logger.info(
        "campaign.recommendations.generated",
        merchant_id=request.merchant_id,
        count=len(recommendations),
    )
    return CampaignRecommendationResponse(
        merchant_id=request.merchant_id,
        recommendations=recommendations,
        usage={"input_tokens": 0, "output_tokens": 0, "mode": "deterministic"},
    )
