"""
FastAPI Routes for Quick Note Application.
Exposes REST endpoints for note CRUD and health telemetry.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.database import (
    create_note,
    delete_note,
    get_all_notes,
    get_note_by_id,
    update_note,
)
from backend.models import HealthResponse, NoteCreate, NoteResponse, NoteUpdate

router = APIRouter(prefix="/api", tags=["Notes"])


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint to verify backend service and database connectivity."""
    return HealthResponse(
        status="healthy",
        database="connected",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/notes", response_model=List[NoteResponse])
def list_notes(
    category: Optional[str] = Query(None, description="Filter by category (e.g. Work, Ideas, Personal)"),
    search: Optional[str] = Query(None, description="Search query across note title and content"),
):
    """
    Retrieve all notes stored in the database.
    Demonstrates HTTP GET request-response retrieval.
    """
    notes = get_all_notes(category=category, search=search)
    return notes


@router.get("/notes/{note_id}", response_model=NoteResponse)
def read_note(note_id: int):
    """Retrieve a single note by its ID."""
    note = get_note_by_id(note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with ID {note_id} not found",
        )
    return note


@router.post("/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def add_note(payload: NoteCreate):
    """
    Create a new note in the SQLite database.
    Demonstrates HTTP POST request-response data persistence with 201 Created.
    """
    created = create_note(
        title=payload.title,
        content=payload.content,
        category=payload.category,
        color=payload.color,
    )
    return created


@router.put("/notes/{note_id}", response_model=NoteResponse)
def modify_note(note_id: int, payload: NoteUpdate):
    """Update an existing note."""
    updated = update_note(
        note_id=note_id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
        color=payload.color,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with ID {note_id} not found",
        )
    return updated


@router.delete("/notes/{note_id}", status_code=status.HTTP_200_OK)
def remove_note(note_id: int):
    """
    Delete a note from the database.
    Demonstrates HTTP DELETE request-response flow.
    """
    success = delete_note(note_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note with ID {note_id} not found",
        )
    return {"message": f"Note {note_id} deleted successfully", "id": note_id}

