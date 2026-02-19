from fastapi import FastAPI
from app.api import auth



app = FastAPI(title="Cinema Booking API")

app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "Cinema Booking API is running"}