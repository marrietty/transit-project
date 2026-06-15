# Transpec — Metro Manila Transit Congestion Predictor

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?logo=fastapi&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

An open-source MRT/LRT queue congestion predictor for Metro Manila commuters. Built with crowdsourced reports and a hybrid ML model to give real-time congestion estimates when no official data feed is available.

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [How the Prediction Engine Works](#how-the-prediction-engine-works)
- [Tech Stack](#tech-stack)
- [Running Locally](#running-locally)
- [Datasets](#datasets)
- [Collaborators](#collaborators)
- [License](#license)

---

## About

Transpec is a crowdsourced congestion forecasting tool built for daily Metro Manila commuters. It fills the gap left by the absence of a real-time official data feed by combining a static time-of-day baseline with live user-reported signals, processed through a trained machine learning classifier on the backend.

This project is structured as a monorepo with a React + TypeScript frontend and a Python FastAPI backend.

---

## Features

- Predicts station congestion level (Low / Moderate / High) per line and time slot
- Hybrid prediction: static peak/off-peak baseline + live crowdsource override
- Passive telemetry logging from in-app transit tap events
- Real-time dashboard with per-station status cards
- Supabase-backed live report feed with sub-second sync

---

## How the Prediction Engine Works

- **Baseline fallback** — If no recent crowd data exists, the system defaults to a pre-computed peak/off-peak schedule derived from historical MRT-3, LRT-1, and LRT-2 ridership patterns.
- **Dynamic override** — Active user clicks and passive transit telemetry from the last 30 minutes are fed into a trained `RandomForestClassifier` (Scikit-Learn) that overrides the baseline when enough recent signals are available.
- **Confidence threshold** — The ML override only fires when the rolling 30-minute sample count exceeds a minimum threshold; below it, the baseline prediction is shown with a reduced-confidence indicator.

---

## Tech Stack

### Frontend

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI library |
| TypeScript | latest | Type-safe JavaScript |
| Vite | 6 | Build tool and dev server |
| Tailwind CSS | v4 | Utility-first styling |
| Lucide React | latest | Icon pack |

### Backend

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.12 | Runtime |
| FastAPI | latest | REST API framework |
| Uvicorn | latest | ASGI server |
| Scikit-Learn | latest | ML classifier (`RandomForestClassifier`) |
| Pandas | latest | Data preprocessing |
| Joblib | latest | Model serialization (`model.joblib`) |
| Supabase Python Client | latest | Real-time database integration |
| python-dotenv | latest | Environment variable loading |

---

## Running Locally

**1. Clone the repository**

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

Start the FastAPI server

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

| Dataset | Source | Use |
|---|---|---|
| Manila GTFS | [TUMI Datahub](https://ckan.transport-data.org/en_GB/dataset/gtfs-manila) | Authoritative stop and timetable data to replace the hand-coded schedule baseline |
| Historical ridership mock data | Locally generated | Simulated hourly tap-in/tap-out volumes used to train the crowd forecasting model |

---

## Collaborators

| Name | Student ID | Role |
|---|---|---|
| — | — | Add team members here |

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

**Marie Criz Zaragoza** · Student ID: 26040022 · Introduction to Open Source Software
