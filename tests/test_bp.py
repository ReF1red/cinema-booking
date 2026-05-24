import pytest
from fastapi.testclient import TestClient
from tests.conftest import client, TEST_EMAIL, TEST_PASSWORD, TEST_NAME, CINEMA_ADMIN_EMAIL, CINEMA_ADMIN_PASSWORD, GLOBAL_ADMIN_EMAIL, GLOBAL_ADMIN_PASSWORD, register_and_login, get_first_cinema_id, get_first_session_id, get_free_seat
from app.main import app

client = TestClient(app)

# 1. регистрация -> логин -> просмотр фильмов -> поиск -> выход
def test_bp_user_flow():
    # Регистрация
    resp = client.post("/auth/register", json={
        "email": TEST_EMAIL,
        "full_name": TEST_NAME,
        "password": TEST_PASSWORD
    })
    assert resp.status_code == 200
    
    # Логин
    resp = client.post("/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    
    # Просмотр фильмов
    resp = client.get("/movies/")
    assert resp.status_code == 200
    movies = resp.json()
    assert len(movies) > 0
    
    # Поиск фильма
    resp = client.get("/movies/search?q=интерстеллар")
    assert resp.status_code == 200
    assert len(resp.json()) > 0
    
    # Выход
    resp = client.post("/auth/logout", cookies={"refresh_token": ""})
    assert resp.status_code == 200

# 2. Логин -> просмотр сеансов -> бронирование -> мои брони -> отмена
def test_bp_booking_cancel_flow():
    token = register_and_login()
    
    # Просмотр сеансов
    cinema_id = get_first_cinema_id()
    if not cinema_id:
        pytest.skip("Нет кинотеатров")
    resp = client.get(f"/sessions/cinemas/{cinema_id}/sessions")
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) > 0
    session_id = sessions[0]["session_id"]
    
    # Бронирование
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    resp = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    booking_id = resp.json()[0]["booking_id"]
    
    # просмотр броней
    resp = client.get("/booking/my", cookies={"access_token": token})
    assert resp.status_code == 200
    my_bookings = resp.json()
    assert any(b["booking_id"] == booking_id for b in my_bookings)
    
    # Отмена брони
    resp = client.post("/booking/cancel",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    assert booking_id in resp.json()["cancelled"]

# 3. Логин -> бронирование -> оплата -> проверка что места paid
def test_bp_booking_pay_flow():
    token = register_and_login()
    
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    
    # Бронирование
    resp = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    booking_id = resp.json()[0]["booking_id"]
    
    # Оплата
    resp = client.post("/booking/pay",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    assert booking_id in resp.json()["paid"]
    
    # Проверка что места paid
    seats = client.get("/halls/halls/1/seats", params={"session_id": session_id}).json()
    seat = next(s for s in seats if s["seat_id"] == seat_id)
    assert seat["status"] == "paid"

# 4. Логин админа кинотеатра -> создание зала -> создание сеанса -> прогноз заполняемости зала
def test_bp_admin_cinema_flow():
    # Логин
    resp = client.post("/auth/login", json={
        "email": CINEMA_ADMIN_EMAIL,
        "password": CINEMA_ADMIN_PASSWORD
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    
    cinema_id = get_first_cinema_id()
    if not cinema_id:
        pytest.skip("Нет кинотеатров")
    
    # Создание зала
    resp = client.post("/halls/admin/halls",
        json={
            "cinema_id": cinema_id,
            "hall_name": "Test Hall BP",
            "rows_count": 5,
            "seats_per_row": 10
        },
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    hall_id = resp.json()["hall_id"]
    
    # Создание сеанса
    movies = client.get("/movies/").json()
    if not movies:
        pytest.skip("Нет фильмов")
    movie_id = movies[0]["movie_id"]
    
    resp = client.post("/sessions/admin/sessions",
        json={
            "hall_id": hall_id,
            "movie_id": movie_id,
            "start_time": "2030-01-01T12:00:00",
            "price": 300
        },
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    session_id = resp.json()["session_id"]
    
    # прогноз заполняемости
    resp = client.post("/ai/predict-occupancy",
        json={"session_id": session_id},
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    assert "predicted_occupancy_rate" in resp.json()

# 5. Логин админа -> обучение модели -> результат обучения
def test_bp_admin_ai_flow():
    # Логин
    resp = client.post("/auth/login", json={
        "email": GLOBAL_ADMIN_EMAIL,
        "password": GLOBAL_ADMIN_PASSWORD
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    
    # Обучение модели
    resp = client.post("/ai/admin/retrain",
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Retraining started in background"
    
    import time
    time.sleep(2)
    
    # Результат обучения
    resp = client.get("/ai/history",
        cookies={"access_token": token}
    )
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) > 0
    assert "mae" in history[0]
    assert "r2" in history[0]