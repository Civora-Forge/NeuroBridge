from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import ocd_router, agent_router

# Create database tables (in a real app, use Alembic migrations)
from .models import ocd_models, agent_models, adhd_models, anxiety_models, asd_models
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NeuroBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocd_router.router, prefix="/api/ocd", tags=["ocd"])
app.include_router(agent_router.router, prefix="/api/agent", tags=["agent"])

@app.get("/")
def read_root():
    return {"message": "Welcome to NeuroBridge API"}
