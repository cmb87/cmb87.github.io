import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import FlightScene from "./components/FlightScene";
import FileControls from "./components/FileControls";
import TimelineControls from "./components/TimelineControls";
import TelemetryOverlay from "./components/TelemetryOverlay";
import ArtificialHorizon from "./components/ArtificialHorizon";
import SignalPlots from "./components/SignalPlots";
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

function App() {
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>PX4 Flight Visualizer</h1>
          <p>Replay PX4 ULog telemetry</p>
        </div>
      </header>

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

      <main className="app-body">
        <section className="scene-panel">
          <div className="scene-wrapper">
            <Suspense fallback={null}>
              <FlightScene
                samples={samples}
                activeSample={currentSample}
                modelType={modelType}
                modelScale={modelScale}
                customModelUrl={customStlUrl}
                followCamera={followCamera}
              />
            </Suspense>
            {!currentSample && <div className="scene-empty-hint">Load a PX4 .ulg to start playback.</div>}
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
            <div className="overlay-stack">
              <TelemetryOverlay
                sample={currentSample}
                vehicleInfo={vehicleInfo}
                status={status}
                ulogName={ulogName}
                playing={playing}
                speed={speed}
              />
              <ArtificialHorizon sample={currentSample} />
            </div>
          </div>
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
        </section>

        <aside className="sidebar">
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
        </aside>
      </main>
    </div>
  );
}

export default App;
