from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.movie_service import MovieService
from app.api.deps import get_current_admin

router = APIRouter(prefix="/movies", tags=["Movies"])

@router.get("/", response_model = List[schemas.MovieOut])
def get_movies(db: Session = Depends(get_db)):
    return MovieService.get_all_movies(db)

@router.get("/{movie_id}", response_model = schemas.MovieOut)
def get_movie_by_id(movie_id: int, db: Session = Depends(get_db)):
    return MovieService.get_movie_by_id(db, movie_id)

@router.post("/admin/movies", response_model=schemas.MovieOut)
def create_movie(
    movie_data: schemas.MovieCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    return MovieService.create_movie(db, movie_data)

@router.put("/admin/movies/{movie_id}", response_model = schemas.MovieOut)
def update_movie(
    movie_id: int,
    movie_data: schemas.MovieCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    return MovieService.update_movie(db, movie_id, movie_data)

@router.delete("/admin/movies/{movie_id}")
def delete_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    return MovieService.delete_movie(db, movie_id)