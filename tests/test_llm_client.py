"""
Unit tests for Local Model Abstraction Layer (agents/llm_client.py)
"""

import json
import pytest
from pydantic import BaseModel
from agents.llm_client import LLMClient


class MockSchema(BaseModel):
    title: str
    score: int


def test_offline_mode_initialization():
    client = LLMClient(offline_mode=True)
    assert client.offline_mode is True


def test_regex_json_extraction_clean():
    client = LLMClient(offline_mode=True)
    text = '{"title": "Test Title", "score": 42}'
    parsed = client._extract_json(text)
    assert parsed == {"title": "Test Title", "score": 42}


def test_regex_json_extraction_markdown_fence():
    client = LLMClient(offline_mode=True)
    text = """Here is the structured output:
```json
{
  "title": "Fenced Title",
  "score": 99
}
```
Hope this helps!"""
    parsed = client._extract_json(text)
    assert parsed == {"title": "Fenced Title", "score": 99}


def test_regex_json_extraction_conversational_wrapping():
    client = LLMClient(offline_mode=True)
    text = 'Sure thing! The data you requested is: {"title": "Wrapped Title", "score": 10}, let me know if you need more.'
    parsed = client._extract_json(text)
    assert parsed == {"title": "Wrapped Title", "score": 10}


def test_regex_trailing_comma_repair():
    client = LLMClient(offline_mode=True)
    text = '{"title": "Trailing", "score": 5,}'
    parsed = client._extract_json(text)
    assert parsed == {"title": "Trailing", "score": 5}


def test_deterministic_offline_stubs_all_roles():
    client = LLMClient(offline_mode=True)
    roles = [
        "ChiefOfStaff",
        "StrategyAgent",
        "ContentWriterAgent",
        "CreativeAgent",
        "ComplianceAgent",
        "SchedulerAgent",
        "CommunityManagerAgent",
        "AnalyticsAgent",
    ]

    for role in roles:
        resp = client.generate(
            messages=[{"role": "user", "content": "Generate task"}],
            agent_role=role,
            context={"channel": "short_form", "week_number": 1, "day": 1},
        )
        assert resp.offline_generated is True
        assert resp.parsed_json is not None
        assert isinstance(resp.parsed_json, dict)
        assert resp.total_tokens > 0


def test_token_accounting_accumulation():
    client = LLMClient(offline_mode=True)
    initial_total = client.cumulative_total_tokens
    resp = client.generate(
        messages=[{"role": "user", "content": "Test"}],
        agent_role="StrategyAgent",
    )
    # In offline mode token counts are reported and can be tracked
    assert resp.total_tokens == resp.prompt_tokens + resp.eval_tokens


def test_json_retry_escalation_recovery(monkeypatch):
    """Verify that when Attempt 1 returns broken JSON, the client escalates and recovers on Attempt 2."""
    client = LLMClient(offline_mode=False)

    call_count = 0

    def mock_call_ollama_chat(model, messages, temperature, json_format):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # Attempt 1 returns conversational invalid text
            return ("Sorry, I cannot produce JSON right now.", 20, 10)
        else:
            # Attempt 2 returns valid JSON adhering to MockSchema
            return ('{"title": "Recovered Title", "score": 88}', 35, 15)

    monkeypatch.setattr(client, "_call_ollama_chat", mock_call_ollama_chat)

    resp = client.generate(
        messages=[{"role": "user", "content": "Return schema"}],
        schema_validator=MockSchema,
        agent_role="TestAgent",
        max_retries=3,
    )

    assert resp.validation_attempts == 2
    assert resp.fallback_used is False
    assert resp.parsed_json == {"title": "Recovered Title", "score": 88}
    assert call_count == 2


def test_json_retry_escalation_fallback_on_triple_failure(monkeypatch):
    """Verify that when all 3 attempts fail, sane fallback schema is safely returned without crashing."""
    client = LLMClient(offline_mode=False)

    call_count = 0

    def mock_call_ollama_chat(model, messages, temperature, json_format):
        nonlocal call_count
        call_count += 1
        return ("Broken syntax { bad json", 15, 5)

    monkeypatch.setattr(client, "_call_ollama_chat", mock_call_ollama_chat)

    resp = client.generate(
        messages=[{"role": "user", "content": "Return schema"}],
        schema_validator=MockSchema,
        agent_role="TestAgent",
        max_retries=3,
    )

    assert resp.validation_attempts == 3
    assert resp.fallback_used is True
    assert resp.parsed_json is not None
    assert call_count == 3

