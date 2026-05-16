from authx import AuthXConfig, AuthX
from dotenv import load_dotenv
from datetime import timedelta
import os

load_dotenv()

config = AuthXConfig()
config.JWT_SECRET_KEY = os.getenv("SECRET_KEY", "cinema-booking")
config.JWT_ACCESS_COOKIE_NAME = "access_token"
config.JWT_REFRESH_COOKIE_NAME = "refresh_token"
config.JWT_TOKEN_LOCATION = ["cookies", "headers"]
config.JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)))
config.JWT_REFRESH_TOKEN_EXPIRES = timedelta(days = 30)
config.JWT_COOKIE_CSRF_PROTECT = False
config.JWT_COOKIE_SAMESITE = "lax"
config.JWT_COOKIE_SECURE = False
#config.JWT_COOKIE_DOMAIN = "127.0.0.1"
config.JWT_ACCESS_COOKIE_PATH = "/"
config.JWT_REFRESH_COOKIE_PATH = "/"

auth = AuthX(config=config)