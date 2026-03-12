import json
import os
from app.database import SessionLocal
from app.models import models

# Пресет данных загружается из data\cities.json и data\cinemas.json

def load_json(filename):
    filepath = os.path.join('data', filename)
    with open(filepath, 'r', encoding='utf-8') as file:
        return json.load(file)

def init_cities_and_cinemas():
    db = SessionLocal()
    
    try:
        cities_exist = db.query(models.City).count() > 0
        cinemas_exist = db.query(models.Cinema).count() > 0
        
        if cities_exist or cinemas_exist:
            print("\nВ базе уже есть данные о городах и/или кинотеатрах.")
            response = input("Хотите очистить старые данные и загрузить новые? (да/нет): ").strip().lower()
            
            if response in ['да', 'yes', 'y', 'д']:
                db.query(models.Cinema).delete()
                db.query(models.City).delete()

                db.commit()
                print("Старые данные удалены.")
            else:
                print("Операция отменена. Существующие данные сохранены.")
                db.close()
                return
        
        cities_data = load_json('cities.json')
        
        for city_data in cities_data:
            city = models.City(**city_data)
            db.add(city)
    
        db.commit()
        print(f"Добавлено {len(cities_data)} городов")

        cinemas_data = load_json('cinemas.json')

        cities = {city.city_name: city for city in db.query(models.City).all()}

        for cinema_data in cinemas_data:
            city_name = cinema_data.pop('city_name')
            city = cities.get(city_name)

            if city:
                cinema = models.Cinema(
                    city_id=city.city_id,
                    cinema_name=cinema_data['cinema_name'],
                    cinema_address=cinema_data.get('cinema_address')
                )
                db.add(cinema)
            else:
                print(f"Предупреждение: город {city_name} не найден")
    
        db.commit()
        print(f"Добавлено {len(cinemas_data)} кинотеатров")

    except FileNotFoundError as error:
        print(f"Ошибка: файл не найден - {error}")

    except json.JSONDecodeError as error:
        print(f"Ошибка: неверный формат JSON - {error}")

    except Exception as error:
        print(f"Ошибка: {error}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    
    print("\nНачало инициализации данных")
    init_cities_and_cinemas()
    print("Инициализация завершена")