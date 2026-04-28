from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from authx import TokenPayload
from typing import Optional
from app.core.auth_config import auth
from app.database import get_db
from app.models import models, UserRole

def get_user_id_from_token(
    token_payload: Optional[TokenPayload] = Depends(auth.access_token_required)
) -> Optional[int]:
    if token_payload is None:
        return None
    return int(token_payload.sub)

def get_current_user(
    user_id: Optional[int] = Depends(get_user_id_from_token),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    if user_id is None:
        return None
    
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is blocked"
        )
    
    return user

def get_current_active_user(
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

def get_current_admin(
    current_user: models.User = Depends(get_current_active_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def get_current_cinema_admin(
    current_user: models.User = Depends(get_current_active_user)
):
    if current_user.role == UserRole.ADMIN:
        return current_user
    
    if current_user.role == UserRole.CINEMA_ADMIN and current_user.cinema_id:
        return current_user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Cinema admin rights required"
    )

def get_cinema_admin_for_cinema(cinema_id: int):
    async def dependency(
        current_user: models.User = Depends(get_current_active_user)
    ):
        if current_user.role == UserRole.ADMIN:
            return current_user
        
        if (current_user.role == UserRole.CINEMA_ADMIN and 
            current_user.cinema_id == cinema_id):
            return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this cinema"
        )
    return dependency

async def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    try:
        token = await auth.get_token_from_request(request)
        payload = auth.verify_token(token)
        user_id = int(payload.sub)
        user = db.query(models.User).filter(models.User.user_id == user_id).first()
        if user and user.is_active:
            return user
        return None
    
    except Exception:
        return None