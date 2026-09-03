"""Strict JSON wrapper with Qwen, Doubao, and Anthropic provider fallbacks."""

import json
from typing import Any

import httpx
from anthropic import AsyncAnthropic

from src.config.settings import settings


class AIProviderUnavailableError(RuntimeError):
    """Raised when no configured production AI provider is available."""


class AIProviderResponseError(RuntimeError):
    """Raised when an AI response cannot be used safely by a caller."""


def _extract_json_object(value: str) -> dict[str, Any]:
    """Parse a JSON object, tolerating a Markdown fence but no prose payload."""
    cleaned = value.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else ""
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        raise AIProviderResponseError("AI provider did not return a JSON object")

    try:
        result = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as error:
        raise AIProviderResponseError("AI provider returned invalid JSON") from error
    if not isinstance(result, dict):
        raise AIProviderResponseError("AI provider returned a non-object JSON payload")
    return result


async def _generate_openai_compatible_json(
    *, provider: str, api_key: str | None, base_url: str, model: str, system: str, prompt: str,
    max_tokens: int,
) -> tuple[dict[str, Any], dict[str, int | str]]:
    if not api_key:
        raise AIProviderUnavailableError(f"{provider} API key is not configured")

    async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
    if response.is_error:
        raise AIProviderResponseError(f"{provider} request failed with status {response.status_code}")

    body = response.json()
    try:
        message = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise AIProviderResponseError(f"{provider} returned no completion") from error
    if not isinstance(message, str):
        raise AIProviderResponseError(f"{provider} returned a non-text completion")

    usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
    return _extract_json_object(message), {
        "input_tokens": int(usage.get("prompt_tokens", 0)),
        "output_tokens": int(usage.get("completion_tokens", 0)),
        "model": model,
        "provider": provider,
    }


async def _generate_anthropic_json(
    *, system: str, prompt: str, max_tokens: int,
) -> tuple[dict[str, Any], dict[str, int | str]]:
    if not settings.ANTHROPIC_API_KEY:
        raise AIProviderUnavailableError("ANTHROPIC_API_KEY is not configured")

    client = AsyncAnthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        timeout=settings.LLM_TIMEOUT_SECONDS,
        max_retries=settings.LLM_MAX_RETRIES,
    )
    response = await client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        temperature=0.3,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(
        block_text
        for block in response.content
        if isinstance((block_text := getattr(block, "text", None)), str)
    )
    return _extract_json_object(text), {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "model": settings.ANTHROPIC_MODEL,
        "provider": "anthropic",
    }


async def _generate_for_provider(
    provider: str, *, system: str, prompt: str, max_tokens: int,
) -> tuple[dict[str, Any], dict[str, int | str]]:
    if provider == "qwen":
        return await _generate_openai_compatible_json(
            provider="qwen",
            api_key=settings.DASHSCOPE_API_KEY,
            base_url=settings.DASHSCOPE_TEXT_BASE_URL,
            model=settings.QWEN_DEFAULT_MODEL,
            system=system,
            prompt=prompt,
            max_tokens=max_tokens,
        )
    if provider == "doubao":
        return await _generate_openai_compatible_json(
            provider="doubao",
            api_key=settings.DOUBAO_API_KEY,
            base_url=settings.DOUBAO_BASE_URL,
            model=settings.DOUBAO_DEFAULT_MODEL,
            system=system,
            prompt=prompt,
            max_tokens=max_tokens,
        )
    if provider == "anthropic":
        return await _generate_anthropic_json(system=system, prompt=prompt, max_tokens=max_tokens)
    raise AIProviderUnavailableError(f"Unsupported LLM provider: {provider}")


async def generate_json(
    *, system: str, prompt: str, max_tokens: int = 1600,
) -> tuple[dict[str, Any], dict[str, int | str]]:
    """Generate schema-shaped JSON using the configured provider and fallback."""
    providers = [settings.DEFAULT_LLM_PROVIDER.lower()]
    fallback = settings.LLM_FALLBACK_PROVIDER.lower()
    if fallback and fallback not in providers:
        providers.append(fallback)

    errors: list[str] = []
    for provider in providers:
        try:
            return await _generate_for_provider(
                provider, system=system, prompt=prompt, max_tokens=max_tokens,
            )
        except (AIProviderUnavailableError, AIProviderResponseError, httpx.HTTPError) as error:
            errors.append(f"{provider}: {error}")

    if not errors:
        raise AIProviderUnavailableError("No LLM provider is configured")
    raise AIProviderUnavailableError("; ".join(errors))