from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import schemas
from app.services.auth_service import AuthService
from fastapi import APIRouter, Depends, HTTPException, status

router =  APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserOut)
def register(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    user = AuthService.register(db, user_data)

    return user


@router.post("/login", response_model=schemas.Token)
def login(
    form_data: schemas.UserLogin,
    db: Session = Depends(get_db)
):
    result = AuthService.login(db, form_data.email, form_data.password)

    return result
