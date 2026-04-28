from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models import models
from app.schemas import schemas
from app.database import get_db
from app.services.session_service import SessionService
from app.services.log_service import LogService
from app.api.deps import get_optional_user, get_current_cinema_admin
from datetime import datetime

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
    return SessionService.get_session_by_cinema(db, cinema_id, date)

@router.get("/{session_id}", response_model=schemas.SessionOut)
def get_session_by_id(
    session_id: int,
    request:Request,
    db = Depends(get_db),
    current_user = Depends(get_optional_user)
    ):
    session = SessionService.get_session_by_id(db, session_id)

    session_for_log = session.copy()
    if isinstance(session_for_log.get("start_time"), datetime):
        session_for_log["start_time"] = session_for_log["start_time"].isoformat()

    if current_user:
        LogService.log_action(
            db = db,
            user_id = current_user.user_id,
            user_email = current_user.email,
            action_type = "VIEW_SESSION",
            details = {"session": session_for_log},
            ip_address = request.client.host
        )

    return session

@router.post("/admin/sessions", response_model=schemas.SessionOut)
def create_session(
    session_data: schemas.SessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
    ):

    hall = db.query(models.Hall).filter(models.Hall.hall_id == session_data.hall_id).first()
    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hall not found"
        )
    
    if current_user.role == models.UserRole.CINEMA_ADMIN:
        if hall.cinema_id != current_user.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this hall"
            )
        
    session = SessionService.create_session(db, session_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_SESSION",
        details = {
            "session_id": session["session_id"],
            "hall_id": session["hall_id"],
            "movie_id": session["movie_id"]
        },
        ip_address = request.client.host
    )
    return session

@router.put("/admin/sessions/{session_id}", response_model=schemas.SessionOut)
def update_session(
    session_id: int,
    session_data: schemas.SessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    hall = db.query(models.Hall).filter(models.Hall.hall_id == session.hall_id).first()
    
    if current_user.role == models.UserRole.CINEMA_ADMIN:
        if hall.cinema_id != current_user.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this session"
            )
        
    updated_session = SessionService.update_session(db, session_id, session_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "UPDATE_SESSION",
        details = {
            "session_id": session.session_id,
            "hall_id": session.hall_id,
            "movie_id": session.movie_id
        },
        ip_address = request.client.host
    )

    return updated_session

@router.delete("/admin/sessions/{session_id}")
def delete_session(
    session_id: int,
    request: Request,
    db = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
    ):
    session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    hall = db.query(models.Hall).filter(models.Hall.hall_id == session.hall_id).first()
    
    if current_user.role == models.UserRole.CINEMA_ADMIN:
        if hall.cinema_id != current_user.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this session"
            )
        
    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "DELETE_SESSION",
        details = {"session": {
            "session_id": session.session_id,
            "movie_id": session.movie_id,
            "hall_id": session.hall_id,
            "start_time": str(session.start_time)
        }},
        ip_address = request.client.host
    )

    return SessionService.delete_session(db, session_id)