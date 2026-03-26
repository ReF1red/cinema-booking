from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 

class HallService:
    @staticmethod
    def get_halls_by_cinema(db: Session,cinema_id: int):
        halls = db.query(models.Hall).filter(models.Hall.cinema_id == cinema_id).all()

        result = []

        for hall in halls:
            result.append({
                "hall_id": hall.hall_id,
                "cinema_id": hall.cinema_id,
                "hall_name": hall.hall_name,
                "rows_count": hall.rows_count,
                "seats_per_row": hall.seats_per_row,
                "total_seats": hall.rows_count * hall.seats_per_row
            })
        return result
    
    @staticmethod
    def get_hall_by_id(db: Session, hall_id: int):
        hall = db.query(models.Hall).filter(models.Hall.hall_id == hall_id).first()

        if hall is None:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Hall not found"
            )
        
        return {
            "hall_id": hall.hall_id,
            "cinema_id": hall.cinema_id,
            "hall_name": hall.hall_name,
            "rows_count": hall.rows_count,
            "seats_per_row": hall.seats_per_row,
            "total_seats": hall.rows_count * hall.seats_per_row
        }
    
    @staticmethod
    def create_hall(db: Session, hall_data: schemas.HallCreate):
        cinema = db.query(models.Cinema).filter(
            models.Cinema.cinema_id == hall_data.cinema_id
        ).first()
        if not cinema:
            raise HTTPException(
                status_code=404,
                detail="Cinema not found"
            )

        new_hall = models.Hall(
            cinema_id=hall_data.cinema_id,
            hall_name=hall_data.hall_name,
            rows_count=hall_data.rows_count,
            seats_per_row=hall_data.seats_per_row
        )

        db.add(new_hall)
        db.commit()
        db.refresh(new_hall)
        
        HallService._generate_seats(
            db,
            new_hall.hall_id,
            new_hall.rows_count,
            new_hall.seats_per_row
        )

        return {
            "hall_id": new_hall.hall_id,
            "cinema_id": new_hall.cinema_id,
            "hall_name": new_hall.hall_name,
            "rows_count": new_hall.rows_count,
            "seats_per_row": new_hall.seats_per_row,
            "total_seats": new_hall.rows_count * new_hall.seats_per_row
        }
    
    @staticmethod
    def update_hall(db: Session, hall_id: int, hall_data: schemas.HallCreate):
        hall = HallService.get_hall_by_id(db, hall_id)
        
        hall.hall_name = hall_data.hall_name
        
        db.commit()
        db.refresh(hall)
        
        return {
            "hall_id": hall.hall_id,
            "cinema_id": hall.cinema_id,
            "hall_name": hall.hall_name,
            "rows_count": hall.rows_count,
            "seats_per_row": hall.seats_per_row,
            "total_seats": hall.rows_count * hall.seats_per_row
        }

    @staticmethod
    def delete_hall(db: Session, hall_id: int):
        hall = HallService.get_hall_by_id(db, hall_id)

        sessions = db.query(models.Session).filter(models.Session.hall_id == hall_id).first()
        if sessions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete hall with existing sessions"
            )
        
        db.delete(hall)
        db.commit()
        
        return {"message": "Hall deleted successfully"}
    
    @staticmethod
    def get_seats_by_hall(db: Session, hall_id: int, session_id: int = None):
        seats = db.query(models.Seat).filter(models.Seat.hall_id == hall_id).all()

        booked_seat_ids = set()

        if session_id != None:
            booked_tickets = db.query(models.Ticket).join(models.Booking).filter(
                models.Booking.session_id == session_id,
                models.Booking.status == "confirmed"
            ).all()

            booked_seat_ids = {t.seat_id for t in booked_tickets}

        result = []
        for seat in seats:
            result.append({
                "seat_id": seat.seat_id,
                "row_letter": seat.row_letter,
                "seat_number": seat.seat_number,
                "is_booked": seat.seat_id in booked_seat_ids
            })

        return result

    @staticmethod
    def _generate_seats(db: Session, hall_id: int, rows_count: int, seats_per_row: int):
        
        for row_idx in range(rows_count):
            row_letter = chr(ord('A') + row_idx)
        
            for seat_num in range(1, seats_per_row + 1):
                seat = models.Seat(
                    hall_id=hall_id,
                    row_letter=row_letter,
                    seat_number=seat_num
                )
                db.add(seat)
        
        db.commit()