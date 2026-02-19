from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from app.core.security import get_password_hash, verify_password, create_access_token

class AuthService:
    @staticmethod
    def register(db, user_data):
        existing = db.query(models.User).filter(models.User.email == user_data.email).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
                )
        hash = get_password_hash(user_data.password)

        new_user = models.User(
            email = user_data.email,
            password_hash = hash,
            full_name = user_data.full_name,
            role = "client",
            is_active = True 
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user
    
    @staticmethod
    def login(db, email, password):
        user = db.query(models.User).filter(models.User.email == email).first()

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="User is blocked",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        token_data = {"sub": user.email}
        token = create_access_token(token_data)

        return {"access_token": token, "token_type": "bearer"}
    