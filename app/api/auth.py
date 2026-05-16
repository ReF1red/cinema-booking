from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import schemas
from app.models import models
from app.services.auth_service import AuthService
from app.services.log_service import LogService
from app.core.auth_config import auth
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from app.core.security import verify_password, get_password_hash
from app.api.deps import get_current_active_user

router =  APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserOut)
def register(
    user_data: schemas.UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    user = AuthService.register(db, user_data)

    LogService.log_action(
        db = db,
        user_id = user.user_id,
        user_email = user.email,
        action_type = "USER_REGISTRATION",
        details = {"email": user.email},
        ip_address = request.client.host
    )

    return user


@router.post("/login", response_model=schemas.TokenOut)
def login(
    form_data: schemas.UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    tokens = AuthService.login(db, form_data.email, form_data.password, response)

    user = db.query(models.User).filter(models.User.email == form_data.email).first()

    LogService.log_action(
        db = db,
        user_id = user.user_id if user else None,
        user_email = form_data.email,
        action_type = "LOGIN",
        details = {"email": form_data.email},
        ip_address = request.client.host
    )

    return tokens


@router.post("/refresh", response_model=schemas.RefreshTokenOut)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):  
    refresh_token = request.cookies.get("refresh_token")
    
    if not refresh_token:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Refresh token missing"
        )
    
    tokens = AuthService.refresh_token(db, refresh_token, response, request)
    
    return tokens


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    refresh_token = request.cookies.get("refresh_token")
    
    AuthService.logout(db, response, refresh_token, request)
    
    return {"message": "Logged out successfully"}

@router.put("/profile", response_model=schemas.UserOut)
def update_profile(
    profile_data: schemas.ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    if profile_data.email and profile_data.email != current_user.email:
        existing = db.query(models.User).filter(
            models.User.email == profile_data.email
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        current_user.email = profile_data.email

    if profile_data.full_name:
        current_user.full_name = profile_data.full_name

    db.commit()
    db.refresh(current_user)

    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="UPDATE_PROFILE",
        details={"full_name": current_user.full_name, "email": current_user.email},
        ip_address=request.client.host
    )

    return current_user

@router.put("/change-password")
def change_password(
    password_data: schemas.PasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    if not verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    if password_data.old_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the old one"
        )

    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()

    LogService.log_action(
        db=db,
        user_id=current_user.user_id,
        user_email=current_user.email,
        action_type="CHANGE_PASSWORD",
        details={},
        ip_address=request.client.host
    )

    return {"message": "Password changed successfully"}

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user = Depends(get_current_active_user)):
    return current_user