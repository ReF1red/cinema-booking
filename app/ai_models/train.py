import pandas as pd
import joblib
import json
import numpy as np
from datetime import datetime
from catboost import CatBoostRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error, r2_score
from app.database import SessionLocal, engine
from app.models import models

def train():
    df = pd.read_sql("SELECT * FROM training_data", engine)
    
    features = [
        'day_of_week', 'is_weekend', 'session_hour',
        'ticket_price', 'capacity'
    ]
    target = 'occu_perc'
    
    X = df[features]
    y = df[target]
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    model = CatBoostRegressor(
        iterations=500,
        learning_rate=0.1,
        depth=6,
        early_stopping_rounds=50,
        verbose=100
    )
    
    model.fit(X_train, y_train, eval_set=(X_test, y_test), verbose=100)
    
    model_path = 'app/ai_models/occupancy_model.joblib'
    joblib.dump(model, model_path)
    
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    mape = mean_absolute_percentage_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)
    
    print(f"MAE: {mae:.4f}")
    print(f"MAPE: {mape:.4f}") 
    print(f"MSE: {mse:.4f}")
    print(f"RMSE: {rmse:.4f}")
    print(f"R²: {r2:.4f}")
    
    db = SessionLocal()
    history = models.TrainingHistory(
        trained_at=datetime.now(),
        model_path=model_path,
        mae=mae,
        mape=mape,
        mse=mse,
        rmse=rmse,
        r2=r2,
        samples_count=len(df),
        features_used=json.dumps(features)
    )
    db.add(history)
    db.commit()
    db.close()

if __name__ == "__main__":
    train()