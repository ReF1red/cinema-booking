from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    cinema_id: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class RefreshTokenCreate(BaseModel):
    refresh_token: str

class CityBase(BaseModel):
    city_name: str

class CityCreate(CityBase):
    pass

class CityOut(CityBase):
    city_id: int
    city_name: str
    class Config:
        from_attributes = True

class CinemaBase(BaseModel):
    city_id: int
    cinema_name: str
    cinema_address: Optional[str] = None

class CinemaCreate(CinemaBase):
    pass

class CinemaOut(BaseModel):
    city_id: int
    city_name: str
    cinema_id: int
    cinema_name: str
    cinema_address: Optional[str] = None
    class Config:
        from_attributes = True

class MovieBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration_min: int
    genre: Optional[str] = None
    poster_url: Optional[str] = None
    release_year: Optional[int] = None
    rating: Optional[float] = None
    director: Optional[str] = None
    writer: Optional[str] = None
    country: Optional[str] = None
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = None
    main_actors: Optional[List[str]] = None

class MovieCreate(MovieBase):
    pass

class MovieOut(MovieBase):
    movie_id: int
    class Config:
        from_attributes = True

class HallBase(BaseModel):
    cinema_id: int
    hall_name: str
    rows_count: int
    seats_per_row: int

class HallCreate(HallBase):
    pass

class HallOut(HallBase):
    hall_id: int
    cinema_id: int
    hall_name: str
    rows_count: int
    seats_per_row: int
    total_seats: int=0
    class Config:
        from_attributes = True

class SeatBase(BaseModel):
    row_letter: str
    seat_number: int

class SeatOut(SeatBase):
    seat_id: int
    status: str
    class Config:
        from_attributes = True

class SessionBase(BaseModel):
    hall_id: int
    movie_id: int
    start_time: datetime
    price: float

class SessionCreate(SessionBase):
    pass 

class SessionOut(SessionBase):
    session_id: int
    available_seats: int
    hall_name: Optional[str] = None
    movie_title: Optional[str] = None
    total_seats: Optional[int] = None
    class Config:
        from_attributes = True

class SeatInfo(BaseModel):
    seat_id: int
    row_letter: str
    seat_number: int
    
class BookingCreate(BaseModel):
    session_id: int
    seats: List[int]

class BookingOut(BaseModel):
    session_id: int
    booking_id: int
    booking_time: datetime
    status: str
    total_price: float
    seats: List[SeatInfo]
    class Config:
        from_attributes = True