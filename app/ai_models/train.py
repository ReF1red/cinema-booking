import pandas as pd
import joblib
from catboost import CatBoostRegressor
from sklearn.model_selection import train_test_split

def train():
    df = pd.read_csv('data/cleaned_cinema_data.csv')
    
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
    
    model.fit(
        X_train, y_train,
        eval_set=(X_test, y_test),
        verbose=100
    )
    
    joblib.dump(model, 'app/ai_models/occupancy_model.joblib')
    
    from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error
    y_pred = model.predict(X_test)
    print(f"MAE: {mean_absolute_error(y_test, y_pred):.4f}")
    print(f"MAPE: {mean_absolute_percentage_error(y_test, y_pred):.4f}")

if __name__ == "__main__":
    train()