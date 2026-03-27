from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 
from datetime import datetime, timedelta

class SessionService:
    @staticmethod
    def get_sessions_by_movie(db: Session, movie_id: int, date: str = None):
        query = db.query(models.Session).filter(models.Session.movie_id == movie_id)
        
        if date:
            date_start = datetime.strptime(date, "%Y-%m-%d")
            date_end = date_start.replace(hour = 23, minute = 59, second = 59)

            query = query.filter(
                models.Session.start_time >= date_start,
                models.Session.start_time <= date_end
                )

        sessions = query.all()

        result = []
        for session in sessions:
            result.append({
                "session_id": session.session_id,
                "hall_id": session.hall_id,
                "movie_id": session.movie_id,
                "start_time": session.start_time,
                "price": session.price,
                "available_seats": session.available_seats
            })

        return result

    
    @staticmethod
    def get_session_by_cinema(db: Session, cinema_id: int, date: str = None):
        query = db.query(models.Session).join(models.Hall).filter(models.Hall.cinema_id == cinema_id)

        if date:
            date_start = datetime.strptime(date, "%Y-%m-%d")
            date_end = date_start.replace(hour = 23, minute = 59, second = 59)

            query = query.filter(
                models.Session.start_time >= date_start,
                models.Session.start_time <= date_end
            ) 

        sessions = query.all()

        result = []

        for session in sessions:
            result.append({
                "session_id": session.session_id,
                "hall_id": session.hall_id,
                "movie_id": session.movie_id,
                "start_time": session.start_time,
                "price": session.price,
                "available_seats": session.available_seats
            })

        return result

            
    
    @staticmethod
    def get_session_by_id(db: Session, session_id: int):
        session = db.query(models.Session).filter(models.Session.session_id == session_id).first()

        if session is None:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Session not found"
            )
        
        return {
            "session_id": session.session_id,
            "hall_id": session.hall_id,
            "movie_id": session.movie_id,
            "start_time": session.start_time,
            "price": session.price,
            "available_seats": session.available_seats
        }
    
    @staticmethod
    def create_session(db: Session, session_data: schemas.SessionCreate):
        hall= db.query(models.Hall).filter(
            models.Hall.hall_id == session_data.hall_id
        ).first()

        if not hall:
            raise HTTPException(
                status_code=404,
                detail="Hall not found"
            )

        movie = db.query(models.Movie).filter(
            models.Movie.movie_id == session_data.movie_id
        ).first()

        if not movie:
            raise HTTPException(
                status_code=404,
                detail="Movie not found"
            )           
        
        total_seats = hall.rows_count * hall.seats_per_row

        new_session = models.Session(
            hall_id = session_data.hall_id,
            movie_id = session_data.movie_id,
            start_time = session_data.start_time,
            price = session_data.price,
            available_seats = total_seats
        )

        db.add(new_session)
        db.commit()
        db.refresh(new_session)


        return {
            "session_id": new_session.session_id,
            "hall_id": new_session.hall_id,
            "movie_id": new_session.movie_id,
            "start_time": new_session.start_time,
            "price": new_session.price,
            "available_seats": new_session.available_seats
        }
    
    @staticmethod
    def update_session(db: Session, session_id: int, session_data: schemas.SessionCreate):
        session = SessionService.get_session_by_id(db, session_id)
                
        session.hall_id = session_data.hall_id
        session.movie_id = session_data.movie_id
        session.start_time = session_data.start_time
        session.price = session_data.price

        db.commit()
        db.refresh(session)
        
        return {
            "session_id": session.session_id,
            "hall_id": session.hall_id,
            "movie_id": session.movie_id,
            "start_time": session.start_time,
            "price": session.price,
            "available_seats": session.available_seats
        }

    @staticmethod
    def delete_session(db: Session, session_id: int):
        session = SessionService.get_session_by_id(db, session_id)
        
        booking = db.query(models.Booking).filter(models.Booking.session_id == session_id).first()
        if booking:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete session with existing bookings"
            )

        db.delete(session)
        db.commit()
        
        return {"message": "Session deleted successfully"}