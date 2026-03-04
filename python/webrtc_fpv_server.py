#!/usr/bin/env python3
import argparse
import asyncio
import contextlib
import json
import os
import time
from dataclasses import dataclass
from typing import Optional

import cv2
from aiohttp import WSMsgType, web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp


@dataclass
class FrameStats:
    count: int = 0
    last_report_ts: float = 0.0
    fps: float = 0.0


@dataclass
class FrameOutputConfig:
    preview: bool = False
    snapshot_dir: Optional[str] = None
    snapshot_every: int = 30
    window_name: str = "FPV"


OUTPUT_CONFIG = FrameOutputConfig()


def process_video_frame(frame_array, timestamp_sec: Optional[float], frame_count: int) -> None:
    _ = frame_array
    _ = timestamp_sec
    if OUTPUT_CONFIG.preview:
        cv2.imshow(OUTPUT_CONFIG.window_name, frame_array)
        cv2.waitKey(1)

    if OUTPUT_CONFIG.snapshot_dir and frame_count % max(1, OUTPUT_CONFIG.snapshot_every) == 0:
        ts_ms = int((timestamp_sec or time.time()) * 1000)
        file_name = f"frame_{frame_count:07d}_{ts_ms}.jpg"
        out_path = os.path.join(OUTPUT_CONFIG.snapshot_dir, file_name)
        cv2.imwrite(out_path, frame_array)

async def consume_video_track(track, peer_id: str) -> None:
    stats = FrameStats(last_report_ts=time.time())
    while True:
        frame = await track.recv()
        stats.count += 1

        frame_array = frame.to_ndarray(format="bgr24")
        process_video_frame(frame_array, frame.time, stats.count)

        now = time.time()
        elapsed = now - stats.last_report_ts
        if elapsed >= 1.0:
            stats.fps = stats.count / elapsed
            height, width = frame_array.shape[:2]
            print(f"[{peer_id}] video {width}x{height} @ {stats.fps:.1f} fps")
            stats.count = 0
            stats.last_report_ts = now


def parse_candidate(candidate_payload):
    if isinstance(candidate_payload, str):
        candidate_sdp = candidate_payload
        sdp_mid = None
        sdp_mline_index = None
        username_fragment = None
    else:
        candidate_sdp = candidate_payload.get("candidate", "")
        sdp_mid = candidate_payload.get("sdpMid")
        sdp_mline_index = candidate_payload.get("sdpMLineIndex")
        username_fragment = candidate_payload.get("usernameFragment")

    if not candidate_sdp:
        return None

    if candidate_sdp.startswith("candidate:"):
        candidate_sdp = candidate_sdp.split(":", 1)[1]

    candidate = candidate_from_sdp(candidate_sdp)
    candidate.sdpMid = sdp_mid
    candidate.sdpMLineIndex = sdp_mline_index
    candidate.usernameFragment = username_fragment
    return candidate


async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)

    peer = None
    track_task = None
    peer_id = f"peer-{id(ws)}"
    print(f"[{peer_id}] signaling connected")

    async def close_peer():
        nonlocal peer, track_task
        if track_task is not None:
            track_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await track_task
            track_task = None

        if peer is not None:
            await peer.close()
            peer = None

    async def ensure_peer():
        nonlocal peer, track_task
        if peer is not None:
            return peer

        peer = RTCPeerConnection()

        @peer.on("track")
        def on_track(track):
            nonlocal track_task
            print(f"[{peer_id}] track received: {track.kind}")
            if track.kind == "video":
                if track_task is not None:
                    track_task.cancel()
                track_task = asyncio.create_task(consume_video_track(track, peer_id))

        @peer.on("icecandidate")
        async def on_icecandidate(candidate):
            if candidate is None or ws.closed:
                return
            await ws.send_json(
                {
                    "type": "candidate",
                    "candidate": {
                        "candidate": f"candidate:{candidate.to_sdp()}",
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                        "usernameFragment": candidate.usernameFragment,
                    },
                }
            )

        @peer.on("connectionstatechange")
        async def on_connectionstatechange():
            current_peer = peer
            if current_peer is None:
                return
            state = current_peer.connectionState
            print(f"[{peer_id}] connection state: {state}")
            if state in {"failed", "closed", "disconnected"}:
                await close_peer()

        return peer

    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue

            try:
                payload = json.loads(msg.data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = payload.get("type")
            if msg_type == "offer":
                sdp = payload.get("sdp")
                if not sdp:
                    await ws.send_json({"type": "error", "message": "Missing offer sdp"})
                    continue

                meta = payload.get("meta") or {}
                requested_w = meta.get("width")
                requested_h = meta.get("height")
                requested_fps = meta.get("fps")
                source = meta.get("source", "unknown")
                camera_mode = meta.get("cameraMode", "unknown")
                print(
                    f"[{peer_id}] offer meta source={source} camera={camera_mode} "
                    f"requested={requested_w}x{requested_h}@{requested_fps}"
                )

                pc = await ensure_peer()
                await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type="offer"))
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                await ws.send_json({"type": "answer", "sdp": pc.localDescription.sdp})
                continue

            if msg_type == "candidate":
                current_peer = peer
                if current_peer is None:
                    continue
                candidate = parse_candidate(payload.get("candidate"))
                if candidate is None:
                    continue
                current_peer.addIceCandidate(candidate)
                continue

            if msg_type == "stop":
                await close_peer()
                continue

            await ws.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})
    finally:
        await close_peer()
        print(f"[{peer_id}] signaling disconnected")

    return ws


async def healthcheck_handler(_request):
    return web.json_response({"status": "ok"})


def create_app():
    app = web.Application()
    app.router.add_get("/healthz", healthcheck_handler)
    app.router.add_get("/webrtc", websocket_handler)
    return app


def parse_args():
    parser = argparse.ArgumentParser(description="WebRTC FPV receiver for browser canvas stream")
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
    print(f"Starting WebRTC FPV server on ws://{args.host}:{args.port}/webrtc")
    if OUTPUT_CONFIG.preview:
        print("OpenCV preview enabled")
    if OUTPUT_CONFIG.snapshot_dir:
        print(f"Saving snapshots to {OUTPUT_CONFIG.snapshot_dir} every {OUTPUT_CONFIG.snapshot_every} frames")
    web.run_app(app, host=args.host, port=args.port)
