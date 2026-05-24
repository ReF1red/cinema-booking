import pytest
from fastapi.testclient import TestClient
from tests.conftest import client, TEST_EMAIL, TEST_PASSWORD, TEST_NAME, register_and_login, get_first_city_id, get_first_cinema_id, get_first_session_id, get_free_seat
from app.main import app

client = TestClient(app)

# 1. Регистрация
def test_register():
    response = client.post("/auth/register", json={
        "email": TEST_EMAIL,
        "full_name": TEST_NAME,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200
    assert response.json()["email"] == TEST_EMAIL

# 2. Регистрация с занятым email
def test_register_duplicate():
    register_and_login()
    response = client.post("/auth/register", json={
        "email": TEST_EMAIL,
        "full_name": TEST_NAME,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 400

# 3. Логин
def test_login():
    register_and_login()
    response = client.post("/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

# 4. Логин с неверным паролем
def test_login_wrong_password():
    register_and_login()
    response = client.post("/auth/login", json={
        "email": TEST_EMAIL,
        "password": "WRONG"
    })
    assert response.status_code == 401

# 5. Список городов
def test_get_cities():
    response = client.get("/cities/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# 6. Список кинотеатров города
def test_get_cinemas():
    city_id = get_first_city_id()
    if not city_id:
        pytest.skip("Нет городов")
    response = client.get(f"/cinemas/by-city/{city_id}")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# 7. Список фильмов
def test_get_movies():
    response = client.get("/movies/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# 8. Поиск
def test_search_movies():
    response = client.get("/movies/search?q=интерстеллар")
    assert response.status_code == 200
    assert len(response.json()) > 0

# 9. Просмотр сеансов кинотеатра
def test_get_sessions():
    cinema_id = get_first_cinema_id()
    if not cinema_id:
        pytest.skip("Нет кинотеатров")
    response = client.get(f"/sessions/cinemas/{cinema_id}/sessions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# 10. Бронирование
def test_make_booking():
    token = register_and_login()
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    
    response = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "confirmed"

# 11. Отмена бронь
def test_cancel_booking():
    token = register_and_login()
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    
    booking = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    ).json()
    
    booking_id = booking[0]["booking_id"]
    
    response = client.post("/booking/cancel",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    assert booking_id in response.json()["cancelled"]

# 12. Больше 4 броней
def test_booking_limit():
    token = register_and_login()
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    
    response = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [1, 2, 3, 4, 5]},
        cookies={"access_token": token}
    )
    assert response.status_code == 400

# 13. Нет прав админимстратора
def test_admin_access_denied():
    token = register_and_login()
    response = client.post("/cities/admin/cities",
        json={"city_name": "TestCity"},
        cookies={"access_token": token}
    )
    assert response.status_code == 403

# 14. Несуществующий ресурс
def test_not_found():
    response = client.get("/movies/99999")
    assert response.status_code == 404

# 15. Смена имени пользователя
def test_change_name():
    token = register_and_login()
    response = client.put("/auth/profile",
        json={"full_name": "Тест"},
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Тест"

# 16. Оплата брони
def test_pay_booking():
    token = register_and_login()
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    
    booking = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    ).json()
    
    booking_id = booking[0]["booking_id"]
    
    response = client.post("/booking/pay",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    assert booking_id in response.json()["paid"]

# 17. Попытка отмены оплаченной брони
def test_cancel_paid_booking():
    token = register_and_login()
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    
    booking = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    ).json()
    
    booking_id = booking[0]["booking_id"]
    
    client.post("/booking/pay",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    
    response = client.post("/booking/cancel",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    assert booking_id in response.json()["failed"]

# 18. Попытка оплаты уже оплаченной брони
def test_pay_already_paid():
    token = register_and_login()
    session_id = get_first_session_id()
    if not session_id:
        pytest.skip("Нет сеансов")
    seat_id = get_free_seat(session_id)
    if not seat_id:
        pytest.skip("Нет свободных мест")
    
    booking = client.post("/booking/",
        json={"session_id": session_id, "seat_ids": [seat_id]},
        cookies={"access_token": token}
    ).json()
    
    booking_id = booking[0]["booking_id"]
    
    client.post("/booking/pay",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    
    response = client.post("/booking/pay",
        json={"booking_ids": [booking_id]},
        cookies={"access_token": token}
    )
    assert response.status_code == 200
    assert booking_id in response.json()["failed"]