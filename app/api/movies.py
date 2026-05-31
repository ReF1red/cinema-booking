import os
import uuid
import json
from fastapi import APIRouter, Depends, Request, Query, HTTPException, UploadFile, File, status, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import schemas
from app.database import get_db
from app.services.movie_service import MovieService
from app.services.log_service import LogService
from app.api.deps import get_optional_user, get_current_cinema_admin
from app.models import models

router = APIRouter(prefix="/movies", tags=["Movies"])
UPLOAD_DIR = "static/posters"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

@router.get("/", response_model=List[schemas.MovieOut])
def get_movies(db: Session = Depends(get_db)):
    return MovieService.get_all_movies(db)

@router.get("/featured", response_model=List[schemas.MovieOut])
def get_featured_movies(
    cinema_id: int = Query(..., description="ID кинотеатра"),
    db: Session = Depends(get_db)
):
    return MovieService.get_featured_movies(db, cinema_id)

@router.get("/search", response_model=List[schemas.MovieOut])
def search_movies(
    q: str = Query(..., min_length=2, description="Поисковый запрос"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_optional_user)
):
    result = MovieService.search_movies(db, q)
    
    if current_user:
        LogService.log_action(
            db=db,
            user_id=current_user.user_id,
            user_email=current_user.email,
            action_type="SEARCH_MOVIES",
            details={"query": q, "results_count": len(result)},
            ip_address=request.client.host
        )
    
    return result

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
            details = {"movie_id": movie_id, "title": movie["title"]},
            ip_address = request.client.host
        )    

    return movie

@router.post("/admin/movies", response_model=schemas.MovieOut)
async def create_movie(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    duration_min: int = Form(...),
    genre: Optional[str] = Form(None),
    release_year: Optional[int] = Form(None),
    rating: Optional[float] = Form(None),
    director: Optional[str] = Form(None),
    writer: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    budget_amount: Optional[float] = Form(None),
    budget_currency: Optional[str] = Form(None),
    main_actors: Optional[str] = Form(None),
    age_rating: Optional[str] = Form(None),
    poster: Optional[UploadFile] = File(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    movie_data = schemas.MovieCreate(
        title = title,
        description = description,
        duration_min = duration_min,
        genre = genre,
        release_year = release_year,
        rating = rating,
        director = director,
        writer = writer,
        country = country,
        budget_amount = budget_amount,
        budget_currency = budget_currency,
        main_actors = json.loads(main_actors) if main_actors else None,
        age_rating = age_rating
    )
    
    movie = MovieService.create_movie(db, movie_data)
    
    if poster and poster.filename:
        movie["poster_url"] = await save_poster(poster)
        db_movie = db.query(models.Movie).filter(models.Movie.movie_id == movie["movie_id"]).first()
        db_movie.poster_url = movie["poster_url"]
        db.commit()

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
async def update_movie(
    movie_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    duration_min: int = Form(...),
    genre: Optional[str] = Form(None),
    release_year: Optional[int] = Form(None),
    rating: Optional[float] = Form(None),
    director: Optional[str] = Form(None),
    writer: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    budget_amount: Optional[float] = Form(None),
    budget_currency: Optional[str] = Form(None),
    main_actors: Optional[str] = Form(None),
    age_rating: Optional[str] = Form(None),
    poster: Optional[UploadFile] = File(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_cinema_admin)
):
    movie_data = schemas.MovieCreate(
        title = title,
        description = description,
        duration_min = duration_min,
        genre = genre,
        release_year = release_year,
        rating = rating,
        director = director,
        writer = writer,
        country = country,
        budget_amount = budget_amount,
        budget_currency = budget_currency,
        main_actors = json.loads(main_actors) if main_actors else None,
        age_rating = age_rating
    )

    movie = MovieService.update_movie(db, movie_id, movie_data)

    if poster and poster.filename:
        old_movie = MovieService.get_movie_by_id(db, movie_id)
        old_url = old_movie.get("poster_url") if old_movie else None
        movie["poster_url"] = await save_poster(poster, old_url)
        db_movie = db.query(models.Movie).filter(models.Movie.movie_id == movie_id).first()
        db_movie.poster_url = movie["poster_url"]
        db.commit()

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

    if movie_dict.get("poster_url"):
        filepath = movie_dict["poster_url"].lstrip("/")
        if os.path.exists(filepath):
            os.remove(filepath)

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

async def save_poster(poster: UploadFile, old_url: str = None) -> str:
    if old_url:
        old_path = old_url.lstrip("/")
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = poster.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = f"Invalid file format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(await poster.read())
    return f"/static/posters/{filename}"