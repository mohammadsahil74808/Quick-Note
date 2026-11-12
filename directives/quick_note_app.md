# Directive: Quick Note Application (FastAPI + SQLite + Single-Page Frontend)

## 1. Goal
Build and maintain a resilient, single-page note-taking application demonstrating:
1. Asynchronous client-to-server request-response lifecycle (`fetch` -> `POST /api/notes` -> `201 Created` response -> DOM update).
2. Server-side persistence in an SQLite database using parameterized SQL queries.
3. Dynamic same-page note display with filtering, search, category tags, and deletion.
4. Live request-response telemetry explaining every step of the HTTP exchange.
5. Dual deployment strategy:
   - Frontend static deployment to **GitHub Pages** (via GitHub Actions or `/docs`).
   - Python backend deployment to **Render / Railway / Cloud / Local** with CORS enabled.

## 2. Inputs
- Python 3.10+ runtime environment.
- Required dependencies: `fastapi`, `uvicorn`, `pydantic`.
- SQLite database path: `notes.db` (auto-created on startup).
- Frontend files: Semantic HTML5, modern vanilla CSS3, modern vanilla ES6+ JavaScript.

## 3. Execution Scripts & Components
- `app.py`: Main application entrypoint running FastAPI and serving static files on `http://localhost:8000`.
- `backend/database.py`: SQLite connection management, table creation, and parameterized database helper functions.
- `backend/models.py`: Pydantic request & response validation models.
- `backend/routes.py`: REST API route controllers (`GET /api/notes`, `POST /api/notes`, `DELETE /api/notes/{id}`, `GET /api/health`).
- `execution/verify_app.py`: Deterministic test and health verification script.
- `tests/test_backend.py`: Pytest automated test suite.

## 4. Outputs
- Interactive web application accessible at `http://localhost:8000` (or configured GitHub Pages URL).
- Persistent `notes.db` SQLite database with indexed queries.
- Clean `.github/workflows/deploy.yml` for automated GitHub Pages continuous deployment.
- `docs/` bundle for zero-build GitHub Pages deployment.

## 5. Edge Cases & Architectural Learnings
- **GitHub Pages Static Nature**: GitHub Pages only serves static assets (HTML/CSS/JS) and cannot run a Python process or host SQLite. The frontend handles this by supporting:
  - Default mode: Calls local or relative `/api/notes` when served alongside FastAPI.
  - Remote API mode: Allows configuring a deployed backend URL (e.g. on Render/Railway) with CORS.
  - Interactive Demo mode: If opened on GitHub Pages without an active backend URL, alerts the user and runs using client-side localStorage fallback so the UI never displays broken error states.
- **XSS & Injection Protection**: User inputs (title, content, category) are sanitized and escaped before rendering into DOM elements. All database queries use SQL parameter substitution (`?`).

