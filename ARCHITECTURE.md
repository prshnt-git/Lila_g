# ARCHITECTURE

## What I built
I built a browser-based player journey visualization tool for LILA Games’ Level Design team.

The tool has two main surfaces:

- **Map Insights**: aggregated map-level view for combat pressure, storm pressure, loot density, and underused spaces
- **Explorer**: per-sample inspection view with playback, player paths, and event markers

## Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast iteration, clean component structure, easy deployment |
| Rendering | SVG overlays on minimap images | Precise control over paths, markers, and heatmaps |
| Data processing | Python | Best fit for parquet parsing and transformation |
| Hosting | Vercel | Fastest path to a shareable URL |

## Data flow

1. Raw gameplay parquet files are provided in `data_raw/`
2. `scripts/inspect_data.py` reads and processes the raw telemetry
3. The preprocessing step:
   - decodes event payloads
   - normalizes event types
   - identifies humans vs bots
   - converts world positions into minimap coordinates
   - exports processed JSON files
4. The processed output is stored in `data_processed/`
5. The frontend in `lila-ops/` loads processed JSON and renders:
   - overview heatmaps
   - player paths
   - event markers
   - sample playback

## Coordinate mapping approach

The raw game data uses world-space coordinates, while the visualization uses a 2D minimap image.

For each map, I used map-specific origin and scale values to convert world coordinates into minimap coordinates.

Conceptually:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
pixel_x = u * map_width
pixel_y = (1 - v) * map_height