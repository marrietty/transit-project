#!/usr/bin/env python3
"""
query_reports.py

A standalone Python utility script to query commuter reports from a Supabase
database for a specific transit station and calculate recent congestion metrics
within the last 30 minutes.

Dependencies:
    - supabase
    - python-dotenv

Usage:
    python query_reports.py --station-id <STATION_ID>
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List

from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError

# Configurable database schema mappings
# Change these values if your Supabase schema uses different names
TABLE_NAME = "station_reports"
COL_STATION_ID = "station_id"
COL_CONGESTION_LEVEL = "congestion_level"
COL_CREATED_AT = "reported_at"


def get_supabase_client() -> Client:
    """
    Initializes and returns the Supabase client using environment variables.
    """
    # Load environment variables from .env file
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set.", file=sys.stderr)
        print("Please check your .env file in the backend directory.", file=sys.stderr)
        sys.exit(1)

    return create_client(supabase_url, supabase_key)


def fetch_and_aggregate_reports(station_id: str) -> Dict[str, Any]:
    """
    Queries commuter reports for a specific station submitted in the last 30 minutes,
    and returns aggregated statistics (recent_report_count and recent_report_average).
    """
    supabase_client = get_supabase_client()

    # Calculate timestamp for 30 minutes ago in UTC
    time_threshold = datetime.now(timezone.utc) - timedelta(minutes=30)
    iso_threshold = time_threshold.isoformat()

    print(f"Connecting to database and fetching reports for station: '{station_id}'")
    print(f"Filtering reports created since: {iso_threshold} (UTC)")

    try:
        # Fetch matching reports from Supabase
        response = (
            supabase_client.table(TABLE_NAME)
            .select(f"{COL_STATION_ID}, {COL_CONGESTION_LEVEL}, {COL_CREATED_AT}")
            .eq(COL_STATION_ID, station_id)
            .gte(COL_CREATED_AT, iso_threshold)
            .execute()
        )
    except APIError as err:
        print(f"\nAPI Error during Supabase query: {err.message}", file=sys.stderr)
        print(f"Please check if the table '{TABLE_NAME}' and columns exist in your Supabase schema.", file=sys.stderr)
        return {
            "recent_report_count": 0,
            "recent_report_average": 0.0,
            "error": f"Database query failed: {err.message}"
        }
    except Exception as err:
        print(f"\nUnexpected error querying Supabase: {err}", file=sys.stderr)
        return {
            "recent_report_count": 0,
            "recent_report_average": 0.0,
            "error": str(err)
        }

    reports: List[Dict[str, Any]] = response.data or []

    # Calculate aggregation values
    recent_report_count = len(reports)
    
    if recent_report_count > 0:
        total_congestion = sum(float(report[COL_CONGESTION_LEVEL]) for report in reports)
        recent_report_average = round(total_congestion / recent_report_count, 2)
    else:
        recent_report_average = 0.0

    return {
        "recent_report_count": recent_report_count,
        "recent_report_average": recent_report_average,
        "reports_raw": reports
    }


def main() -> None:
    """
    CLI Entry point.
    """
    parser = argparse.ArgumentParser(
        description="Query and aggregate recent commuter reports from Supabase."
    )
    parser.add_argument(
        "--station-id",
        required=True,
        help="The unique identifier/ID of the transit station."
    )
    args = parser.parse_args()

    metrics = fetch_and_aggregate_reports(args.station_id)

    print("\n--- Aggregation Results ---")
    print(f"Station ID:             {args.station_id}")
    print(f"Recent Report Count:    {metrics['recent_report_count']}")
    print(f"Recent Report Average:  {metrics['recent_report_average']}")
    
    if "error" in metrics:
        print(f"Status:                 FAILED ({metrics['error']})")
    else:
        print("Status:                 SUCCESS")
        
    if metrics.get("reports_raw"):
        print("\nRecent Reports Raw Data:")
        for idx, r in enumerate(metrics["reports_raw"], 1):
            print(f"  [{idx}] Level: {r.get(COL_CONGESTION_LEVEL)} | Created At: {r.get(COL_CREATED_AT)}")


if __name__ == "__main__":
    main()
