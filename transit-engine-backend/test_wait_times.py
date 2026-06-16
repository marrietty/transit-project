import os
from model_utils import TransitPredictor

def test_predictions():
    # Load model
    predictor = TransitPredictor('ridership_model.joblib')
    
    # Define a base payload representing North Avenue station at 5 PM on Monday (rush hour)
    base_payload = {
        'station_id': 'MRT3-NORTHAVE',
        'line': 'MRT-3',
        'direction': 'NB',
        'hour': 17,
        'hour_block': '17:00',
        'day_of_week': 'Mon',
        'is_weekend': 0,
        'is_holiday': 0,
        'is_payday': 0
    }
    
    # We will vary the avg_wait_time_mins (user reports)
    test_scenarios = [
        None,         # No crowdsource reports (should impute to 0.0)
        0.0,          # Reported as 0 min wait (empty platform)
        5.0,          # Short wait (5 mins)
        15.0,         # Moderate wait (15 mins)
        30.0,         # Heavy wait (30 mins)
        45.0          # Severe wait (45 mins)
    ]
    
    print("=== Testing Fusion of User Live Reports (avg_wait_time_mins) ===")
    print(f"Station: {base_payload['station_id']} | Time: {base_payload['hour_block']} | Day: {base_payload['day_of_week']}")
    print("-" * 75)
    print(f"{'User Input (avg_wait_time_mins)':<35} | {'Predicted turnstile_entries (Volume)':<35}")
    print("-" * 75)
    
    for wt in test_scenarios:
        payload = base_payload.copy()
        payload['avg_wait_time_mins'] = wt
        prediction = predictor.predict_live(payload)
        
        wt_label = "None (No user report - Imputed to 0)" if wt is None else f"{wt} mins"
        print(f"{wt_label:<35} | {prediction:<35.2f}")

if __name__ == '__main__':
    test_predictions()
