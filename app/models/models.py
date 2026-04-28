from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import datetime
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CINEMA_ADMIN = "cinema_admin"
    CLIENT = "client"

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CLIENT)
    cinema_id = Column(Integer, ForeignKey("cinemas.cinema_id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    bookings = relationship("Booking", back_populates="user")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    action_logs = relationship("ActionLog", back_populates="user")
    cinema = relationship("Cinema", foreign_keys=[cinema_id])

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    refresh_token_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")

class ActionLog(Base):
    __tablename__ = "action_logs"

    action_log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    user_email = Column(String, nullable=True)
    action_type = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="action_logs")

class City(Base):
    __tablename__ = "cities"

    city_id = Column(Integer, primary_key=True, index=True)
    city_name = Column(String, unique=True, nullable=False)

    cinemas = relationship("Cinema", back_populates="city")

class Cinema(Base):
    __tablename__ = "cinemas"

    cinema_id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.city_id"), nullable=False)
    cinema_name = Column(String, nullable=False)
    cinema_address = Column(String)

    city = relationship("City", back_populates="cinemas")
    halls = relationship("Hall", back_populates="cinema")

class Hall(Base):
    __tablename__ = "halls"

    hall_id = Column(Integer, primary_key=True, index=True)
    cinema_id = Column(Integer, ForeignKey("cinemas.cinema_id"), nullable=False)
    hall_name = Column(String, nullable=False)
    rows_count = Column(Integer, nullable=False)
    seats_per_row = Column(Integer, nullable=False)
        
    cinema = relationship("Cinema", back_populates="halls")
    sessions = relationship("Session", back_populates="hall")
    seats = relationship("Seat", back_populates="hall", cascade="all, delete-orphan")

class Seat(Base):
    __tablename__ = "seats"
    
    seat_id = Column(Integer, primary_key=True, index=True)
    hall_id = Column(Integer, ForeignKey("halls.hall_id"), nullable=False)
    row_letter = Column(String(1), nullable=False)
    seat_number = Column(Integer, nullable=False)

    hall = relationship("Hall", back_populates="seats")
    tickets = relationship("Ticket", back_populates="seat")

class Movie(Base):
    __tablename__ = "movies"

    movie_id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    duration_min = Column(Integer, nullable=False)
    genre = Column(String)
    poster_url = Column(String)
    release_year = Column(Integer)
    rating = Column(Float, nullable=True)
    director = Column(String, nullable=True)
    writer = Column(String, nullable=True)
    country = Column(String, nullable=True)
    budget_amount = Column(Float, nullable=True)
    budget_currency = Column(String, nullable=True)
    main_actors = Column(Text, nullable=True)

    sessions = relationship("Session", back_populates="movie")

class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, index=True)
    hall_id = Column(Integer, ForeignKey("halls.hall_id"), nullable=False)
    movie_id = Column(Integer, ForeignKey("movies.movie_id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    price = Column(Float, nullable=False)
    available_seats = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    hall = relationship("Hall", back_populates="sessions")
    movie = relationship("Movie", back_populates="sessions")
    bookings = relationship("Booking", back_populates="session")

class Booking(Base):
    __tablename__ = "bookings"

    booking_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), nullable=False)
    booking_time = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="confirmed")
    total_price = Column(Float)

    user = relationship("User", back_populates="bookings")
    session = relationship("Session", back_populates="bookings")
    tickets = relationship("Ticket", back_populates="booking", cascade="all, delete-orphan")
    fraud_log = relationship("FraudLog", back_populates="booking", uselist=False)

class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.booking_id"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.seat_id"), nullable=False)
    is_paid = Column(Boolean, default=False)
 
    booking = relationship("Booking", back_populates="tickets")
    seat = relationship("Seat", back_populates="tickets")

class FraudLog(Base):
    __tablename__ = "fraud_log"

    fraud_log_id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.booking_id"), unique=True)
    risk_score = Column(Float)
    reason = Column(String)
    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("Booking", back_populates="fraud_log")