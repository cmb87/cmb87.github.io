# VTOL Flight Visualizer

Interactive React + Three.js viewer with two modes:

- **Log Analyzer**: replay PX4 ULog missions with timeline scrub/playback.
- **Simulator**: connect to a live websocket stream and render SITL ground-truth in real time.

Both modes share the same STL model pipeline (bundled tailsitter STL, dummy model, or uploaded STL).

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) and choose a tab in the header:

- **Log Analyzer**: load your own `.ulg` via the sidebar.
- **Simulator**: set websocket host/port (defaults `127.0.0.1:8765`) and click **Connect**.

Use the **Vehicle mesh** controls in either mode to switch between the bundled STL (`public/tailsitter.stl`), dummy cubes, or an uploaded `.stl`.

> **Node requirement:** The project is set up with Vite 4 so it works on Node 16+, although some upstream packages (for example `camera-controls`) emit warnings when Node < 22. The dev server still runs normally on Node 16/18/20.

## Features

- Parses `vehicle_attitude` and `vehicle_local_position` topics in-browser via `@foxglove/ulog`.
- Converts PX4 NED coordinates to the scene frame, centers the track, and animates the STL with quaternion slerp interpolation.
- Streams simulator ground-truth telemetry over websocket (default `ws://127.0.0.1:8765`) for live visualization.
- Simulator scene toggle between the existing 3D flight view and a geo-referenced satellite tile scene (`/public/satellite/tiles`).
- Tailsitter-aware orientation offset so pitch `0°` renders the aircraft standing nose-up.
- Ground plane + tracked path for visual context and orientation aids.
- Artificial-horizon widget synced to the telemetry overlay, plus play/pause, scrub, and playback-speed controls.
- Glassmorphic telemetry overlay showing time, attitude, altitude, airspeed, and E/U/-N velocity.
- Bundled STL + selectable dummy body so the viewer works out-of-the-box.
- Browser websocket streaming of the active scene canvas (including first-person camera) to a Python backend.
- FPV streaming controls for capture width, height, and FPS before starting a stream.

## Satellite tile mode setup

The simulator supports a second renderer that uses pre-downloaded zoom-19 tiles + HDR environment.

Expected asset layout (preferred):

```text
public/
  satellite/
    tiles/
      map.csv
      tile_z19_x..._y....png
    hdr/
      kloppenheim_07_puresky_1k.exr
```

If your source app is at `/home/cp/projects-temp/20_uav/03-simulation/project-visnav/app/map-app-satelitte`, copy:

- `/public/tiles/*` -> `this-repo/public/satellite/tiles/`
- `/public/hdr/kloppenheim_07_puresky_1k.exr` -> `this-repo/public/satellite/hdr/`

Then run `npm run dev`, open **Simulator**, and switch **Scene** to **Satellite tiles**.

The loader also supports legacy paths (`/tiles/map.csv`, `/tiles/*.png`, `/hdr/*.exr`) as a fallback.

The satellite scene now lazy-loads nearby tiles around the active vehicle and unloads far-away tiles to keep GPU memory bounded.

## WebSocket FPV stream contract

The sidebar **FPV Stream** panel sends JPEG frames over websocket and uses simple control JSON:

- Browser -> backend:
  - `{ "type": "start", "meta": { "source": "fpv-canvas", "cameraMode": "follow-first", "width": 1280, "height": 720, "fps": 30, "format": "image/jpeg", "quality": 0.75 } }`
  - binary websocket messages containing one JPEG-encoded frame each
  - `{ "type": "stop" }`
- Backend -> browser:
  - `{ "type": "ack", "message": "stream-started" }`
  - `{ "type": "ack", "message": "stream-stopped" }`
  - optional `{ "type": "error", "message": "..." }`

The default stream endpoint is `ws://127.0.0.1:9001/fpv`.

## Python websocket receiver example

An example backend is included at `python/ws_fpv_server.py`.

Install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/requirements-ws.txt
```

Run the backend:

```bash
python python/ws_fpv_server.py --host 127.0.0.1 --port 9001
```

In the app sidebar **FPV Stream** panel, keep the default websocket URL `ws://127.0.0.1:9001/fpv` and click **Start Stream**.

## Building for production

```bash
npm run build
npm run preview
```

`npm run build` outputs a static bundle in `dist/` that can be hosted on any static site host.
