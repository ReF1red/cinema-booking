import pandas as pd

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
    
    features = [
        'day_of_week', 'is_weekend', 'session_hour',
        'ticket_price', 'capacity', 'occu_perc'
    ]
    
    df[features].to_csv('data/cleaned_cinema_data.csv', index=False)

if __name__ == "__main__":
    prepare_data()