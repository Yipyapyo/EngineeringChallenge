from unittest.mock import AsyncMock, MagicMock

import pytest

import app.ai as ai_module


@pytest.fixture
def mock_ai(mocker):
    mock = mocker.patch.object(ai_module, "apply_edit_instruction", new_callable=AsyncMock)
    mock.return_value = "<p>modified</p>"
    return mock


def test_ai_edit_returns_updated_html(client, mock_ai):
    response = client.post(
        "/document/1/ai-edit",
        json={"document_html": "<p>original</p>", "instruction": "Make it bold"},
    )
    assert response.status_code == 200
    assert response.json()["updated_html"] == "<p>modified</p>"


def test_ai_edit_passes_instruction_and_html(client, mock_ai):
    client.post(
        "/document/1/ai-edit",
        json={"document_html": "<p>original</p>", "instruction": "Delete claim 3"},
    )
    mock_ai.assert_called_once_with(
        document_html="<p>original</p>",
        instruction="Delete claim 3",
        context_file_content=None,
    )


def test_ai_edit_passes_context_file_content(client, mock_ai):
    client.post(
        "/document/1/ai-edit",
        json={
            "document_html": "<p>original</p>",
            "instruction": "Write a background section",
            "context_file_content": "Prior art text here",
        },
    )
    mock_ai.assert_called_once_with(
        document_html="<p>original</p>",
        instruction="Write a background section",
        context_file_content="Prior art text here",
    )


def test_ai_edit_404_for_unknown_document(client, mock_ai):
    response = client.post(
        "/document/999/ai-edit",
        json={"document_html": "<p>x</p>", "instruction": "do something"},
    )
    assert response.status_code == 404
    mock_ai.assert_not_called()


def test_ai_edit_502_on_openai_failure(client, mocker):
    mocker.patch.object(
        ai_module,
        "apply_edit_instruction",
        new_callable=AsyncMock,
        side_effect=ai_module.AIServiceError("upstream error", status_code=502),
    )
    response = client.post(
        "/document/1/ai-edit",
        json={"document_html": "<p>x</p>", "instruction": "do something"},
    )
    assert response.status_code == 502


def test_ai_edit_422_for_missing_instruction(client):
    response = client.post(
        "/document/1/ai-edit",
        json={"document_html": "<p>x</p>"},
    )
    assert response.status_code == 422


def test_ai_edit_does_not_auto_save(client, mock_ai):
    original_content = client.get("/document/1").json()["content"]
    client.post(
        "/document/1/ai-edit",
        json={"document_html": "<p>x</p>", "instruction": "change it"},
    )
    # Document content in DB should be unchanged
    assert client.get("/document/1").json()["content"] == original_content
