<img width="1859" height="867" alt="image" src="https://github.com/user-attachments/assets/d51c2dcb-bb98-4c5f-ab16-a3ec59aa2995" /># LILA Player Ops

A web-based player journey visualization tool built for LILA Games’ Level Design team.

This project turns raw gameplay telemetry from **LILA BLACK** into a browser-based map analysis tool that helps level designers understand:

- where players move
- where combat happens
- where players die
- where storm pressure appears
- where loot concentrates
- which spaces are underused

## Live Demo

`https://lila-g.vercel.app/`
<img width="1859" height="867" alt="image" src="https://github.com/user-attachments/assets/3fe6a960-af79-45ec-9da8-b3f0e5619c62" />


## What’s included

This repo contains:

- **Frontend app** in `lila-ops/`
- **Preprocessing script** in `scripts/inspect_data.py`
- **Processed visualization data** in `data_processed/`
- **Original provided dataset** in `data_raw/`

## Features implemented

- Parse and preprocess gameplay parquet data
- Render player journeys on the correct minimap
- Distinguish human players and bots visually
- Show kill, death, loot, and storm events as distinct markers
- Filter by map and match
- Timeline/playback for sample match inspection
- Heatmap overlays for combat, death, storm pressure, and loot density
- Browser-based workflow intended for level-design use

## Repo structure

```text
Lila_g/
├─ README.md
├─ ARCHITECTURE.md
├─ INSIGHTS.md
├─ data_raw/
├─ data_processed/
├─ scripts/
│  └─ inspect_data.py
└─ lila-ops/
   ├─ src/
   ├─ public/
   ├─ package.json
   └─ ...

   Tech stack
Frontend: React + TypeScript + Vite
Rendering: SVG overlays on top of minimap images
Data preparation: Python
Hosting: Vercel / Netlify
How data flows
Raw gameplay data is provided in parquet files inside data_raw/.
scripts/inspect_data.py reads and transforms the raw data.
It writes processed outputs into data_processed/.
The frontend in lila-ops/ loads processed JSON and renders:
map overview insights
heatmaps
sample explorer playback
Local setup
Install frontend dependencies
cd lila-ops
npm install
Run the frontend
cd lila-ops
npm run dev
Re-run preprocessing

From repo root:

python scripts/inspect_data.py
Notes / assumptions
-The browser app is built around processed JSON outputs, not direct parquet parsing in the frontend.
-The explorer is designed as a sample inspector, not a full replay system.
-The overview uses a curated usable sample set for responsiveness and clarity.
-The project prioritizes level-designer readability over analytics-dashboard complexity.

Author note

This project was built with a map-first product approach for level designers rather than analysts. The goal was to make gameplay patterns easy to inspect visually and quickly.
