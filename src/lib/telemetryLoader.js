import { MessageType, ULog } from "@foxglove/ulog";
import { BlobReader } from "@foxglove/ulog/web";
import { Euler, Matrix4, Quaternion } from "three";

const MIN_SAMPLE_STEP = 1 / 120;
const MIN_SERIES_STEP = 1 / 50;

const REQUIRED_TOPICS = ["vehicle_attitude", "vehicle_local_position"];
const OPTIONAL_TOPICS = [
  "vehicle_status",
  "vehicle_control_mode",
  "vtol_vehicle_status",
  "actuator_outputs",
  "manual_control_setpoint",
  "manual_control_switches",
  "vehicle_attitude_setpoint",
  "vehicle_angular_velocity",
  "vehicle_rates_setpoint",
  "actuator_motors",
  "failsafe_flags",
  "event",
];

const RAD_TO_DEG = 180 / Math.PI;

const NAV_STATE_LABELS = {
  0: "Manual",
  1: "Altitude",
  2: "Position",
  3: "Mission",
  4: "Hold",
  5: "RTL",
  6: "Acro",
  7: "Descend",
  8: "Termination",
  9: "Offboard",
  10: "Stabilized",
  11: "Takeoff",
  12: "Land",
  13: "Follow",
  14: "Precision Land",
  15: "Orbit",
  16: "VTOL Takeoff",
};

const VTOL_STATE_LABELS = {
  0: "Unknown",
  1: "Transition to FW",
  2: "Transition to MC",
  3: "Multicopter",
  4: "Fixed Wing",
};

const nedToSceneMatrix = new Matrix4().set(
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
);

const NED_TO_SCENE_QUAT = new Quaternion().setFromRotationMatrix(nedToSceneMatrix);

function safeNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return fallback;
}

function toSeconds(timestamp, baseTime) {
  return Number(timestamp - baseTime) / 1e6;
}

function toQuaternion(px4Quat) {
  if (!Array.isArray(px4Quat) || px4Quat.length < 4) {
    return undefined;
  }
  const [w = 1, x = 0, y = 0, z = 0] = px4Quat;
  return new Quaternion(x, y, z, w);
}

function convertVectorNedToScene([north = 0, east = 0, down = 0]) {
  return [east, -down, -north];
}

function convertOrientationToScene(pxQuat) {
  return NED_TO_SCENE_QUAT.clone().multiply(pxQuat);
}

function navStateLabel(navState) {
  return NAV_STATE_LABELS[navState] ?? `State ${navState}`;
}

function inferVehicleState(status, vtolState) {
  if (typeof vtolState?.vehicle_vtol_state === "number") {
    return VTOL_STATE_LABELS[vtolState.vehicle_vtol_state] ?? `VTOL ${vtolState.vehicle_vtol_state}`;
  }
  if (status?.is_vtol) {
    if (status.in_transition_mode) {
      return status.in_transition_to_fw ? "Transition to FW" : "Transition to MC";
    }
    return status.vehicle_type === 2 ? "Fixed Wing" : "Multicopter";
  }
  return status?.vehicle_type === 2 ? "Fixed Wing" : "Multicopter";
}

function deriveFlightMode(status, controlMode) {
  if (!controlMode) {
    return navStateLabel(safeNumber(status?.nav_state, -1));
  }

  if (controlMode.flag_control_offboard_enabled) {
    return "Offboard";
  }

  if (controlMode.flag_control_manual_enabled) {
    if (controlMode.flag_control_position_enabled || controlMode.flag_multicopter_position_control_enabled) {
      return "Position";
    }
    if (controlMode.flag_control_altitude_enabled) {
      return "Altitude";
    }
    if (controlMode.flag_control_attitude_enabled) {
      return "Stabilized";
    }
    if (controlMode.flag_control_rates_enabled) {
      return "Acro";
    }
    return "Manual";
  }

  if (controlMode.flag_control_auto_enabled) {
    return navStateLabel(safeNumber(status?.nav_state, -1));
  }

  return navStateLabel(safeNumber(status?.nav_state, -1));
}

function deriveVehicleType(status) {
  if (!status) {
    return "Unknown";
  }
  if (status.is_vtol_tailsitter) {
    return "VTOL Tailsitter";
  }
  if (status.is_vtol) {
    return "VTOL";
  }
  return status.vehicle_type === 2 ? "Fixed Wing" : "Multicopter";
}

function fieldAsNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return undefined;
}

function fieldAsString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const chars = value
      .map((item) => fieldAsNumber(item))
      .filter((item) => Number.isFinite(item) && item > 0)
      .map((item) => String.fromCharCode(item));
    const text = chars.join("").trim();
    return text || undefined;
  }
  return undefined;
}

function decodeReleaseVersion(value) {
  const raw = fieldAsNumber(value);
  if (!Number.isFinite(raw)) {
    return undefined;
  }
  const int = raw >>> 0;
  const major = (int >>> 24) & 0xff;
  const minor = (int >>> 16) & 0xff;
  const patch = (int >>> 8) & 0xff;
  if (major === 0 && minor === 0 && patch === 0) {
    return undefined;
  }
  return `v${major}.${minor}.${patch}`;
}

function extractVehicleInfo(ulog) {
  const information = ulog.header?.information;
  if (!information) {
    return {
      vehicleType: "Unknown",
      px4Version: "Unknown",
      px4VersionHash: "",
      hardware: "",
      os: "",
    };
  }

  const sysName = fieldAsString(information.get("sys_name")) ?? "PX4";
  const verSwHash = fieldAsString(information.get("ver_sw")) ?? "";
  const verSwRelease = decodeReleaseVersion(information.get("ver_sw_release"));
  const verHw = fieldAsString(information.get("ver_hw")) ?? "";
  const osName = fieldAsString(information.get("sys_os_name")) ?? "";

  const px4Version = verSwRelease ?? (verSwHash ? `${sysName} ${verSwHash.slice(0, 8)}` : sysName);

  return {
    vehicleType: "Unknown",
    px4Version,
    px4VersionHash: verSwHash,
    hardware: verHw,
    os: osName,
  };
}

function toTitleCaseLabel(text) {
  return text
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function eventLevelLabel(logLevels) {
  const level = safeNumber(logLevels, 0) & 0x0f;
  if (level >= 8) {
    return "Error";
  }
  if (level >= 4) {
    return "Warning";
  }
  if (level >= 2) {
    return "Info";
  }
  return "Debug";
}

function eventSummary(id, levelLabel, args) {
  const eventId = safeNumber(id, 0) >>> 0;
  const group = (eventId >>> 16) & 0xff;
  const code = eventId & 0xffff;
  const compactArgs = Array.isArray(args)
    ? args
        .map((value) => safeNumber(value, 0))
        .filter((value, index) => value !== 0 || index < 3)
        .slice(0, 6)
    : [];
  const argsText = compactArgs.length ? ` args ${compactArgs.join(", ")}` : "";
  return `${levelLabel} event g${group} c${code}${argsText}`;
}

function createSample({
  time,
  renderQuaternion,
  telemetryQuaternion,
  position,
  velocity,
  altitude,
  altitudeRelative,
  flightMode,
  vehicleState,
  vehicleType,
}) {
  const euler = new Euler().setFromQuaternion(telemetryQuaternion, "XYZ");
  return {
    time,
    quaternion: [
      renderQuaternion.x,
      renderQuaternion.y,
      renderQuaternion.z,
      renderQuaternion.w,
    ],
    telemetryQuaternion: [
      telemetryQuaternion.x,
      telemetryQuaternion.y,
      telemetryQuaternion.z,
      telemetryQuaternion.w,
    ],
    position,
    velocity,
    altitude,
    altitudeRelative,
    euler: [euler.x, euler.y, euler.z],
    speed: Math.hypot(...velocity),
    flightMode,
    vehicleState,
    vehicleType,
  };
}

function normalizeActuatorValue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (Math.abs(value) <= 1.5) {
    return Math.max(-1, Math.min(1, value));
  }
  return Math.max(-1, Math.min(1, (value - 1500) / 500));
}

function normalizeSwitchValue(value) {
  return safeNumber(value, 0);
}

function toDegrees(value) {
  return safeNumber(value) * RAD_TO_DEG;
}

function normalizeRatesDeg(body, fallback = [0, 0, 0]) {
  const xyz = Array.isArray(body?.xyz) ? body.xyz : null;
  if (xyz && xyz.length >= 3) {
    return [toDegrees(xyz[0]), toDegrees(xyz[1]), toDegrees(xyz[2])];
  }

  const rollRate = body?.roll ?? body?.rollspeed ?? body?.x;
  const pitchRate = body?.pitch ?? body?.pitchspeed ?? body?.y;
  const yawRate = body?.yaw ?? body?.yawspeed ?? body?.z;

  if ([rollRate, pitchRate, yawRate].some((value) => Number.isFinite(safeNumber(value, NaN)))) {
    return [toDegrees(rollRate), toDegrees(pitchRate), toDegrees(yawRate)];
  }

  return fallback;
}

function extractManualSwitches(body, fallback = []) {
  if (!body) {
    return fallback;
  }

  return [
    normalizeSwitchValue(body.arm_switch),
    normalizeSwitchValue(body.kill_switch),
    normalizeSwitchValue(body.return_switch),
    normalizeSwitchValue(body.loiter_switch),
    normalizeSwitchValue(body.offboard_switch),
    normalizeSwitchValue(body.gear_switch),
    normalizeSwitchValue(body.transition_switch),
    normalizeSwitchValue(body.engage_main_motor_switch),
    normalizeSwitchValue(body.photo_switch),
    normalizeSwitchValue(body.video_switch),
    normalizeSwitchValue(body.mode_slot),
  ];
}

function quaternionToEulerDeg(quaternion) {
  const euler = new Euler().setFromQuaternion(quaternion, "XYZ");
  return [euler.x * RAD_TO_DEG, euler.y * RAD_TO_DEG, euler.z * RAD_TO_DEG];
}

function setpointEulerDeg(body) {
  const setpointQuat = toQuaternion(body.q_d ?? body.quaternion_d);
  if (setpointQuat) {
    return quaternionToEulerDeg(setpointQuat);
  }
  return [
    toDegrees(body.roll_body),
    toDegrees(body.pitch_body),
    toDegrees(body.yaw_body),
  ];
}

export async function parseUlogFile(file, { onProgress } = {}) {
  const reader = new BlobReader(file);
  const ulog = new ULog(reader);
  await ulog.open();
  const vehicleInfo = extractVehicleInfo(ulog);

  const topicById = new Map();
  const idByTopic = new Map();
  for (const [msgId, sub] of ulog.subscriptions.entries()) {
    topicById.set(msgId, sub.name);
    if (!idByTopic.has(sub.name)) {
      idByTopic.set(sub.name, msgId);
    }
  }

  for (const required of REQUIRED_TOPICS) {
    if (!idByTopic.has(required)) {
      throw new Error(`ULog is missing required topic: ${required}`);
    }
  }

  const subscribedTopics = [...REQUIRED_TOPICS, ...OPTIONAL_TOPICS].filter((topic) => idByTopic.has(topic));
  const msgIds = new Set(subscribedTopics.map((topic) => idByTopic.get(topic)));

  const samples = [];
  const actuatorSeries = [];
  const motorSeries = [];
  const manualSeries = [];
  const attitudeSeries = [];
  const ratesSeries = [];
  const velocityAltitudeSeries = [];
  const failsafeSeries = [];
  const eventSeries = [];
  const failsafeTransitions = [];

  let baseTime;
  let originNed;
  let fallbackOriginNed;
  let altitudeRefAmsl;

  let orientation;
  let position;
  let hasValidXYOrigin = false;

  let currentStatus;
  let currentControlMode;
  let currentVtolStatus;
  let currentFlightMode = "Unknown";
  let currentVehicleState = "Multicopter";
  let currentVehicleType = vehicleInfo.vehicleType;

  let lastActuatorTime = -Infinity;
  let lastMotorTime = -Infinity;
  let lastManualTime = -Infinity;
  let lastAttitudePlotTime = -Infinity;
  let lastRatesPlotTime = -Infinity;
  let lastVelocityAltitudePlotTime = -Infinity;
  let lastFailsafePlotTime = -Infinity;

  let latestAttitudeDeg = [0, 0, 0];
  let latestSetpointDeg = [0, 0, 0];
  let latestRatesDeg = [0, 0, 0];
  let latestRateSetpointDeg = [0, 0, 0];
  let latestManualSticks = [0, 0, 0, 0];
  let latestManualSwitches = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let latestAltitudeRelative = 0;
  let latestAltitudeAmsl = 0;
  let latestVelocity = [0, 0, 0];
  let sawActuatorMotors = false;
  const lastFailsafeFlags = new Map();

  for await (const msg of ulog.readMessages({ includeLogs: false, msgIds })) {
    if (msg.type !== MessageType.Data) {
      continue;
    }

    const topic = topicById.get(msg.msgId);
    if (!topic) {
      continue;
    }

    const body = msg.value ?? {};
    const timestamp = body.timestamp_sample ?? body.timestamp ?? 0n;
    if (baseTime === undefined) {
      baseTime = timestamp;
    }
    const time = toSeconds(timestamp, baseTime);

    if (topic === "vehicle_status") {
      currentStatus = body;
      currentFlightMode = deriveFlightMode(currentStatus, currentControlMode);
      currentVehicleState = inferVehicleState(currentStatus, currentVtolStatus);
      currentVehicleType = deriveVehicleType(currentStatus);
      continue;
    }

    if (topic === "vehicle_control_mode") {
      currentControlMode = body;
      currentFlightMode = deriveFlightMode(currentStatus, currentControlMode);
      continue;
    }

    if (topic === "vtol_vehicle_status") {
      currentVtolStatus = body;
      currentVehicleState = inferVehicleState(currentStatus, currentVtolStatus);
      continue;
    }

    if (topic === "failsafe_flags") {
      const activeFlags = Object.entries(body)
        .filter(([key, value]) => key !== "timestamp" && typeof value === "boolean" && value)
        .map(([key]) => key);
      const activeSet = new Set(activeFlags);

      for (const [flag, wasActive] of lastFailsafeFlags.entries()) {
        const isActive = activeSet.has(flag);
        if (wasActive !== isActive) {
          failsafeTransitions.push({
            time,
            flag,
            label: toTitleCaseLabel(flag),
            active: isActive,
          });
          lastFailsafeFlags.set(flag, isActive);
        }
      }
      for (const flag of activeSet) {
        if (!lastFailsafeFlags.has(flag)) {
          failsafeTransitions.push({
            time,
            flag,
            label: toTitleCaseLabel(flag),
            active: true,
          });
          lastFailsafeFlags.set(flag, true);
        }
      }

      if (time - lastFailsafePlotTime >= MIN_SERIES_STEP) {
        failsafeSeries.push({
          time,
          channels: [activeFlags.length],
          activeFlags,
        });
        lastFailsafePlotTime = time;
      }
      continue;
    }

    if (topic === "event") {
      const levelLabel = eventLevelLabel(body.log_levels);
      const summary = eventSummary(body.id, levelLabel, body.arguments);
      eventSeries.push({
        time,
        id: safeNumber(body.id, 0),
        level: levelLabel,
        summary,
      });
      continue;
    }

    if (topic === "actuator_outputs") {
      if (time - lastActuatorTime >= MIN_SERIES_STEP) {
        const noutputs = Math.min(8, safeNumber(body.noutputs, 0));
        const output = Array.isArray(body.output) ? body.output : [];
        const channels = Array.from({ length: noutputs }, (_, index) =>
          normalizeActuatorValue(safeNumber(output[index], 0)),
        );
        actuatorSeries.push({ time, channels });
        lastActuatorTime = time;

        if (!sawActuatorMotors && time - lastMotorTime >= MIN_SERIES_STEP) {
          const motorChannels = channels.slice(0, Math.min(4, channels.length));
          if (motorChannels.length) {
            motorSeries.push({ time, channels: motorChannels });
            lastMotorTime = time;
          }
        }
      }
      continue;
    }

    if (topic === "actuator_motors") {
      sawActuatorMotors = true;
      if (time - lastMotorTime >= MIN_SERIES_STEP) {
        const control = Array.isArray(body.control) ? body.control : [];
        const channels = Array.from({ length: Math.min(8, control.length) }, (_, index) =>
          normalizeActuatorValue(control[index]),
        );
        if (channels.length) {
          motorSeries.push({ time, channels });
          lastMotorTime = time;
        }
      }
      continue;
    }

    if (topic === "manual_control_setpoint") {
      latestManualSticks = [
        safeNumber(body.roll, 0),
        safeNumber(body.pitch, 0),
        safeNumber(body.yaw, 0),
        safeNumber(body.throttle, 0),
      ];
      if (time - lastManualTime >= MIN_SERIES_STEP) {
        manualSeries.push({
          time,
          channels: [...latestManualSticks, ...latestManualSwitches],
        });
        lastManualTime = time;
      }
      continue;
    }

    if (topic === "manual_control_switches") {
      latestManualSwitches = extractManualSwitches(body, latestManualSwitches);
      if (time - lastManualTime >= MIN_SERIES_STEP) {
        manualSeries.push({
          time,
          channels: [...latestManualSticks, ...latestManualSwitches],
        });
        lastManualTime = time;
      }
      continue;
    }

    if (topic === "vehicle_attitude_setpoint") {
      latestSetpointDeg = setpointEulerDeg(body);
      if (time - lastAttitudePlotTime >= MIN_SERIES_STEP) {
        attitudeSeries.push({
          time,
          channels: [
            latestAttitudeDeg[0],
            latestAttitudeDeg[1],
            latestAttitudeDeg[2],
            latestSetpointDeg[0],
            latestSetpointDeg[1],
            latestSetpointDeg[2],
          ],
        });
        lastAttitudePlotTime = time;
      }
      continue;
    }

    if (topic === "vehicle_rates_setpoint") {
      latestRateSetpointDeg = normalizeRatesDeg(body, latestRateSetpointDeg);
      if (time - lastRatesPlotTime >= MIN_SERIES_STEP) {
        ratesSeries.push({
          time,
          channels: [
            latestRatesDeg[0],
            latestRatesDeg[1],
            latestRatesDeg[2],
            latestRateSetpointDeg[0],
            latestRateSetpointDeg[1],
            latestRateSetpointDeg[2],
          ],
        });
        lastRatesPlotTime = time;
      }
      continue;
    }

    if (topic === "vehicle_angular_velocity") {
      latestRatesDeg = normalizeRatesDeg(body, latestRatesDeg);
      if (time - lastRatesPlotTime >= MIN_SERIES_STEP) {
        ratesSeries.push({
          time,
          channels: [
            latestRatesDeg[0],
            latestRatesDeg[1],
            latestRatesDeg[2],
            latestRateSetpointDeg[0],
            latestRateSetpointDeg[1],
            latestRateSetpointDeg[2],
          ],
        });
        lastRatesPlotTime = time;
      }
      continue;
    }

    if (topic === "vehicle_attitude") {
      const telemetryQuat = toQuaternion(body.q ?? body.quaternion);
      if (!telemetryQuat) {
        continue;
      }
      orientation = {
        time,
        telemetryQuat,
        renderQuat: convertOrientationToScene(telemetryQuat.clone()),
      };

      latestAttitudeDeg = quaternionToEulerDeg(telemetryQuat);
      latestRatesDeg = normalizeRatesDeg(body, latestRatesDeg);

      if (time - lastRatesPlotTime >= MIN_SERIES_STEP) {
        ratesSeries.push({
          time,
          channels: [
            latestRatesDeg[0],
            latestRatesDeg[1],
            latestRatesDeg[2],
            latestRateSetpointDeg[0],
            latestRateSetpointDeg[1],
            latestRateSetpointDeg[2],
          ],
        });
        lastRatesPlotTime = time;
      }

      if (time - lastAttitudePlotTime >= MIN_SERIES_STEP) {
        attitudeSeries.push({
          time,
          channels: [
            latestAttitudeDeg[0],
            latestAttitudeDeg[1],
            latestAttitudeDeg[2],
            latestSetpointDeg[0],
            latestSetpointDeg[1],
            latestSetpointDeg[2],
          ],
        });
        lastAttitudePlotTime = time;
      }
    }

    if (topic === "vehicle_local_position") {
      const xyValid = body.xy_valid !== false;
      const zValid = body.z_valid !== false;

      const rawNedPosition = [safeNumber(body.x), safeNumber(body.y), safeNumber(body.z)];
      const rawNedVelocity = [safeNumber(body.vx), safeNumber(body.vy), safeNumber(body.vz)];
      const rawRefAlt = Number(body.ref_alt);
      if (Number.isFinite(rawRefAlt)) {
        altitudeRefAmsl = rawRefAlt;
      }

      if (!fallbackOriginNed) {
        fallbackOriginNed = [...rawNedPosition];
      }
      if (!originNed && xyValid) {
        originNed = [...rawNedPosition];
        hasValidXYOrigin = true;
      }

      const referenceOrigin = originNed ?? fallbackOriginNed;
      const nedPosition = [
        hasValidXYOrigin
          ? xyValid
            ? rawNedPosition[0] - referenceOrigin[0]
            : position?.nedPosition?.[0] ?? 0
          : 0,
        hasValidXYOrigin
          ? xyValid
            ? rawNedPosition[1] - referenceOrigin[1]
            : position?.nedPosition?.[1] ?? 0
          : 0,
        zValid ? rawNedPosition[2] - referenceOrigin[2] : position?.nedPosition?.[2] ?? 0,
      ];
      const nedVelocity = [
        hasValidXYOrigin ? (xyValid ? rawNedVelocity[0] : position?.nedVelocity?.[0] ?? 0) : 0,
        hasValidXYOrigin ? (xyValid ? rawNedVelocity[1] : position?.nedVelocity?.[1] ?? 0) : 0,
        zValid ? rawNedVelocity[2] : position?.nedVelocity?.[2] ?? 0,
      ];

      position = {
        time,
        nedPosition,
        nedVelocity,
        scenePosition: convertVectorNedToScene(nedPosition),
        sceneVelocity: convertVectorNedToScene(nedVelocity),
        altitudeRelative: -nedPosition[2],
        altitudeAmsl: Number.isFinite(rawRefAlt)
          ? rawRefAlt - rawNedPosition[2]
          : Number.isFinite(altitudeRefAmsl)
            ? altitudeRefAmsl - rawNedPosition[2]
            : -nedPosition[2],
      };
      latestAltitudeRelative = position.altitudeRelative;
      latestAltitudeAmsl = position.altitudeAmsl;
      latestVelocity = [...position.sceneVelocity];

      if (time - lastVelocityAltitudePlotTime >= MIN_SERIES_STEP) {
        velocityAltitudeSeries.push({
          time,
          channels: [
            latestVelocity[0],
            latestVelocity[1],
            latestVelocity[2],
            latestAltitudeRelative,
            latestAltitudeAmsl,
          ],
        });
        lastVelocityAltitudePlotTime = time;
      }
    }

    if (!orientation || !position) {
      continue;
    }

    const nextTime = Math.max(orientation.time, position.time);
    const sample = createSample({
      time: nextTime,
      renderQuaternion: orientation.renderQuat.clone(),
      telemetryQuaternion: orientation.telemetryQuat.clone(),
      position: [...position.scenePosition],
      velocity: [...position.sceneVelocity],
      altitude: position.altitudeAmsl,
      altitudeRelative: position.altitudeRelative,
      flightMode: currentFlightMode,
      vehicleState: currentVehicleState,
      vehicleType: currentVehicleType,
    });

    if (!samples.length || nextTime - samples[samples.length - 1].time >= MIN_SAMPLE_STEP) {
      samples.push(sample);
    } else {
      samples[samples.length - 1] = sample;
    }

    onProgress?.({ samples: samples.length, seconds: nextTime });
  }

  if (!samples.length) {
    throw new Error("No usable telemetry found in the selected ULog");
  }

  return {
    samples,
    duration: samples[samples.length - 1].time,
    origin: originNed ?? fallbackOriginNed ?? [0, 0, 0],
    vehicleInfo: {
      ...vehicleInfo,
      vehicleType: currentVehicleType || vehicleInfo.vehicleType,
    },
    actuatorSeries,
    motorSeries,
    manualSeries,
    attitudeSeries,
    ratesSeries,
    velocityAltitudeSeries,
    failsafeSeries,
    eventSeries,
    failsafeTransitions,
  };
}
