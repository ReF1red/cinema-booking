from fastapi import FastAPI
from app.api import auth, cities, movies, halls, sessions, bookings, cinemas, ai
from authx.exceptions import MissingTokenError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="Cinema Booking API")

os.makedirs("static/posters", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth.router)
app.include_router(cities.router)
app.include_router(cinemas.router)
app.include_router(movies.router)
app.include_router(halls.router)
app.include_router(sessions.router)
app.include_router(bookings.router)
app.include_router(ai.router)

@app.get("/")
def root():
    return {"message": "Cinema Booking API is running"}

@app.exception_handler(MissingTokenError)
async def missing_token_handler(request, exc):
    return JSONResponse(
        status_code=401,
        content={"detail": "Not authenticated"}
    )