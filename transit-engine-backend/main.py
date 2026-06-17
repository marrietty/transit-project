"""
main.py

FastAPI backend for the Metro Manila transit crowd-forecasting app.

Serves three endpoints used by the React frontend:
  - GET  /api/status/{station_id}  -> predicted turnstile volume + congestion category
  - POST /api/report               -> submit a live commuter congestion report
  - GET  /api/reports              -> recent reports grouped by station (state restore)

The trained pipeline is produced by train_model.ipynb and loaded on startup via
the TransitPredictor wrapper in processor.py.

Run:
    uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

from processor import DEFAULT_MODEL_PATH, TransitPredictor, _coerce_feature_types

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TABLE_NAME = "station_reports"
COL_STATION_ID = "station_id"
COL_CONGESTION_LEVEL = "congestion_level"
COL_REPORTED_AT = "reported_at"

# Frontend station IDs that don't collapse cleanly into the training vocabulary.
STATION_ID_OVERRIDES = {
    "LRT1-FPJ": "LRT1-ROOSEVELT",
    "LRT2-MARIKINA-PASIG": "LRT2-MARIKINA",
    "MRT3-SANTOLAN-ANNAPOLIS": "MRT3-SANTOLAN",
}

predictor: Optional[TransitPredictor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the trained pipeline once on startup."""
    global predictor
    if not os.path.exists(DEFAULT_MODEL_PATH):
        raise FileNotFoundError(
            f"Model '{DEFAULT_MODEL_PATH}' not found. Run train_model.ipynb first."
        )
    print(f"Loading model from '{DEFAULT_MODEL_PATH}'...")
    predictor = TransitPredictor(DEFAULT_MODEL_PATH)
    print("Model loaded.")
    yield
    predictor = None


app = FastAPI(
    title="Metro Manila Transit Crowd-Forecasting API",
    description="Predicts turnstile volume and serves crowdsourced congestion reports.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the frontend origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def get_supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL and SUPABASE_KEY must be set in the backend .env file.",
        )
    return create_client(url, key)


def fetch_recent_reports(station_id: Optional[str] = None) -> list:
    """
    Returns reports from the last 30 minutes, optionally filtered by station.
    """
    client = get_supabase_client()
    threshold = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()

    query = (
        client.table(TABLE_NAME)
        .select(f"{COL_STATION_ID}, {COL_CONGESTION_LEVEL}, {COL_REPORTED_AT}")
        .gte(COL_REPORTED_AT, threshold)
    )
    if station_id is not None:
        query = query.eq(COL_STATION_ID, station_id)

    return query.execute().data or []


def congestion_to_wait_mins(level: int) -> int:
    """Map a 1-3 congestion level to an estimated wait time in minutes."""
    return {1: 5, 2: 15, 3: 35}.get(level, 5)


# ---------------------------------------------------------------------------
# Prediction helpers
# ---------------------------------------------------------------------------

def normalize_station_id(station_id: str) -> str:
    """Normalize a frontend station ID to the training vocabulary format."""
    val = station_id.upper()
    if val in STATION_ID_OVERRIDES:
        return STATION_ID_OVERRIDES[val]
    if "-" in val:
        prefix, rest = val.split("-", 1)
        return f"{prefix}-{rest.replace('-', '')}"
    return val


def line_for_station(station_id: str) -> str:
    val = station_id.upper()
    if "MRT3" in val:
        return "MRT-3"
    if "LRT1" in val:
        return "LRT-1"
    if "LRT2" in val:
        return "LRT-2"
    return "MRT-3"


def is_payday(d: datetime) -> int:
    return 1 if d.day in (15, 30, 31) else 0


def is_holiday(d: datetime) -> int:
    # Placeholder; wire to a PH holiday calendar in production.
    return 0


def live_wait_time(station_id: str) -> tuple[Optional[float], int]:
    """
    Returns (avg_wait_time_mins, report_count) from recent reports for a station.
    Wait time is derived from the average reported congestion level.
    """
    try:
        reports = fetch_recent_reports(station_id)
    except Exception as err:
        # Live reports are optional — the model imputes a missing wait time.
        # Never let a Supabase/credentials error break the prediction.
        print(f"live_wait_time: skipping live reports ({err})")
        return None, 0

    count = len(reports)
    if count == 0:
        return None, 0

    avg_level = sum(float(r[COL_CONGESTION_LEVEL]) for r in reports) / count
    if avg_level <= 1.0:
        wait = 5.0
    elif avg_level <= 2.0:
        wait = 5.0 + (avg_level - 1.0) * 10.0
    else:
        wait = 15.0 + (avg_level - 2.0) * 20.0
    return round(wait, 1), count


def congestion_category(volume: float) -> str:
    if volume < 1000:
        return "Low"
    if volume < 2000:
        return "Medium"
    if volume < 3500:
        return "High"
    return "Critical"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ReportPayload(BaseModel):
    station_id: str
    congestion_level: int = Field(..., ge=1, le=3)


class StatusResponse(BaseModel):
    station_id: str
    predicted_volume: float
    congestion_level: str
    live_reports_count: int
    meta: Dict[str, Any]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def read_root() -> Dict[str, str]:
    return {
        "status": "online",
        "service": "Metro Manila Transit Crowd-Forecasting API",
        "model_loaded": str(predictor is not None),
        "docs": "/docs",
    }


@app.get("/api/status/{station_id}", response_model=StatusResponse)
def get_station_status(
    station_id: str = Path(..., description="Station ID, e.g. 'mrt3-ayala'"),
    direction: str = Query("NB", pattern="^(NB|SB)$"),
    override_wait_time: Optional[float] = Query(None, description="Dev override for wait time."),
    override_report_count: Optional[int] = Query(None, description="Dev override for report count."),
) -> Dict[str, Any]:
    """Predict turnstile volume and congestion category for a station right now."""
    if predictor is None:
        raise HTTPException(status_code=500, detail="Model not loaded.")

    now = datetime.now()
    day_idx = now.weekday()  # Mon=0
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    if override_wait_time is not None or override_report_count is not None:
        avg_wait = override_wait_time
        reports_count = override_report_count if override_report_count is not None else 1
    else:
        avg_wait, reports_count = live_wait_time(station_id)

    payload = {
        "station_id": normalize_station_id(station_id),
        "line": line_for_station(station_id),
        "direction": direction,
        "hour": now.hour,
        "hour_block": f"{now.hour:02d}:00",
        "day_of_week": days[day_idx],
        "is_weekend": 1 if day_idx >= 5 else 0,
        "is_holiday": is_holiday(now),
        "is_payday": is_payday(now),
        "avg_wait_time_mins": avg_wait,
    }

    try:
        df = _coerce_feature_types(pd.DataFrame([payload]))
        volume = max(0.0, float(predictor.pipeline.predict(df)[0]))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {err}")

    return {
        "station_id": station_id,
        "predicted_volume": round(volume, 2),
        "congestion_level": congestion_category(volume),
        "live_reports_count": reports_count,
        "meta": {
            "line": payload["line"],
            "direction": direction,
            "hour": payload["hour"],
            "day_of_week": payload["day_of_week"],
            "is_weekend": bool(payload["is_weekend"]),
            "is_holiday": bool(payload["is_holiday"]),
            "is_payday": bool(payload["is_payday"]),
            "avg_wait_time_mins": avg_wait,
        },
    }


@app.post("/api/report")
def submit_report(payload: ReportPayload) -> Dict[str, Any]:
    """Insert a live commuter congestion report into Supabase."""
    try:
        client = get_supabase_client()
        response = (
            client.table(TABLE_NAME)
            .insert(
                {
                    COL_STATION_ID: payload.station_id,
                    COL_CONGESTION_LEVEL: payload.congestion_level,
                }
            )
            .execute()
        )
        return {"status": "success", "data": response.data}
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {err}")


@app.get("/api/reports")
def get_all_reports() -> Dict[str, Any]:
    """Return the latest report per station from the last 30 minutes."""
    try:
        reports = fetch_recent_reports()
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {err}")

    grouped: Dict[str, Any] = {}
    for r in reports:
        sid = r[COL_STATION_ID]
        level = r[COL_CONGESTION_LEVEL]
        ts = r[COL_REPORTED_AT]
        if sid not in grouped or ts > grouped[sid]["timestamp"]:
            note_state = "clear" if level == 1 else "moving" if level == 2 else "backed up"
            grouped[sid] = {
                "weight": level,
                "minutes": congestion_to_wait_mins(level),
                "note": f"Live report (queue is {note_state})",
                "timestamp": ts,
            }
    return grouped


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
