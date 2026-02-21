import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Euler, Matrix4, Quaternion } from "three";
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
const DEFAULT_MODEL_TYPE = "stl";
const DEFAULT_MODEL_SCALE = 1.2;
const SIM_MOTION_SCALE = 0.3;
const SIM_TRAIL_POINTS = 240;
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
const SIM_TAILSITTER_PITCH_CORRECTION_QUAT = new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0, "XYZ"));

function createSimConnection(id, host = DEFAULT_SIM_HOST, port = DEFAULT_SIM_PORT) {
  return {
    id,
    host,
    port,
    connected: false,
    connecting: false,
    frameCount: 0,
    status: "Disconnected",
    error: null,
  };
}

function createDefaultVehicleMeshSettings() {
  return {
    modelType: DEFAULT_MODEL_TYPE,
    modelScale: DEFAULT_MODEL_SCALE,
    rotateTailsitter90: false,
    tailsitterPitchCorrection: false,
    customStlUrl: "",
    customStlName: "",
  };
}

function buildWsUrl(host, port) {
  return `ws://${host.trim() || DEFAULT_SIM_HOST}:${normalizeWsPort(port)}`;
}

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

function formatHudHeading(sample) {
  const heading = Number.isFinite(sample?.headingDeg)
    ? sample.headingDeg
    : Number.isFinite(sample?.euler?.[2])
      ? (sample.euler[2] * 180) / Math.PI
      : null;
  if (!Number.isFinite(heading)) {
    return "-";
  }
  const normalized = ((heading % 360) + 360) % 360;
  return `${normalized.toFixed(0)} deg`;
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

function normalizeActuatorCommands(values) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: 8 }, (_, index) => {
    const value = Number(source[index]);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(-1, Math.min(1, value));
  });
}

function toSimSample(payload, context, motionScale, tailsitterPitchCorrection = false) {
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
  const displayTelemetryQuat = tailsitterPitchCorrection
    ? telemetryQuat.clone().multiply(SIM_TAILSITTER_PITCH_CORRECTION_QUAT)
    : telemetryQuat;
  const displayEuler = new Euler().setFromQuaternion(displayTelemetryQuat, "XYZ");
  const roll = displayEuler.x;
  const pitch = displayEuler.y;
  const yaw = displayEuler.z;
  const rawEuler = new Euler().setFromQuaternion(telemetryQuat, "XYZ");
  const rawYaw = rawEuler.z;

  const renderQuat = NED_TO_SCENE_QUAT.clone().multiply(telemetryQuat);

  const absoluteNed = [Number(positionNed[0]) || 0, Number(positionNed[1]) || 0, Number(positionNed[2]) || 0];
  if (context.originNed == null) {
    context.originNed = [...absoluteNed];
  }

  const relativeNed = [
    absoluteNed[0] - context.originNed[0],
    absoluteNed[1] - context.originNed[1],
    absoluteNed[2] - context.originNed[2],
  ];
  const scenePosition = toSceneVector(relativeNed);
  const displayPosition = [
    scenePosition[0] * motionScale,
    scenePosition[1] * motionScale,
    scenePosition[2] * motionScale,
  ];

  let velocity = [0, 0, 0];
  const dt = context.lastTimeSec != null ? timeUsec * 1e-6 - context.lastTimeSec : 0;
  if (context.lastPosition && dt > 1e-6) {
    velocity = [
      (scenePosition[0] - context.lastPosition[0]) / dt,
      (scenePosition[1] - context.lastPosition[1]) / dt,
      (scenePosition[2] - context.lastPosition[2]) / dt,
    ];
  }

  const altitudeRelative = -relativeNed[2];
  const altitudeAmsl = Number(payload?.lla?.alt_m);
  const latDeg = Number(payload?.lla?.lat_deg);
  const lonDeg = Number(payload?.lla?.lon_deg);
  const yawDeg = ((rawYaw * 180) / Math.PI + 360) % 360;
  const headingDeg = firstFinite([payload?.heading_deg, payload?.heading, payload?.yaw_deg], yawDeg);
  const rawSystemId = Number(payload?.system_id);
  const systemId = Number.isFinite(rawSystemId) ? Math.trunc(rawSystemId) : null;
  const actuatorCommands = normalizeActuatorCommands(payload?.u);

  const sample = {
    time: (timeUsec - context.firstTimeUsec) / 1e6,
    quaternion: [renderQuat.x, renderQuat.y, renderQuat.z, renderQuat.w],
    telemetryQuaternion: [telemetryQuat.x, telemetryQuat.y, telemetryQuat.z, telemetryQuat.w],
    position: scenePosition,
    displayPosition,
    velocity,
    altitude: Number.isFinite(altitudeAmsl) ? altitudeAmsl : altitudeRelative,
    altitudeRelative,
    euler: [roll, pitch, yaw],
    speed: Math.hypot(...velocity),
    latDeg: Number.isFinite(latDeg) ? latDeg : null,
    lonDeg: Number.isFinite(lonDeg) ? lonDeg : null,
    headingDeg,
    systemId,
    u: actuatorCommands,
    flightMode: "Simulator",
    vehicleState: "SITL",
    vehicleType: "Simulator",
  };

  context.lastPosition = scenePosition;
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
  const [modelType, setModelType] = useState(DEFAULT_MODEL_TYPE);
  const [modelScale, setModelScale] = useState(DEFAULT_MODEL_SCALE);
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
  const [showActuatorLabels, setShowActuatorLabels] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [followCamera, setFollowCamera] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const [simConnections, setSimConnections] = useState([createSimConnection(1)]);
  const [simVehiclesBySystemId, setSimVehiclesBySystemId] = useState({});
  const [simVehicleMeshSettings, setSimVehicleMeshSettings] = useState({});
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [showInterVehicleLinks, setShowInterVehicleLinks] = useState(false);
  const [simMaxDistanceMeters, setSimMaxDistanceMeters] = useState("");
  const [rotateTailsitter90, setRotateTailsitter90] = useState(false);

  const simSocketsRef = useRef(new Map());
  const simContextsRef = useRef(new Map());
  const simConnectionStatsRef = useRef(new Map());
  const simVehicleMeshSettingsRef = useRef({});
  const nextSimConnectionIdRef = useRef(2);

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

  useEffect(() => {
    simVehicleMeshSettingsRef.current = simVehicleMeshSettings;
  }, [simVehicleMeshSettings]);

  useEffect(() => {
    return () => {
      for (const settings of Object.values(simVehicleMeshSettingsRef.current)) {
        if (settings?.customStlUrl) {
          URL.revokeObjectURL(settings.customStlUrl);
        }
      }
    };
  }, []);

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

  const handleSelectedSimModelTypeChange = useCallback(
    (nextType) => {
      if (selectedSystemId == null) {
        return;
      }
      const key = String(selectedSystemId);
      setSimVehicleMeshSettings((prev) => {
        const current = prev[key] ?? createDefaultVehicleMeshSettings();
        return {
          ...prev,
          [key]: {
            ...current,
            modelType: nextType,
          },
        };
      });
    },
    [selectedSystemId],
  );

  const handleSelectedSimModelScaleChange = useCallback(
    (nextScale) => {
      if (selectedSystemId == null) {
        return;
      }
      const key = String(selectedSystemId);
      setSimVehicleMeshSettings((prev) => {
        const current = prev[key] ?? createDefaultVehicleMeshSettings();
        return {
          ...prev,
          [key]: {
            ...current,
            modelScale: nextScale,
          },
        };
      });
    },
    [selectedSystemId],
  );

  const handleSelectedSimRotate90Change = useCallback(
    (nextValue) => {
      if (selectedSystemId == null) {
        return;
      }
      const key = String(selectedSystemId);
      setSimVehicleMeshSettings((prev) => {
        const current = prev[key] ?? createDefaultVehicleMeshSettings();
        return {
          ...prev,
          [key]: {
            ...current,
            rotateTailsitter90: nextValue,
          },
        };
      });
    },
    [selectedSystemId],
  );

  const handleSelectedSimPitchCorrectionChange = useCallback(
    (nextValue) => {
      if (selectedSystemId == null) {
        return;
      }
      const key = String(selectedSystemId);
      setSimVehicleMeshSettings((prev) => {
        const current = prev[key] ?? createDefaultVehicleMeshSettings();
        return {
          ...prev,
          [key]: {
            ...current,
            tailsitterPitchCorrection: nextValue,
          },
        };
      });
    },
    [selectedSystemId],
  );

  const handleSelectedSimCustomStlSelected = useCallback(
    (file) => {
      if (!file || selectedSystemId == null) {
        return;
      }
      const key = String(selectedSystemId);
      const url = URL.createObjectURL(file);
      setSimVehicleMeshSettings((prev) => {
        const current = prev[key] ?? createDefaultVehicleMeshSettings();
        if (current.customStlUrl) {
          URL.revokeObjectURL(current.customStlUrl);
        }
        return {
          ...prev,
          [key]: {
            ...current,
            modelType: "upload",
            customStlUrl: url,
            customStlName: file.name,
          },
        };
      });
    },
    [selectedSystemId],
  );

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

  const clearVehiclesForConnection = useCallback((connectionId) => {
    setSimVehiclesBySystemId((prev) => {
      const nextEntries = Object.entries(prev).filter(([, vehicle]) => vehicle.connectionId !== connectionId);
      return Object.fromEntries(nextEntries);
    });
  }, []);

  const closeSimConnectionSocket = useCallback((connectionId) => {
    const socket = simSocketsRef.current.get(connectionId);
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      simSocketsRef.current.delete(connectionId);
    }
  }, []);

  const setConnectionState = useCallback((connectionId, updater) => {
    setSimConnections((prev) =>
      prev.map((connection) => {
        if (connection.id !== connectionId) {
          return connection;
        }
        return { ...connection, ...updater(connection) };
      }),
    );
  }, []);

  const handleSimConnectionFieldChange = useCallback((connectionId, field, value) => {
    setConnectionState(connectionId, () => ({ [field]: value }));
  }, [setConnectionState]);

  const handleAddSimConnection = useCallback(() => {
    const nextId = nextSimConnectionIdRef.current;
    nextSimConnectionIdRef.current += 1;
    setSimConnections((prev) => {
      const lastPort = prev.length ? prev[prev.length - 1].port : DEFAULT_SIM_PORT;
      const incrementedPort = Math.min(65535, normalizeWsPort(lastPort) + 1);
      return [...prev, createSimConnection(nextId, DEFAULT_SIM_HOST, String(incrementedPort))];
    });
  }, []);

  const handleSimDisconnectConnection = useCallback(
    (connectionId) => {
      closeSimConnectionSocket(connectionId);
      simContextsRef.current.delete(connectionId);
      simConnectionStatsRef.current.delete(connectionId);
      clearVehiclesForConnection(connectionId);
      setConnectionState(connectionId, () => ({
        connected: false,
        connecting: false,
        error: null,
        status: "Disconnected",
      }));
    },
    [clearVehiclesForConnection, closeSimConnectionSocket, setConnectionState],
  );

  const handleRemoveSimConnection = useCallback(
    (connectionId) => {
      handleSimDisconnectConnection(connectionId);
      setSimConnections((prev) => prev.filter((connection) => connection.id !== connectionId));
    },
    [handleSimDisconnectConnection],
  );

  const handleSimConnectConnection = useCallback(
    (connectionId) => {
      const connection = simConnections.find((item) => item.id === connectionId);
      if (!connection) {
        return;
      }

      closeSimConnectionSocket(connectionId);
      clearVehiclesForConnection(connectionId);
      simContextsRef.current.set(connectionId, {
        firstTimeUsec: null,
        originNed: null,
        lastPosition: null,
        lastTimeSec: null,
      });
      simConnectionStatsRef.current.set(connectionId, {
        frameCount: 0,
        lastStatusUpdateMs: 0,
      });

      const url = buildWsUrl(connection.host, connection.port);
      setConnectionState(connectionId, () => ({
        connecting: true,
        connected: false,
        frameCount: 0,
        error: null,
        status: `Connecting to ${url} ...`,
      }));

      const socket = new WebSocket(url);
      let didOpen = false;
      simSocketsRef.current.set(connectionId, socket);

      socket.onopen = () => {
        didOpen = true;
        setConnectionState(connectionId, () => ({
          connecting: false,
          connected: true,
          status: `Connected to ${url}. Waiting for data ...`,
        }));
      };

      socket.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        const context = simContextsRef.current.get(connectionId);
        if (!context) {
          return;
        }

        const incomingSystemId = Number(payload?.system_id);
        const parsedSystemId = Number.isFinite(incomingSystemId) ? Math.trunc(incomingSystemId) : null;
        const meshSettings = parsedSystemId == null ? null : simVehicleMeshSettingsRef.current[String(parsedSystemId)];
        const tailSitterPitchCorrectionEnabled = Boolean(meshSettings?.tailsitterPitchCorrection);
        const sample = toSimSample(payload, context, SIM_MOTION_SCALE, tailSitterPitchCorrectionEnabled);
        if (!sample || !Number.isFinite(sample.systemId)) {
          return;
        }

        const systemId = Math.trunc(sample.systemId);
        setSimVehiclesBySystemId((prev) => {
          const key = String(systemId);
          const existing = prev[key];
          const prevTrail = Array.isArray(existing?.trailSamples) ? existing.trailSamples : [];
          const nextTrail = [...prevTrail, sample];
          if (nextTrail.length > SIM_TRAIL_POINTS) {
            nextTrail.splice(0, nextTrail.length - SIM_TRAIL_POINTS);
          }
          return {
            ...prev,
            [key]: {
              systemId,
              connectionId,
              latestSample: sample,
              trailSamples: nextTrail,
            },
          };
        });

        const stats = simConnectionStatsRef.current.get(connectionId) ?? {
          frameCount: 0,
          lastStatusUpdateMs: 0,
        };
        stats.frameCount += 1;
        const nowMs = performance.now();
        if (nowMs - stats.lastStatusUpdateMs >= 250) {
          stats.lastStatusUpdateMs = nowMs;
          setConnectionState(connectionId, () => ({
            frameCount: stats.frameCount,
            status: `Connected to ${url} - ${stats.frameCount} frames`,
          }));
        }
        simConnectionStatsRef.current.set(connectionId, stats);
      };

      socket.onerror = () => {
        setConnectionState(connectionId, () => ({
          error: "WebSocket connection error",
        }));
      };

      socket.onclose = () => {
        if (simSocketsRef.current.get(connectionId) === socket) {
          simSocketsRef.current.delete(connectionId);
        }
        setConnectionState(connectionId, () => ({
          connecting: false,
          connected: false,
          status: didOpen ? "Disconnected" : "Unable to connect",
        }));
        clearVehiclesForConnection(connectionId);
      };
    },
    [clearVehiclesForConnection, closeSimConnectionSocket, setConnectionState, simConnections],
  );

  useEffect(
    () => () => {
      for (const connectionId of simSocketsRef.current.keys()) {
        closeSimConnectionSocket(connectionId);
      }
    },
    [closeSimConnectionSocket],
  );

  const simVehicleList = useMemo(
    () =>
      Object.values(simVehiclesBySystemId)
        .filter((vehicle) => Number.isFinite(vehicle?.systemId))
        .sort((a, b) => a.systemId - b.systemId),
    [simVehiclesBySystemId],
  );

  useEffect(() => {
    if (!simVehicleList.length) {
      setSelectedSystemId(null);
      return;
    }
    if (selectedSystemId != null && simVehicleList.some((vehicle) => vehicle.systemId === selectedSystemId)) {
      return;
    }
    setSelectedSystemId(simVehicleList[0].systemId);
  }, [selectedSystemId, simVehicleList]);

  const selectedVehicle = useMemo(
    () => simVehicleList.find((vehicle) => vehicle.systemId === selectedSystemId) ?? null,
    [selectedSystemId, simVehicleList],
  );
  const selectedSimVehicleMesh = useMemo(() => {
    if (selectedSystemId == null) {
      return createDefaultVehicleMeshSettings();
    }
    return simVehicleMeshSettings[String(selectedSystemId)] ?? createDefaultVehicleMeshSettings();
  }, [selectedSystemId, simVehicleMeshSettings]);
  const selectedSimSample = selectedVehicle?.latestSample ?? null;
  const simDuration = selectedSimSample?.time ?? 0;
  const simMaxDistanceThreshold = useMemo(() => {
    const parsed = Number(simMaxDistanceMeters);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [simMaxDistanceMeters]);
  const simCombinedFrameCount = useMemo(
    () => simConnections.reduce((sum, connection) => sum + (connection.frameCount || 0), 0),
    [simConnections],
  );
  const simConnectedCount = useMemo(
    () => simConnections.filter((connection) => connection.connected).length,
    [simConnections],
  );
  const simSummary = useMemo(() => {
    if (!simConnections.length) {
      return "No simulator websocket rows configured.";
    }
    if (!simConnectedCount) {
      return "Disconnected. Add websocket rows and connect.";
    }
    return `${simConnectedCount}/${simConnections.length} websocket(s) connected - ${simVehicleList.length} vehicle(s)`;
  }, [simConnectedCount, simConnections.length, simVehicleList.length]);
  const selectedVehicleUrl = useMemo(() => {
    if (!selectedVehicle) {
      return "No vehicle selected";
    }
    const source = simConnections.find((connection) => connection.id === selectedVehicle.connectionId);
    if (!source) {
      return `System ${selectedVehicle.systemId}`;
    }
    return `${buildWsUrl(source.host, source.port)} (sys ${selectedVehicle.systemId})`;
  }, [selectedVehicle, simConnections]);

  const sceneSample = activeView === "log" ? currentSample : selectedSimSample;

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
          <div className="channel-map-header">
            <h3>Actuator Channel Labels</h3>
            <button
              type="button"
              className="channel-map-toggle"
              onClick={() => setShowActuatorLabels((prev) => !prev)}
              aria-expanded={showActuatorLabels}
              aria-label={showActuatorLabels ? "Hide actuator labels" : "Show actuator labels"}
            >
              ☰
            </button>
          </div>
          {showActuatorLabels && (
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
          )}
        </section>
      )}

      <main className="app-body">
        <section className="scene-panel">
          <div className="scene-wrapper">
            <Suspense fallback={null}>
              <FlightScene
                samples={samples}
                activeSample={activeView === "log" ? currentSample : selectedSimSample}
                modelType={modelType}
                modelScale={modelScale}
                customModelUrl={customStlUrl}
                followCamera={followCamera}
                simMode={activeView === "sim"}
                rotateTailsitter90={rotateTailsitter90}
                simVehicles={simVehicleList}
                simVehicleMeshSettings={simVehicleMeshSettings}
                selectedSystemId={selectedSystemId}
                showInterVehicleLinks={showInterVehicleLinks}
                maxInterVehicleDistanceMeters={simMaxDistanceThreshold}
              />
            </Suspense>
            {activeView === "log" && !currentSample && <div className="scene-empty-hint">Load a PX4 .ulg to start playback.</div>}
            {activeView === "sim" && !selectedSimSample && (
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
            {activeView === "sim" && (
              <SimMapOverlay
                simVehicles={simVehicleList}
                selectedSystemId={selectedSystemId}
                showInterVehicleLinks={showInterVehicleLinks}
                maxDistanceMeters={simMaxDistanceThreshold}
                maxDistanceInput={simMaxDistanceMeters}
                onMaxDistanceInputChange={setSimMaxDistanceMeters}
              />
            )}
            <div className="scene-center-hud">
              <div>
                <span className="label">Speed</span>
                <strong>{Number.isFinite(sceneSample?.speed) ? `${sceneSample.speed.toFixed(1)} m/s` : "-"}</strong>
              </div>
              <div>
                <span className="label">Altitude</span>
                <strong>{Number.isFinite(sceneSample?.altitude) ? `${sceneSample.altitude.toFixed(1)} m` : "-"}</strong>
              </div>
              <div>
                <span className="label">Rel Alt</span>
                <strong>
                  {Number.isFinite(sceneSample?.altitudeRelative) ? `${sceneSample.altitudeRelative.toFixed(1)} m` : "-"}
                </strong>
              </div>
              <div>
                <span className="label">Heading</span>
                <strong>{formatHudHeading(sceneSample)}</strong>
              </div>
            </div>
            <div className="overlay-stack">
              <TelemetryOverlay
                sample={sceneSample}
                vehicleInfo={vehicleInfo}
                status={activeView === "log" ? status : simSummary}
                ulogName={activeView === "log" ? ulogName : selectedVehicleUrl}
                playing={activeView === "log" ? playing : simConnectedCount > 0}
                speed={activeView === "log" ? speed : 1}
              />
              <ArtificialHorizon sample={activeView === "log" ? currentSample : selectedSimSample} />
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
                  Live mode. {simCombinedFrameCount} frames received, selected at {simDuration.toFixed(2)} s.
                </span>
                <div className="sim-live-toggles">
                  <label>
                    <input
                      type="checkbox"
                      checked={followCamera}
                      onChange={(event) => setFollowCamera(event.target.checked)}
                    />
                    Follow camera
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showInterVehicleLinks}
                      onChange={(event) => setShowInterVehicleLinks(event.target.checked)}
                    />
                    Show blue dotted links
                  </label>
                </div>
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
              rotateTailsitter90={rotateTailsitter90}
              onRotateTailsitter90Change={setRotateTailsitter90}
              onCustomStlSelected={handleCustomStlSelected}
              customStlName={customStlName}
            />
          ) : (
            <SimulatorControls
              connections={simConnections}
              onConnectionFieldChange={handleSimConnectionFieldChange}
              onAddConnection={handleAddSimConnection}
              onRemoveConnection={handleRemoveSimConnection}
              onConnectConnection={handleSimConnectConnection}
              onDisconnectConnection={handleSimDisconnectConnection}
              vehicles={simVehicleList}
              selectedSystemId={selectedSystemId}
              onSelectedSystemIdChange={setSelectedSystemId}
              status={simSummary}
              modelType={selectedSimVehicleMesh.modelType}
              onModelChange={handleSelectedSimModelTypeChange}
              modelScale={selectedSimVehicleMesh.modelScale}
              onModelScaleChange={handleSelectedSimModelScaleChange}
              rotateTailsitter90={selectedSimVehicleMesh.rotateTailsitter90}
              onRotateTailsitter90Change={handleSelectedSimRotate90Change}
              tailsitterPitchCorrection={selectedSimVehicleMesh.tailsitterPitchCorrection}
              onTailsitterPitchCorrectionChange={handleSelectedSimPitchCorrectionChange}
              onCustomStlSelected={handleSelectedSimCustomStlSelected}
              customStlName={selectedSimVehicleMesh.customStlName}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

export default App;
