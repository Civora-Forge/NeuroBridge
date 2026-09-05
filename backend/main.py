import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import ocd_router, agent_router, adhd_router, anxiety_router

# Create database tables (in a real app, use Alembic migrations)
from .models import ocd_models, agent_models, adhd_models, anxiety_models, asd_models
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NeuroBridge API")

_allowed_origins = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()]
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

@app.get("/")
def read_root():
    return {"message": "Welcome to NeuroBridge API"}
