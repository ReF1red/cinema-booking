import pytest
import os
from app.main import app
from app.database import SessionLocal
from app.models import models
from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv("tests/.env.test")

TEST_EMAIL = os.getenv("TEST_EMAIL")
TEST_PASSWORD = os.getenv("TEST_PASSWORD")
TEST_NAME = os.getenv("TEST_NAME")

CINEMA_ADMIN_EMAIL = os.getenv("CINEMA_ADMIN_EMAIL")
CINEMA_ADMIN_PASSWORD = os.getenv("CINEMA_ADMIN_PASSWORD")

GLOBAL_ADMIN_EMAIL = os.getenv("GLOBAL_ADMIN_EMAIL")
GLOBAL_ADMIN_PASSWORD = os.getenv("GLOBAL_ADMIN_PASSWORD")

client = TestClient(app)

def _cleanup_user():
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == TEST_EMAIL).first()
        if user:
            for token in user.refresh_tokens:
                db.delete(token)
            for booking in user.bookings:
                for ticket in booking.tickets:
                    db.delete(ticket)
                db.delete(booking)
            for log in user.action_logs:
                db.delete(log)
            db.delete(user)
            db.commit()
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup():
    _cleanup_user()
    yield
    _cleanup_user()

def register_and_login(email=TEST_EMAIL, password=TEST_PASSWORD, name=TEST_NAME):
    client.post("/auth/register", json={
        "email": email,
        "full_name": name,
        "password": password
    })
    return client.post("/auth/login", json={
        "email": email,
        "password": password
    }).json()["access_token"]


def get_first_city_id():
    cities = client.get("/cities/").json()
    return cities[0]["city_id"] if cities else None


def get_first_cinema_id():
    city_id = get_first_city_id()
    if not city_id:
        return None
    cinemas = client.get(f"/cinemas/by-city/{city_id}").json()
    return cinemas[0]["cinema_id"] if cinemas else None


def get_first_session_id():
    cinema_id = get_first_cinema_id()
    if not cinema_id:
        return None
    sessions = client.get(f"/sessions/cinemas/{cinema_id}/sessions").json()
    return sessions[0]["session_id"] if sessions else None


def get_free_seat(session_id: int) -> int:
    seats = client.get("/halls/halls/1/seats", params={"session_id": session_id}).json()
    free = [s for s in seats if s["status"] == "free"]
    return free[0]["seat_id"] if free else None