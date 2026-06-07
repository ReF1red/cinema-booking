from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 
from datetime import datetime, timedelta

class SessionService:
    @staticmethod
    def get_available_seats(db: Session, session_id: int) -> int:
        session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
        if not session:
            return 0
        
        hall = db.query(models.Hall).filter(models.Hall.hall_id == session.hall_id).first()
        total = hall.rows_count * hall.seats_per_row
        
        taken = db.query(models.Ticket).join(models.Booking).filter(
            models.Booking.session_id == session_id,
            models.Booking.status.in_(["confirmed", "paid"])
        ).count()
        
        return total - taken

    @staticmethod
    def get_sessions_by_movie(db: Session, movie_id: int, date: str = None):
        query = db.query(models.Session).filter(models.Session.movie_id == movie_id)
        
        movie = db.query(models.Movie).filter(models.Movie.movie_id == movie_id).first()

        if not movie:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Movie not found"
            )
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

            hall = db.query(models.Hall).filter(models.Hall.hall_id == session.hall_id).first()

            result.append({
                "session_id": session.session_id,
                "hall_id": session.hall_id,
                "movie_id": session.movie_id,
                "start_time": session.start_time,
                "price": session.price,
                "available_seats": SessionService.get_available_seats(db, session.session_id),
                "hall_name": hall.hall_name if hall else None,
                "movie_title": movie.title if movie else None,
                "total_seats": hall.rows_count * hall.seats_per_row if hall else None
            })

        return result

    
    @staticmethod
    def get_session_by_cinema(db: Session, cinema_id: int, date: str = None):
        query = db.query(models.Session).join(models.Hall).filter(models.Hall.cinema_id == cinema_id)

        cinema = db.query(models.Cinema).filter(models.Cinema.cinema_id == cinema_id).first()

        if not cinema:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Cinema not found"
            )
        
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
                "available_seats": SessionService.get_available_seats(db, session.session_id)
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
            "available_seats": SessionService.get_available_seats(db, session.session_id)
        }
    
    @staticmethod
    def create_session(db: Session, session_data: schemas.SessionCreate):
        hall= db.query(models.Hall).filter(
            models.Hall.hall_id == session_data.hall_id
        ).first()

        if not hall:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hall not found"
            )

        movie = db.query(models.Movie).filter(
            models.Movie.movie_id == session_data.movie_id
        ).first()

        if not movie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Movie not found"
            )     

        movie_duration = movie.duration_min
        session_end = session_data.start_time + timedelta(minutes=movie_duration)

        start_time = session_data.start_time.replace(tzinfo=None) if session_data.start_time.tzinfo else session_data.start_time
        session_end = start_time + timedelta(minutes=movie_duration)

        conflicting = db.query(models.Session).filter(
            models.Session.hall_id == session_data.hall_id,
            models.Session.start_time < session_end
        ).all()

        if conflicting:
            for conf in conflicting:
                conf_movie = db.query(models.Movie).filter(models.Movie.movie_id == conf.movie_id).first()
                conf_duration = conf_movie.duration_min if conf_movie else 120
                conf_end = conf.start_time + timedelta(minutes=conf_duration)
                if conf_end > start_time:
                    raise HTTPException(
                        status_code = status.HTTP_400_BAD_REQUEST,
                        detail = f"В зале уже есть сеанс в это время: «{conf_movie.title if conf_movie else 'Фильм'}» "
                                f"({conf.start_time.strftime('%H:%M')} – {conf_end.strftime('%H:%M')})"
                    )  
        
        new_session = models.Session(
            hall_id = session_data.hall_id,
            movie_id = session_data.movie_id,
            start_time = session_data.start_time,
            price = session_data.price
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
            "available_seats": SessionService.get_available_seats(db, new_session.session_id)
        }
    
    @staticmethod
    def update_session(db: Session, session_id: int, session_data: schemas.SessionCreate):
        session = db.query(models.Session).filter(models.Session.session_id == session_id).first()

        if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Session not found"
                )
        
        movie = db.query(models.Movie).filter(
            models.Movie.movie_id == session_data.movie_id
        ).first()

        if not movie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Movie not found"
            )  
    
        movie_duration = movie.duration_min

        start_time = session_data.start_time.replace(tzinfo=None) if session_data.start_time.tzinfo else session_data.start_time
        session_end = start_time + timedelta(minutes=movie_duration)

        conflicting = db.query(models.Session).filter(
            models.Session.hall_id == session_data.hall_id,
            models.Session.session_id != session_id,
            models.Session.start_time < session_end
        ).all()

        if conflicting:
            for conf in conflicting:
                conf_movie = db.query(models.Movie).filter(models.Movie.movie_id == conf.movie_id).first()
                conf_duration = conf_movie.duration_min if conf_movie else 120
                conf_start = conf.start_time.replace(tzinfo=None) if conf.start_time.tzinfo else conf.start_time
                conf_end = conf_start + timedelta(minutes=conf_duration)
                if conf_end > start_time:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"В зале уже есть сеанс в это время: «{conf_movie.title if conf_movie else 'Фильм'}» "
                            f"({conf_start.strftime('%H:%M')} – {conf_end.strftime('%H:%M')})"
                    )
                
        session.hall_id = session_data.hall_id
        session.movie_id = session_data.movie_id
        session.start_time = start_time
        session.price = session_data.price

        db.commit()
        db.refresh(session)
        
        return {
            "session_id": session.session_id,
            "hall_id": session.hall_id,
            "movie_id": session.movie_id,
            "start_time": session.start_time,
            "price": session.price,
            "available_seats": SessionService.get_available_seats(db, session.session_id)
        }

    @staticmethod
    def delete_session(db: Session, session_id: int):
        session = db.query(models.Session).filter(models.Session.session_id == session_id).first()
        if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Session not found"
                )
        
        booking = db.query(models.Booking).filter(models.Booking.session_id == session_id).first()
        if booking:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete session with existing bookings"
            )

        db.delete(session)
        db.commit()
        
        return {"message": "Session deleted successfully"}