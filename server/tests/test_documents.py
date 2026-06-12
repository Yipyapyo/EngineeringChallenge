from app.data import DOCUMENT_1


def test_get_document_returns_content(client):
    response = client.get("/document/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["content"] == DOCUMENT_1
    assert data["version_id"] is not None


def test_get_document_404(client):
    response = client.get("/document/999")
    assert response.status_code == 404


def test_save_document_updates_content(client):
    new_content = "<p>Updated patent content</p>"
    response = client.post("/save/1", json={"content": new_content})
    assert response.status_code == 200
    assert response.json()["content"] == new_content

    # Verify the change persisted
    fetched = client.get("/document/1")
    assert fetched.json()["content"] == new_content


def test_save_document_404(client):
    response = client.post("/save/999", json={"content": "<p>x</p>"})
    assert response.status_code == 404


def test_save_does_not_create_new_version(client):
    versions_before = client.get("/document/1/versions").json()
    client.post("/save/1", json={"content": "<p>edited</p>"})
    versions_after = client.get("/document/1/versions").json()
    assert len(versions_before) == len(versions_after)
