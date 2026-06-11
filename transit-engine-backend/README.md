# Metro Manila Transit Monitoring & ML Prediction Backend

This is the Python-based backend that connects to a Supabase database to query transit station reports, trains a Machine Learning model using synthetic data to predict congestion, and serves live predictions via FastAPI.

## Features

1. **Database Querying (`query_reports.py`)**:
   - Standalone CLI utility querying reports submitted in the last 30 minutes from the `station_reports` Supabase table.
   - Computes live count of reports (`recent_report_count`) and congestion averages (`recent_report_average`).

2. **Machine Learning Model (`train_and_serve.py`)**:
   - **Synthetic Data Generation**: Synthesizes 5,000 commuter reports matching real Manila transit rush hour profiles (weekday peaks 7-9 AM, 5-7 PM, and report average correlations).
   - **Model Training**: Splits data and trains a robust `RandomForestClassifier` mapping hour, day, report count, and average to `predicted_congestion` (1 = Clear, 2 = Moderate, 3 = Heavy).
   - **Model Serialization**: Saves the classifier as `model.joblib`.

3. **FastAPI Server (`train_and_serve.py` / `main.py`)**:
   - Exposes `GET /api/status/{station_id}`.
   - Merges live Supabase metrics with the current server's hour of the day and day of week.
   - Runs model inference to return the final predicted congestion level (`predicted_congestion`).
   - Automatically detects if `model.joblib` is missing at server startup and triggers training.

---

## Setup Instructions

### 1. Prerequisites
- **Python 3.8+**
  ```bash
  python --version
  ```

### 2. Create and Activate a Virtual Environment
**On Windows (PowerShell)**:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**On macOS/Linux (Bash/Zsh)**:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org --trusted-host pypi.python.org
```

### 4. Configure Credentials
Ensure your `.env` file exists in the `transit-engine-backend` directory containing:
```env
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_KEY="your-anon-or-service-role-key"
```

---

## Usage Guide

### A. Run Machine Learning Training
You can manually generate synthetic records, train the model, and print accuracy metrics by running:
```bash
python train_and_serve.py --train
```

### B. Run the FastAPI Web Server
To start the FastAPI server with auto-reload:
```bash
uvicorn train_and_serve:app --reload
```

- If `model.joblib` does not exist, the server will **automatically** run the training pipeline first.
- Explore the interactive Swagger UI documentation at **`http://127.0.0.1:8000/docs`**.
- Fetch station status & ML predictions:
  ```
  http://127.0.0.1:8000/api/status/mrt3-ayala
  ```
  **Response JSON format**:
  ```json
  {
    "station_id": "mrt3-ayala",
    "recent_report_count": 4,
    "recent_report_average": 2.25,
    "server_hour": 17,
    "server_day_of_week": 2,
    "predicted_congestion": 3
  }
  ```
