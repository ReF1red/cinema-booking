from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    if len(password) > 72:
        password = password[:72]
    return pwd_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    if len(password) > 72:
        password = password[:72]
    return pwd_context.verify(password, hashed_password)

def create_access_token(data: dict) -> str:
    copy = data.copy()
    to_encode = datetime.utcnow() + timedelta(minutes=30)
    copy["exp"] = to_encode
    token =  jwt.encode(
        claims=copy,
        key="qwerty",
        algorithm="HS256"
        )
    return token