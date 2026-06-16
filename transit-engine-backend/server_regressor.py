import os
from datetime import datetime
from typing import Dict, Any, Optional
import random

import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import the custom transformer to allow joblib deserialization
from model_utils import CyclicTransformer

# Define Model File Name
MODEL_PATH = "transit_crowd_model.joblib"

# Initialize FastAPI App
app = FastAPI(
    title="Metro Manila Transit Regression Prediction API",
    description="Production-ready API endpoint for predicting turnstile entries and crowding volumes.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model lazy-loading
model = None

@app.on_event("startup")
def startup_event():
    global model
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Pre-trained pipeline file '{MODEL_PATH}' was not found. "
            "Please run 'train_regressor.py' to generate the model first."
        )
    print(f"Loading pre-trained regression pipeline from '{MODEL_PATH}'...")
    model = joblib.load(MODEL_PATH)
    print("Pipeline loaded successfully.")


# =====================================================================
# 1. HELPER FUNCTIONS
# =====================================================================

def get_line_for_station(station_id: str) -> str:
    """
    Infers the transit line based on the standard station ID prefix.
    """
    station_upper = station_id.upper()
    if "MRT3" in station_upper:
        return "MRT-3"
    elif "LRT1" in station_upper:
        return "LRT-1"
    elif "LRT2" in station_upper:
        return "LRT-2"
    return "MRT-3"  # Fallback


def check_if_holiday(current_date: datetime.date) -> int:
    """
    Placeholder check for Philippine public holidays.
    Returns 1 if current_date is a holiday, otherwise 0.
    """
    # Standard dummy logic. In production, this would query a calendar table or third-party api.
    return 0


def check_if_payday(current_date: datetime.date) -> int:
    """
    Determines if current_date falls on a standard Philippine semi-monthly payday (15th / end of month).
    Returns 1 if it is a payday, otherwise 0.
    """
    day = current_date.day
    # Standard 15th and end-of-month paydays
    if day in [15, 30, 31]:
        return 1
    return 0


def query_live_reports(station_id: str):
    """
    Simulates a database query returning the average wait time and report count
    submitted by users for a specific station in the past 30 minutes.
    """
    # In a real environment, this executes:
    # SELECT AVG(wait_time), COUNT(*) FROM station_reports
    # WHERE station_id = :station_id AND created_at >= NOW() - INTERVAL '30 minutes'
    
    # Simulating data: 25% chance of no recent reports
    if random.random() < 0.25:
        return None, 0

    num_reports = random.randint(1, 12)
    avg_wait = round(random.uniform(3.0, 45.0), 1)
    return avg_wait, num_reports


def get_congestion_level(volume: float) -> str:
    """
    Categorizes predicted turnstile entries into readable congestion classes
    based on the percentile distribution of the synthetic ridership dataset.
    """
    if volume < 1000:
        return "Low"
    elif volume < 2000:
        return "Medium"
    elif volume < 3500:
        return "High"
    else:
        return "Critical"


# =====================================================================
# 2. SCHEMAS AND ENDPOINTS
# =====================================================================

class StatusResponse(BaseModel):
    station_id: str = Field(..., description="Unique transit station identifier.")
    predicted_volume: float = Field(..., description="Predicted number of turnstile entries for the current hour.")
    congestion_level: str = Field(..., description="Calculated congestion status ('Low', 'Medium', 'High', 'Critical').")
    live_reports_count: int = Field(..., description="Count of live crowdsourced reports within the past 30 minutes.")
    meta: Dict[str, Any] = Field(..., description="Contextual features used for this prediction model.")


@app.get(
    "/api/status/{station_id}",
    response_model=StatusResponse,
    summary="Retrieve live predicted crowd volume and congestion category"
)
def get_station_status(
    station_id: str = Path(..., description="Unique transit station ID (e.g. 'MRT3-NORTHAVE')"),
    direction: str = Query("NB", regex="^(NB|SB)$", description="Travel direction: 'NB' (Northbound) or 'SB' (Southbound)."),
    override_wait_time: Optional[float] = Query(None, description="Developer override: mock average wait time in minutes."),
    override_report_count: Optional[int] = Query(None, description="Developer override: mock count of reports.")
) -> Dict[str, Any]:
    """
    Aggregates real-time server parameters and crowdsourced report variables,
    feeds them into the trained scikit-learn regressor pipeline, and returns the
    predicted turnstile entries and estimated congestion category.
    """
    global model
    if model is None:
        raise HTTPException(
            status_code=500,
            detail="Machine learning model is not loaded on startup."
        )

    # 1. Fetch current server date/time details
    now = datetime.now()
    server_hour = now.hour
    server_day = now.weekday()  # 0: Monday, 6: Sunday
    is_weekend = 1 if server_day >= 5 else 0

    # 2. Get holiday & payday indicators
    is_holiday = check_if_holiday(now.date())
    is_payday = check_if_payday(now.date())

    # Map day index to training string labels
    days_map = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    day_of_week_str = days_map[server_day]
    hour_block_str = f"{server_hour:02d}:00"

    # 3. Fetch user reports (or apply developer overrides)
    if override_wait_time is not None or override_report_count is not None:
        avg_wait_time = override_wait_time
        live_reports_count = override_report_count if override_report_count is not None else 1
    else:
        avg_wait_time, live_reports_count = query_live_reports(station_id)

    # Resolve transit line from station_id
    line = get_line_for_station(station_id)

    # 4. Formulate prediction input payload dictionary
    payload_dict = {
        'station_id': station_id,
        'line': line,
        'direction': direction,
        'hour': server_hour,
        'hour_block': hour_block_str,
        'day_of_week': day_of_week_str,
        'is_weekend': is_weekend,
        'is_holiday': is_holiday,
        'is_payday': is_payday,
        'avg_wait_time_mins': avg_wait_time
    }

    # 5. Transform into a DataFrame matching expected model schema columns
    df = pd.DataFrame([payload_dict])

    # Enforce data types and fill missing values exactly like TransitPredictor
    df['avg_wait_time_mins'] = pd.to_numeric(df['avg_wait_time_mins'], errors='coerce')
    df['hour'] = pd.to_numeric(df['hour'], errors='coerce').fillna(0).astype(int)
    df['is_weekend'] = pd.to_numeric(df['is_weekend'], errors='coerce').fillna(0).astype(int)
    df['is_holiday'] = pd.to_numeric(df['is_holiday'], errors='coerce').fillna(0).astype(int)
    df['is_payday'] = pd.to_numeric(df['is_payday'], errors='coerce').fillna(0).astype(int)

    for col in ['station_id', 'line', 'direction', 'hour_block', 'day_of_week']:
        if df[col].iloc[0] is None or pd.isna(df[col].iloc[0]):
            df[col] = "unknown"
        else:
            df[col] = df[col].astype(str)

    # 6. Run regression model prediction
    try:
        prediction = model.predict(df)
        predicted_volume = max(0.0, float(prediction[0]))
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Model inference failed: {str(err)}"
        )

    # 7. Map volume to congestion string category
    congestion_level = get_congestion_level(predicted_volume)

    # 8. Return response payload
    return {
        "station_id": station_id,
        "predicted_volume": round(predicted_volume, 2),
        "congestion_level": congestion_level,
        "live_reports_count": live_reports_count,
        "meta": {
            "line": line,
            "direction": direction,
            "hour": server_hour,
            "day_of_week": day_of_week_str,
            "is_weekend": bool(is_weekend),
            "is_holiday": bool(is_holiday),
            "is_payday": bool(is_payday),
            "avg_wait_time_mins": avg_wait_time
        }
    }


if __name__ == "__main__":
    import uvicorn
    # Start the server on port 8000
    uvicorn.run("server_regressor:app", host="127.0.0.1", port=8000, reload=True)
