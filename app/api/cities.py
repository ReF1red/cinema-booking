from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.city_service import CityService
from app.services.log_service import LogService
from app.api.deps import get_current_admin

router = APIRouter(prefix="/cities", tags=["Cities"])

@router.get("/", response_model=List[schemas.CityOut])
def get_cities(
    db = Depends(get_db)
    ):
    return CityService.get_all_cities(db)

@router.post("/admin/cities", response_model=schemas.CityOut)
def create_city(
    city_data: schemas.CityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    city = CityService.create_city(db, city_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None
    
    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_CITY",
        details = {"city": city_data.model_dump()},
        ip_address = request.client.host
    )

    return city

@router.put("/admin/cities/{city_id}", response_model=schemas.CityOut)
def update_city(
    city_id: int,
    city_data: schemas.CityCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    city = CityService.update_city(db, city_id, city_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "UPDATE_CITY",
        details = {"city_data": city_data.model_dump()},
        ip_address = request.client.host
    )

    return city

@router.delete("/admin/cities/{city_id}")
def delete_city(
    city_id: int,
    request: Request,
    db = Depends(get_db),
    current_user = Depends(get_current_admin)
    ):
    city = CityService.get_city_by_id(db, city_id)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "DELETE_CITY",
        details = {"city": {
            "city_id": city.city_id,
            "city_name": city.city_name
        }},
        ip_address = request.client.host
    )

    return CityService.delete_city(db, city_id)