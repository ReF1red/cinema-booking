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

@router.post("/", response_model=List[schemas.BookingOut])
def create_booking(
    booking_data: schemas.MultiBookingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
    ):
    if not booking_data.seat_ids:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "seat_ids must not be empty"
        )

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    active_bookings = db.query(models.Booking).filter(
        models.Booking.user_id == user_id,
        models.Booking.status == "confirmed"
    ).count()

    if active_bookings >= 4:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "You already have 4 active bookings. Pay or cancel existing bookings first."
        )

    result = []

    for seat_id in booking_data.seat_ids:
        single = schemas.BookingCreate(
            session_id = booking_data.session_id,
            seat_id = seat_id
        )
        booking = BookingService.create_booking(db, current_user.user_id, single)
        result.append(booking)

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CREATE_BOOKING",
        details = {
            "session_id": booking_data.session_id,
            "count": len(result)
        },
        ip_address = request.client.host
    )

    return result

@router.get("/my", response_model=List[schemas.BookingOut])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
    ):
    BookingService.cancel_expired_bookings(db, current_user.user_id)
    return BookingService.get_user_bookings(db, current_user.user_id)

@router.post("/cancel")
def cancel_bookings(
    data: schemas.MultiActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
    ):
    if not data.booking_ids:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "booking_ids must not be empty"
        )

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    cancelled = []
    failed = []
    for booking_id in data.booking_ids:
        try:
            BookingService.cancel_booking(db, booking_id, current_user.user_id)
            cancelled.append(booking_id)
        except HTTPException:
            failed.append(booking_id)

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "CANCEL_BOOKING",
        details = {"cancelled": cancelled, "failed": failed},
        ip_address = request.client.host
    )

    return {"cancelled": cancelled, "failed": failed}

@router.post("/pay")
def pay_bookings(
    data: schemas.MultiActionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    if not data.booking_ids:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "booking_ids must not be empty"
        )

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    paid = []
    failed = []

    for booking_id in data.booking_ids:
        booking = db.query(models.Booking).filter(
            models.Booking.booking_id == booking_id,
            models.Booking.user_id == current_user.user_id
        ).with_for_update().first()
        
        if not booking or booking.status == "paid" or booking.session.start_time <= datetime.now():
            failed.append(booking_id)
            continue
        
        for ticket in booking.tickets:
            ticket.is_paid = True
        booking.status = "paid"
        paid.append(booking_id)
    
    db.commit()

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "PAY_BOOKING",
        details = {"paid": paid, "failed": failed},
        ip_address = request.client.host
    )
    
    return {"paid": paid, "failed": failed}

@router.post("/buy", response_model=List[schemas.BookingOut])
def buy_tickets(
    booking_data: schemas.MultiBookingCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    if not booking_data.seat_ids:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "seat_ids must not be empty"
        )

    user_id = current_user.user_id if current_user else None
    user_email = current_user.email if current_user else None

    result = []
    for seat_id in booking_data.seat_ids:
        single = schemas.BookingCreate(
            session_id = booking_data.session_id,
            seat_id = seat_id
        )
        booking_dict = BookingService.create_booking(db, current_user.user_id, single)
        
        booking_obj = db.query(models.Booking).filter(
            models.Booking.booking_id == booking_dict["booking_id"]
        ).with_for_update().first()
        
        if booking_obj and booking_obj.session.start_time > datetime.now():
            for ticket in booking_obj.tickets:
                ticket.is_paid = True
            booking_obj.status = "paid"
            result.append(booking_dict)
    
    db.commit()

    LogService.log_action(
        db = db,
        user_id = user_id,
        user_email = user_email,
        action_type = "BUY_TICKET",
        details = {
            "session_id": booking_data.session_id,
            "count": len(result)
        },
        ip_address = request.client.host
    )
    
    return result