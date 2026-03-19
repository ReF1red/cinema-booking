from fastapi import FastAPI
from app.api import auth, cities, movies

app = FastAPI(title="Cinema Booking API")

app.include_router(auth.router)
app.include_router(cities.router)
app.include_router(movies.router)

@app.get("/")
def root():
    return {"message": "Cinema Booking API is running"}