# VTOL Flight Visualizer

Interactive React + Three.js viewer that replays PX4 ULog missions with a tailsitter STL model. The scene renders the vehicle attitude/position stream, draws the ground track, and overlays live telemetry in the upper-right corner.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) and load your own `.ulg` file via the sidebar, or click **Load sample flight** to use the bundled log in `public/sample-flight.ulg`. Use the **Vehicle mesh** toggle to switch between the bundled STL (`public/tailsitter.stl`) and a simple cube-based dummy body if you want a guaranteed-visible reference model.

> **Node requirement:** The project is set up with Vite 4 so it works on Node 16+, although some upstream packages (for example `camera-controls`) emit warnings when Node < 22. The dev server still runs normally on Node 16/18/20.

## Features

- Parses `vehicle_attitude` and `vehicle_local_position` topics in-browser via `@foxglove/ulog`.
- Converts PX4 NED coordinates to the scene frame, centers the track, and animates the STL with quaternion slerp interpolation.
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
