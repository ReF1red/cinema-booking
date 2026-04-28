from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.booking_service import BookingService
from app.services.log_service import LogService
from app.api.deps import get_current_active_user
from app.models import models
from datetime import datetime

router = APIRouter(prefix="/booking", tags=["Booking"])

@router.post("/", response_model=schemas.BookingOut)
def create_booking(
    booking_data: schemas.BookingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
    ):
    booking = BookingService.create_booking(db, current_user.user_id, booking_data)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_BOOKING",
        details = {
            "booking_id": booking["booking_id"],
            "session_id": booking["session_id"],
            "total_price": booking["total_price"],
            "seats_count": len(booking["seats"])
        },
        ip_address = request.client.host
    )

    return booking

@router.get("/my", response_model=List[schemas.BookingOut])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
    ):
    return BookingService.get_user_bookings(db, current_user.user_id)

@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
    ):
    booking = BookingService.get_booking_by_id(db, booking_id, current_user.user_id)

    session  = booking.session
    session.available_seats += len(booking.tickets)

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CANCEL_BOOKING",
        details = {"booking": {
            "booking_id": booking_id,
            "session_id": booking.session_id if booking else None,
            "total_price": booking.total_price if booking else None
        }},
        ip_address = request.client.host
    )

    return BookingService.cancel_booking(db, booking_id, current_user.user_id)

@router.post("/{booking_id}/pay")
def pay_booking(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    booking = db.query(models.Booking).filter(
        models.Booking.booking_id == booking_id,
        models.Booking.user_id == current_user.user_id
    ).first()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    if booking.session.start_time <= datetime.now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already started"
        )
    
    for ticket in booking.tickets:
        ticket.is_paid = True

    db.commit()

    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="PAY_BOOKING",
        details={"booking_id": booking_id, "total_price": booking.total_price},
        ip_address=request.client.host
    )
    
    return {"message": "Payment successful", "booking_id": booking_id}

@router.post("/buy", response_model= schemas.BookingOut)
def buy_ticket(
    booking_data: schemas.BookingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    booking_dict = BookingService.create_booking(db, current_user.user_id, booking_data)
    
    booking_obj = db.query(models.Booking).filter(
        models.Booking.booking_id == booking_dict["booking_id"]
    ).first()

    for ticket in booking_obj.tickets:
        ticket.is_paid = True 
    
    db.commit()
    
    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="BUY_TICKET",
        details={
            "booking_id": booking_dict["booking_id"],
            "session_id": booking_dict["session_id"],
            "total_price": booking_dict["total_price"],
            "seats_count": len(booking_dict["seats"])
        },
        ip_address=request.client.host
    )
    
    return booking_dict