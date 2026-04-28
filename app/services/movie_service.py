from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 
import json

class MovieService:
    @staticmethod
    def get_all_movies(db: Session):
        movies = db.query(models.Movie).all()
        result = []
        for movie in movies:
            result.append({
                "movie_id": movie.movie_id,
                "title": movie.title,
                "description": movie.description,
                "duration_min": movie.duration_min,
                "genre": movie.genre,
                "poster_url": movie.poster_url,
                "release_year": movie.release_year,
                "rating": movie.rating,
                "director": movie.director,
                "writer": movie.writer,
                "country": movie.country,
                "budget_amount": movie.budget_amount,
                "budget_currency": movie.budget_currency,
                "main_actors": json.loads(movie.main_actors) if movie.main_actors else None
            })
        return result
    
    @staticmethod
    def get_movie_by_id(db: Session, movie_id: int):
        movie = db.query(models.Movie).filter(models.Movie.movie_id == movie_id).first()

        if movie is None:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Movie not found"
            )

        main_actors = None
        if movie.main_actors:
            main_actors = json.loads(movie.main_actors)
        
        return {
            "movie_id": movie.movie_id,
            "title": movie.title,
            "description": movie.description,
            "duration_min": movie.duration_min,
            "genre": movie.genre,
            "poster_url": movie.poster_url,
            "release_year": movie.release_year,
            "rating": movie.rating,
            "director": movie.director,
            "writer": movie.writer,
            "country": movie.country,
            "budget_amount": movie.budget_amount,
            "budget_currency": movie.budget_currency,
            "main_actors": json.loads(movie.main_actors) if movie.main_actors else None
        }
    
    @staticmethod
    def create_movie(db: Session, movie_data: schemas.MovieCreate):

        main_actors_json = json.dumps(movie_data.main_actors) if movie_data.main_actors else None

        new_movie = models.Movie(
            title = movie_data.title,
            description = movie_data.description,
            duration_min = movie_data.duration_min,
            genre = movie_data.genre,
            poster_url = movie_data.poster_url,
            release_year = movie_data.release_year,
            rating=movie_data.rating,
            director=movie_data.director,
            writer=movie_data.writer,
            country=movie_data.country,
            budget_amount=movie_data.budget_amount,
            budget_currency=movie_data.budget_currency,
            main_actors=main_actors_json
        )
        
        db.add(new_movie)
        db.commit()
        db.refresh(new_movie)
        
        return {
            "movie_id": new_movie.movie_id,
            "title": new_movie.title,
            "description": new_movie.description,
            "duration_min": new_movie.duration_min,
            "genre": new_movie.genre,
            "poster_url": new_movie.poster_url,
            "release_year": new_movie.release_year,
            "rating": new_movie.rating,
            "director": new_movie.director,
            "writer": new_movie.writer,
            "country": new_movie.country,
            "budget_amount": new_movie.budget_amount,
            "budget_currency": new_movie.budget_currency,
            "main_actors": json.loads(new_movie.main_actors) if new_movie.main_actors else None
        }
    
    @staticmethod
    def update_movie(db: Session, movie_id: int, movie_data: schemas.MovieCreate):
        movie = db.query(models.Movie).filter(models.Movie.movie_id == movie_id).first()
        if not movie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Movie not found"
            )  
              
        movie.title = movie_data.title
        movie.description = movie_data.description
        movie.duration_min = movie_data.duration_min
        movie.genre = movie_data.genre
        movie.poster_url = movie_data.poster_url
        movie.release_year = movie_data.release_year
        movie.rating = movie_data.rating
        movie.director = movie_data.director
        movie.writer = movie_data.writer
        movie.country = movie_data.country
        movie.budget_amount = movie_data.budget_amount
        movie.budget_currency = movie_data.budget_currency
        
        if movie_data.main_actors is not None:
            movie.main_actors = json.dumps(movie_data.main_actors)

        db.commit()
        db.refresh(movie)
        
        return {
            "movie_id": movie.movie_id,
            "title": movie.title,
            "description": movie.description,
            "duration_min": movie.duration_min,
            "genre": movie.genre,
            "poster_url": movie.poster_url,
            "release_year": movie.release_year,
            "rating": movie.rating,
            "director": movie.director,
            "writer": movie.writer,
            "country": movie.country,
            "budget_amount": movie.budget_amount,
            "budget_currency": movie.budget_currency,
            "main_actors": json.loads(movie.main_actors) if movie.main_actors else None
        }    
    
    @staticmethod
    def delete_movie(db: Session, movie_id: int):
        movie = db.query(models.Movie).filter(models.Movie.movie_id == movie_id).first()
        if not movie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Movie not found"
            )
        sessions = db.query(models.Session).filter(models.Session.movie_id == movie_id).first()
        if sessions:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "Cannot delete movie with existing sessions"
            )
        
        db.delete(movie)
        db.commit()
        
        return {"message": "Movie deleted successfully"}