import pytest
from playwright.sync_api import sync_playwright, Page, expect
from tests.conftest import TEST_UI_EMAIL, TEST_UI_PASSWORD, TEST_UI_NAME

FRONT_URL = "http://127.0.0.1:5173"
API_URL = "http://127.0.0.1:8000"

def cleanup_test_user():
    from app.database import SessionLocal
    from app.models import models

    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == TEST_UI_EMAIL).first()
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
def setup_cleanup():
    cleanup_test_user()
    yield
    cleanup_test_user()

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    yield page
    context.close()

def login(page: Page, email: str, password: str):
    page.goto(FRONT_URL)
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)

def register(page: Page, name: str, email: str, password: str):
    page.goto(FRONT_URL)
    page.click("text=Зарегистрироваться")
    page.fill('input[id="full-name"]', name)
    page.fill('input[type="email"]', email)
    page.fill('input[type="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)

# 1. Страница входа
def test_login_page_loads(page):
    page.goto(FRONT_URL)
    expect(page.locator("h3")).to_contain_text("С возвращением")

# 2. Регистрация
def test_register(page):
    register(page, TEST_UI_NAME, TEST_UI_EMAIL, TEST_UI_PASSWORD)
    expect(page.locator("h1")).to_contain_text("Выберите локацию")

# 3. Логин
def test_login_success(page):
    login(page, TEST_UI_EMAIL, TEST_UI_PASSWORD)
    expect(page.locator("h1")).to_contain_text("Выберите локацию")

# 4. Неверный пароль
def test_login_wrong_password(page):
    page.goto(FRONT_URL)
    page.fill('input[type="email"]', TEST_UI_EMAIL)
    page.fill('input[type="password"]', "wrongpassword")
    page.click('button[type="submit"]')
    expect(page.locator("text=Invalid credentials")).to_be_visible()

# 5. Режим гостя
def test_guest_login(page):
    page.goto(FRONT_URL)
    page.click("text=Войти как гость")
    page.wait_for_url(f"{FRONT_URL}/cities")
    expect(page.locator("h1")).to_contain_text("Выберите локацию")

# 6. Поиск фильмов
def test_search_movies(page):
    login(page, TEST_UI_EMAIL, TEST_UI_PASSWORD)
    page.goto(f"{FRONT_URL}/home")
    page.wait_for_timeout(1000)
    search_input = page.locator("input.pl-10")
    if search_input.count() > 0:
        search_input.fill("интерстеллар")
        page.wait_for_timeout(1000)
    expect(page.locator("text=Интерстеллар").first).to_be_visible()

# 7. Карточка фильма
def test_movie_details(page):
    login(page, TEST_UI_EMAIL, TEST_UI_PASSWORD)
    page.goto(f"{FRONT_URL}/home")
    page.wait_for_timeout(2000)
    button = page.locator("text=Купить билет").first
    if button.count() > 0:
        button.click()
        page.wait_for_timeout(1000)
    expect(page.locator("h1")).to_be_visible()

# 8. Просмотр броней
def test_my_bookings_page(page):
    login(page, TEST_UI_EMAIL, TEST_UI_PASSWORD)
    page.goto(f"{FRONT_URL}/bookings")
    page.wait_for_timeout(1000)
    expect(page.locator("h1")).to_contain_text("Мои билеты")

# 9. Профиль
def test_profile_page(page):
    page.goto(f"{FRONT_URL}/profile")
    page.wait_for_timeout(1000)
    expect(page.locator("h1")).to_contain_text("Профиль")

# 10. Выход
def test_logout(page):
    login(page, TEST_UI_EMAIL, TEST_UI_PASSWORD)
    page.click("text=Выйти")
    page.wait_for_timeout(1000)
    expect(page.locator("h3")).to_contain_text("С возвращением")