def test_list_versions_initially_one(client):
    response = client.get("/document/1/versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 1
    assert versions[0]["version_number"] == 1


def test_list_versions_404_for_unknown_document(client):
    response = client.get("/document/999/versions")
    assert response.status_code == 404


def test_create_version_returns_version_two(client):
    response = client.post("/document/1/versions", json={"content": "<p>v2</p>"})
    assert response.status_code == 200
    data = response.json()
    assert data["version_number"] == 2
    assert data["content"] == "<p>v2</p>"
    assert data["document_id"] == 1


def test_create_version_increments_number_sequentially(client):
    client.post("/document/1/versions", json={"content": "<p>v2</p>"})
    response = client.post("/document/1/versions", json={"content": "<p>v3</p>"})
    assert response.json()["version_number"] == 3


def test_create_version_sets_it_as_current(client):
    client.post("/document/1/versions", json={"content": "<p>new current</p>"})
    doc = client.get("/document/1").json()
    assert doc["content"] == "<p>new current</p>"


def test_create_version_404_for_unknown_document(client):
    response = client.post("/document/999/versions", json={"content": "<p>x</p>"})
    assert response.status_code == 404


def test_get_specific_version(client):
    create_resp = client.post("/document/1/versions", json={"content": "<p>snapshot</p>"})
    version_id = create_resp.json()["id"]

    response = client.get(f"/document/1/versions/{version_id}")
    assert response.status_code == 200
    assert response.json()["content"] == "<p>snapshot</p>"


def test_get_version_404_for_wrong_document(client):
    # Version 1 of document 1 should not be accessible via document 2
    versions = client.get("/document/1/versions").json()
    v1_id = versions[0]["id"]
    response = client.get(f"/document/2/versions/{v1_id}")
    assert response.status_code == 404


def test_activate_version_changes_document_content(client):
    original_content = client.get("/document/1").json()["content"]

    # Create a new version with different content
    v2_resp = client.post("/document/1/versions", json={"content": "<p>v2 content</p>"})
    v2_id = v2_resp.json()["id"]
    assert client.get("/document/1").json()["content"] == "<p>v2 content</p>"

    # Activate the original version
    v1_id = client.get("/document/1/versions").json()[0]["id"]
    activate_resp = client.put(f"/document/1/versions/{v1_id}/activate")
    assert activate_resp.status_code == 200
    assert activate_resp.json()["content"] == original_content
    assert activate_resp.json()["current_version_id"] == v1_id

    # Document should now reflect the original version
    assert client.get("/document/1").json()["content"] == original_content

    # Unused variable kept to avoid confusion about v2_id
    _ = v2_id


def test_activate_version_404_for_wrong_document(client):
    # Cannot activate doc 2's version via doc 1
    v_doc2_id = client.get("/document/2/versions").json()[0]["id"]
    response = client.put(f"/document/1/versions/{v_doc2_id}/activate")
    assert response.status_code == 404


def test_versions_ordered_by_number(client):
    client.post("/document/1/versions", json={"content": "<p>v2</p>"})
    client.post("/document/1/versions", json={"content": "<p>v3</p>"})
    versions = client.get("/document/1/versions").json()
    numbers = [v["version_number"] for v in versions]
    assert numbers == sorted(numbers)
