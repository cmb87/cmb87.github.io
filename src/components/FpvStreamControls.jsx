import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_SIGNALING_URL = "ws://127.0.0.1:9001/webrtc";
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;
const MIN_DIMENSION = 160;
const MAX_DIMENSION = 3840;
const MIN_FPS = 1;
const MAX_FPS = 60;
const CAMERA_MODE_FOLLOW_FIRST = "follow-first";

function toMessageError(err, fallback) {
  return err?.message ?? fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function drawScaledCanvas(sourceCanvas, targetCanvas, context2d) {
  if (!sourceCanvas || !targetCanvas || !context2d) {
    return;
  }

  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const tw = targetCanvas.width;
  const th = targetCanvas.height;

  if (!sw || !sh || !tw || !th) {
    return;
  }

  const scale = Math.min(tw / sw, th / sh);
  const drawWidth = Math.max(1, Math.round(sw * scale));
  const drawHeight = Math.max(1, Math.round(sh * scale));
  const offsetX = Math.floor((tw - drawWidth) / 2);
  const offsetY = Math.floor((th - drawHeight) / 2);

  context2d.fillStyle = "#000";
  context2d.fillRect(0, 0, tw, th);
  context2d.drawImage(sourceCanvas, 0, 0, sw, sh, offsetX, offsetY, drawWidth, drawHeight);
}

export default function FpvStreamControls({ canvasElement, cameraMode }) {
  const [signalingUrl, setSignalingUrl] = useState(DEFAULT_SIGNALING_URL);
  const [captureWidthInput, setCaptureWidthInput] = useState(String(DEFAULT_WIDTH));
  const [captureHeightInput, setCaptureHeightInput] = useState(String(DEFAULT_HEIGHT));
  const [captureFpsInput, setCaptureFpsInput] = useState(String(DEFAULT_FPS));
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState(null);
  const [streaming, setStreaming] = useState(false);

  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const mediaRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const captureContextRef = useRef(null);
  const drawLoopFrameRef = useRef(null);
  const drawLoopRunningRef = useRef(false);

  const stopDrawLoop = useCallback(() => {
    drawLoopRunningRef.current = false;
    if (drawLoopFrameRef.current != null) {
      cancelAnimationFrame(drawLoopFrameRef.current);
      drawLoopFrameRef.current = null;
    }
  }, []);

  const stopStreaming = useCallback(() => {
    stopDrawLoop();

    const socket = socketRef.current;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "stop" }));
        }
      } catch {
        // Ignore signaling shutdown errors.
      }
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socketRef.current = null;
    }

    const peer = peerRef.current;
    if (peer) {
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();
      peerRef.current = null;
    }

    const media = mediaRef.current;
    if (media) {
      for (const track of media.getTracks()) {
        track.stop();
      }
      mediaRef.current = null;
    }

    captureContextRef.current = null;
    captureCanvasRef.current = null;
    setStreaming(false);
    setStatus("Stopped");
  }, [stopDrawLoop]);

  const startStreaming = useCallback(async () => {
    setError(null);

    if (!canvasElement) {
      setError("No active scene canvas to capture.");
      return;
    }

    if (typeof canvasElement.captureStream !== "function") {
      setError("Browser does not support canvas captureStream().");
      return;
    }

    if (!signalingUrl.trim()) {
      setError("Signaling URL is required.");
      return;
    }

    const captureWidth = clampNumber(captureWidthInput, MIN_DIMENSION, MAX_DIMENSION, DEFAULT_WIDTH);
    const captureHeight = clampNumber(captureHeightInput, MIN_DIMENSION, MAX_DIMENSION, DEFAULT_HEIGHT);
    const captureFps = clampNumber(captureFpsInput, MIN_FPS, MAX_FPS, DEFAULT_FPS);

    setCaptureWidthInput(String(captureWidth));
    setCaptureHeightInput(String(captureHeight));
    setCaptureFpsInput(String(captureFps));

    stopStreaming();

    try {
      setStatus("Preparing capture canvas ...");

      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = captureWidth;
      captureCanvas.height = captureHeight;
      const captureContext = captureCanvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!captureContext) {
        throw new Error("Unable to create 2D capture context");
      }

      captureCanvasRef.current = captureCanvas;
      captureContextRef.current = captureContext;
      drawScaledCanvas(canvasElement, captureCanvas, captureContext);

      const frameIntervalMs = 1000 / captureFps;
      let lastDrawMs = 0;
      drawLoopRunningRef.current = true;

      const step = (nowMs) => {
        if (!drawLoopRunningRef.current) {
          return;
        }
        if (lastDrawMs === 0 || nowMs - lastDrawMs >= frameIntervalMs) {
          drawScaledCanvas(canvasElement, captureCanvas, captureContext);
          lastDrawMs = nowMs;
        }
        drawLoopFrameRef.current = requestAnimationFrame(step);
      };
      drawLoopFrameRef.current = requestAnimationFrame(step);

      setStatus("Capturing canvas stream ...");
      const stream = captureCanvas.captureStream(captureFps);
      mediaRef.current = stream;

      const peer = new RTCPeerConnection({ iceServers: [] });
      peerRef.current = peer;

      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream);
      }

      const socket = new WebSocket(signalingUrl.trim());
      socketRef.current = socket;

      peer.onicecandidate = (event) => {
        if (!event.candidate || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        socket.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        );
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;
        if (state === "connected") {
          setStatus(`Streaming ${captureWidth}x${captureHeight} @ ${captureFps} fps`);
          setStreaming(true);
          return;
        }
        if (state === "failed" || state === "disconnected" || state === "closed") {
          setStatus(`Peer ${state}`);
          setStreaming(false);
        }
      };

      socket.onopen = async () => {
        try {
          setStatus("Creating offer ...");
          const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
          await peer.setLocalDescription(offer);
          socket.send(
            JSON.stringify({
              type: "offer",
              sdp: offer.sdp,
              meta: {
                source: "fpv-canvas",
                cameraMode,
                width: captureWidth,
                height: captureHeight,
                fps: captureFps,
              },
            }),
          );
          setStatus("Offer sent. Waiting for answer ...");
        } catch (err) {
          setError(toMessageError(err, "Failed to create/send offer"));
          stopStreaming();
        }
      };

      socket.onmessage = async (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        try {
          if (message.type === "answer" && message.sdp) {
            await peer.setRemoteDescription({ type: "answer", sdp: message.sdp });
            setStatus("Answer received. Establishing media ...");
            return;
          }
          if (message.type === "candidate" && message.candidate) {
            await peer.addIceCandidate(message.candidate);
            return;
          }
          if (message.type === "error") {
            throw new Error(message.message || "Signaling server error");
          }
        } catch (err) {
          setError(toMessageError(err, "Failed to process signaling message"));
          stopStreaming();
        }
      };

      socket.onerror = () => {
        setError("WebSocket signaling error");
      };

      socket.onclose = () => {
        if (peer.connectionState !== "connected") {
          setStatus("Signaling channel closed");
          setStreaming(false);
        }
      };
    } catch (err) {
      setError(toMessageError(err, "Unable to start WebRTC stream"));
      stopStreaming();
    }
  }, [
    cameraMode,
    canvasElement,
    captureFpsInput,
    captureHeightInput,
    captureWidthInput,
    signalingUrl,
    stopStreaming,
  ]);

  useEffect(() => () => stopStreaming(), [stopStreaming]);

  return (
    <div className="panel panel-fpv-stream">
      <h2>FPV Stream</h2>
      <p className="panel-subtitle">Stream the active scene canvas to a Python WebRTC backend.</p>

      <div className="panel-block">
        <span className="label">Signaling websocket</span>
        <input
          type="text"
          value={signalingUrl}
          onChange={(event) => setSignalingUrl(event.target.value)}
          placeholder={DEFAULT_SIGNALING_URL}
          spellCheck={false}
          disabled={streaming}
        />
      </div>

      <div className="panel-block">
        <span className="label">Capture settings</span>
        <div className="fpv-stream-grid">
          <label>
            <span>Width</span>
            <input
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              step={1}
              value={captureWidthInput}
              onChange={(event) => setCaptureWidthInput(event.target.value)}
              disabled={streaming}
            />
          </label>
          <label>
            <span>Height</span>
            <input
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              step={1}
              value={captureHeightInput}
              onChange={(event) => setCaptureHeightInput(event.target.value)}
              disabled={streaming}
            />
          </label>
          <label>
            <span>FPS</span>
            <input
              type="number"
              min={MIN_FPS}
              max={MAX_FPS}
              step={1}
              value={captureFpsInput}
              onChange={(event) => setCaptureFpsInput(event.target.value)}
              disabled={streaming}
            />
          </label>
        </div>
      </div>

      <div className="control-row fpv-stream-actions">
        <button type="button" onClick={startStreaming} disabled={streaming || !canvasElement}>
          Start WebRTC
        </button>
        <button type="button" className="ghost" onClick={stopStreaming} disabled={!streaming}>
          Stop
        </button>
      </div>

      <div className="input-meta">Status: {status}</div>
      <div className="input-meta">
        Scene camera: {cameraMode === CAMERA_MODE_FOLLOW_FIRST ? "First person" : "Not first person"}
      </div>
      <div className="input-meta">Set width/height/fps before starting. Stop to change active stream settings.</div>
      {cameraMode !== CAMERA_MODE_FOLLOW_FIRST && (
        <div className="input-meta">Tip: switch camera to "First person" to stream true FPV.</div>
      )}
      {error && <p className="error-line">{error}</p>}
    </div>
  );
}
