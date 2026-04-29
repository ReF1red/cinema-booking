from fastapi import FastAPI
from app.api import auth, cities, movies, halls, sessions, bookings, cinemas, ai

app = FastAPI(title="Cinema Booking API")

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