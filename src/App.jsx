import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Matrix4, Quaternion } from "three";
import FlightScene from "./components/FlightScene";
import FileControls from "./components/FileControls";
import SimulatorControls from "./components/SimulatorControls";
import TimelineControls from "./components/TimelineControls";
import TelemetryOverlay from "./components/TelemetryOverlay";
import ArtificialHorizon from "./components/ArtificialHorizon";
import SignalPlots from "./components/SignalPlots";
import SimMapOverlay from "./components/SimMapOverlay";
import { parseUlogFile } from "./lib/telemetryLoader";
import { sampleAtTime } from "./lib/telemetryMath";
import "./App.css";

const SAMPLE_LOG_PATH = "/sample-flight.ulg";
const ACTUATOR_LABEL_OPTIONS = [
  "rudder",
  "elevon",
  "left aileron",
  "right aileron",
  "aux1",
  "aux2",
  "aux3",
  "aux4",
];
const DEFAULT_ACTUATOR_LABELS = [
  "left aileron",
  "right aileron",
  "elevon",
  "rudder",
  "aux1",
  "aux2",
  "aux3",
  "aux4",
];
const DEFAULT_SIM_HOST = "127.0.0.1";
const DEFAULT_SIM_PORT = "8765";
const SIM_TRAIL_POINTS = 50;
const SIM_UI_UPDATE_INTERVAL_MS = 16;
const NED_TO_SCENE_QUAT = new Quaternion().setFromRotationMatrix(
  new Matrix4().set(
    0,
    1,
    0,
    0,
    0,
    0,
    -1,
    0,
    -1,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
  ),
);

function normalizeWsPort(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return 8765;
  }
  return parsed;
}

function toSceneVector([north = 0, east = 0, down = 0]) {
  return [east, -down, -north];
}

function firstFinite(values, fallback = null) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return fallback;
}

function toSimSample(payload, context, motionScale) {
  const timeUsec = Number(payload?.time_usec);
  const positionNed = payload?.position_ned_m;
  const quaternionWxyz = payload?.quaternion_wxyz;

  if (!Number.isFinite(timeUsec) || !Array.isArray(positionNed) || !Array.isArray(quaternionWxyz)) {
    return null;
  }

  if (context.firstTimeUsec == null) {
    context.firstTimeUsec = timeUsec;
  }

  const telemetryQuat = new Quaternion(
    Number(quaternionWxyz[1]) || 0,
    Number(quaternionWxyz[2]) || 0,
    Number(quaternionWxyz[3]) || 0,
    Number(quaternionWxyz[0]) || 1,
  ).normalize();
  const renderQuat = NED_TO_SCENE_QUAT.clone().multiply(telemetryQuat);
  const sinrCosp = 2 * (telemetryQuat.w * telemetryQuat.x + telemetryQuat.y * telemetryQuat.z);
  const cosrCosp = 1 - 2 * (telemetryQuat.x * telemetryQuat.x + telemetryQuat.y * telemetryQuat.y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (telemetryQuat.w * telemetryQuat.y - telemetryQuat.z * telemetryQuat.x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  const sinyCosp = 2 * (telemetryQuat.w * telemetryQuat.z + telemetryQuat.x * telemetryQuat.y);
  const cosyCosp = 1 - 2 * (telemetryQuat.y * telemetryQuat.y + telemetryQuat.z * telemetryQuat.z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  const absoluteNed = [Number(positionNed[0]) || 0, Number(positionNed[1]) || 0, Number(positionNed[2]) || 0];
  if (context.originNed == null) {
    context.originNed = [...absoluteNed];
  }

  const relativeNed = [
    absoluteNed[0] - context.originNed[0],
    absoluteNed[1] - context.originNed[1],
    absoluteNed[2] - context.originNed[2],
  ];
  const scenePositionUnscaled = toSceneVector(relativeNed);
  const scenePosition = [
    scenePositionUnscaled[0] * motionScale,
    scenePositionUnscaled[1] * motionScale,
    scenePositionUnscaled[2] * motionScale,
  ];

  let sceneVelocity = [0, 0, 0];
  const dt = context.lastTimeSec != null ? timeUsec * 1e-6 - context.lastTimeSec : 0;
  if (context.lastScenePosition && dt > 1e-6) {
    sceneVelocity = [
      (scenePosition[0] - context.lastScenePosition[0]) / dt,
      (scenePosition[1] - context.lastScenePosition[1]) / dt,
      (scenePosition[2] - context.lastScenePosition[2]) / dt,
    ];
  }

  const altitudeRelative = -relativeNed[2];
  const altitudeAmsl = Number(payload?.lla?.alt_m);
  const latDeg = Number(payload?.lla?.lat_deg);
  const lonDeg = Number(payload?.lla?.lon_deg);
  const yawDeg = ((yaw * 180) / Math.PI + 360) % 360;
  const headingDeg = firstFinite([payload?.heading_deg, payload?.heading, payload?.yaw_deg], yawDeg);

  const sample = {
    time: (timeUsec - context.firstTimeUsec) / 1e6,
    quaternion: [renderQuat.x, renderQuat.y, renderQuat.z, renderQuat.w],
    telemetryQuaternion: [telemetryQuat.x, telemetryQuat.y, telemetryQuat.z, telemetryQuat.w],
    position: scenePosition,
    velocity: sceneVelocity,
    altitude: Number.isFinite(altitudeAmsl) ? altitudeAmsl : altitudeRelative,
    altitudeRelative,
    euler: [roll, pitch, yaw],
    speed: Math.hypot(...sceneVelocity),
    latDeg: Number.isFinite(latDeg) ? latDeg : null,
    lonDeg: Number.isFinite(lonDeg) ? lonDeg : null,
    headingDeg,
    flightMode: "Simulator",
    vehicleState: "SITL",
    vehicleType: "Simulator",
  };

  context.lastScenePosition = scenePosition;
  context.lastTimeSec = timeUsec * 1e-6;

  return sample;
}

function App() {
  const [activeView, setActiveView] = useState("log");
  const [samples, setSamples] = useState([]);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Load a PX4 .ulg log to begin");
  const [error, setError] = useState(null);
  const [ulogName, setUlogName] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [modelType, setModelType] = useState("stl");
  const [modelScale, setModelScale] = useState(1.2);
  const [customStlUrl, setCustomStlUrl] = useState("");
  const [customStlName, setCustomStlName] = useState("");
  const [actuatorSeries, setActuatorSeries] = useState([]);
  const [motorSeries, setMotorSeries] = useState([]);
  const [manualSeries, setManualSeries] = useState([]);
  const [attitudeSeries, setAttitudeSeries] = useState([]);
  const [ratesSeries, setRatesSeries] = useState([]);
  const [velocityAltitudeSeries, setVelocityAltitudeSeries] = useState([]);
  const [failsafeSeries, setFailsafeSeries] = useState([]);
  const [eventSeries, setEventSeries] = useState([]);
  const [failsafeTransitions, setFailsafeTransitions] = useState([]);
  const [actuatorLabels, setActuatorLabels] = useState(DEFAULT_ACTUATOR_LABELS);

  const [playing, setPlaying] = useState(false);
  const [followCamera, setFollowCamera] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const [simHost, setSimHost] = useState(DEFAULT_SIM_HOST);
  const [simPort, setSimPort] = useState(DEFAULT_SIM_PORT);
  const [simSamples, setSimSamples] = useState([]);
  const [simSample, setSimSample] = useState(null);
  const [simStatus, setSimStatus] = useState("Disconnected. Set websocket host/port and connect.");
  const [simError, setSimError] = useState(null);
  const [simConnecting, setSimConnecting] = useState(false);
  const [simConnected, setSimConnected] = useState(false);
  const [simFrameCount, setSimFrameCount] = useState(0);
  const [simMotionScale, setSimMotionScale] = useState(0.3);
  const [simSmoothing, setSimSmoothing] = useState(0.55);

  const simSocketRef = useRef(null);
  const simLatestSampleRef = useRef(null);
  const simPendingSampleRef = useRef(null);
  const simUiFlushTimerRef = useRef(null);
  const simMotionScaleRef = useRef(1);
  const simLastStatusUpdateMsRef = useRef(0);
  const simFrameCounterRef = useRef(0);
  const simContextRef = useRef({
    firstTimeUsec: null,
    originNed: null,
    lastScenePosition: null,
    lastTimeSec: null,
  });

  const currentSample = useMemo(() => sampleAtTime(samples, time), [samples, time]);

  useEffect(() => {
    if (!playing || duration <= 0) {
      return undefined;
    }
    let frame;
    let previous = performance.now();
    const step = (now) => {
      const delta = (now - previous) / 1000;
      previous = now;
      setTime((prev) => {
        const next = prev + delta * speed;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, speed]);

  const resetPlayback = useCallback(() => {
    setPlaying(false);
    setTime(0);
  }, []);

  const handleUlogSelection = useCallback(
    async (file) => {
      if (!file) {
        return;
      }
      resetPlayback();
      setLoading(true);
      setStatus(`Parsing ${file.name} …`);
      setError(null);
      setUlogName(file.name);
      try {
        const result = await parseUlogFile(file, {
          onProgress: ({ samples: sampleCount }) => {
            setStatus(`Parsing ${file.name} · ${sampleCount} frames`);
          },
        });
        setSamples(result.samples);
        setDuration(result.duration);
        setVehicleInfo(result.vehicleInfo ?? null);
        setActuatorSeries(result.actuatorSeries ?? []);
        setMotorSeries(result.motorSeries ?? []);
        setManualSeries(result.manualSeries ?? []);
        setAttitudeSeries(result.attitudeSeries ?? []);
        setRatesSeries(result.ratesSeries ?? []);
        setVelocityAltitudeSeries(result.velocityAltitudeSeries ?? []);
        setFailsafeSeries(result.failsafeSeries ?? []);
        setEventSeries(result.eventSeries ?? []);
        setFailsafeTransitions(result.failsafeTransitions ?? []);
        const summary = `Loaded ${file.name} · ${result.samples.length} frames · ${result.duration.toFixed(1)} s`;
        setStatus(summary);
      } catch (err) {
        console.error(err);
        setSamples([]);
        setDuration(0);
        setVehicleInfo(null);
        setActuatorSeries([]);
        setMotorSeries([]);
        setManualSeries([]);
        setAttitudeSeries([]);
        setRatesSeries([]);
        setVelocityAltitudeSeries([]);
        setFailsafeSeries([]);
        setEventSeries([]);
        setFailsafeTransitions([]);
        setStatus("Unable to parse log – see details below");
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    },
    [resetPlayback],
  );

  const handleSampleLoad = useCallback(async () => {
    resetPlayback();
    setStatus("Fetching bundled sample flight …");
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(SAMPLE_LOG_PATH);
      if (!response.ok) {
        throw new Error(`Failed to download sample (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      const file = new File([blob], "sample-flight.ulg", { type: blob.type || "application/octet-stream" });
      await handleUlogSelection(file);
    } catch (err) {
      console.error(err);
      setStatus("Unable to load sample flight");
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [handleUlogSelection, resetPlayback]);

  const clearTelemetry = useCallback(() => {
    resetPlayback();
    setSamples([]);
    setDuration(0);
    setVehicleInfo(null);
    setActuatorSeries([]);
    setMotorSeries([]);
    setManualSeries([]);
    setAttitudeSeries([]);
    setRatesSeries([]);
    setVelocityAltitudeSeries([]);
    setFailsafeSeries([]);
    setEventSeries([]);
    setFailsafeTransitions([]);
    setStatus("Load a PX4 .ulg log to begin");
    setError(null);
    setUlogName("");
  }, [resetPlayback]);

  useEffect(() => {
    return () => {
      if (customStlUrl) {
        URL.revokeObjectURL(customStlUrl);
      }
    };
  }, [customStlUrl]);

  const handleModelTypeChange = useCallback((nextType) => {
    setModelType(nextType);
  }, []);

  const handleCustomStlSelected = useCallback((file) => {
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);
    setCustomStlUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return url;
    });
    setCustomStlName(file.name);
    setModelType("upload");
  }, []);

  const handleScrub = useCallback(
    (nextTime) => {
      setTime((prev) => {
        const clamped = Math.min(Math.max(nextTime, 0), duration || 0);
        if (!Number.isFinite(clamped)) {
          return prev;
        }
        return clamped;
      });
    },
    [duration],
  );

  const cancelSimUiFlush = useCallback(() => {
    if (simUiFlushTimerRef.current != null) {
      clearTimeout(simUiFlushTimerRef.current);
      simUiFlushTimerRef.current = null;
    }
  }, []);

  const flushPendingSimSample = useCallback(() => {
    simUiFlushTimerRef.current = null;
    const sample = simPendingSampleRef.current;
    if (!sample) {
      return;
    }

    simPendingSampleRef.current = null;
    simLatestSampleRef.current = sample;
    setSimSample(sample);
    setSimSamples((prev) => {
      const next = [...prev, sample];
      if (next.length > SIM_TRAIL_POINTS) {
        next.splice(0, next.length - SIM_TRAIL_POINTS);
      }
      return next;
    });
  }, []);

  const scheduleSimUiFlush = useCallback(() => {
    if (simUiFlushTimerRef.current != null) {
      return;
    }
    simUiFlushTimerRef.current = setTimeout(flushPendingSimSample, SIM_UI_UPDATE_INTERVAL_MS);
  }, [flushPendingSimSample]);

  const closeSimSocket = useCallback(() => {
    cancelSimUiFlush();
    simPendingSampleRef.current = null;
    const currentSocket = simSocketRef.current;
    if (currentSocket) {
      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;
      currentSocket.close();
      simSocketRef.current = null;
    }
  }, [cancelSimUiFlush]);

  const clearSimData = useCallback(() => {
    simContextRef.current = {
      firstTimeUsec: null,
      originNed: null,
      lastScenePosition: null,
      lastTimeSec: null,
    };
    simFrameCounterRef.current = 0;
    simLastStatusUpdateMsRef.current = 0;
    simPendingSampleRef.current = null;
    setSimFrameCount(0);
    setSimSample(null);
    setSimSamples([]);
    simLatestSampleRef.current = null;
  }, []);

  const clearSimTrail = useCallback(() => {
    const latestSample = simLatestSampleRef.current;
    setSimSamples(latestSample ? [latestSample] : []);
  }, []);

  const handleSimDisconnect = useCallback(() => {
    closeSimSocket();
    setSimConnecting(false);
    setSimConnected(false);
    setSimStatus("Disconnected. Set websocket host/port and connect.");
  }, [closeSimSocket]);

  const handleSimConnect = useCallback(() => {
    closeSimSocket();
    clearSimData();
    setSimError(null);
    setSimConnecting(true);
    setSimConnected(false);

    const host = simHost.trim() || DEFAULT_SIM_HOST;
    const port = normalizeWsPort(simPort);
    const url = `ws://${host}:${port}`;
    setSimStatus(`Connecting to ${url} ...`);

    const socket = new WebSocket(url);
    let didOpen = false;
    simSocketRef.current = socket;

    socket.onopen = () => {
      didOpen = true;
      setSimConnecting(false);
      setSimConnected(true);
      setSimStatus(`Connected to ${url}. Waiting for data ...`);
    };

    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      const sample = toSimSample(payload, simContextRef.current, simMotionScaleRef.current);
      if (!sample) {
        return;
      }

      simPendingSampleRef.current = sample;
      scheduleSimUiFlush();

      simFrameCounterRef.current += 1;
      const nowMs = performance.now();
      if (nowMs - simLastStatusUpdateMsRef.current >= 250) {
        simLastStatusUpdateMsRef.current = nowMs;
        setSimFrameCount(simFrameCounterRef.current);
        setSimStatus(`Connected to ${url} - ${simFrameCounterRef.current} frames`);
      }
    };

    socket.onerror = () => {
      setSimError("WebSocket connection error");
    };

    socket.onclose = () => {
      if (simSocketRef.current === socket) {
        simSocketRef.current = null;
      }
      setSimConnecting(false);
      setSimConnected(false);
      if (didOpen) {
        setSimStatus("Disconnected from simulator websocket.");
      } else {
        setSimStatus("Unable to connect. Check host/port and simulator websocket.");
      }
    };
  }, [clearSimData, closeSimSocket, scheduleSimUiFlush, simHost, simPort]);

  useEffect(
    () => () => {
      closeSimSocket();
    },
    [closeSimSocket],
  );

  useEffect(() => {
    simMotionScaleRef.current = simMotionScale;
  }, [simMotionScale]);

  useEffect(() => {
    simContextRef.current.lastScenePosition = null;
    simContextRef.current.lastTimeSec = null;
    clearSimTrail();
  }, [clearSimTrail, simMotionScale]);

  const simDuration = simSample?.time ?? 0;
  const simUrl = useMemo(() => `ws://${simHost.trim() || DEFAULT_SIM_HOST}:${normalizeWsPort(simPort)}`, [simHost, simPort]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>PX4 Flight Visualizer</h1>
          <p>{activeView === "log" ? "Replay PX4 ULog telemetry" : "Live simulator websocket telemetry"}</p>
        </div>
        <div className="view-tabs" role="tablist" aria-label="Viewer modes">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "log"}
            className={`view-tab ${activeView === "log" ? "active" : ""}`}
            onClick={() => setActiveView("log")}
          >
            Log Analyzer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "sim"}
            className={`view-tab ${activeView === "sim" ? "active" : ""}`}
            onClick={() => setActiveView("sim")}
          >
            Simulator
          </button>
        </div>
      </header>

      {activeView === "log" && (
        <section className="channel-map-bar">
          <h3>Actuator Channel Labels</h3>
          <div className="channel-map-grid">
            {actuatorLabels.map((label, index) => (
              <label key={`act-${index}`}>
                <span>A{index + 1}</span>
                <select
                  value={label}
                  onChange={(event) => {
                    const value = event.target.value;
                    setActuatorLabels((prev) => {
                      const next = [...prev];
                      next[index] = value;
                      return next;
                    });
                  }}
                >
                  {ACTUATOR_LABEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      <main className="app-body">
        <section className="scene-panel">
          <div className="scene-wrapper">
            <Suspense fallback={null}>
              <FlightScene
                samples={activeView === "log" ? samples : simSamples}
                activeSample={activeView === "log" ? currentSample : simSample}
                modelType={modelType}
                modelScale={modelScale}
                customModelUrl={customStlUrl}
                followCamera={followCamera}
                simMode={activeView === "sim"}
                simSmoothing={simSmoothing}
              />
            </Suspense>
            {activeView === "log" && !currentSample && <div className="scene-empty-hint">Load a PX4 .ulg to start playback.</div>}
            {activeView === "sim" && !simSample && (
              <div className="scene-empty-hint">Connect to the simulator websocket to start live view.</div>
            )}
            {activeView === "log" && (
              <SignalPlots
                actuatorSeries={actuatorSeries}
                motorSeries={motorSeries}
                manualSeries={manualSeries}
                attitudeSeries={attitudeSeries}
                ratesSeries={ratesSeries}
                velocityAltitudeSeries={velocityAltitudeSeries}
                failsafeSeries={failsafeSeries}
                eventSeries={eventSeries}
                failsafeTransitions={failsafeTransitions}
                time={time}
                duration={duration}
                actuatorLabels={actuatorLabels}
              />
            )}
            {activeView === "sim" && <SimMapOverlay samples={simSamples} activeSample={simSample} />}
            <div className="overlay-stack">
              <TelemetryOverlay
                sample={activeView === "log" ? currentSample : simSample}
                vehicleInfo={vehicleInfo}
                status={activeView === "log" ? status : simStatus}
                ulogName={activeView === "log" ? ulogName : simUrl}
                playing={activeView === "log" ? playing : simConnected}
                speed={activeView === "log" ? speed : 1}
              />
              <ArtificialHorizon sample={activeView === "log" ? currentSample : simSample} />
            </div>
          </div>
          {activeView === "log" ? (
            <TimelineControls
              duration={duration}
              time={time}
              playing={playing}
              speed={speed}
              disabled={!samples.length}
              onPlayToggle={() => setPlaying((prev) => !prev)}
              onScrub={handleScrub}
              onSpeedChange={setSpeed}
              followCamera={followCamera}
              onFollowCameraChange={setFollowCamera}
              onReset={resetPlayback}
            />
          ) : (
            <div className="timeline-controls sim-live-controls">
              <div className="timeline-meta">
                <span>
                  Live mode. {simFrameCount} frames received, latest at {simDuration.toFixed(2)} s.
                </span>
                <label>
                  <input
                    type="checkbox"
                    checked={followCamera}
                    onChange={(event) => setFollowCamera(event.target.checked)}
                  />
                  Follow camera
                </label>
                <button type="button" className="ghost" onClick={clearSimTrail}>
                  Clear trail
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="sidebar">
          {activeView === "log" ? (
            <FileControls
              onLogSelected={handleUlogSelection}
              onLoadSample={handleSampleLoad}
              onClear={clearTelemetry}
              status={status}
              error={error}
              loading={loading}
              ulogName={ulogName}
              modelType={modelType}
              onModelChange={handleModelTypeChange}
              modelScale={modelScale}
              onModelScaleChange={setModelScale}
              onCustomStlSelected={handleCustomStlSelected}
              customStlName={customStlName}
            />
          ) : (
            <SimulatorControls
              host={simHost}
              onHostChange={setSimHost}
              port={simPort}
              onPortChange={setSimPort}
              wsUrl={simUrl}
              connected={simConnected}
              connecting={simConnecting}
              onConnect={handleSimConnect}
              onDisconnect={handleSimDisconnect}
              onClearTrail={clearSimTrail}
              status={simStatus}
              error={simError}
              motionScale={simMotionScale}
              onMotionScaleChange={setSimMotionScale}
              smoothing={simSmoothing}
              onSmoothingChange={setSimSmoothing}
              modelType={modelType}
              onModelChange={handleModelTypeChange}
              modelScale={modelScale}
              onModelScaleChange={setModelScale}
              onCustomStlSelected={handleCustomStlSelected}
              customStlName={customStlName}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
