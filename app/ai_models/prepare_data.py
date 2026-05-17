import pandas as pd
from app.database import SessionLocal
from app.models import models

def prepare_data():
    df = pd.read_csv('data/cinemaTicket_Ref.csv')
    
    # Очистка
    df = df[(df['occu_perc'] <= 100) & (df['occu_perc'] >= 0)]
    df = df[df['capacity'] > 0]
    
    # Признаки
    df['date'] = pd.to_datetime(df['date'])
    df['day_of_week'] = df['date'].dt.dayofweek
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    df['session_hour'] = df['show_time'].astype(int)
    
    db = SessionLocal()
    
    db.query(models.TrainingData).delete()
    
    for _, row in df.iterrows():
        db.add(models.TrainingData(
            day_of_week=int(row['day_of_week']),
            is_weekend=int(row['is_weekend']),
            session_hour=int(row['session_hour']),
            ticket_price=float(row['ticket_price']),
            capacity=int(row['capacity']),
            occu_perc=float(row['occu_perc'])
        ))
    
    db.commit()
    db.close()

if __name__ == "__main__":
    prepare_data()