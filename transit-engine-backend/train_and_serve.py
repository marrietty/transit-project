#!/usr/bin/env python3
"""
train_and_serve.py

A unified script to generate synthetic Manila transit data, train a
RandomForestClassifier for congestion prediction, and run a FastAPI server
that serves predictions based on live Supabase statistics and current server time.

Usage:
    - Train the model:
        python train_and_serve.py --train
    - Start the FastAPI server (will train the model if model.joblib is missing):
        uvicorn train_and_serve:app --reload
"""

import os
import sys
import argparse
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any

import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import database querying logic from Phase 2
from query_reports import fetch_and_aggregate_reports

MODEL_FILENAME = "model.joblib"
app_model = None  # Global variable for the loaded model inside FastAPI


# =====================================================================
# 1. SYNTHETIC DATA GENERATION
# =====================================================================

def generate_synthetic_data(n_samples: int = 5000) -> pd.DataFrame:
    """
    Generates a synthetic dataset containing simulated commuter congestion records
    modeling realistic Manila rush hour congestion trends.
    """
    print(f"Generating {n_samples} synthetic commuter transit records...")
    
    np.random.seed(42)  # For reproducible training results

    # Generate feature distributions
    hours = np.random.randint(0, 24, n_samples)
    days = np.random.randint(0, 7, n_samples)  # 0: Monday, 6: Sunday
    report_counts = np.random.randint(0, 51, n_samples)
    report_averages = np.random.uniform(1.0, 3.0, n_samples)
    
    targets = []
    
    for i in range(n_samples):
        h = hours[i]
        d = days[i]
        cnt = report_counts[i]
        avg = report_averages[i]
        
        is_weekday = d < 5
        # Rush Hour Peak Windows in Manila: 7-9 AM and 5-7 PM (17:00-19:59)
        is_rush_hour = is_weekday and ((7 <= h <= 9) or (17 <= h <= 19))
        
        # Probabilities mapping: [P(Clear=1), P(Moderate=2), P(Heavy=3)]
        if avg >= 2.4:
            # High user report average strongly points to heavy congestion
            weights = [0.05, 0.15, 0.80]
        elif avg >= 1.7:
            # Moderate user reports
            if is_rush_hour:
                weights = [0.02, 0.18, 0.80]
            else:
                weights = [0.10, 0.70, 0.20]
        else:
            # Low reports average
            if is_rush_hour:
                weights = [0.10, 0.40, 0.50]
            elif cnt > 25:
                weights = [0.20, 0.60, 0.20]
            else:
                # Outside peak with low/no report activities
                weights = [0.85, 0.10, 0.05]
                
        # Sample congestion label
        congestion = np.random.choice([1, 2, 3], p=weights)
        targets.append(congestion)
        
    df = pd.DataFrame({
        "hour_of_day": hours,
        "day_of_week": days,
        "recent_report_count": report_counts,
        "recent_report_average": report_averages,
        "predicted_congestion": targets
    })
    
    return df


# =====================================================================
# 2. MODEL TRAINING
# =====================================================================

def train_pipeline() -> RandomForestClassifier:
    """
    Generates synthetic data, splits it, trains a RandomForestClassifier,
    evaluates its performance, and serializes the model to disk.
    """
    print("\n--- Starting Model Training Pipeline ---")
    
    # 1. Generate data
    df = generate_synthetic_data(5000)
    
    # 2. Separate features and target
    X = df[["hour_of_day", "day_of_week", "recent_report_count", "recent_report_average"]]
    y = df["predicted_congestion"]
    
    # 3. Train/Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # 4. Initialize and fit RandomForestClassifier
    print("Training RandomForestClassifier model...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=5,
        random_state=42
    )
    clf.fit(X_train, y_train)
    
    # 5. Evaluate
    y_pred = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Model Accuracy: {accuracy * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # 6. Save model to joblib
    joblib.dump(clf, MODEL_FILENAME)
    print(f"Model successfully saved to '{MODEL_FILENAME}'")
    
    return clf


# =====================================================================
# 3. FASTAPI INTEGRATION
# =====================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan handler that loads the model on startup.
    If the model.joblib file is missing, it will automatically trigger training.
    """
    global app_model
    
    # Path to the serialized model
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, MODEL_FILENAME)
    
    if not os.path.exists(model_path):
        print(f"Model file '{model_path}' not found. Initializing training...")
        app_model = train_pipeline()
    else:
        print(f"Loading pre-trained model from '{model_path}'...")
        app_model = joblib.load(model_path)
        
    yield
    # Cleanup on shutdown
    app_model = None
    print("FastAPI shutdown complete.")


# Initialize FastAPI Server
app = FastAPI(
    title="Metro Manila Transit Predictor API",
    description="FastAPI application serving Machine Learning predictions for congestion monitoring.",
    version="1.1.0",
    lifespan=lifespan
)

# CORS configuration for local React frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MLStationStatusResponse(BaseModel):
    station_id: str = Field(..., description="Unique transit station identifier.")
    recent_report_count: int = Field(..., description="Count of reports submitted in the last 30 minutes.")
    recent_report_average: float = Field(..., description="Numerical average congestion level from live reports.")
    server_hour: int = Field(..., description="Server hour of the day (0-23) used as a model feature.")
    server_day_of_week: int = Field(..., description="Server day of the week (0-6) used as a model feature.")
    predicted_congestion: int = Field(..., description="ML model-predicted congestion level (1=Clear, 2=Moderate, 3=Heavy).")


@app.get("/")
def read_root() -> Dict[str, str]:
    """
    Health check endpoint.
    """
    return {
        "status": "online",
        "service": "Metro Manila Transit Prediction Backend",
        "model_loaded": str(app_model is not None),
        "docs": "/docs"
    }


@app.get(
    "/api/status/{station_id}",
    response_model=MLStationStatusResponse,
    summary="Get live station status with ML-predicted congestion level",
    response_description="Returns live metrics, server time features, and machine learning predicted congestion."
)
def get_station_status(
    station_id: str = Path(..., description="Unique station ID (e.g. 'mrt3-ayala')")
) -> Dict[str, Any]:
    """
    Retrieves live reports from the Supabase database for the past 30 minutes, 
    extracts the current server hour of day and day of week, feeds all 4 features 
    into the trained RandomForestClassifier, and outputs the smart prediction.
    """
    # 1. Fetch live metrics from Supabase database
    metrics = fetch_and_aggregate_reports(station_id)

    # Propagate database API query error if it occurs
    if "error" in metrics:
        raise HTTPException(
            status_code=502,
            detail=f"Database query failed: {metrics['error']}"
        )

    # 2. Extract current server time features
    now = datetime.now()
    server_hour = now.hour
    server_day_of_week = now.weekday()  # 0: Monday, 6: Sunday

    recent_report_count = metrics["recent_report_count"]
    recent_report_average = metrics["recent_report_average"]

    # 3. Model inference
    if app_model is None:
        raise HTTPException(
            status_code=500,
            detail="Machine learning model is not loaded."
        )

    try:
        # Create input feature vector as a DataFrame to match training columns and avoid warnings
        feature_df = pd.DataFrame([{
            "hour_of_day": server_hour,
            "day_of_week": server_day_of_week,
            "recent_report_count": recent_report_count,
            "recent_report_average": recent_report_average
        }])
        
        # Predict congestion level
        prediction = app_model.predict(feature_df)
        predicted_congestion = int(prediction[0])
    except Exception as err:
        raise HTTPException(
            status_code=500,
            detail=f"Model inference failed: {str(err)}"
        )

    return {
        "station_id": station_id,
        "recent_report_count": recent_report_count,
        "recent_report_average": recent_report_average,
        "server_hour": server_hour,
        "server_day_of_week": server_day_of_week,
        "predicted_congestion": predicted_congestion
    }


# =====================================================================
# CLI RUNNER FOR TRAINING
# =====================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="CLI utilities for train_and_serve.py"
    )
    parser.add_argument(
        "--train",
        action="store_true",
        help="Run the training pipeline to generate model.joblib"
    )
    args = parser.parse_args()

    if args.train or not os.path.exists(MODEL_FILENAME):
        train_pipeline()
    else:
        print("Model file exists. Use '--train' to force retraining.")
        print("To start the server, run: uvicorn train_and_serve:app --reload")
