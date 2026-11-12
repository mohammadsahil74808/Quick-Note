"""
Deterministic Verification Script (Layer 3: Execution).
Tests the FastAPI backend, SQLite database persistence, and request-response round-trip.
"""

import sys
from pathlib import Path

# Ensure UTF-8 output encoding on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from app import app


def run_verification():
    print("=" * 65)
    print("  [TEST] Starting Quick Note Application Deterministic Verification")
    print("=" * 65)

    with TestClient(app) as client:
        # 1. Health Check
        print("\n[Step 1] Verifying GET /api/health...")
        health_res = client.get("/api/health")
        assert health_res.status_code == 200, f"Expected 200, got {health_res.status_code}"
        health_data = health_res.json()
        assert health_data["status"] == "healthy"
        print(f"  [OK] Backend health verified: {health_data}")

        # 2. Note Creation (POST /api/notes) -> 201 Created
        print("\n[Step 2] Testing HTTP POST /api/notes (Request-Response Flow)...")
        payload = {
            "title": "Automated Test Note",
            "content": "This note verifies SQLite persistence and JSON serialization.",
            "category": "Architecture",
            "color": "indigo"
        }
        post_res = client.post("/api/notes", json=payload)
        assert post_res.status_code == 201, f"Expected 201, got {post_res.status_code}: {post_res.text}"
        created_note = post_res.json()
        assert "id" in created_note and created_note["id"] is not None
        assert created_note["title"] == payload["title"]
        assert created_note["content"] == payload["content"]
        assert created_note["category"] == payload["category"]
        assert created_note["color"] == payload["color"]
        note_id = created_note["id"]
        print(f"  [OK] Successfully created Note #{note_id} with 201 Created")

        # 3. Retrieve Notes (GET /api/notes)
        print("\n[Step 3] Testing HTTP GET /api/notes...")
        get_res = client.get("/api/notes")
        assert get_res.status_code == 200
        notes_list = get_res.json()
        assert isinstance(notes_list, list)
        matching = [n for n in notes_list if n["id"] == note_id]
        assert len(matching) == 1, f"Created note #{note_id} not found in GET response"
        print(f"  [OK] Successfully verified note #{note_id} in GET response (Total notes: {len(notes_list)})")

        # 4. Search and Filter Query
        print("\n[Step 4] Testing search and category filter queries...")
        filter_res = client.get("/api/notes", params={"category": "Architecture"})
        assert filter_res.status_code == 200
        filtered_notes = filter_res.json()
        assert all(n["category"].lower() == "architecture" for n in filtered_notes)

        search_res = client.get("/api/notes", params={"search": "Automated Test"})
        assert search_res.status_code == 200
        search_notes = search_res.json()
        assert any(n["id"] == note_id for n in search_notes)
        print("  [OK] Search and category filtering verified")

        # 5. Note Update (PUT /api/notes/{id})
        print("\n[Step 5] Testing HTTP PUT /api/notes/{id}...")
        update_res = client.put(f"/api/notes/{note_id}", json={"title": "Updated Title"})
        assert update_res.status_code == 200
        updated_note = update_res.json()
        assert updated_note["title"] == "Updated Title"
        print(f"  [OK] Note #{note_id} successfully updated")

        # 6. Note Deletion (DELETE /api/notes/{id})
        print(f"\n[Step 6] Testing HTTP DELETE /api/notes/{note_id}...")
        del_res = client.delete(f"/api/notes/{note_id}")
        assert del_res.status_code == 200
        print(f"  [OK] Note #{note_id} successfully deleted")

        # Verify deletion in database
        get_deleted = client.get(f"/api/notes/{note_id}")
        assert get_deleted.status_code == 404, f"Expected 404, got {get_deleted.status_code}"
        print(f"  [OK] Confirmed note #{note_id} returned 404 Not Found after deletion")

        # 7. Validation / Edge Case (Empty Title)
        print("\n[Step 7] Testing validation handling (Pydantic 422 Unprocessable Entity)...")
        invalid_res = client.post("/api/notes", json={"title": "", "content": "Missing title"})
        assert invalid_res.status_code == 422, f"Expected 422 validation error, got {invalid_res.status_code}"
        print("  [OK] Empty title correctly rejected with 422 Unprocessable Entity")

        # 8. Frontend Assets Serving Verification
        print("\n[Step 8] Testing frontend static file delivery...")
        index_res = client.get("/")
        assert index_res.status_code == 200
        assert "Quick Note Application" in index_res.text
        print("  [OK] Frontend index.html served correctly at root '/'")

        css_res = client.get("/css/style.css")
        assert css_res.status_code == 200
        print("  [OK] CSS stylesheet served correctly at '/css/style.css'")

        js_res = client.get("/js/app.js")
        assert js_res.status_code == 200
        print("  [OK] JavaScript bundle served correctly at '/js/app.js'")

        print("\n" + "=" * 65)
        print("  [SUCCESS] ALL 8 DETERMINISTIC VERIFICATION CHECKS PASSED (100%)")
        print("=" * 65 + "\n")
        return True


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
