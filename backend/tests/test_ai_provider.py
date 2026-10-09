from __future__ import annotations

import json as json_module

import pytest
from fastapi.testclient import TestClient

from backend import ai_service
from backend.main import app


class FakeResponse:
    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self.is_success = 200 <= status_code < 300
        self._body = body

    def json(self) -> dict:
        return self._body


def test_groq_returns_schema_checked_assessment(monkeypatch):
    monkeypatch.setattr(ai_service, "AI_MODE", "local")
    expected = ai_service.analyze_quality("DOC-TEST", {"title": "Test"})
    monkeypatch.setattr(ai_service, "AI_MODE", "groq")
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "test-secret")

    def fake_post(url, *, headers, json, timeout):
        assert url == "https://api.groq.com/openai/v1/chat/completions"
        assert headers["Authorization"] == "Bearer test-secret"
        assert json["model"] == "openai/gpt-oss-120b"
        prompt = json["messages"][0]["content"]
        assert "Test" in prompt
        assert "test-secret" not in prompt
        return FakeResponse(
            200,
            {"choices": [{"message": {"content": json_module.dumps(expected)}}]},
        )
    monkeypatch.setattr(ai_service.httpx, "post", fake_post)

    result = ai_service.analyze_quality("DOC-TEST", {"title": "Test"})

    assert result["document_id"] == "DOC-TEST"
    assert result["module"] == "quality"
    assert result["missing_sections"] == expected["missing_sections"]


def test_groq_http_errors_do_not_disclose_api_key(monkeypatch):
    monkeypatch.setattr(ai_service, "AI_MODE", "groq")
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "test-secret")
    monkeypatch.setattr(ai_service.httpx, "post", lambda *args, **kwargs: FakeResponse(401, {}))

    with pytest.raises(RuntimeError, match="rejected the API key") as exc_info:
        ai_service.analyze_quality("DOC-TEST", {})

    assert "test-secret" not in str(exc_info.value)


def test_groq_authentication_error_is_returned_as_bad_gateway(monkeypatch):
    monkeypatch.setattr(ai_service, "AI_MODE", "groq")
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "test-secret")
    monkeypatch.setattr(ai_service.httpx, "post", lambda *args, **kwargs: FakeResponse(401, {}))

    response = TestClient(app).post(
        "/api/quality/analyze",
        json={"document_id": "DOC-TEST", "analysis": {}},
    )

    assert response.status_code == 502
    assert "GROQ_API_KEY" in response.json()["detail"]
    assert "test-secret" not in response.text


def test_local_mode_skips_provider(monkeypatch):
    monkeypatch.setattr(ai_service, "AI_MODE", "local")
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "test-secret")
    monkeypatch.setattr(
        ai_service.httpx,
        "post",
        lambda *args, **kwargs: pytest.fail("AI provider should not be called in local mode"),
    )

    result = ai_service.analyze_quality("DOC-TEST", {})

    assert result["document_id"] == "DOC-TEST"
    assert result["module"] == "quality"
