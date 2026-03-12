from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional

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
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"    

class CityBase(BaseModel):
    name: str

class CityCreate(CityBase):
    pass

class CityOut(CityBase):
    city_id: int
    name: str
    class Config:
        from_attributes = True

class CinemaBase(BaseModel):
    city_id: int
    name: str
    address: Optional[str] = None

class CinemaCreate(CinemaBase):
    pass

class CinemaOut(CinemaBase):
    cinema_id: int
    city_id: int
    name: str
    address: Optional[str] = None
    class Config:
        from_attributes = True