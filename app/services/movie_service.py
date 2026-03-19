from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 

class MovieService:
    @staticmethod
    def get_all_movies(db: Session):
        return db.query(models.Movie).all()
    
    @staticmethod
    def get_movie_by_id(db: Session, movie_id: int):
        movie = db.query(models.Movie).filter(models.Movie.movie_id == movie_id).first()

        if movie is None:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Movie not found"
            )
        return movie
    
    @staticmethod
    def create_movie(db: Session, movie_data: schemas.MovieCreate):
        new_movie = models.Movie(
            title = movie_data.title,
            description = movie_data.description,
            duration_min = movie_data.duration_min,
            genre = movie_data.genre,
            poster_url = movie_data.poster_url,
            release_year = movie_data.release_year
        )
        
        db.add(new_movie)
        db.commit()
        db.refresh(new_movie)
        
        return new_movie
    
    @staticmethod
    def update_movie(db: Session, movie_id: int, movie_data: schemas.MovieCreate):
        movie = MovieService.get_movie_by_id(db, movie_id)
        
        movie.title = movie_data.title
        movie.description = movie_data.description
        movie.duration_min = movie_data.duration_min
        movie.genre = movie_data.genre
        movie.poster_url = movie_data.poster_url
        movie.release_year = movie_data.release_year
        
        db.commit()
        db.refresh(movie)
        
        return movie
    
    @staticmethod
    def delete_movie(db: Session, movie_id: int):
        movie = MovieService.get_movie_by_id(db, movie_id)

        sessions = db.query(models.Session).filter(models.Session.movie_id == movie_id).first()
        if sessions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete movie with existing sessions"
            )
        
        db.delete(movie)
        db.commit()
        
        return {"message": "Movie deleted successfully"}