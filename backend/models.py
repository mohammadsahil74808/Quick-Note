"""
Pydantic Models for Quick Note Application.
Enforces request validation, typing, and structured API responses.
"""

from typing import Optional
from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Title of the note")
    content: str = Field(..., min_length=1, max_length=10000, description="Body content of the note")
    category: str = Field(default="General", max_length=50, description="Category or tag for the note")
    color: str = Field(default="amber", max_length=30, description="Visual color theme tag")


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    category: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=30)


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    color: str
    created_at: str
    updated_at: str


class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str

