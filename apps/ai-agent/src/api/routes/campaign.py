# ============================================================
# AI auto - AI Agent Service
# Campaign Routes (AI-powered campaign configuration)
# ============================================================

from datetime import date
import re
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import structlog

from src.services.anthropic_json import (
    AIProviderResponseError,
    AIProviderUnavailableError,
    generate_json,
)

router = APIRouter()
logger = structlog.get_logger()

MARKETING_PRODUCT_CATEGORIES = (
    "代金券",
    "团购套餐券",
    "单品兑换券",
    "次卡 / 多次券",
    "体验券",
    "储值 / 礼品卡",
    "其他",
)


class CampaignConfigRequest(BaseModel):
    """Request to parse natural language into campaign configuration."""

    description: str = Field(..., description="Merchant's natural language campaign description")
    merchant_id: str
    store_id: Optional[str] = None
    language: str = "zh-CN"
    growth_context: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured merchant-provided growth inputs used to validate the AI plan",
    )


class CampaignOption(BaseModel):
    """One of 3 AI-generated configuration options."""

    option_id: int
    task_type: str = "customer_campaign"
    campaign_type: str
    discount_amount: Optional[float] = None
    offer_price: Optional[float] = None
    original_price: Optional[float] = None
    min_purchase: Optional[float] = None
    cash_reward: Optional[float] = None
    target_audience: str
    duration_days: int
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    budget: float
    content_brief: Optional[str] = None
    content_types: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    call_to_action: Optional[str] = None
    description: str = Field(..., description="Explanation of expected outcome")
    confidence: float = Field(..., ge=0, le=1)


class CampaignConfigResponse(BaseModel):
    """Response with 3 AI-generated campaign configuration options."""

    request_id: str
    parsed_intent: dict
    options: list[CampaignOption]
    usage: dict  # token usage info


class MarketingProductRequest(BaseModel):
    """Request to turn a merchant's product brief into a reviewable draft."""

    merchant_id: str
    prompt: str = Field(..., min_length=1, max_length=2000)
    category: Optional[str] = Field(default=None, max_length=100)


class MarketingProductSku(BaseModel):
    sku_name: str = Field(..., min_length=1, max_length=200)
    sku_code: str = Field(..., min_length=1, max_length=100)
    spec: Optional[str] = Field(default=None, max_length=200)
    price: float = Field(..., ge=0)
    market_price: Optional[float] = Field(default=None, ge=0)
    attributes: dict[str, str] = Field(default_factory=dict)


class MarketingProductDraft(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    skus: list[MarketingProductSku] = Field(..., min_length=1, max_length=20)


class MarketingProductResponse(BaseModel):
    request_id: str
    product: MarketingProductDraft
    usage: dict = Field(default_factory=dict)


def _normalise_marketing_product(value: Any) -> dict[str, Any]:
    """Accept the common camelCase variant before validating the provider payload."""
    if not isinstance(value, dict):
        return {}

    product = value.get("product", value)
    if not isinstance(product, dict):
        return {}

    raw_skus = product.get("skus")
    if not isinstance(raw_skus, list):
        return {**product, "product_name": product.get("product_name", product.get("productName"))}

    skus: list[dict[str, Any]] = []
    for raw_sku in raw_skus:
        if not isinstance(raw_sku, dict):
            skus.append(raw_sku)
            continue

        raw_attributes = raw_sku.get("attributes", {})
        attributes = (
            {
                str(key): str(attribute)
                for key, attribute in raw_attributes.items()
                if attribute is not None and isinstance(attribute, (str, int, float, bool))
            }
            if isinstance(raw_attributes, dict)
            else {}
        )
        skus.append(
            {
                **raw_sku,
                "sku_name": raw_sku.get("sku_name", raw_sku.get("skuName")),
                "sku_code": raw_sku.get("sku_code", raw_sku.get("skuCode")),
                "spec": raw_sku.get("spec"),
                "price": raw_sku.get("price"),
                "market_price": raw_sku.get("market_price", raw_sku.get("marketPrice")),
                "attributes": attributes,
            }
        )

    return {
        **product,
        "product_name": product.get("product_name", product.get("productName")),
        "category": _normalise_product_category(product.get("category")),
        "description": product.get("description", ""),
        "skus": skus,
    }


def _normalise_product_category(value: Any) -> str:
    category = str(value).strip() if value is not None else ""
    return category if category in MARKETING_PRODUCT_CATEGORIES else "其他"


def _fallback_marketing_product(request: MarketingProductRequest) -> MarketingProductDraft:
    """Build a clearly reviewable local draft when no LLM provider is available."""
    prompt = request.prompt.strip()
    name_match = re.match(
        r"^(?:请|帮我|给我)?(?:生成|创建|设计|做)(?:一个|一款)?\s*(.+?)(?=\s*(?:原价|门市价|售价|现价|活动价|优惠价|价格|包含|适用于|[，,。；;]|$))",
        prompt,
    )
    product_name = (name_match.group(1) if name_match else "AI营销商品").strip(" ，,。；;")
    if not product_name.endswith(("券", "卡")):
        product_name += "券"

    category = _normalise_product_category(request.category)
    if category == "其他" and not request.category:
        category = next(
        (
            label
            for keywords, label in (
                (("代金券",), "代金券"),
                (("次卡", "多次券"), "次卡 / 多次券"),
                (("体验券",), "体验券"),
                (("储值", "礼品卡"), "储值 / 礼品卡"),
                (("兑换券",), "单品兑换券"),
                (("套餐", "团购"), "团购套餐券"),
            )
            if any(keyword in prompt for keyword in keywords)
        ),
            "其他",
        )
    number = r"(\d+(?:\.\d+)?)"
    market_match = re.search(r"(?:原价|门市价|市场价|划线价)\s*[:：]?\s*" + number, prompt)
    price_match = re.search(
        r"(?:售价|现价|活动价|优惠价|卖价|价格)\s*[:：]?\s*" + number,
        prompt,
    )
    all_prices = [float(value) for value in re.findall(number, prompt)]
    market_price = float(market_match.group(1)) if market_match else None
    price = float(price_match.group(1)) if price_match else (all_prices[-1] if all_prices else 0)
    if market_price is None and len(all_prices) >= 2 and price_match is not None:
        market_price = all_prices[0]

    description = f"根据商家描述生成的待审核草稿：{prompt}"
    if price == 0:
        description += "；未识别到明确售价，请核对后填写。"
    return MarketingProductDraft(
        product_name=product_name[:200],
        category=category[:100],
        description=description[:2000],
        skus=[
            MarketingProductSku(
                sku_name="默认规格",
                sku_code="AI-DEFAULT-SKU",
                price=price,
                market_price=market_price,
                attributes={},
            )
        ],
    )


class GrowthIntakeRequest(BaseModel):
    """One turn of a merchant's natural-language growth-goal conversation."""

    merchant_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[dict[str, str]] = Field(default_factory=list)
    current: dict[str, Any] = Field(default_factory=dict)
    available_stores: list[dict[str, str]] = Field(default_factory=list)
    language: str = "zh-CN"


class GrowthIntakeResponse(BaseModel):
    reply: str
    extracted: dict[str, Any]
    missing: list[str]
    ready: bool
    summary: dict[str, Any] = Field(default_factory=dict)
    usage: dict = Field(default_factory=dict)


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
        logger.info(
            "campaign.configure.request",
            merchant_id=request.merchant_id,
            desc=request.description[:50],
        )
        result, usage = await generate_json(
            system=(
                "You are a Chinese local-business marketing strategist. Return only valid JSON. "
                "Do not invent legal, financial, or customer facts."
            ),
            prompt=(
                "Turn the following merchant request into exactly three safe, practical growth execution options. "
                "Use this exact JSON object shape: "
                '{"parsed_intent":{"activity_type":"string","task_type":"customer_campaign|creator_content",'
                '"target_audience":"string","duration_days":number,"budget":number},'
                '"options":[{"option_id":1,"task_type":"customer_campaign|creator_content",'
                '"campaign_type":"DISCOUNT|CASH_REWARD|COMBO",'
                '"discount_amount":number|null,"offer_price":number|null,"original_price":number|null,'
                '"min_purchase":number|null,"cash_reward":number|null,"target_audience":"string",'
                '"duration_days":number,"start_at":"ISO date|null","end_at":"ISO date|null",'
                '"budget":number,"content_brief":"string|null","content_types":["graphic|short_video"],'
                '"channels":["douyin|xiaohongshu|wechat_video"],"call_to_action":"string|null",'
                '"description":"string",'
                '"confidence":number}]}. All copy must be in Chinese.\n\n'
                "task_type 规则：如果商户目标是给达人发布图文/短视频任务，让达人完成内容并通过专属链接引流，必须返回 creator_content；如果目标是让普通客户领券、到店或核销，返回 customer_campaign。creator_content 不是优惠券活动，content_brief、content_types、channels 和 call_to_action 必须描述达人交付物；此时优惠金额字段可以为 null。\n"
                "Extract every price and date explicitly stated by the merchant. For COMBO, offer_price is the "
                "selling/package price and original_price is the original/list price; do not replace either with "
                "discount_amount or invent values. Preserve explicit start_at/end_at dates; if the year is omitted, "
                f"use the current calendar year ({date.today().isoformat()[:4]}).\n"
                f"Merchant ID: {request.merchant_id}\nStore ID: {request.store_id or 'not provided'}\n"
                f"Language: {request.language}\nRequest: {request.description}\n"
                "Structured growth context from the merchant (null means not provided; do not invent it): "
                f"{request.growth_context}"
            ),
        )
        options = [CampaignOption.model_validate(option) for option in result.get("options", [])]
        if len(options) != 3:
            raise AIProviderResponseError(
                "AI provider did not return exactly three campaign options"
            )
        return CampaignConfigResponse(
            request_id=str(uuid4()),
            parsed_intent=result.get("parsed_intent", {}),
            options=options,
            usage=usage,
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error
    except (AIProviderResponseError, ValueError) as error:
        logger.warning("campaign.configure.invalid_response", error=str(error))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试"
        ) from error
    except HTTPException:
        raise
    except Exception as e:
        logger.error("campaign.configure.error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/product/generate", response_model=MarketingProductResponse, status_code=status.HTTP_200_OK
)
async def generate_marketing_product(request: MarketingProductRequest):
    """Generate a marketing-product draft for merchant review."""
    try:
        logger.info("campaign.product_generate.request", merchant_id=request.merchant_id)
        result, usage = await generate_json(
            system=(
                "你是谨慎的中文本地生活营销商品顾问。只返回合法 JSON，不要编造外部商品 ID、库存或商户事实。"
                "根据商户描述生成可审阅的券类营销商品草稿；没有提供的经营数据可以给出保守建议，但不要伪装成真实数据。"
            ),
            prompt=(
                "请把下面的商品描述整理为一个营销商品草稿，严格返回以下 JSON 结构："
                '{"product":{"product_name":"string","category":"string","description":"string",'
                '"skus":[{"sku_name":"string","sku_code":"string","spec":"string|null",'
                '"price":number,"market_price":number|null,"attributes":{"key":"value"}}]}}。'
                "商品只用于优惠券、套餐、次卡、兑换券等营销场景，不涉及实物履约。"
                "如果描述中只有一个规格，也只返回一个 SKU；sku_code 使用稳定、易读的 ASCII 编码。"
                "category 只能填写以下之一：代金券、团购套餐券、单品兑换券、次卡 / 多次券、体验券、储值 / 礼品卡、其他。"
                "attributes 的所有 value 必须是字符串；人数、次数等数字也请转成字符串。"
                "价格只能按描述中的价格填写；描述未给价格时，给出合理的待商家审核建议。"
                f"\n商户 ID：{request.merchant_id}\n指定类目：{request.category or '未指定'}\n商品描述：{request.prompt}"
            ),
        )
        raw_product = _normalise_marketing_product(result)
        product = MarketingProductDraft.model_validate(raw_product)
        return MarketingProductResponse(
            request_id=str(uuid4()),
            product=product,
            usage=usage,
        )
    except AIProviderUnavailableError as error:
        logger.warning("campaign.product_generate.fallback", error=str(error))
        return MarketingProductResponse(
            request_id=f"fallback-{uuid4()}",
            product=_fallback_marketing_product(request),
            usage={"provider": "fallback", "model": "local-product-parser"},
        )
    except (AIProviderResponseError, ValueError, TypeError) as error:
        logger.warning("campaign.product_generate.invalid_response", error=str(error))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试"
        ) from error
    except HTTPException:
        raise
    except Exception as error:
        logger.error("campaign.product_generate.error", error=str(error))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)
        ) from error


@router.post("/growth-intake", response_model=GrowthIntakeResponse, status_code=status.HTTP_200_OK)
async def growth_intake(request: GrowthIntakeRequest):
    """Extract growth-plan fields from a conversation and ask for missing fields."""
    try:
        logger.info("campaign.growth_intake.request", merchant_id=request.merchant_id)
        result, usage = await generate_json(
            system=(
                "你是谨慎的中文本地商户增长顾问。只返回合法 JSON，不要编造商户事实。"
                "你负责从多轮对话中提取增长计划字段；信息不完整时只追问缺失信息。必须识别任务服务对象。"
            ),
            prompt=(
                "根据当前对话和已有识别结果，合并提取增长计划信息。目标是让商户只用自然语言完成设置，"
                "不要让商户填写字段。必须严格返回以下 JSON 结构："
                '{"reply":"给商户的中文回复","extracted":{"goal_brief":"string|null",'
                '"task_type":"customer_campaign|creator_content|null",'
                '"goal_metric":"新增到店核销数|新增订单数|新增 GMV|复购订单数|null",'
                '"baseline_value":"number|null","target_value":"number|null","budget":"number|null",'
                '"start_at":"ISO date|null","end_at":"ISO date|null","store_id":"string|null",'
                '"store_name":"string|null","store_scope":"specific|all|null",'
                '"acceptable_roi_boundary":"number|null","acceptable_risk_boundary":"string|null"},'
                '"missing":["goal_brief|goal_metric|target_value|budget|start_at|end_at|store_id"],'
                '"ready":true,"summary":{"goal":"string","calculation":"string"}}。'
                "missing 只能使用字段名；goal_brief、goal_metric、target_value、budget、start_at、end_at 和适用门店是必填项；baseline_value、acceptable_roi_boundary 和风险边界是可选项。"
                "如果有多个门店，除非商户明确说全部门店，否则必须询问适用门店。"
                "target_value 按目标期末累计值理解；如果商户说的是本期新增量，请结合 baseline_value 换算目标期末值。"
                "budget 是整个增长任务的总投入上限，不是单个创作者的报酬。task_type=creator_content 时，任务是商家发给达人的内容交付和引流任务，不要把它描述成普通客户领券活动；task_type=customer_campaign 时，任务是普通客户优惠活动。"
                "reply 要自然地说明已识别内容，并明确列出还缺哪些；字段全部齐全时，给出一段完整的确认摘要。"
                "禁止只回复‘无法识别’、‘请换一种说法’等泛化失败话术；无法补全时也要保留已有内容并列出具体缺项。\n\n"
                f"可用门店（只能从这里选择 store_id）：{request.available_stores}\n"
                f"已有识别结果：{request.current}\n"
                f"对话记录：{request.history}\n"
                f"本轮商户消息：{request.message}"
            ),
        )
        return GrowthIntakeResponse(
            reply=str(result.get("reply", "请继续告诉我增长目标。")),
            extracted=result.get("extracted", {}),
            missing=result.get("missing", []),
            ready=bool(result.get("ready", False)),
            summary=result.get("summary", {}),
            usage=usage,
        )
    except AIProviderUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error
    except (AIProviderResponseError, ValueError, TypeError) as error:
        logger.warning("campaign.growth_intake.invalid_response", error=str(error))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试"
        ) from error
    except HTTPException:
        raise
    except Exception as error:
        logger.error("campaign.growth_intake.error", error=str(error))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)
        ) from error


@router.post(
    "/optimize", response_model=CampaignOptimizationResponse, status_code=status.HTTP_200_OK
)
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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error
    except (AIProviderResponseError, ValueError, TypeError) as error:
        logger.warning("campaign.optimize.invalid_response", error=str(error))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 返回格式无效，请重试"
        ) from error
    except HTTPException:
        raise
    except Exception as e:
        logger.error("campaign.optimize.error", error=str(e))
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/recommendations",
    response_model=CampaignRecommendationResponse,
    status_code=status.HTTP_200_OK,
)
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
        recommendations.append(
            CampaignRecommendation(
                title=title,
                rationale=rationale,
                benchmark=f"{benchmark}：同类活动平均核销率 {peer_rate}%",
            )
        )

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
