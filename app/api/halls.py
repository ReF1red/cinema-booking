from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.hall_service import HallService
from app.services.log_service import LogService
from app.models import models
from app.api.deps import get_current_user, get_current_cinema_admin, get_optional_user

router = APIRouter(prefix="/halls", tags=["Halls"])

@router.get("/cinemas/{cinema_id}/halls", response_model=List[schemas.HallOut])
def get_halls_by_cinema(
    cinema_id: int,
    db = Depends(get_db),
    ):
    return HallService.get_halls_by_cinema(db, cinema_id)

@router.get("/halls/{hall_id}", response_model=schemas.HallOut)
def get_hall_by_id(
    hall_id: int,
    request: Request,
    db = Depends(get_db),
    current_user = Depends(get_optional_user)
    ):
    hall = HallService.get_hall_by_id(db, hall_id)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    if current_user:
        LogService.log_action(
            db = db,
            user_id = user_id,
            user_email = user_email,
            action_type = "VIEW_HALL",
            details = {"hall": hall},
            ip_address = request.client.host
        )

    return hall

@router.get("/halls/{hall_id}/seats", response_model=List[schemas.SeatOut])
def get_seats_by_hall(
    hall_id: int,
    request: Request,
    session_id: int = None,
    db = Depends(get_db),
    current_user = Depends(get_optional_user)
    ):
    seats = HallService.get_seats_by_hall(db, hall_id, session_id)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    if current_user:
        LogService.log_action(
            db = db,
            user_id = user_id,
            user_email = user_email,
            action_type = "VIEW_HALL_SCHEMA",
            details = {"hall_id": hall_id, "session_id": session_id, "seats_count": len(seats)},
            ip_address = request.client.host
        )

    return seats

@router.post("/admin/halls", response_model=schemas.HallOut)
def create_hall(
    hall_data: schemas.HallCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
    ):
    if current_user.role == models.UserRole.CINEMA_ADMIN:
        if hall_data.cinema_id != current_user.cinema_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot create hall in another cinema"
            )

    hall = HallService.create_hall(db, hall_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_HALL",
        details = {"hall_data": hall_data.model_dump()},
        ip_address = request.client.host
    )

    return hall

@router.put("/admin/halls/{hall_id}", response_model=schemas.HallOut)
def update_hall(
    hall_id: int,
    hall_data: schemas.HallCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
    ):
    hall = db.query(models.Hall).filter(models.Hall.hall_id == hall_id).first()
    if not hall:
        raise HTTPException(
            status_code=404,
            detail="Hall not found"
        )
    if current_user.role == models.UserRole.CINEMA_ADMIN:
        if hall.cinema_id != current_user.cinema_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )

    updated_hall = HallService.update_hall(db, hall_id, hall_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "UPDATE_HALL",
        details = {"hall_data": hall_data.model_dump()},
        ip_address = request.client.host
    )

    return updated_hall

@router.delete("/admin/halls/{hall_id}")
def delete_hall(
    hall_id: int,
    request: Request,
    db = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
    ):
    hall = db.query(models.Hall).filter(models.Hall.hall_id == hall_id).first()
    if not hall:
        raise HTTPException(
            status_code=404,
            detail="Hall not found"
        )
    if current_user.role == models.UserRole.CINEMA_ADMIN:
        if hall.cinema_id != current_user.cinema_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied"
            )
            
    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "DELETE_HALL",
        details = {"hall": {
            "hall_id": hall.hall_id,
            "hall_name": hall.hall_name,
            "cinema_id": hall.cinema_id
        }},
        ip_address = request.client.host
    )

    return HallService.delete_hall(db, hall_id)