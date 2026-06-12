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


def test_create_version_404_for_unknown_document(client):
    response = client.post("/document/999/versions", json={"content": "<p>x</p>"})
    assert response.status_code == 404


def test_get_document_returns_latest_version(client):
    client.post("/document/1/versions", json={"content": "<p>newest</p>"})
    doc = client.get("/document/1").json()
    assert doc["content"] == "<p>newest</p>"


def test_get_specific_version(client):
    create_resp = client.post("/document/1/versions", json={"content": "<p>snapshot</p>"})
    version_id = create_resp.json()["id"]

    response = client.get(f"/document/1/versions/{version_id}")
    assert response.status_code == 200
    assert response.json()["content"] == "<p>snapshot</p>"


def test_get_version_is_read_only(client):
    # Reading an old version must not change what the document endpoint returns
    v1_id = client.get("/document/1/versions").json()[0]["id"]
    client.post("/document/1/versions", json={"content": "<p>v2</p>"})

    client.get(f"/document/1/versions/{v1_id}")

    assert client.get("/document/1").json()["content"] == "<p>v2</p>"


def test_get_version_404_for_wrong_document(client):
    # Version 1 of document 1 should not be accessible via document 2
    v1_id = client.get("/document/1/versions").json()[0]["id"]
    response = client.get(f"/document/2/versions/{v1_id}")
    assert response.status_code == 404


def test_update_version_content(client):
    v1_id = client.get("/document/1/versions").json()[0]["id"]
    response = client.put(f"/document/1/versions/{v1_id}", json={"content": "<p>edited v1</p>"})
    assert response.status_code == 200
    assert response.json()["content"] == "<p>edited v1</p>"

    # Persisted
    fetched = client.get(f"/document/1/versions/{v1_id}")
    assert fetched.json()["content"] == "<p>edited v1</p>"


def test_update_version_does_not_create_new_version(client):
    v1_id = client.get("/document/1/versions").json()[0]["id"]
    client.put(f"/document/1/versions/{v1_id}", json={"content": "<p>edited</p>"})
    versions = client.get("/document/1/versions").json()
    assert len(versions) == 1


def test_update_old_version_leaves_latest_untouched(client):
    v1_id = client.get("/document/1/versions").json()[0]["id"]
    client.post("/document/1/versions", json={"content": "<p>v2</p>"})

    client.put(f"/document/1/versions/{v1_id}", json={"content": "<p>edited old v1</p>"})

    # The document endpoint still serves the latest version
    assert client.get("/document/1").json()["content"] == "<p>v2</p>"
    # But v1 was updated
    assert client.get(f"/document/1/versions/{v1_id}").json()["content"] == "<p>edited old v1</p>"


def test_update_version_404_for_wrong_document(client):
    v_doc2_id = client.get("/document/2/versions").json()[0]["id"]
    response = client.put(f"/document/1/versions/{v_doc2_id}", json={"content": "<p>x</p>"})
    assert response.status_code == 404


def test_versions_ordered_by_number(client):
    client.post("/document/1/versions", json={"content": "<p>v2</p>"})
    client.post("/document/1/versions", json={"content": "<p>v3</p>"})
    versions = client.get("/document/1/versions").json()
    numbers = [v["version_number"] for v in versions]
    assert numbers == sorted(numbers)
