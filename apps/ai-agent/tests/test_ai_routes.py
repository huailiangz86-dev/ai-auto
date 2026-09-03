import pytest
from fastapi import HTTPException

from src.api.routes import campaign, content, moderation
from src.services.anthropic_json import _extract_json_object


def test_extract_json_object_accepts_fenced_payload() -> None:
    assert _extract_json_object("```json\n{\"answer\": 42}\n```") == {"answer": 42}


def test_extract_json_object_rejects_non_json_payload() -> None:
    with pytest.raises(Exception, match="JSON"):
        _extract_json_object("not a structured response")


@pytest.mark.asyncio
async def test_campaign_configure_returns_three_validated_options(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_generate_json(**_: object):
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
        campaign.CampaignConfigRequest(description="做一个拉新活动", merchant_id="merchant-1")
    )

    assert len(response.options) == 3
    assert response.usage["model"] == "test"


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
            coupon_id="coupon-1", campaign_id="campaign-1", agent_id="agent-1", platform="wechat", count=2
        )
    )

    assert [option.text for option in response.options] == ["限时优惠", "到店可用"]


@pytest.mark.asyncio
async def test_non_text_moderation_is_not_reported_as_a_false_pass() -> None:
    with pytest.raises(HTTPException) as error:
        await moderation.moderate_content(moderation.ModerationRequest(content_type="image", media_url="https://example.com/a.png"))

    assert error.value.status_code == 501


def test_seedance_helpers_protect_provider_details() -> None:
    assert content._video_status("queued") == "generating"
    assert content._video_status("running") == "generating"
    assert content._video_status("succeeded") == "ready"
    assert content._video_status("expired") == "failed"
    assert content._seedance_video_url({"output": {"video_url": "https://provider.example/video.mp4"}}) == "https://provider.example/video.mp4"
    assert content._seedance_video_url({"status": "running"}) is None
    identifier = content._seedance_safety_identifier("agent-123")
    assert len(identifier) == 64
    assert "agent-123" not in identifier