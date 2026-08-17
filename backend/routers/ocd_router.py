from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import ocd_models
from ..schemas import ocd_schemas
from ..services import ai_service

router = APIRouter()

# --- Exposure Hierarchies ---

@router.post("/hierarchies/", response_model=ocd_schemas.ExposureHierarchy)
def create_hierarchy(hierarchy: ocd_schemas.ExposureHierarchyCreate, db: Session = Depends(get_db)):
    # Default owner_id = 1 for now
    db_hierarchy = ocd_models.ExposureHierarchy(**hierarchy.model_dump(), owner_id=1)
    db.add(db_hierarchy)
    db.commit()
    db.refresh(db_hierarchy)
    
    # Auto-generate tasks using Gemini
    suggestions = ai_service.generate_exposure_suggestions(hierarchy.category)
    for i, desc in enumerate(suggestions):
        task = ocd_models.ExposureTask(
            description=desc,
            estimated_suds=(i + 1) * 20,
            order_index=i,
            hierarchy_id=db_hierarchy.id
        )
        db.add(task)
    db.commit()
    db.refresh(db_hierarchy)
    return db_hierarchy

@router.get("/hierarchies/", response_model=List[ocd_schemas.ExposureHierarchy])
def read_hierarchies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ocd_models.ExposureHierarchy).offset(skip).limit(limit).all()

# --- ERP Sessions ---

@router.post("/sessions/", response_model=ocd_schemas.ERPSession)
def create_session(session: ocd_schemas.ERPSessionCreate, db: Session = Depends(get_db)):
    db_session = ocd_models.ERPSession(**session.model_dump(), owner_id=1)
    
    # Generate AI summary
    summary = ai_service.summarize_erp_session(
        session.pre_suds, session.post_suds, session.duration_seconds, session.resisted_compulsion, session.notes or ""
    )
    db_session.ai_summary = summary
    
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions/", response_model=List[ocd_schemas.ERPSession])
def read_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ocd_models.ERPSession).offset(skip).limit(limit).all()

# --- SUDS Logs ---

@router.post("/suds/", response_model=ocd_schemas.SUDSLog)
def create_suds_log(suds: ocd_schemas.SUDSLogCreate, db: Session = Depends(get_db)):
    db_suds = ocd_models.SUDSLog(**suds.model_dump(), owner_id=1)
    db.add(db_suds)
    db.commit()
    db.refresh(db_suds)
    return db_suds

@router.get("/suds/", response_model=List[ocd_schemas.SUDSLog])
def read_suds_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ocd_models.SUDSLog).order_by(ocd_models.SUDSLog.created_at.desc()).offset(skip).limit(limit).all()

# --- Journal Entries ---

@router.post("/journal/", response_model=ocd_schemas.OCDJournalEntry)
def create_journal_entry(entry: ocd_schemas.OCDJournalEntryCreate, db: Session = Depends(get_db)):
    db_entry = ocd_models.OCDJournalEntry(**entry.model_dump(), owner_id=1)
    
    # AI analysis
    analysis = ai_service.analyze_journal_entry(
        entry.trigger, entry.obsession, entry.emotion or "", entry.anxiety_level
    )
    db_entry.ai_analysis = analysis
    
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

@router.get("/journal/", response_model=List[ocd_schemas.OCDJournalEntry])
def read_journal_entries(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ocd_models.OCDJournalEntry).order_by(ocd_models.OCDJournalEntry.created_at.desc()).offset(skip).limit(limit).all()
