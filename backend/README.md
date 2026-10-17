# HerFirst FastAPI backend

For complete setup instructions, see the project-root `README.md`.

## Quick start (Windows)

Open a terminal in this `backend` folder, then run:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Use Python 3.12 or 3.13. The included `start_backend.bat` checks the selected Python version, installs dependencies, verifies imports, and then starts Uvicorn. Health is available at `http://127.0.0.1:8000/api/health`; Swagger is at `http://127.0.0.1:8000/docs`.

## Tests

From this folder:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Tests run without an AMD API key. The service uses a domain-aware offline generator if AMD settings are absent or the external service fails.

## Optional AMD Token Factory configuration

Copy the root `.env.example` to `backend/.env`, then set `AMD_API_KEY`, `AMD_BASE_URL`, and `AMD_MODEL_NAME` using the values from your AMD Token Factory model page. Never put secrets in frontend environment files or commit `backend/.env`. The health endpoint reports whether all three settings are present; it does not guarantee that a model request will succeed.

## Endpoints

- `GET /api/health`
- `POST /api/blueprints`
- `POST /api/tasks/guidance`
