#!/usr/bin/env python3
import argparse
import json
import os
import time
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np
from aiohttp import WSMsgType, web


@dataclass
class FrameStats:
    total_frames: int = 0
    window_frames: int = 0
    decode_failures: int = 0
    total_bytes: int = 0
    window_bytes: int = 0
    last_report_ts: float = 0.0
    last_frame_ts: float = 0.0
    ewma_fps: float = 0.0


@dataclass
class FrameOutputConfig:
    preview: bool = False
    snapshot_dir: Optional[str] = None
    snapshot_every: int = 30
    window_name: str = "FPV"


OUTPUT_CONFIG = FrameOutputConfig()


def process_video_frame(frame_array, timestamp_sec: Optional[float], frame_count: int) -> None:
    _ = timestamp_sec
    if OUTPUT_CONFIG.preview:
        cv2.imshow(OUTPUT_CONFIG.window_name, frame_array)
        cv2.waitKey(1)

    if OUTPUT_CONFIG.snapshot_dir and frame_count % max(1, OUTPUT_CONFIG.snapshot_every) == 0:
        ts_ms = int((timestamp_sec or time.time()) * 1000)
        file_name = f"frame_{frame_count:07d}_{ts_ms}.jpg"
        out_path = os.path.join(OUTPUT_CONFIG.snapshot_dir, file_name)
        cv2.imwrite(out_path, frame_array)


async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=20, max_msg_size=8 * 1024 * 1024)
    await ws.prepare(request)

    peer_id = f"peer-{id(ws)}"
    stats = FrameStats(last_report_ts=time.perf_counter())
    stream_meta = {}
    print(f"[{peer_id}] connected")

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    payload = json.loads(msg.data)
                except json.JSONDecodeError:
                    await ws.send_json({"type": "error", "message": "Invalid JSON"})
                    continue

                msg_type = payload.get("type")
                if msg_type == "start":
                    stats = FrameStats(last_report_ts=time.perf_counter())
                    stream_meta = payload.get("meta") or {}
                    source = stream_meta.get("source", "unknown")
                    camera_mode = stream_meta.get("cameraMode", "unknown")
                    width = stream_meta.get("width")
                    height = stream_meta.get("height")
                    fps = stream_meta.get("fps")
                    frame_format = stream_meta.get("format", "unknown")
                    quality = stream_meta.get("quality")
                    print(
                        f"[{peer_id}] start source={source} camera={camera_mode} "
                        f"requested={width}x{height}@{fps} format={frame_format} quality={quality}"
                    )
                    await ws.send_json({"type": "ack", "message": "stream-started"})
                    continue

                if msg_type == "stop":
                    print(f"[{peer_id}] stop")
                    await ws.send_json({"type": "ack", "message": "stream-stopped"})
                    continue

                if msg_type == "ping":
                    await ws.send_json({"type": "pong", "ts": time.time()})
                    continue

                await ws.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})
                continue

            if msg.type == WSMsgType.BINARY:
                now_perf = time.perf_counter()
                payload_size = len(msg.data)
                encoded = np.frombuffer(msg.data, dtype=np.uint8)
                frame_array = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
                if frame_array is None:
                    stats.decode_failures += 1
                    await ws.send_json({"type": "error", "message": "Failed to decode JPEG frame"})
                    continue

                stats.total_frames += 1
                stats.window_frames += 1
                stats.total_bytes += payload_size
                stats.window_bytes += payload_size

                if stats.last_frame_ts > 0.0:
                    dt = now_perf - stats.last_frame_ts
                    if dt > 0.0:
                        instant_fps = 1.0 / dt
                        if stats.ewma_fps == 0.0:
                            stats.ewma_fps = instant_fps
                        else:
                            stats.ewma_fps = (0.2 * instant_fps) + (0.8 * stats.ewma_fps)
                stats.last_frame_ts = now_perf

                process_video_frame(frame_array, time.time(), stats.total_frames)

                now = time.perf_counter()
                elapsed = now - stats.last_report_ts
                if elapsed >= 1.0:
                    height, width = frame_array.shape[:2]
                    ingest_fps = stats.window_frames / elapsed if elapsed > 0 else 0.0
                    throughput_mbps = (stats.window_bytes * 8.0) / elapsed / 1_000_000 if elapsed > 0 else 0.0
                    print(
                        f"[{peer_id}] video {width}x{height} @ {ingest_fps:.1f} fps "
                        f"(ewma {stats.ewma_fps:.1f}, {throughput_mbps:.2f} Mbps, "
                        f"total={stats.total_frames}, decode_fail={stats.decode_failures})"
                    )
                    stats.window_frames = 0
                    stats.window_bytes = 0
                    stats.last_report_ts = now
                continue

            if msg.type == WSMsgType.ERROR:
                print(f"[{peer_id}] websocket error: {ws.exception()}")
    finally:
        print(f"[{peer_id}] disconnected")

    return ws


async def healthcheck_handler(_request):
    return web.json_response({"status": "ok"})


def create_app():
    app = web.Application()
    app.router.add_get("/healthz", healthcheck_handler)
    app.router.add_get("/fpv", websocket_handler)
    return app


def parse_args():
    parser = argparse.ArgumentParser(description="WebSocket FPV receiver for browser canvas stream")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9001)
    parser.add_argument("--preview", action="store_true", help="Show live frames in an OpenCV window")
    parser.add_argument("--snapshot-dir", default="", help="Directory to save JPEG snapshots")
    parser.add_argument(
        "--snapshot-every",
        type=int,
        default=30,
        help="Save one snapshot every N frames (default: 30)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    snapshot_dir = args.snapshot_dir.strip() or None
    if snapshot_dir:
        os.makedirs(snapshot_dir, exist_ok=True)

    OUTPUT_CONFIG.preview = bool(args.preview)
    OUTPUT_CONFIG.snapshot_dir = snapshot_dir
    OUTPUT_CONFIG.snapshot_every = max(1, int(args.snapshot_every))

    app = create_app()
    print(f"Starting WebSocket FPV server on ws://{args.host}:{args.port}/fpv")
    if OUTPUT_CONFIG.preview:
        print("OpenCV preview enabled")
    if OUTPUT_CONFIG.snapshot_dir:
        print(f"Saving snapshots to {OUTPUT_CONFIG.snapshot_dir} every {OUTPUT_CONFIG.snapshot_every} frames")

    web.run_app(app, host=args.host, port=args.port)
