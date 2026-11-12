"""
Server Launcher Script (Layer 3: Execution).
Launches uvicorn and displays connection endpoints.
"""

import sys
import webbrowser
from pathlib import Path
import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def start_server(port: int = 8000, open_browser: bool = False):
    url = f"http://localhost:{port}"
    print("\n" + "=" * 60)
    print("  🚀 Quick Note Application Server")
    print(f"  🌐 Local App URL:  {url}")
    print(f"  📖 API Docs:       {url}/docs")
    print(f"  📡 API Endpoint:   {url}/api/notes")
    print("=" * 60 + "\n")

    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)


if __name__ == "__main__":
    start_server(open_browser=False)

