from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List
from app.models import models
from app.schemas import schemas
from app.database import get_db
from app.services.cinema_service import CinemaService
from app.services.log_service import LogService
from app.api.deps import get_current_admin

router = APIRouter(prefix="/cities", tags=["Cinemas"])

@router.get("/{city_id}/cinemas", response_model=List[schemas.CinemaOut])
def get_cinemas_by_city(
    city_id: int,
    db = Depends(get_db)
    ):
    return CinemaService.get_cinemas_by_city(db, city_id)

@router.post("/admin/cinemas", response_model=schemas.CinemaOut)
def create_cinema(
    cinema_data: schemas.CinemaCreate,
    request: Request,
    db = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    cinema = CinemaService.create_cinema(db, cinema_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_CINEMA",
        details = {"cinema_data": cinema_data.model_dump()},
        ip_address = request.client.host
    )

    return cinema

@router.put("/admin/cinemas/{cinema_id}", response_model=schemas.CinemaOut)
def update_cinema(
    cinema_id: int,
    cinema_data: schemas.CinemaCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    cinema = CinemaService.update_cinema(db, cinema_id, cinema_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "UPDATE_CINEMA",
        details = {"cinema_data": cinema_data.model_dump()},
        ip_address = request.client.host
    )

    return cinema

@router.delete("/admin/cinemas/{cinema_id}")
def delete_cinema(
    cinema_id: int,
    request: Request,
    db = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    cinema = db.query(models.Cinema).filter(models.Cinema.cinema_id == cinema_id).first()

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "DELETE_CINEMA",
        details = {"cinema": {
            "cinema_id": cinema.cinema_id,
            "cinema_name": cinema.cinema_name,
            "city_id": cinema.city_id            
        }},
        ip_address = request.client.host
    )

    return CinemaService.delete_cinema(db, cinema_id)