# NASA CLPS Lunar Mission Browser 🚀🌕

An interactive 3D geospatial dashboard for exploring NASA's **Commercial Lunar Payload Services (CLPS)** missions, landing coordinates, lunar surface environments, and real-time celestial telemetry.

---

## 🌟 Key Features

- **Interactive 3D Lunar Globe**: Built with Three.js WebGL rendering, custom crater and albedo textures, atmosphere glow, and landing coordinates mapped to lunar lat/long.
- **CLPS Landing Site Pins**: Highlighting missions like Peregrine-1, Nova-C (Intuitive Machines IM-1 & IM-2), Blue Ghost M1, Griffin Mission One (VIPER), and more with status indicators (Landed, Planned, Anomaly).
- **Ephemeris & Astronomical Telemetry Engine**: Computes sub-solar points, solar elevation/azimuth, Earth visibility, and synodic phase angles.
- **Synodic Illumination & Horizon Forecasts**: 29.5-day synodic lunar day/night cycles, horizon gauges, and power generation window estimations.
- **Dual Architecture**:
  - **Frontend**: Vite + React + TypeScript + Three.js + Lucide Icons.
  - **Backend**: FastAPI Python backend for SPICE / Skyfield / IAU celestial ephemeris calculations and PostgreSQL/PostGIS spatial schema.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+) & npm
- Python 3.10+

---

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

---

### 2. Backend Setup (FastAPI Astro Engine)

```bash
# From the root directory:
pip install fastapi uvicorn pydantic skyfield
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

The API docs and Swagger UI will be available at `http://localhost:8000/docs`.

---

## 📂 Project Structure

```
NASA/
├── backend/
│   ├── astro_engine.py    # Lunar ephemeris & solar/earth horizon algorithms
│   ├── main.py            # FastAPI REST endpoints
│   ├── missions_db.py     # NASA CLPS mission catalog & data structures
│   └── test_astro.py      # Automated tests for astronomical calculations
├── frontend/
│   ├── src/
│   │   ├── components/    # 3D LunarGlobe, Gauges, Mission Panels, Timeline
│   │   ├── data/          # Offline/client mission fallback data
│   │   ├── types/         # TypeScript interfaces (verbatimModuleSyntax compliant)
│   │   └── utils/         # Client-side IAU ephemeris fallback calculator
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── data/
│   └── schema.sql         # PostGIS / PostgreSQL schema for spatial queries
├── .gitignore
└── README.md
```

---

## 🛰️ NASA CLPS Missions Included
- **Astrobotic Peregrine Mission 1** (Sinus Viscositatis) — Status: Anomaly (Jan 2024 re-entry)
- **Intuitive Machines IM-1 / Odysseus** (Malapert A, South Pole) — Status: Landed (Feb 2024)
- **Intuitive Machines IM-2 / Athena** (Mons Mouton, South Pole) — Status: Landed (Mar 6, 2025)
- **Firefly Aerospace Blue Ghost Mission 1** (Mons Latreille, Mare Crisium) — Status: Landed (Mar 2, 2025)
- **Draper Series 2 / APEX 1.0** (Schrödinger Basin, Far Side) — Status: Cancelled (Jul 2026)
- **Astrobotic Griffin Mission 1** (Lunar South Pole, Site TBD) — Status: Upcoming (NET late 2026)
- **Intuitive Machines IM-3** (Reiner Gamma Swirl) — Status: Upcoming (early 2027)

---

## 🌌 Texture & Data Sources
- **Surface Imagery**: NASA LRO LROC WAC color mosaic (4096×2048) + LOLA laser altimetry DEM (2880×1440) from [SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720)
- **Normal Map**: DEM-derived tangent-space normals for crisp crater shading
- **Mission Data**: NASA CLPS program official sources, verified against NASA news releases and LROC landing region pages
- **Licensing**: All NASA imagery and data are public domain (credit requested per [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/))
