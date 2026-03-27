from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import schemas
from app.database import get_db
from app.services.session_service import SessionService
from app.api.deps import get_current_user, get_current_admin

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.get("/movies/{movie_id}/sessions", response_model=List[schemas.SessionOut])
def get_sessions_by_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    date: Optional[str] = Query(None, description="Дата формата ГОД-МЕСЯЦ-ДЕНЬ")
    ):
    return SessionService.get_sessions_by_movie(db, movie_id, date)

@router.get("/cinemas/{cinema_id}/sessions", response_model=List[schemas.SessionOut])
def get_sessions_by_cinema(
    cinema_id: int,
    db = Depends(get_db),
    date: Optional[str] = Query(None, description="Дата формата ГОД-МЕСЯЦ-ДЕНЬ")
    ):
    return SessionService.get_sessions_by_cinema(db, cinema_id, date)

@router.get("/{session_id}", response_model=schemas.SessionOut)
def get_session_by_id(
    session_id: int,
    db = Depends(get_db)
    ):
    return SessionService.get_session_by_id(db, session_id)

@router.post("/admin/sessions", response_model=schemas.SessionOut)
def create_session(
    session_data: schemas.SessionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    return SessionService.create_session(db, session_data)

@router.put("/admin/sessions/{session_id}", response_model=schemas.SessionOut)
def update_session(
    session_id: int,
    session_data: schemas.SessionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    return SessionService.update_session(db, session_id, session_data)

@router.delete("/admin/sessions/{session_id}")
def delete_session(
    session_id: int,
    db = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    return SessionService.delete_session(db, session_id)