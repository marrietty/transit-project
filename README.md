# Transpec

An open-source MRT/LRT queue congestion predictor for Metro Manila commuters. Built with crowdsourced reports and a hybrid ML model to give real-time congestion estimates when no official data feed is available.

---

## Features

- Predicts station congestion level (Low / Moderate / High) per line and time slot
- Hybrid prediction: static time-of-day baseline + dynamic crowdsource override
- Passive telemetry logging from in-app transit tap events
- Real-time dashboard with per-station status cards
- Supabase-backed live report feed with sub-second sync

---

## How the Prediction Engine Works

- **Baseline fallback** — If no recent crowd data exists, the system defaults to a pre-computed peak/off-peak schedule derived from historical MRT-3, LRT-1, and LRT-2 ridership patterns.
- **Dynamic override** — Active user clicks and passive transit telemetry from the last 30 minutes are fed into a trained `RandomForestClassifier` (Scikit-Learn) that overrides the baseline when enough recent signals are available.
- **Confidence threshold** — The ML override only fires when the rolling 30-minute sample count exceeds a minimum threshold; below it, the baseline prediction is displayed with a reduced-confidence indicator.

---

## Tech Stack

**Frontend**
- React 19
- TypeScript
- Vite 6
- Tailwind CSS v4
- Lucide React

**Backend**
- Python 3.12
- FastAPI
- Uvicorn
- Scikit-Learn
- Pandas
- Joblib
- Supabase Python Client
- python-dotenv

---

## Running Locally

**1. Clone the repo**

```bash
git clone https://github.com/marrietty/transit-project.git
cd transpec
```

**2. Backend**

Create and activate a virtual environment:

```bash
python -m venv .venv
```

```bash
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server. Running `train_and_serve:app` automatically handles ML model training on startup if `model.joblib` is missing:

```bash
uvicorn train_and_serve:app --reload
```

**3. Frontend**

```bash
cd transit-engine-frontend
npm install && npm run dev
```

The frontend runs on `http://localhost:5173` and the API on `http://localhost:8000` by default.

---

## Datasets

- **GTFS** — Official Manila GTFS dataset from [TUMI Datahub](https://ckan.transport-data.org/en_GB/dataset/gtfs-manila), used to replace the hand-coded schedule baseline with authoritative stop and timetable data.
- **Historical ridership mock data** — Simulated hourly tap-in/tap-out volumes used to supplement static GTFS schedules and train the crowd forecasting model.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
