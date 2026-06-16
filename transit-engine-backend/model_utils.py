import os
import numpy as np
import pandas as pd
import joblib
from sklearn.base import BaseEstimator, TransformerMixin

class CyclicTransformer(BaseEstimator, TransformerMixin):
    """
    A scikit-learn custom transformer that maps cyclic time features
    (hour, hour_block, day_of_week) to sine and cosine coordinates.
    """
    def __init__(self):
        self.day_map = {
            'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 
            'Fri': 4, 'Sat': 5, 'Sun': 6
        }

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        # Determine whether input is a DataFrame or numpy array
        if isinstance(X, pd.DataFrame):
            hour_col = X.iloc[:, 0]
            hb_col = X.iloc[:, 1]
            dow_col = X.iloc[:, 2]
        else:
            X_arr = np.asarray(X)
            hour_col = pd.Series(X_arr[:, 0])
            hb_col = pd.Series(X_arr[:, 1])
            dow_col = pd.Series(X_arr[:, 2])

        # 1. Hour (numerical 0-23)
        hour_val = hour_col.astype(float)
        hour_sin = np.sin(2 * np.pi * hour_val / 24.0)
        hour_cos = np.cos(2 * np.pi * hour_val / 24.0)

        # 2. Hour Block (string "HH:MM")
        def parse_hour_block(val):
            if pd.isna(val):
                return 0.0
            if isinstance(val, (int, float)):
                return float(val)
            val_str = str(val).strip()
            if ':' in val_str:
                parts = val_str.split(':')
                try:
                    return float(parts[0]) + float(parts[1]) / 60.0
                except ValueError:
                    return 0.0
            try:
                return float(val_str)
            except ValueError:
                return 0.0

        hb_val = hb_col.apply(parse_hour_block) if hasattr(hb_col, 'apply') else pd.Series([parse_hour_block(x) for x in hb_col])
        hb_sin = np.sin(2 * np.pi * hb_val / 24.0)
        hb_cos = np.cos(2 * np.pi * hb_val / 24.0)

        # 3. Day of Week (string "Mon", "Tue"...)
        def parse_day(val):
            if pd.isna(val):
                return 0.0
            if isinstance(val, (int, float)):
                return float(val)
            val_str = str(val).strip()
            return float(self.day_map.get(val_str, 0))

        dow_val = dow_col.apply(parse_day) if hasattr(dow_col, 'apply') else pd.Series([parse_day(x) for x in dow_col])
        dow_sin = np.sin(2 * np.pi * dow_val / 7.0)
        dow_cos = np.cos(2 * np.pi * dow_val / 7.0)

        return np.column_stack([
            hour_sin, hour_cos,
            hb_sin, hb_cos,
            dow_sin, dow_cos
        ])


class TransitPredictor:
    """
    Production-ready predictor class for live inference on transit crowd forecasting.
    """
    def __init__(self, model_path=None):
        if model_path is None:
            # Default to the same directory where this file resides
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, 'ridership_model.joblib')
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Trained model not found at '{model_path}'. Please run the training script first.")
        
        self.pipeline = joblib.load(model_path)
        self.expected_features = [
            'station_id', 'line', 'direction', 
            'hour', 'hour_block', 'day_of_week',
            'is_weekend', 'is_holiday', 'is_payday', 
            'avg_wait_time_mins'
        ]

    def predict_live(self, payload_dict):
        """
        Accepts a dictionary containing feature values for a single record:
        {
            'station_id': 'MRT3-NORTHAVE',
            'line': 'MRT-3',
            'direction': 'NB',
            'hour': 17,
            'hour_block': '17:00',
            'day_of_week': 'Mon',
            'is_weekend': 0,
            'is_holiday': 0,
            'is_payday': 0,
            'avg_wait_time_mins': 7.5  # can be float, None, or np.nan
        }
        Returns the predicted number of turnstile entries as a float.
        """
        # Ensure payload is a dictionary
        if not isinstance(payload_dict, dict):
            raise TypeError("payload_dict must be a dictionary.")

        # Construct DataFrame and handle missing keys/values
        row_dict = {feat: payload_dict.get(feat, None) for feat in self.expected_features}
        df = pd.DataFrame([row_dict])
        
        # Enforce proper types for numeric/binary features to avoid scikit-learn typing/imputation issues
        df['avg_wait_time_mins'] = pd.to_numeric(df['avg_wait_time_mins'], errors='coerce')
        df['hour'] = pd.to_numeric(df['hour'], errors='coerce').fillna(0).astype(int)
        df['is_weekend'] = pd.to_numeric(df['is_weekend'], errors='coerce').fillna(0).astype(int)
        df['is_holiday'] = pd.to_numeric(df['is_holiday'], errors='coerce').fillna(0).astype(int)
        df['is_payday'] = pd.to_numeric(df['is_payday'], errors='coerce').fillna(0).astype(int)

        # Enforce proper types and fill None for categorical/cyclic string features
        for col in ['station_id', 'line', 'direction', 'hour_block', 'day_of_week']:
            if df[col].iloc[0] is None or pd.isna(df[col].iloc[0]):
                df[col] = "unknown"
            else:
                df[col] = df[col].astype(str)

        # Run inference using the scikit-learn Pipeline
        prediction = self.pipeline.predict(df)
        return float(prediction[0])
