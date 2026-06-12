from unittest.mock import AsyncMock, MagicMock

import pytest
from openai import APIError, APITimeoutError, RateLimitError

import app.ai as ai_module
from app.ai import AIServiceError, apply_edit_instruction


def _make_mock_response(content: str) -> MagicMock:
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock


@pytest.fixture
def mock_create(mocker):
    mock = AsyncMock()
    mocker.patch.object(ai_module.client.chat.completions, "create", mock)
    return mock


async def test_apply_edit_returns_html(mock_create):
    mock_create.return_value = _make_mock_response("<p>result</p>")
    result = await apply_edit_instruction("<p>original</p>", "change it")
    assert result == "<p>result</p>"


async def test_apply_edit_strips_markdown_fences(mock_create):
    mock_create.return_value = _make_mock_response("```html\n<p>result</p>\n```")
    result = await apply_edit_instruction("<p>original</p>", "change it")
    assert result == "<p>result</p>"


async def test_apply_edit_strips_fence_without_language_tag(mock_create):
    mock_create.return_value = _make_mock_response("```\n<p>result</p>\n```")
    result = await apply_edit_instruction("<p>original</p>", "change it")
    assert result == "<p>result</p>"


async def test_apply_edit_context_truncated_at_20000_chars(mock_create):
    mock_create.return_value = _make_mock_response("<p>ok</p>")
    large_context = "x" * 30_000
    await apply_edit_instruction("<p>doc</p>", "edit", context_file_content=large_context)

    call_args = mock_create.call_args
    user_message = next(m["content"] for m in call_args.kwargs["messages"] if m["role"] == "user")
    # The context in the message should be capped at MAX_CONTEXT_CHARS
    assert "x" * 20_001 not in user_message
    assert "x" * 20_000 in user_message


async def test_apply_edit_includes_context_in_user_message(mock_create):
    mock_create.return_value = _make_mock_response("<p>ok</p>")
    await apply_edit_instruction("<p>doc</p>", "edit", context_file_content="prior art text")

    call_args = mock_create.call_args
    user_message = next(m["content"] for m in call_args.kwargs["messages"] if m["role"] == "user")
    assert "prior art text" in user_message


async def test_apply_edit_system_prompt_contains_key_rules(mock_create):
    mock_create.return_value = _make_mock_response("<p>ok</p>")
    await apply_edit_instruction("<p>doc</p>", "edit")

    call_args = mock_create.call_args
    system_message = next(
        m["content"] for m in call_args.kwargs["messages"] if m["role"] == "system"
    )
    assert "Return ONLY the complete HTML" in system_message
    assert "renumber" in system_message.lower()


async def test_apply_edit_uses_temperature_zero(mock_create):
    mock_create.return_value = _make_mock_response("<p>ok</p>")
    await apply_edit_instruction("<p>doc</p>", "edit")
    assert mock_create.call_args.kwargs["temperature"] == 0


async def test_apply_edit_uses_timeout(mock_create):
    mock_create.return_value = _make_mock_response("<p>ok</p>")
    await apply_edit_instruction("<p>doc</p>", "edit")
    assert mock_create.call_args.kwargs["timeout"] == 60.0


async def test_apply_edit_raises_ai_service_error_on_rate_limit(mock_create):
    mock_create.side_effect = RateLimitError(
        message="rate limit", response=MagicMock(status_code=429), body={}
    )
    with pytest.raises(AIServiceError) as exc_info:
        await apply_edit_instruction("<p>doc</p>", "edit")
    assert exc_info.value.status_code == 429


async def test_apply_edit_raises_ai_service_error_on_timeout(mock_create):
    mock_create.side_effect = APITimeoutError(request=MagicMock())
    with pytest.raises(AIServiceError) as exc_info:
        await apply_edit_instruction("<p>doc</p>", "edit")
    assert exc_info.value.status_code == 504


async def test_apply_edit_raises_ai_service_error_on_api_error(mock_create):
    mock_create.side_effect = APIError(
        message="error", request=MagicMock(), body={}
    )
    with pytest.raises(AIServiceError) as exc_info:
        await apply_edit_instruction("<p>doc</p>", "edit")
    assert exc_info.value.status_code == 502


async def test_apply_edit_raises_on_empty_response(mock_create):
    mock_create.return_value = _make_mock_response("   ")
    with pytest.raises(AIServiceError):
        await apply_edit_instruction("<p>doc</p>", "edit")
