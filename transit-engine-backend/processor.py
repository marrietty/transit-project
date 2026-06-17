"""
processor.py

Shared inference utilities for the Metro Manila transit crowd-forecasting model.

Contains:
  - CyclicTransformer: a scikit-learn transformer that sin/cos-encodes the
    cyclic time features (hour, hour_block, day_of_week). It MUST live here so
    that joblib can deserialize the trained pipeline (the pickle references this
    class by its import path).
  - TransitPredictor: a thin wrapper that loads the exported pipeline and runs
    a single live prediction from a feature dict.

Both the training notebook (train_model.ipynb) and the API (main.py) import
from this module so there is exactly one definition of the custom transformer.
"""

import os
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.base import BaseEstimator, TransformerMixin

# Default location of the exported model, relative to this file.
DEFAULT_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "transit_model.joblib"
)

# Feature columns the pipeline expects, in no particular order.
EXPECTED_FEATURES = [
    "station_id",
    "line",
    "direction",
    "hour",
    "hour_block",
    "day_of_week",
    "is_weekend",
    "is_holiday",
    "is_payday",
    "avg_wait_time_mins",
]

_DAY_MAP = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}


class CyclicTransformer(BaseEstimator, TransformerMixin):
    """
    Maps the three cyclic time features to sine/cosine coordinates.

    Expected input columns (in order): hour, hour_block, day_of_week.
      - hour:        numeric 0-23
      - hour_block:  string "HH:MM" (or numeric hour)
      - day_of_week: string "Mon".."Sun" (or numeric 0-6)

    Outputs 6 columns: [hour_sin, hour_cos, hb_sin, hb_cos, dow_sin, dow_cos].
    """

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        if isinstance(X, pd.DataFrame):
            hour_col, hb_col, dow_col = (X.iloc[:, 0], X.iloc[:, 1], X.iloc[:, 2])
        else:
            arr = np.asarray(X)
            hour_col = pd.Series(arr[:, 0])
            hb_col = pd.Series(arr[:, 1])
            dow_col = pd.Series(arr[:, 2])

        # 1. Hour (0-23)
        hour_val = pd.to_numeric(hour_col, errors="coerce").fillna(0.0).astype(float)
        hour_sin = np.sin(2 * np.pi * hour_val / 24.0)
        hour_cos = np.cos(2 * np.pi * hour_val / 24.0)

        # 2. Hour block ("HH:MM")
        hb_val = hb_col.apply(self._parse_hour_block)
        hb_sin = np.sin(2 * np.pi * hb_val / 24.0)
        hb_cos = np.cos(2 * np.pi * hb_val / 24.0)

        # 3. Day of week ("Mon".."Sun")
        dow_val = dow_col.apply(self._parse_day)
        dow_sin = np.sin(2 * np.pi * dow_val / 7.0)
        dow_cos = np.cos(2 * np.pi * dow_val / 7.0)

        return np.column_stack(
            [hour_sin, hour_cos, hb_sin, hb_cos, dow_sin, dow_cos]
        )

    @staticmethod
    def _parse_hour_block(val) -> float:
        if pd.isna(val):
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        text = str(val).strip()
        if ":" in text:
            parts = text.split(":")
            try:
                return float(parts[0]) + float(parts[1]) / 60.0
            except ValueError:
                return 0.0
        try:
            return float(text)
        except ValueError:
            return 0.0

    @staticmethod
    def _parse_day(val) -> float:
        if pd.isna(val):
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        return float(_DAY_MAP.get(str(val).strip(), 0))


class TransitPredictor:
    """
    Loads the exported pipeline and runs single-record live predictions.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or DEFAULT_MODEL_PATH
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Trained model not found at '{self.model_path}'. "
                "Run train_model.ipynb to export it first."
            )
        self.pipeline = joblib.load(self.model_path)

    def predict_live(self, payload: Dict[str, Any]) -> float:
        """
        Accepts a dict of feature values and returns predicted turnstile entries.
        Missing keys/values are coerced to safe defaults.
        """
        if not isinstance(payload, dict):
            raise TypeError("payload must be a dict.")

        row = {feat: payload.get(feat, None) for feat in EXPECTED_FEATURES}
        df = pd.DataFrame([row])
        df = _coerce_feature_types(df)

        prediction = self.pipeline.predict(df)
        return max(0.0, float(prediction[0]))


def _coerce_feature_types(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enforces the dtypes the pipeline was trained on. Shared by TransitPredictor
    and the API so inference is identical everywhere.
    """
    df["avg_wait_time_mins"] = pd.to_numeric(df["avg_wait_time_mins"], errors="coerce")
    for col in ["hour", "is_weekend", "is_holiday", "is_payday"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)

    for col in ["station_id", "line", "direction", "hour_block", "day_of_week"]:
        if df[col].iloc[0] is None or pd.isna(df[col].iloc[0]):
            df[col] = "unknown"
        else:
            df[col] = df[col].astype(str)
    return df
