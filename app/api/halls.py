from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.hall_service import HallService
from app.api.deps import get_current_user, get_current_admin

router = APIRouter(prefix="/halls", tags=["Halls"])

@router.get("/cinemas/{cinema_id}/halls", response_model=List[schemas.HallOut])
def get_halls_by_cinema(
    cinema_id: int,
    db = Depends(get_db)
    ):
    return HallService.get_halls_by_cinema(db, cinema_id)

@router.get("/halls/{hall_id}", response_model=schemas.HallOut)
def get_hall_by_id(
    hall_id: int,
    db = Depends(get_db)
    ):
    return HallService.get_hall_by_id(db, hall_id)

@router.get("/halls/{hall_id}/seats", response_model=List[schemas.SeatOut])
def get_seats_by_hall(
    hall_id: int,
    session_id: int = None,
    db = Depends(get_db)
    ):
    return HallService.get_seats_by_hall(db, hall_id, session_id)

@router.post("/admin/halls", response_model=schemas.HallOut)
def create_hall(
    hall_data: schemas.HallCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    return HallService.create_hall(db, hall_data)

@router.put("/admin/halls/{hall_id}", response_model=schemas.HallOut)
def update_hall(
    hall_id: int,
    hall_data: schemas.HallCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    return HallService.update_hall(db, hall_id, hall_data)

@router.delete("/admin/halls/{hall_id}")
def delete_hall(
    hall_id: int,
    db = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    return HallService.delete_hall(db, hall_id)