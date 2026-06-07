import io
import qrcode
import json
import os
import tempfile
from fastapi import APIRouter, Depends, Request, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.database import get_db
from app.services.booking_service import BookingService
from app.services.log_service import LogService
from app.api.deps import get_current_active_user
from app.models import models
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

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
        booking.paid_at = datetime.now()
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
            booking_obj.paid_at = datetime.now()
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

@router.get("/ticket")
def get_ticket_pdf(
    booking_ids: str = Query(..., description="ID броней через запятую, например: 1,2,3"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    ids = [int(x.strip()) for x in booking_ids.split(",") if x.strip()]
    
    if not ids:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail = "No booking ids provided"
        )
    
    bookings = db.query(models.Booking).filter(
        models.Booking.booking_id.in_(ids),
        models.Booking.user_id == current_user.user_id,
        models.Booking.status == "paid"
    ).all()
    
    if not bookings:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail = "No paid bookings found"
        )
    
    tickets_data = []
    total_price = 0
    seat_labels = []
    
    for booking in bookings:
        ticket = db.query(models.Ticket).filter(
            models.Ticket.booking_id == booking.booking_id
        ).first()
        if ticket:
            seat = ticket.seat
            seat_labels.append(f"{seat.row_letter}{seat.seat_number}")
            tickets_data.append(ticket)
            total_price += booking.total_price
    
    if not tickets_data:
        raise HTTPException(status_code=404, detail="No tickets found")
    
    first_booking = bookings[0]
    session = first_booking.session
    hall = session.hall
    cinema = hall.cinema
    city = cinema.city
    movie = session.movie
    
    seat_str = ", ".join(seat_labels)
    
    qr_data = json.dumps({
        "ticket_ids": [b.booking_id for b in bookings],
        "movie": movie.title,
        "date": session.start_time.isoformat(),
        "city": city.city_name,
        "cinema": cinema.cinema_name,
        "hall": hall.hall_name,
        "seats": seat_labels,
        "price": int(total_price)
    }, ensure_ascii=False)
    

    current_dir = os.path.dirname(os.path.abspath(__file__))
    fonts_dir = os.path.join(current_dir, "..", "..", "fonts")

    
    font_path = os.path.join(fonts_dir, "DejaVuSans.ttf")
    font_bold_path = os.path.join(fonts_dir, "DejaVuSans-Bold.ttf")
    
    pdfmetrics.registerFont(TTFont('DejaVuSans', font_path))
    pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', font_bold_path))
    
    FONT = 'DejaVuSans'
    FONT_BOLD = 'DejaVuSans-Bold'
    
    buffer = io.BytesIO()
    width, height = 80 * mm, 240 * mm
    c = canvas.Canvas(buffer, pagesize=(width, height))

    c.setFillColorRGB(0.04, 0.04, 0.05)
    c.rect(0, 0, width, height, fill=1)

    y = height - 10 * mm

    logo_path = "frontend/public/favicon.png"
    if os.path.exists(logo_path):
        c.drawImage(logo_path, width/2 - 8*mm, y - 12*mm, width=16*mm, height=16*mm, mask='auto')
        y -= 22 * mm
    else:
        y -= 5 * mm

    c.setFillColorRGB(0.89, 0.04, 0.08)
    c.setFont(FONT_BOLD, 14)
    c.drawCentredString(width / 2, y, "CINEMAX")
    y -= 14 * mm

    c.setStrokeColorRGB(0.2, 0.2, 0.22)
    c.setLineWidth(0.5)
    c.line(5*mm, y, width-5*mm, y)
    y -= 8 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "ФИЛЬМ")
    y -= 5 * mm
    c.setFillColorRGB(0.96, 0.96, 0.97)
    c.setFont(FONT_BOLD, 9)
    c.drawString(8*mm, y, movie.title[:35])
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "ДАТА И ВРЕМЯ")
    y -= 5 * mm
    c.setFillColorRGB(0.96, 0.96, 0.97)
    c.setFont(FONT_BOLD, 9)
    
    months_ru = {
        1: "января", 2: "февраля", 3: "марта", 4: "апреля",
        5: "мая", 6: "июня", 7: "июля", 8: "августа",
        9: "сентября", 10: "октября", 11: "ноября", 12: "декабря"
    }

    date_str = session.start_time.strftime(f"%d {months_ru[session.start_time.month]} %Y, %H:%M")
    c.drawString(8*mm, y, date_str)
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "ГОРОД")
    y -= 5 * mm
    c.setFillColorRGB(0.96, 0.96, 0.97)
    c.setFont(FONT_BOLD, 9)
    c.drawString(8*mm, y, city.city_name)
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "КИНОТЕАТР")
    y -= 5 * mm
    c.setFillColorRGB(0.96, 0.96, 0.97)
    c.setFont(FONT_BOLD, 9)
    c.drawString(8*mm, y, cinema.cinema_name[:35])
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "ЗАЛ")
    y -= 5 * mm
    c.setFillColorRGB(0.96, 0.96, 0.97)
    c.setFont(FONT_BOLD, 9)
    c.drawString(8*mm, y, f"{hall.hall_name}")
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "МЕСТО")
    y -= 5 * mm
    c.setFillColorRGB(0.96, 0.96, 0.97)
    c.setFont(FONT_BOLD, 9)
    c.drawString(8*mm, y, f"{seat_str}")
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 7)
    c.drawString(8*mm, y, "ЦЕНА")
    y -= 5 * mm
    c.setFillColorRGB(0.89, 0.04, 0.08)
    c.setFont(FONT_BOLD, 11)
    c.drawString(8*mm, y, f"{int(total_price)}")
    y -= 12 * mm

    c.setStrokeColorRGB(0.2, 0.2, 0.22)
    c.line(5*mm, y, width-5*mm, y)
    y -= 15 * mm

    qr_img = qrcode.make(qr_data)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as _f:
        _f.write(qr_buffer.getvalue())
        tmp_path = _f.name

    qr_size = 35 * mm
    c.drawImage(tmp_path, width/2 - qr_size/2, y - qr_size - 5*mm, width=qr_size, height=qr_size)
    os.unlink(tmp_path)
    y -= qr_size + 15 * mm

    c.setStrokeColorRGB(0.2, 0.2, 0.22)
    c.line(5*mm, y, width-5*mm, y)
    y -= 10 * mm

    c.setFillColorRGB(0.6, 0.6, 0.65)
    c.setFont(FONT, 8)
    c.drawCentredString(width/2, y, "Спасибо за покупку!")

    c.save()
    buffer.seek(0)

    filename = f"tickets_{booking_ids.replace(',', '_')}.pdf"

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )