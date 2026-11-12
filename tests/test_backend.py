"""
Automated Pytest Test Suite for Quick Note Application.
Tests API routes, SQLite persistence, request-response integrity, and security boundaries.
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from fastapi.testclient import TestClient
from app import app


@pytest.fixture(scope="module")
def client():
    """Provides a FastAPI test client instance."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    """Verifies that the /api/health endpoint returns a healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "timestamp" in data


def test_create_note_and_persistence(client):
    """Verifies HTTP POST /api/notes request-response lifecycle and SQLite storage."""
    payload = {
        "title": "Architecture Decision Record #1",
        "content": "Using SQLite for zero-config ACID-compliant local persistence.",
        "category": "Architecture",
        "color": "emerald",
    }
    response = client.post("/api/notes", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["title"] == payload["title"]
    assert data["content"] == payload["content"]
    assert data["category"] == payload["category"]
    assert data["color"] == payload["color"]
    assert "created_at" in data
    assert "updated_at" in data


def test_create_note_validation_failure(client):
    """Verifies that invalid payloads are rejected with HTTP 422 Unprocessable Entity."""
    # Empty title
    res_empty_title = client.post("/api/notes", json={"title": "", "content": "Content only"})
    assert res_empty_title.status_code == 422

    # Missing content
    res_missing_content = client.post("/api/notes", json={"title": "Title only"})
    assert res_missing_content.status_code == 422


def test_get_all_notes(client):
    """Verifies HTTP GET /api/notes returns a list of notes."""
    response = client.get("/api/notes")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_note_by_id(client):
    """Verifies retrieval of a specific note by ID and proper 404 handling."""
    # First create a note to fetch
    create_res = client.post(
        "/api/notes",
        json={"title": "Fetchable Note", "content": "Sample content", "category": "Work", "color": "slate"},
    )
    note_id = create_res.json()["id"]

    # Fetch existing
    get_res = client.get(f"/api/notes/{note_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == note_id

    # Fetch non-existent
    not_found_res = client.get("/api/notes/9999999")
    assert not_found_res.status_code == 404


def test_update_note(client):
    """Verifies HTTP PUT /api/notes/{id} updates note content."""
    create_res = client.post(
        "/api/notes",
        json={"title": "Before Update", "content": "Old content", "category": "Ideas", "color": "amber"},
    )
    note_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/notes/{note_id}",
        json={"title": "After Update", "content": "New content"},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["title"] == "After Update"
    assert updated["content"] == "New content"
    assert updated["category"] == "Ideas"  # Preserved


def test_delete_note(client):
    """Verifies HTTP DELETE /api/notes/{id} deletes note and handles subsequent calls."""
    create_res = client.post(
        "/api/notes",
        json={"title": "Note to Delete", "content": "Will be removed soon", "category": "Tasks", "color": "crimson"},
    )
    note_id = create_res.json()["id"]

    del_res = client.delete(f"/api/notes/{note_id}")
    assert del_res.status_code == 200
    assert del_res.json()["id"] == note_id

    # Should now be 404
    after_del = client.get(f"/api/notes/{note_id}")
    assert after_del.status_code == 404

    # Deleting again should be 404
    del_again = client.delete(f"/api/notes/{note_id}")
    assert del_again.status_code == 404


def test_search_and_filter(client):
    """Verifies search filtering by keyword and category."""
    client.post(
        "/api/notes",
        json={"title": "UniqueSearchTargetKey99", "content": "Specific content body", "category": "Snippets"},
    )

    search_res = client.get("/api/notes", params={"search": "UniqueSearchTargetKey99"})
    assert search_res.status_code == 200
    notes = search_res.json()
    assert len(notes) >= 1
    assert any("UniqueSearchTargetKey99" in n["title"] for n in notes)

    filter_res = client.get("/api/notes", params={"category": "Snippets"})
    assert filter_res.status_code == 200
    filtered_notes = filter_res.json()
    assert all(n["category"].lower() == "snippets" for n in filtered_notes)


def test_sql_injection_resilience(client):
    """Verifies that malicious SQL injection strings in title/content are safely stored as text."""
    injection_title = "'); DROP TABLE notes; --"
    injection_content = "1' OR '1' = '1"

    res = client.post("/api/notes", json={"title": injection_title, "content": injection_content})
    assert res.status_code == 201
    created = res.json()
    assert created["title"] == injection_title

    # Table must still exist and be readable
    health_check = client.get("/api/health")
    assert health_check.status_code == 200


def test_frontend_static_serving(client):
    """Verifies that FastAPI serves the single-page application static files."""
    index_res = client.get("/")
    assert index_res.status_code == 200
    assert "text/html" in index_res.headers.get("content-type", "")

    css_res = client.get("/css/style.css")
    assert css_res.status_code == 200

    js_res = client.get("/js/app.js")
    assert js_res.status_code == 200
