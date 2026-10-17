# HerFirst

HerFirst is a React + TypeScript project planner with a FastAPI backend. The backend creates structured blueprints and task guidance. If AMD Token Factory credentials are absent or the service fails, it uses the built-in domain-aware offline generator. A healthy backend does not by itself mean an external AI model is connected.

## Prerequisites (Windows)

- Python **3.12 or 3.13** recommended (3.10–3.13 supported by the startup script). Python 3.14+ is not assumed compatible with every dependency.
- Node.js **20.19+ or 22.12+** (required by Vite 8) and npm.
- Internet access for first-time dependency installation.

## Start the backend

Open `backend\start_backend.bat`, or run these commands in PowerShell from the project root:

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If `py -3.13` is unavailable, install Python 3.12/3.13 or use `python` if it points to a supported version. Check `http://127.0.0.1:8000/api/health`; API docs are at `http://127.0.0.1:8000/docs`.

## Start the frontend

Open `frontend\start_frontend.bat`, or use a second PowerShell window:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:5174/**. The dev server uses port 5174 and intentionally fails with a clear message if that port is occupied; stop the other process or change `frontend/vite.config.ts` and add the matching origin to backend CORS.

If PowerShell blocks `npm`, use `npm.cmd` as shown above. The frontend's default backend URL is `http://localhost:8000`. To override it, copy `frontend/.env.example` to `frontend/.env.local`, edit `VITE_BACKEND_URL`, then restart Vite.

## Optional AMD Token Factory setup

Copy root `.env.example` to `backend/.env`, then add the values supplied by your AMD Token Factory account: `AMD_API_KEY`, `AMD_BASE_URL`, and `AMD_MODEL_NAME`. Never place credentials in frontend environment files or commit `backend/.env`. The API falls back to offline guidance if the external request fails or returns invalid JSON. `/api/health` reports whether the settings are present, not whether a model call has succeeded.

## Tests and build

Backend (from `backend`):

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend (from `frontend`):

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

## API endpoints

- `GET /api/health` — reports backend and provider configuration status.
- `POST /api/blueprints` — creates a project blueprint.
- `POST /api/tasks/guidance` — creates task-specific guidance.

If the UI cannot reach the backend, check that the backend terminal is still running and that `VITE_BACKEND_URL` points to it. If the browser reports a CORS error, ensure the frontend origin matches the allowed origins in `backend/app/main.py`.
