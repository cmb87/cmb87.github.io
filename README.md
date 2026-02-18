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

- **Log Analyzer**: load your own `.ulg` via the sidebar, or click **Load sample flight** to use `public/sample-flight.ulg`.
- **Simulator**: set websocket host/port (defaults `127.0.0.1:8765`) and click **Connect**.

Use the **Vehicle mesh** controls in either mode to switch between the bundled STL (`public/tailsitter.stl`), dummy cubes, or an uploaded `.stl`.

> **Node requirement:** The project is set up with Vite 4 so it works on Node 16+, although some upstream packages (for example `camera-controls`) emit warnings when Node < 22. The dev server still runs normally on Node 16/18/20.

## Features

- Parses `vehicle_attitude` and `vehicle_local_position` topics in-browser via `@foxglove/ulog`.
- Converts PX4 NED coordinates to the scene frame, centers the track, and animates the STL with quaternion slerp interpolation.
- Streams simulator ground-truth telemetry over websocket (default `ws://127.0.0.1:8765`) for live visualization.
- Tailsitter-aware orientation offset so pitch `0°` renders the aircraft standing nose-up.
- Ground plane + tracked path for visual context and orientation aids.
- Artificial-horizon widget synced to the telemetry overlay, plus play/pause, scrub, and playback-speed controls.
- Glassmorphic telemetry overlay showing time, attitude, altitude, airspeed, and E/U/-N velocity.
- Bundled STL + demo log so the viewer works out-of-the-box (plus a selectable dummy body for debugging).

## Building for production

```bash
npm run build
npm run preview
```

`npm run build` outputs a static bundle in `dist/` that can be hosted on any static site host.
