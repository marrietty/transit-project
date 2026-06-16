import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error

# Import custom transformer from model_utils
from model_utils import CyclicTransformer, TransitPredictor

def main():
    print("--- Philippine MRT/LRT Crowd-Forecasting Regression Training ---")
    
    # 1. Load data
    data_path = os.path.join("data", "synthetic_ridership.csv")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at '{data_path}'")
        
    print(f"Loading dataset from '{data_path}'...")
    # Read with low_memory=False to suppress mixed type warnings
    df = pd.read_csv(data_path, low_memory=False)
    print(f"Loaded {len(df)} rows.")

    # 2. Define features and target classification
    categorical_features = ['station_id', 'line', 'direction']
    cyclic_features = ['hour', 'hour_block', 'day_of_week']
    binary_features = ['is_weekend', 'is_holiday', 'is_payday']
    live_feature = ['avg_wait_time_mins']
    
    target_column = 'turnstile_entries'
    
    # All features to keep for the model
    feature_columns = categorical_features + cyclic_features + binary_features + live_feature
    
    print("\nFeature classification check:")
    print(f"  Categorical: {categorical_features}")
    print(f"  Cyclic:      {cyclic_features}")
    print(f"  Binary:      {binary_features}")
    print(f"  Live:        {live_feature}")
    print(f"  Target:      {target_column}")

    X = df[feature_columns]
    y = df[target_column]

    # 3. Train/Test Split
    print("\nSplitting data into 80% train and 20% test sets...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"  Training shape: {X_train.shape}")
    print(f"  Testing shape:  {X_test.shape}")

    # 4. Construct Preprocessor using ColumnTransformer
    print("\nConstructing scikit-learn preprocessing pipeline...")
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features),
            ('impute_wait', SimpleImputer(strategy='constant', fill_value=0.0), live_feature),
            ('cyclic', CyclicTransformer(), cyclic_features),
            ('bin', 'passthrough', binary_features)
        ],
        remainder='drop'  # explicitly drop other fields
    )

    # 5. Define Pipeline with RandomForestRegressor
    print("Initializing RandomForestRegressor pipeline...")
    pipeline = Pipeline(
        steps=[
            ('preprocessor', preprocessor),
            ('regressor', RandomForestRegressor(
                n_estimators=100,
                max_depth=12,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1
            ))
        ]
    )

    # 6. Train the model
    print("\nFitting the RandomForestRegressor model (this may take a few seconds)...")
    pipeline.fit(X_train, y_train)
    print("Model training complete.")

    # 7. Evaluate the model
    print("\nEvaluating model performance on test set...")
    y_pred = pipeline.predict(X_test)
    
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    
    print(f"  R2 Score:                  {r2:.4f}")
    print(f"  Mean Absolute Error (MAE): {mae:.2f}")
    print(f"  Root Mean Squared Error:   {rmse:.2f}")

    # 8. Save the final pipeline using joblib
    model_filename = 'ridership_model.joblib'
    print(f"\nSaving the trained pipeline to '{model_filename}'...")
    joblib.dump(pipeline, model_filename)
    print("Model saved successfully.")

    # 9. Verify production predictor load and run prediction
    print("\nVerifying production TransitPredictor class...")
    predictor = TransitPredictor(model_filename)
    
    # Test payload mimicking a real-time request
    test_payload = {
        'station_id': 'MRT3-NORTHAVE',
        'line': 'MRT-3',
        'direction': 'NB',
        'hour': 17,
        'hour_block': '17:00',
        'day_of_week': 'Mon',
        'is_weekend': 0,
        'is_holiday': 0,
        'is_payday': 0,
        'avg_wait_time_mins': 7.5
    }
    
    pred_entries = predictor.predict_live(test_payload)
    print(f"  Sample Payload: {test_payload}")
    print(f"  Predicted Volume: {pred_entries:.2f} turnstile entries")

    # Test payload with missing/None crowdsource reports (should trigger imputer to fill with 0)
    test_payload_missing = {
        'station_id': 'MRT3-NORTHAVE',
        'line': 'MRT-3',
        'direction': 'NB',
        'hour': 17,
        'hour_block': '17:00',
        'day_of_week': 'Mon',
        'is_weekend': 0,
        'is_holiday': 0,
        'is_payday': 0,
        'avg_wait_time_mins': None  # Missing wait time report
    }
    pred_entries_missing = predictor.predict_live(test_payload_missing)
    print(f"  Sample Payload (Missing wait time): {test_payload_missing}")
    print(f"  Predicted Volume (with imputation): {pred_entries_missing:.2f} turnstile entries")

if __name__ == '__main__':
    main()
