from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status 
from datetime import datetime, timedelta


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
        
        MAX_SEATS_PER_BOOKING = 4
        MAX_TOTAL_BOOKED_SEATS = 4

        if len(booking_data.seats) > MAX_SEATS_PER_BOOKING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Нельзя забронировать более {MAX_SEATS_PER_BOOKING} мест за одну бронь"
            )
        
        total_booked = db.query(models.Ticket).join(models.Booking).filter(
            models.Booking.user_id == user_id,
            models.Booking.status == "confirmed",
            models.Ticket.is_paid == False
        ).count()
        
        if total_booked + len(booking_data.seats) > MAX_TOTAL_BOOKED_SEATS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"У вас уже {total_booked} забронированных мест. Нельзя забронировать более {MAX_TOTAL_BOOKED_SEATS} мест одновременно"
            )
        
        seats = db.query(models.Seat).filter(models.Seat.seat_id.in_(booking_data.seats)).all()

        for seat in seats:
            if seat.hall_id != session.hall_id:
                raise HTTPException(
                    status_code = status.HTTP_400_BAD_REQUEST,
                    detail = f"Seat {seat.seat_id} is not in this hall"      
                )
        
        booked_tickets = db.query(models.Ticket).join(models.Booking).filter(
            models.Booking.session_id == booking_data.session_id,
            models.Booking.status == "confirmed",
            models.Ticket.seat_id.in_(booking_data.seats)
        ).all()

        if booked_tickets:
            booked_seat_ids = [t.seat_id for t in booked_tickets]

            raise HTTPException(
                status_code = status.HTTP_400_BAD_REQUEST,
                detail = f"Seats {booked_seat_ids} are already booked"
            )
        
        total_price = session.price * len(booking_data.seats)


        new_booking = models.Booking(
            user_id = user_id,
            session_id = booking_data.session_id,
            total_price = total_price,
            status = "confirmed"
        )

        db.add(new_booking)
        db.flush()

        for seat in seats:
            ticket = models.Ticket(
                booking_id = new_booking.booking_id,
                seat_id = seat.seat_id
            )
            db.add(ticket)

        db.commit()
        db.refresh(new_booking)

        result = []
        for seat in seats:
            result.append({
                "seat_id": seat.seat_id,
                "row_letter": seat.row_letter,
                "seat_number": seat.seat_number
            })
        return{
            "booking_id": new_booking.booking_id,
            "session_id": new_booking.session_id,
            "booking_time": new_booking.booking_time,
            "status": new_booking.status,
            "total_price": new_booking.total_price,
            "seats": result
        }

    @staticmethod
    def get_user_bookings(db: Session, user_id: int):
        user_bookings = db.query(models.Booking).filter(
            models.Booking.user_id == user_id).order_by(
                models.Booking.booking_time.desc()).all()
        
        result = []
        for booking in user_bookings:
            tickets = db.query(models.Ticket).filter(
                models.Ticket.booking_id == booking.booking_id).all()
            
            seats = []
            for ticket in tickets:
                seat = db.query(models.Seat).filter(
                    models.Seat.seat_id ==ticket.seat_id
                ).first()
                if seat:
                    seats.append({
                        "seat_id": seat.seat_id,
                        "row_letter": seat.row_letter,
                        "seat_number": seat.seat_number
                    })
            
            result.append({
                "booking_id": booking.booking_id,
                "session_id": booking.session_id,
                "booking_time": booking.booking_time,
                "status": booking.status,
                "total_price": booking.total_price,
                "seats": seats
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