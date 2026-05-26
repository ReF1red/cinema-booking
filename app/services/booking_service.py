from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 
from datetime import datetime


class BookingService:
    @staticmethod
    def get_booking_by_id(db: Session, booking_id: int, user_id: int):
        booking = db.query(models.Booking).filter(
            models.Booking.booking_id == booking_id,
            models.Booking.user_id == user_id
        ).first()
        
        if not booking:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Booking not found"
            )
        return booking

    @staticmethod
    def create_booking(db: Session, user_id: int, booking_data: schemas.BookingCreate):
        session = db.query(models.Session).filter(
            models.Session.session_id == booking_data.session_id
        ).with_for_update().first() 

        if not session:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Session not found"
            ) 
        
        if session.start_time < datetime.now():
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "Session already started"      
            )
        
        seat = db.query(models.Seat).filter(
            models.Seat.seat_id == booking_data.seat_id
        ).first()
        
        if not seat or seat.hall_id != session.hall_id:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "Seat not in this hall"
            )
        
        booked = db.query(models.Ticket).join(models.Booking).filter(
            models.Booking.session_id == booking_data.session_id,
            models.Booking.status.in_(["confirmed", "paid"]),
            models.Ticket.seat_id == booking_data.seat_id
        ).first()
        
        if booked:
            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = "Seat already booked"
            )
        
        booking = models.Booking(
            user_id = user_id,
            session_id = booking_data.session_id,
            total_price = session.price,
            status = "confirmed"
        )
        db.add(booking)
        db.flush()
        
        ticket = models.Ticket(
            booking_id = booking.booking_id,
            seat_id = seat.seat_id
        )
        db.add(ticket)
        db.commit()
        db.refresh(booking)
        
        return {
            "booking_id": booking.booking_id,
            "session_id": booking.session_id,
            "booking_time": booking.booking_time,
            "status": booking.status,
            "total_price": booking.total_price,
            "seat": {
                "seat_id": seat.seat_id,
                "row_letter": seat.row_letter,
                "seat_number": seat.seat_number
            },
            "is_paid": False
        }

    @staticmethod
    def get_user_bookings(db: Session, user_id: int):
        user_bookings = db.query(models.Booking).filter(
            models.Booking.user_id == user_id
        ).order_by(models.Booking.booking_time.desc()).all()
        
        result = []
        for booking in user_bookings:
            ticket = db.query(models.Ticket).filter(
                models.Ticket.booking_id == booking.booking_id
            ).first()
            
            seat = None
            if ticket:
                seat_data = db.query(models.Seat).filter(
                    models.Seat.seat_id ==ticket.seat_id
                ).first()
                if seat_data:
                    seat ={
                        "seat_id": seat_data.seat_id,
                        "row_letter": seat_data.row_letter,
                        "seat_number": seat_data.seat_number
                    }
            
            result.append({
                "booking_id": booking.booking_id,
                "session_id": booking.session_id,
                "booking_time": booking.booking_time,
                "status": booking.status,
                "total_price": booking.total_price,
                "seat": seat,
                "is_paid": ticket.is_paid if ticket else False
            })
        return result
    
    @staticmethod
    def cancel_booking(db: Session, booking_id: int, user_id: int):
        booking = db.query(models.Booking).filter(
            models.Booking.booking_id == booking_id,
            models.Booking.user_id == user_id
        ).with_for_update().first()

        if not booking:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "Booking not found"
            )
        
        if booking.status == "paid":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel paid booking"
            )
        
        session = booking.session
        
        db.delete(booking)
        db.commit()

        return {"message": "Booking cancelled successfully"}
    
    @staticmethod
    def cancel_expired_bookings(db: Session, user_id: int):
        expired = db.query(models.Booking).join(models.Session).filter(
            models.Booking.user_id == user_id,
            models.Booking.status == "confirmed",
            models.Session.start_time <= datetime.now()
        ).all()
        
        for booking in expired:
            booking.status = "cancelled"
        
        if expired:
            db.commit()
        
        return len(expired)