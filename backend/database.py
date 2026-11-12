"""
SQLite Database Layer for Quick Note Application.
Provides parameterized queries, schema management, and persistent storage.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "notes.db"


_INITIALIZED = False

def init_db(db_path: Optional[Path] = None) -> None:
    """Initializes the database schema if it doesn't already exist."""
    global _INITIALIZED
    path = db_path or DEFAULT_DB_PATH
    with sqlite3.connect(str(path)) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'General',
                color TEXT NOT NULL DEFAULT 'amber',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notes_created_at 
            ON notes(created_at DESC);
        """)
        conn.commit()
    _INITIALIZED = True


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    """Creates a database connection with dictionary-like row factory and ensures schema exists."""
    global _INITIALIZED
    path = db_path or DEFAULT_DB_PATH
    if not _INITIALIZED or not path.exists():
        init_db(path)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def get_all_notes(
    db_path: Optional[Path] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieves all notes with optional category filter and keyword search."""
    path = db_path or DEFAULT_DB_PATH
    with get_connection(path) as conn:
        query = "SELECT id, title, content, category, color, created_at, updated_at FROM notes"
        params: List[Any] = []
        conditions: List[str] = []

        if category and category.lower() != "all":
            conditions.append("LOWER(category) = LOWER(?)")
            params.append(category)

        if search and search.strip():
            conditions.append("(LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?))")
            search_param = f"%{search.strip()}%"
            params.extend([search_param, search_param])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY id DESC"

        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_note_by_id(note_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Retrieves a single note by its ID."""
    path = db_path or DEFAULT_DB_PATH
    with get_connection(path) as conn:
        cursor = conn.execute(
            "SELECT id, title, content, category, color, created_at, updated_at FROM notes WHERE id = ?",
            (note_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def create_note(
    title: str,
    content: str,
    category: str = "General",
    color: str = "amber",
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Inserts a new note into the database using parameterized SQL."""
    path = db_path or DEFAULT_DB_PATH
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection(path) as conn:
        cursor = conn.execute(
            """
            INSERT INTO notes (title, content, category, color, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (title.strip(), content.strip(), category.strip(), color.strip(), now_iso, now_iso),
        )
        note_id = cursor.lastrowid
        conn.commit()

    return {
        "id": note_id,
        "title": title.strip(),
        "content": content.strip(),
        "category": category.strip(),
        "color": color.strip(),
        "created_at": now_iso,
        "updated_at": now_iso,
    }


def update_note(
    note_id: int,
    title: Optional[str] = None,
    content: Optional[str] = None,
    category: Optional[str] = None,
    color: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Updates an existing note."""
    existing = get_note_by_id(note_id, db_path)
    if not existing:
        return None

    new_title = title.strip() if title is not None else existing["title"]
    new_content = content.strip() if content is not None else existing["content"]
    new_category = category.strip() if category is not None else existing["category"]
    new_color = color.strip() if color is not None else existing["color"]
    now_iso = datetime.now(timezone.utc).isoformat()

    path = db_path or DEFAULT_DB_PATH
    with get_connection(path) as conn:
        conn.execute(
            """
            UPDATE notes
            SET title = ?, content = ?, category = ?, color = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_title, new_content, new_category, new_color, now_iso, note_id),
        )
        conn.commit()

    return get_note_by_id(note_id, db_path)


def delete_note(note_id: int, db_path: Optional[Path] = None) -> bool:
    """Deletes a note by its ID. Returns True if deleted, False if not found."""
    path = db_path or DEFAULT_DB_PATH
    with get_connection(path) as conn:
        cursor = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
        return cursor.rowcount > 0
