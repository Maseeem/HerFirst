import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env when launched from the backend directory, without ever exposing it to the frontend.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from .schemas import BlueprintRequest, BlueprintResponse, GuidanceRequest, GuidanceResponse
from .services import AMD_CONFIGURED, MODEL_NAME, generate_blueprint, generate_guidance

app = FastAPI(
    title="HerFirst API",
    version="1.0.0",
    description="Beginner-friendly project blueprints and task guidance.",
)

local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

deployed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

allowed_origins = list(dict.fromkeys(
    local_origins + deployed_origins
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "HerFirst API",
        "ai_provider": "amd_token_factory" if AMD_CONFIGURED else "offline_domain_synthesizer",
        "amd_configured": AMD_CONFIGURED,
        "model": MODEL_NAME if AMD_CONFIGURED else None,
    }

@app.post("/api/blueprints", response_model=BlueprintResponse)
def create_blueprint(request: BlueprintRequest):
    return generate_blueprint(request.model_dump())

@app.post("/api/tasks/guidance", response_model=GuidanceResponse)
def create_task_guidance(request: GuidanceRequest):
    return generate_guidance(request.model_dump())
