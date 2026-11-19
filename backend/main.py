import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import ocd_router, agent_router, adhd_router, anxiety_router, ai_proxy_router, privacy_router

# Create database tables (in a real app, use Alembic migrations)
from .models import ocd_models, agent_models, adhd_models, anxiety_models, asd_models
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NeuroBridge API")

_allowed_origins = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()]
_is_cloud_run = bool(os.getenv("K_SERVICE"))
_required_cloud_run_variables = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "GEMINI_API_KEY")
_missing_cloud_run_variables = [name for name in _required_cloud_run_variables if not os.getenv(name)]
if _is_cloud_run and _missing_cloud_run_variables:
    raise RuntimeError(f"Missing required Cloud Run configuration: {', '.join(_missing_cloud_run_variables)}.")
if _is_cloud_run and not _allowed_origins:
    raise RuntimeError("CORS_ALLOWED_ORIGINS must be set when running on Cloud Run.")
if "*" in _allowed_origins:
    raise RuntimeError("CORS_ALLOWED_ORIGINS must not contain '*' when credentials are enabled.")
if not _allowed_origins:
    # Local dev fallback only — production must set CORS_ALLOWED_ORIGINS explicitly.
    _allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocd_router.router, prefix="/api/ocd", tags=["ocd"])
app.include_router(agent_router.router, prefix="/api/agent", tags=["agent"])
app.include_router(adhd_router.router, prefix="/api/adhd", tags=["adhd"])
app.include_router(anxiety_router.router, prefix="/api/anxiety", tags=["anxiety"])
app.include_router(ai_proxy_router.router, prefix="/api/ai", tags=["ai"])
app.include_router(privacy_router.router, prefix="/api/privacy", tags=["privacy"])

@app.get("/")
def read_root():
    return {"message": "Welcome to NeuroBridge API"}


@app.get("/healthz")
def healthz():
    """Unauthenticated liveness probe for Cloud Run."""
    return {"status": "ok"}
