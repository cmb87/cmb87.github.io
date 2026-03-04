import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_SIGNALING_URL = "ws://127.0.0.1:9001/fpv";
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;
const DEFAULT_FPS = 15;
const DEFAULT_FIT_MODE = "cover";
const DEFAULT_JPEG_QUALITY = 0.75;
const MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
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

function drawScaledCanvas(sourceCanvas, targetCanvas, context2d, fitMode = DEFAULT_FIT_MODE) {
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

  if (fitMode === "stretch") {
    context2d.drawImage(sourceCanvas, 0, 0, sw, sh, 0, 0, tw, th);
    return;
  }

  const scale = fitMode === "contain" ? Math.min(tw / sw, th / sh) : Math.max(tw / sw, th / sh);
  const drawWidth = Math.max(1, Math.round(sw * scale));
  const drawHeight = Math.max(1, Math.round(sh * scale));
  const offsetX = Math.floor((tw - drawWidth) / 2);
  const offsetY = Math.floor((th - drawHeight) / 2);

  if (fitMode === "contain") {
    context2d.fillStyle = "#000";
    context2d.fillRect(0, 0, tw, th);
  }
  context2d.drawImage(sourceCanvas, 0, 0, sw, sh, offsetX, offsetY, drawWidth, drawHeight);
}

export default function FpvStreamControls({ canvasElement, cameraMode }) {
  const [signalingUrl, setSignalingUrl] = useState(DEFAULT_SIGNALING_URL);
  const [captureWidthInput, setCaptureWidthInput] = useState(String(DEFAULT_WIDTH));
  const [captureHeightInput, setCaptureHeightInput] = useState(String(DEFAULT_HEIGHT));
  const [captureFpsInput, setCaptureFpsInput] = useState(String(DEFAULT_FPS));
  const [fitMode, setFitMode] = useState(DEFAULT_FIT_MODE);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState(null);
  const [streaming, setStreaming] = useState(false);

  const socketRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const captureContextRef = useRef(null);
  const drawLoopFrameRef = useRef(null);
  const drawLoopRunningRef = useRef(false);
  const sendLoopTimerRef = useRef(null);
  const sendLoopRunningRef = useRef(false);
  const encodeInFlightRef = useRef(false);
  const sentFramesRef = useRef(0);
  const droppedFramesRef = useRef(0);
  const lastStatReportMsRef = useRef(0);

  const stopDrawLoop = useCallback(() => {
    drawLoopRunningRef.current = false;
    if (drawLoopFrameRef.current != null) {
      cancelAnimationFrame(drawLoopFrameRef.current);
      drawLoopFrameRef.current = null;
    }
  }, []);

  const stopSendLoop = useCallback(() => {
    sendLoopRunningRef.current = false;
    encodeInFlightRef.current = false;
    if (sendLoopTimerRef.current != null) {
      clearTimeout(sendLoopTimerRef.current);
      sendLoopTimerRef.current = null;
    }
  }, []);

  const maybeReportStats = useCallback((captureWidth, captureHeight, captureFps) => {
    const nowMs = Date.now();
    if (!lastStatReportMsRef.current) {
      lastStatReportMsRef.current = nowMs;
      return;
    }

    if (nowMs - lastStatReportMsRef.current < 1000) {
      return;
    }

    const sent = sentFramesRef.current;
    const dropped = droppedFramesRef.current;
    setStatus(`Streaming ${captureWidth}x${captureHeight} @ ${captureFps} fps (sent ${sent}/s, dropped ${dropped}/s)`);
    sentFramesRef.current = 0;
    droppedFramesRef.current = 0;
    lastStatReportMsRef.current = nowMs;
  }, []);

  const stopStreaming = useCallback(() => {
    stopSendLoop();
    stopDrawLoop();

    const socket = socketRef.current;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "stop" }));
        }
      } catch {
        // Ignore shutdown errors.
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

    captureContextRef.current = null;
    captureCanvasRef.current = null;
    sentFramesRef.current = 0;
    droppedFramesRef.current = 0;
    lastStatReportMsRef.current = 0;
    setStreaming(false);
    setStatus("Stopped");
  }, [stopDrawLoop, stopSendLoop]);

  const startStreaming = useCallback(async () => {
    setError(null);

    if (!canvasElement) {
      setError("No active scene canvas to capture.");
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
      drawScaledCanvas(canvasElement, captureCanvas, captureContext, fitMode);

      const frameIntervalMs = 1000 / captureFps;
      let lastDrawMs = 0;
      drawLoopRunningRef.current = true;

      const step = (nowMs) => {
        if (!drawLoopRunningRef.current) {
          return;
        }
        if (lastDrawMs === 0 || nowMs - lastDrawMs >= frameIntervalMs) {
          drawScaledCanvas(canvasElement, captureCanvas, captureContext, fitMode);
          lastDrawMs = nowMs;
        }
        drawLoopFrameRef.current = requestAnimationFrame(step);
      };
      drawLoopFrameRef.current = requestAnimationFrame(step);

      setStatus("Connecting websocket ...");

      const socket = new WebSocket(signalingUrl.trim());
      socketRef.current = socket;

      socket.onopen = async () => {
        try {
          socket.send(
            JSON.stringify({
              type: "start",
              meta: {
                source: "fpv-canvas",
                cameraMode,
                width: captureWidth,
                height: captureHeight,
                fps: captureFps,
                format: "image/jpeg",
                quality: DEFAULT_JPEG_QUALITY,
              },
            }),
          );

          sentFramesRef.current = 0;
          droppedFramesRef.current = 0;
          lastStatReportMsRef.current = Date.now();
          setStreaming(true);
          setStatus(`Streaming ${captureWidth}x${captureHeight} @ ${captureFps} fps`);

          const frameIntervalMs = Math.max(1, Math.round(1000 / captureFps));
          sendLoopRunningRef.current = true;

          const sendNextFrame = () => {
            if (!sendLoopRunningRef.current) {
              return;
            }

            const currentSocket = socketRef.current;
            const captureTarget = captureCanvasRef.current;
            const captureCtx = captureContextRef.current;
            if (
              !currentSocket
              || currentSocket.readyState !== WebSocket.OPEN
              || !captureTarget
              || !captureCtx
            ) {
              sendLoopTimerRef.current = setTimeout(sendNextFrame, frameIntervalMs);
              return;
            }

            if (encodeInFlightRef.current) {
              sendLoopTimerRef.current = setTimeout(sendNextFrame, frameIntervalMs);
              return;
            }

            if (currentSocket.bufferedAmount > MAX_BUFFERED_BYTES) {
              droppedFramesRef.current += 1;
              maybeReportStats(captureWidth, captureHeight, captureFps);
              sendLoopTimerRef.current = setTimeout(sendNextFrame, frameIntervalMs);
              return;
            }

            encodeInFlightRef.current = true;
            drawScaledCanvas(canvasElement, captureTarget, captureCtx, fitMode);
            captureTarget.toBlob(
              (blob) => {
                try {
                  const activeSocket = socketRef.current;
                  if (!blob || !activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
                    droppedFramesRef.current += 1;
                    return;
                  }

                  if (activeSocket.bufferedAmount > MAX_BUFFERED_BYTES) {
                    droppedFramesRef.current += 1;
                    return;
                  }

                  activeSocket.send(blob);
                  sentFramesRef.current += 1;
                } finally {
                  maybeReportStats(captureWidth, captureHeight, captureFps);
                  encodeInFlightRef.current = false;
                  if (sendLoopRunningRef.current) {
                    sendLoopTimerRef.current = setTimeout(sendNextFrame, frameIntervalMs);
                  }
                }
              },
              "image/jpeg",
              DEFAULT_JPEG_QUALITY,
            );
          };

          sendLoopTimerRef.current = setTimeout(sendNextFrame, frameIntervalMs);
        } catch (err) {
          setError(toMessageError(err, "Failed to start websocket stream"));
          stopStreaming();
        }
      };

      socket.onmessage = async (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === "error") {
          setError(message.message || "Backend websocket error");
          stopStreaming();
          return;
        }

        if (message.type === "ack") {
          setStatus(`Connected. Streaming ${captureWidth}x${captureHeight} @ ${captureFps} fps`);
        }
      };

      socket.onerror = () => {
        setError("WebSocket stream error");
      };

      socket.onclose = () => {
        setStreaming(false);
        setStatus("WebSocket closed");
      };
    } catch (err) {
      setError(toMessageError(err, "Unable to start WebSocket stream"));
      stopStreaming();
    }
  }, [
    cameraMode,
    canvasElement,
    captureFpsInput,
    captureHeightInput,
    captureWidthInput,
    fitMode,
    maybeReportStats,
    signalingUrl,
    stopStreaming,
  ]);

  useEffect(() => () => stopStreaming(), [stopStreaming]);

  return (
    <div className="panel panel-fpv-stream">
      <h2>FPV Stream</h2>
      <p className="panel-subtitle">Stream the active scene canvas to a Python websocket backend.</p>

      <div className="panel-block">
        <span className="label">Stream websocket</span>
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
          <label>
            <span>Fit</span>
            <select value={fitMode} onChange={(event) => setFitMode(event.target.value)} disabled={streaming}>
              <option value="cover">Cover (no bars)</option>
              <option value="contain">Contain (bars)</option>
              <option value="stretch">Stretch (distort)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="control-row fpv-stream-actions">
        <button type="button" onClick={startStreaming} disabled={streaming || !canvasElement}>
          Start Stream
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
