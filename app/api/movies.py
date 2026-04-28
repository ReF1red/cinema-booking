from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.movie_service import MovieService
from app.services.log_service import LogService
from app.api.deps import get_optional_user, get_current_cinema_admin

router = APIRouter(prefix="/movies", tags=["Movies"])

@router.get("/", response_model=List[schemas.MovieOut])
def get_movies(db: Session = Depends(get_db)):
    return MovieService.get_all_movies(db)

@router.get("/{movie_id}", response_model=schemas.MovieOut)
def get_movie_by_id(
    movie_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_optional_user)
    ):
    
    movie =  MovieService.get_movie_by_id(db, movie_id)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    if current_user:
        LogService.log_action(
            db = db,
            user_id = user_id,
            user_email = user_email,
            action_type = "VIEW_MOVIE",
            details = {"movie_id": movie_id, "title": movie.title},
            ip_address = request.client.host
        )    

    return movie

@router.post("/admin/movies", response_model=schemas.MovieOut)
def create_movie(
    movie_data: schemas.MovieCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    movie = MovieService.create_movie(db, movie_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_MOVIE",
        details = {"movie_data": movie_data.model_dump()},
        ip_address = request.client.host
    )

    return movie

@router.put("/admin/movies/{movie_id}", response_model=schemas.MovieOut)
def update_movie(
    movie_id: int,
    movie_data: schemas.MovieCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    movie = MovieService.update_movie(db, movie_id, movie_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "UPDATE_MOVIE",
        details = {"movie_data": movie_data.model_dump()},
        ip_address = request.client.host
    )

    return movie

@router.delete("/admin/movies/{movie_id}")
def delete_movie(
    movie_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    movie_dict = MovieService.get_movie_by_id(db, movie_id)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "DELETE_MOVIE",
        details={"movie": movie_dict},
        ip_address = request.client.host
    )

    return MovieService.delete_movie(db, movie_id)