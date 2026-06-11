#!/usr/bin/env python3
"""
parse_gtfs.py

Parses Manila transit GTFS data (routes, stops, stop_times, trips, frequencies)
to output a clean, structured JSON file 'manila_subway_data.json' representing
LRT-1, LRT-2, and MRT-3 schedules, coordinates, transfers, operating hours, and headways.
"""

import os
import json
import math
from typing import Dict, Any, List
import pandas as pd

# Define routes mapping and colors
ROUTES_MAP = {
    "ROUTE_880747": {"line_id": "lrt1", "name": "LRT-1", "full_name": "LRT Line 1 (Green Line)", "color": "#eab308", "text_color": "#ffffff"},
    "ROUTE_880801": {"line_id": "lrt2", "name": "LRT-2", "full_name": "LRT Line 2 (Purple Line)", "color": "#a855f7", "text_color": "#ffffff"},
    "ROUTE_880854": {"line_id": "mrt3", "name": "MRT-3", "full_name": "MRT Line 3 (Blue Line)", "color": "#3b82f6", "text_color": "#ffffff"}
}

DATA_DIR = "./data"
BACKEND_OUTPUT_PATH = "./manila_subway_data.json"
FRONTEND_OUTPUT_PATH = "../transit-engine-frontend/src/data/manila_subway_data.json"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the Haversine distance in meters between two points on the Earth.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def parse_time_to_minutes(time_str: str) -> float:
    """
    Parses a time string HH:MM:SS into the total number of minutes.
    Handles GTFS hours > 23 (e.g., 25:30:00).
    """
    parts = time_str.strip().split(':')
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = int(parts[2])
    return hours * 60 + minutes + seconds / 60.0


def format_minutes_to_time(total_minutes: float) -> str:
    """
    Formats total minutes into an HH:MM string (modulo 24 hours).
    """
    hours = int(total_minutes // 60) % 24
    minutes = int(total_minutes % 60)
    return f"{hours:02d}:{minutes:02d}"


def calculate_headway_label(headway_secs_list: List[int]) -> str:
    """
    Converts list of headway seconds into a readable label (e.g., "Every 3-5 mins").
    """
    if not headway_secs_list:
        return "Every 5 mins"
    
    minutes_list = [round(sec / 60.0, 1) for sec in headway_secs_list]
    min_m = min(minutes_list)
    max_m = max(minutes_list)

    # Format float nicely (strip .0)
    def fmt(val):
        return str(int(val)) if val.is_integer() else str(val)

    if min_m == max_m:
        return f"Every {fmt(min_m)} mins"
    else:
        return f"Every {fmt(min_m)}-{fmt(max_m)} mins"


def main():
    print("Starting GTFS parsing script...")
    
    # 1. Load GTFS tables
    try:
        routes_df = pd.read_csv(os.path.join(DATA_DIR, "routes.txt"))
        stops_df = pd.read_csv(os.path.join(DATA_DIR, "stops.txt"))
        trips_df = pd.read_csv(os.path.join(DATA_DIR, "trips.txt"))
        stop_times_df = pd.read_csv(os.path.join(DATA_DIR, "stop_times.txt"))
        frequencies_df = pd.read_csv(os.path.join(DATA_DIR, "frequencies.txt"))
    except FileNotFoundError as err:
        print(f"Error: GTFS files not found. {err}")
        print("Make sure this script is run inside the 'transit-engine-backend' directory.")
        sys.exit(1)

    # Dictionary to collect results
    lines_data = []

    # Map stop_id to parsed info for distance/transfer computation later
    all_stations_flat = []

    for route_id, info in ROUTES_MAP.items():
        print(f"Processing line: {info['name']} ({route_id})")
        
        # Filter trips for the route
        r_trips = trips_df[trips_df["route_id"] == route_id]
        if r_trips.empty:
            print(f"  Warning: No trips found for route {route_id}")
            continue
            
        r_trip_ids = r_trips["trip_id"].unique()

        # Find headways in frequencies
        r_freqs = frequencies_df[frequencies_df["trip_id"].isin(r_trip_ids)]
        headway_label = "Every 5 mins"
        if not r_freqs.empty:
            headways = list(r_freqs["headway_secs"].unique())
            headway_label = calculate_headway_label(headways)
            print(f"  Headway calculated: {headway_label}")

        # Get stop sequences for the trips.
        # We find the trip with the maximum number of stop times to construct the full station sequence.
        trip_counts = stop_times_df[stop_times_df["trip_id"].isin(r_trip_ids)].groupby("trip_id").size()
        if trip_counts.empty:
            print(f"  Warning: No stop times found for route {route_id}")
            continue
            
        longest_trip_id = trip_counts.idxmax()
        longest_trip_stops = stop_times_df[stop_times_df["trip_id"] == longest_trip_id].sort_values("stop_sequence")
        
        # Merge to get coordinates and names
        merged_stops = longest_trip_stops.merge(stops_df, on="stop_id")

        # Get stop_times on all trips for this route to calculate first/last train timings per stop
        r_st = stop_times_df[stop_times_df["trip_id"].isin(r_trip_ids)]
        r_st_with_freq = r_st.merge(r_freqs, on="trip_id")

        # Parse relative times and base trip times
        r_st_with_freq["rel_arr"] = r_st_with_freq["arrival_time"].apply(parse_time_to_minutes)
        r_st_with_freq["rel_dep"] = r_st_with_freq["departure_time"].apply(parse_time_to_minutes)
        r_st_with_freq["trip_start"] = r_st_with_freq["start_time"].apply(parse_time_to_minutes)
        r_st_with_freq["trip_end"] = r_st_with_freq["end_time"].apply(parse_time_to_minutes)

        # Calculate absolute arrival/departure times at each stop
        r_st_with_freq["abs_arrival"] = r_st_with_freq["trip_start"] + r_st_with_freq["rel_arr"]
        r_st_with_freq["abs_departure"] = r_st_with_freq["trip_end"] + r_st_with_freq["rel_dep"]

        # Group by stop_id to find first (min absolute arrival) and last (max absolute departure)
        timings = r_st_with_freq.groupby("stop_id").agg(
            first_train_mins=("abs_arrival", "min"),
            last_train_mins=("abs_departure", "max")
        ).reset_index()

        timings["first_train"] = timings["first_train_mins"].apply(format_minutes_to_time)
        timings["last_train"] = timings["last_train_mins"].apply(format_minutes_to_time)
        timing_map = timings.set_index("stop_id")[["first_train", "last_train"]].to_dict(orient="index")

        # Build list of stations for this line
        line_stations = []
        for idx, row in enumerate(merged_stops.itertuples(), 1):
            stop_id = row.stop_id
            
            # Retrieve operating timings
            stop_timings = timing_map.get(stop_id, {"first_train": "05:00", "last_train": "22:00"})

            # Clean name (e.g. Taft Ave MRT -> Taft Ave, Betty Go Belmonte LRT -> Betty Go Belmonte)
            name_clean = row.stop_name
            for suffix in [" MRT", " LRT", " LRT Station", " LRT-1", " LRT-2", " MRT-3"]:
                if name_clean.endswith(suffix):
                    name_clean = name_clean[:-len(suffix)]

            station_info = {
                "id": stop_id,
                "sequence": idx,
                "name": name_clean,
                "full_name": row.stop_name,
                "coordinates": {"lat": float(row.stop_lat), "lng": float(row.stop_lon)},
                "transfer_lines": [],  # Computed in post-processing
                "first_train": stop_timings["first_train"],
                "last_train": stop_timings["last_train"],
                "line_id": info["line_id"]
            }
            line_stations.append(station_info)
            all_stations_flat.append(station_info)

        lines_data.append({
            "id": info["line_id"],
            "name": info["name"],
            "full_name": info["full_name"],
            "color": info["color"],
            "text_color": info["text_color"],
            "headway": headway_label,
            "stations": line_stations
        })

    # =====================================================================
    # 4. COMPUTE TRANSFERS Programmatically
    # =====================================================================
    print("Computing transfers programmatically...")
    # Distance threshold: 450 meters (typical walking transfer distance)
    TRANSFER_THRESHOLD_METERS = 450.0

    for s1 in all_stations_flat:
        for s2 in all_stations_flat:
            # Must be different transit lines
            if s1["line_id"] == s2["line_id"]:
                continue
                
            dist = haversine_distance(
                s1["coordinates"]["lat"], s1["coordinates"]["lng"],
                s2["coordinates"]["lat"], s2["coordinates"]["lng"]
            )
            
            if dist <= TRANSFER_THRESHOLD_METERS:
                line_name = [l["name"] for l in lines_data if l["id"] == s2["line_id"]][0]
                if line_name not in s1["transfer_lines"]:
                    s1["transfer_lines"].append(line_name)

    # Save to the JSON structure
    output_data = {"lines": lines_data}

    # Write output to files
    try:
        # Write to backend path
        with open(BACKEND_OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"Backend output successfully written to: {BACKEND_OUTPUT_PATH}")

        # Ensure target directory exists for frontend
        frontend_dir = os.path.dirname(FRONTEND_OUTPUT_PATH)
        os.makedirs(frontend_dir, exist_ok=True)

        # Write to frontend path
        with open(FRONTEND_OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        print(f"Frontend output successfully written to: {FRONTEND_OUTPUT_PATH}")
    except Exception as e:
        print(f"Error saving JSON files: {e}")


if __name__ == "__main__":
    main()
