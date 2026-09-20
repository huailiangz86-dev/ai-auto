import pytest
from fastapi import HTTPException

from src.api.routes import campaign, content, moderation
from src.services.anthropic_json import _extract_json_object


def test_extract_json_object_accepts_fenced_payload() -> None:
    assert _extract_json_object('```json\n{"answer": 42}\n```') == {"answer": 42}


def test_extract_json_object_rejects_non_json_payload() -> None:
    with pytest.raises(Exception, match="JSON"):
        _extract_json_object("not a structured response")


@pytest.mark.asyncio
async def test_campaign_configure_returns_three_validated_options(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_generate_json(**_: object):
        captured.update(_)
        return {
            "parsed_intent": {"activity_type": "discount"},
            "options": [
                {
                    "option_id": index,
                    "campaign_type": "DISCOUNT",
                    "discount_amount": 10,
                    "min_purchase": 100,
                    "cash_reward": None,
                    "target_audience": "新客",
                    "duration_days": 7,
                    "budget": 1000,
                    "description": "新客满减活动",
                    "confidence": 0.8,
                }
                for index in range(1, 4)
            ],
        }, {"input_tokens": 10, "output_tokens": 20, "model": "test"}

    monkeypatch.setattr(campaign, "generate_json", fake_generate_json)
    response = await campaign.configure_campaign(
        campaign.CampaignConfigRequest(
            description="做一个拉新活动",
            merchant_id="merchant-1",
            growth_context={"goal_metric": "新增订单数", "target_value": 200, "budget": 10000},
        )
    )

    assert len(response.options) == 3
    assert response.usage["model"] == "test"
    assert "target_value" in str(captured["prompt"])
    assert "10000" in str(captured["prompt"])


@pytest.mark.asyncio
async def test_growth_intake_returns_missing_fields_and_merged_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_generate_json(**kwargs: object):
        captured.update(kwargs)
        return {
            "reply": "还需要告诉我活动结束时间。",
            "extracted": {
                "goal_brief": "望京店新增到店新客",
                "goal_metric": "新增到店核销数",
                "target_value": 200,
                "budget": 10000,
                "store_id": "store-1",
                "store_name": "望京店",
                "store_scope": "specific",
                "start_at": "2026-10-01T00:00:00+08:00",
                "end_at": None,
            },
            "missing": ["end_at"],
            "ready": False,
            "summary": {"goal": "望京店新增 200 位到店新客"},
        }, {"input_tokens": 12, "output_tokens": 30, "model": "test"}

    monkeypatch.setattr(campaign, "generate_json", fake_generate_json)
    response = await campaign.growth_intake(
        campaign.GrowthIntakeRequest(
            merchant_id="merchant-1",
            message="预算一万，望京店新增 200 位新客，10 月 1 日开始",
            current={"budget": 10000},
            available_stores=[{"id": "store-1", "name": "望京店", "code": "WJ"}],
        )
    )

    assert response.ready is False
    assert response.missing == ["end_at"]
    assert response.extracted["store_id"] == "store-1"
    assert "活动结束时间" in response.reply
    assert "望京店" in str(captured["prompt"])


@pytest.mark.asyncio
async def test_marketing_product_generation_returns_validated_draft(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_generate_json(**_: object):
        return {
            "product": {
                "product_name": "双人火锅套餐券",
                "category": "团购套餐券",
                "description": "适用于两位到店用餐的套餐券。",
                "skus": [
                    {
                        "sku_name": "午市双人套餐",
                        "sku_code": "HOT-POT-2P-LUNCH",
                        "spec": "午市 / 双人",
                        "price": 198,
                        "market_price": 298,
                        "attributes": {"时段": "午市", "人数": 2},
                    }
                ],
            }
        }, {"input_tokens": 10, "output_tokens": 20, "model": "test"}

    monkeypatch.setattr(campaign, "generate_json", fake_generate_json)
    response = await campaign.generate_marketing_product(
        campaign.MarketingProductRequest(
            merchant_id="merchant-1",
            prompt="生成一个双人火锅套餐，原价 298 元，售价 198 元",
        )
    )

    assert response.product.product_name == "双人火锅套餐券"
    assert response.product.skus[0].price == 198
    assert response.product.skus[0].attributes["人数"] == "2"
    assert response.usage["model"] == "test"


def test_marketing_product_category_is_normalised_to_supported_option() -> None:
    payload = campaign._normalise_marketing_product(
        {
            "productName": "测试商品",
            "category": "本地生活服务",
            "skus": [],
        }
    )

    assert payload["category"] == "其他"


@pytest.mark.asyncio
async def test_marketing_product_generation_accepts_camel_case_provider_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_generate_json(**_: object):
        return {
            "product": {
                "productName": "双人火锅套餐券",
                "category": "团购套餐券",
                "description": "适用于两位到店用餐的套餐券。",
                "skus": [
                    {
                        "skuName": "默认规格",
                        "skuCode": "HOT-POT-2P",
                        "price": 198,
                        "marketPrice": 298,
                        "attributes": {"人数": 2},
                    }
                ],
            }
        }, {"input_tokens": 10, "output_tokens": 20, "model": "test"}

    monkeypatch.setattr(campaign, "generate_json", fake_generate_json)
    response = await campaign.generate_marketing_product(
        campaign.MarketingProductRequest(
            merchant_id="merchant-1",
            prompt="生成一个双人火锅套餐，原价 298 元，售价 198 元",
        )
    )

    assert response.product.product_name == "双人火锅套餐券"
    assert response.product.skus[0].sku_code == "HOT-POT-2P"
    assert response.product.skus[0].attributes["人数"] == "2"


@pytest.mark.asyncio
async def test_marketing_product_generation_falls_back_when_provider_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unavailable_generate_json(**_: object):
        raise campaign.AIProviderUnavailableError("qwen API key is not configured")

    monkeypatch.setattr(campaign, "generate_json", unavailable_generate_json)
    response = await campaign.generate_marketing_product(
        campaign.MarketingProductRequest(
            merchant_id="merchant-1",
            prompt="生成一个双人火锅套餐，原价 298 元，售价 198 元",
        )
    )

    assert response.usage["provider"] == "fallback"
    assert response.product.product_name == "双人火锅套餐券"
    assert response.product.skus[0].price == 198
    assert response.product.skus[0].market_price == 298


@pytest.mark.asyncio
async def test_copywriting_uses_generated_variants(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_generate_json(**_: object):
        return {
            "options": [
                {"option_id": 1, "copy": "限时优惠", "tone": "热情"},
                {"option_id": 2, "copy": "到店可用", "tone": "随意"},
            ]
        }, {"input_tokens": 10, "output_tokens": 20, "model": "test"}

    monkeypatch.setattr(content, "generate_json", fake_generate_json)
    response = await content.generate_copywriting(
        content.CopywritingRequest(
            coupon_id="coupon-1",
            campaign_id="campaign-1",
            agent_id="agent-1",
            platform="wechat",
            count=2,
        )
    )

    assert [option.text for option in response.options] == ["限时优惠", "到店可用"]


@pytest.mark.asyncio
async def test_non_text_moderation_is_not_reported_as_a_false_pass() -> None:
    with pytest.raises(HTTPException) as error:
        await moderation.moderate_content(
            moderation.ModerationRequest(
                content_type="image", media_url="https://example.com/a.png"
            )
        )

    assert error.value.status_code == 501


@pytest.mark.asyncio
async def test_batch_moderation_keeps_successful_items_when_one_item_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_moderate(request: moderation.ModerationRequest) -> moderation.ModerationResponse:
        if request.content == "bad":
            raise HTTPException(status_code=422, detail="bad content")
        return moderation.ModerationResponse(
            request_id="request-1",
            content_type="text",
            result=moderation.ModerationResult(passed=True, score=0.1, action="pass", message="ok"),
            model="test",
            processing_time_ms=0,
        )

    monkeypatch.setattr(moderation, "moderate_content", fake_moderate)
    response = await moderation.moderate_batch(
        [
            moderation.ModerationRequest(content_type="text", content="good"),
            moderation.ModerationRequest(content_type="text", content="bad"),
        ]
    )

    assert response.total_processed == 2
    assert response.total_failed == 1
    assert response.results[0].result.passed is True
    assert response.results[1]["status_code"] == 422


def test_seedance_helpers_protect_provider_details() -> None:
    assert content._video_status("queued") == "generating"
    assert content._video_status("running") == "generating"
    assert content._video_status("succeeded") == "ready"
    assert content._video_status("expired") == "failed"
    assert (
        content._seedance_video_url({"output": {"video_url": "https://provider.example/video.mp4"}})
        == "https://provider.example/video.mp4"
    )
    assert content._seedance_video_url({"status": "running"}) is None
    identifier = content._seedance_safety_identifier("agent-123")
    assert len(identifier) == 64
    assert "agent-123" not in identifier
