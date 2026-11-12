"""
Quick Note Application - Main Entry Point.
Runs the FastAPI backend, provides CORS support, and serves the Single-Page Application.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from backend.database import init_db
from backend.routes import router as api_router

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler to initialize database schema."""
    init_db()
    yield


app = FastAPI(
    title="Quick Note Application API",
    description="Educational full-stack note application demonstrating request-response flow and SQLite storage",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for cross-origin requests (e.g., when frontend is hosted on GitHub Pages)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows GitHub Pages and local test origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include backend API routes
app.include_router(api_router)

# Mount frontend static assets (CSS, JS)
if FRONTEND_DIR.exists():
    css_dir = FRONTEND_DIR / "css"
    js_dir = FRONTEND_DIR / "js"
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    def serve_frontend_index():
        """Serves the main single-page application index.html."""
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "Frontend index.html not found. API is running under /api/notes"}


if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("\n" + "=" * 60)
    print("  [*] Quick Note Application Starting...")
    print("  [>] Web Interface: http://localhost:8000")
    print("  [>] API Swagger Docs: http://localhost:8000/docs")
    print("  [>] Backend API: http://localhost:8000/api/notes")
    print("=" * 60 + "\n")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
