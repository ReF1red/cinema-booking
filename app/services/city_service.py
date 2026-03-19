from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from fastapi import HTTPException, status

class CityService:
    @staticmethod
    def get_all_cities(db: Session):
        return db.query(models.City).all()

    @staticmethod
    def get_city_by_id(db: Session, city_id: int):
        city = db.query(models.City).filter(models.City.city_id == city_id).first()
        if city is None:
            raise HTTPException(
                status_code=404,
                detail="City not found"
            )
        return city

    @staticmethod
    def create_city(db: Session, city_data: schemas.CityCreate):
        exist_city = db.query(models.City).filter(models.City.city_name == city_data.name).first()
        if exist_city:
            raise HTTPException(
                status_code=400,
                detail="City already exists"
            )
        
        new_city = models.City(city_name=city_data.name)
        db.add(new_city)
        db.commit()
        db.refresh(new_city)
        return new_city

    @staticmethod
    def delete_city(db: Session, city_id: int):
        city = CityService.get_city_by_id(db, city_id)
        cinemas = db.query(models.Cinema).filter(models.Cinema.city_id == city_id).all()
        if cinemas:
            raise HTTPException(
                status_code=400,
                detail="You can't delete a city with cinemas."
            )
        
        db.delete(city)
        db.commit()
        return {"message": "City is deleted"}



    @staticmethod
    def get_cinemas_by_city(db: Session, city_id: int):
        CityService.get_city_by_id(db, city_id)

        cinemas = db.query(models.Cinema).filter(models.Cinema.city_id == city_id).all()
        result = []
        for cinema in cinemas:
            result.append({
                "city_id": cinema.city_id,
                "city_name": cinema.city.city_name,
                "cinema_id": cinema.cinema_id,
                "cinema_name": cinema.cinema_name,
                "cinema_address": cinema.cinema_address
            })
        return result

    @staticmethod
    def get_cinema_by_id(db: Session, cinema_id: int):
        cinema = db.query(models.Cinema).filter(models.Cinema.cinema_id == cinema_id).first()
        if cinema is None:
            raise HTTPException(status_code=404, detail="Cinema not found")
        
        return {
            "city_id": cinema.city_id,
            "city_name": cinema.city.city_name,
            "cinema_id": cinema.cinema_id,
            "cinema_name": cinema.cinema_name,
            "cinema_address": cinema.cinema_address
        }

    @staticmethod
    def create_cinema(db: Session, cinema_data: schemas.CinemaCreate):
        CityService.get_city_by_id(db, cinema_data.city_id)
        
        new_cinema = models.Cinema(
            city_id=cinema_data.city_id,
            cinema_name=cinema_data.cinema_name,
            cinema_address=cinema_data.cinema_address
        )

        db.add(new_cinema)
        db.commit()
        db.refresh(new_cinema)
        return new_cinema

    @staticmethod
    def delete_cinema(db: Session, cinema_id: int):
        cinema = CityService.get_cinema_by_id(db, cinema_id)

        halls = db.query(models.Hall).filter(models.Hall.cinema_id == cinema_id).all()
        if halls:
            raise HTTPException(
                status_code=400,
                detail="You can't delete a cinema with halls."
            )
        
        db.delete(cinema)
        db.commit()
        return {"message": "Cinema is deleted"}