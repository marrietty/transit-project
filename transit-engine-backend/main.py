"""
main.py

FastAPI backend application for transit monitoring. Exposes an API endpoint
to retrieve transit station congestion status metrics aggregated from Supabase.
"""

import os
from datetime import datetime
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from query_reports import fetch_and_aggregate_reports

# Initialize FastAPI App
app = FastAPI(
    title="Metro Manila Transit Monitoring API",
    description="Backend API for crowdsourced transit congestion reports.",
    version="1.0.0"
)

# Configure CORS Middleware (crucial for PWA and frontend integration)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production to match your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StationStatusResponse(BaseModel):
    station_id: str = Field(..., description="The unique identifier of the station queried.")
    recent_report_count: int = Field(..., description="Total number of reports submitted in the last 30 minutes.")
    recent_report_average: float = Field(..., description="Average congestion level of recent reports (e.g. 1.0 = Clear, 2.0 = Moderate, 3.0 = Heavy).")
    server_hour: int = Field(..., ge=0, le=23, description="The current server hour of the day (0-23).")
    server_day_of_week: int = Field(..., ge=0, le=6, description="The current server day of the week (0-6, where 0 = Monday, 6 = Sunday).")


@app.get("/")
def read_root() -> Dict[str, str]:
    """
    Root endpoint verifying server health and running status.
    """
    return {
        "status": "online",
        "service": "Metro Manila Transit Backend",
        "documentation": "/docs"
    }


@app.get(
    "/api/status/{station_id}",
    response_model=StationStatusResponse,
    summary="Get recent congestion status metrics for a transit station",
    response_description="Returns report aggregations and server time markers."
)
def get_station_status(
    station_id: str = Path(..., description="The unique identifier of the station (e.g., 'mrt3-ayala')")
) -> Dict[str, Any]:
    """
    Fetches commuter reports for a specific 'station_id' submitted within the last 30 minutes.
    
    Aggregates reports to calculate:
    - **recent_report_count**: Total number of recent reports
    - **recent_report_average**: Mathematical average of reported congestion levels
    
    Also packages:
    - **server_hour**: Current server hour of the day (0-23)
    - **server_day_of_week**: Current server day of the week (0-6, where 0=Monday, 6=Sunday)
    """
    # Query database and aggregate reports
    metrics = fetch_and_aggregate_reports(station_id)

    # If the database query returned an error key, map it to an HTTP Bad Gateway (502) error
    if "error" in metrics:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to query database: {metrics['error']}"
        )

    # Get current server date/time details
    now = datetime.now()
    server_hour = now.hour
    server_day_of_week = now.weekday()  # Monday is 0, Sunday is 6

    return {
        "station_id": station_id,
        "recent_report_count": metrics["recent_report_count"],
        "recent_report_average": metrics["recent_report_average"],
        "server_hour": server_hour,
        "server_day_of_week": server_day_of_week
    }
