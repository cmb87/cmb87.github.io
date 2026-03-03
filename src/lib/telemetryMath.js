import { Euler, Quaternion, Vector3 } from "three";

const tempQuatA = new Quaternion();
const tempQuatB = new Quaternion();
const tempQuatOut = new Quaternion();
const tempTelemetryA = new Quaternion();
const tempTelemetryB = new Quaternion();
const tempTelemetryOut = new Quaternion();
const tempEuler = new Euler();
const WORLD_UP = new Vector3(0, 0, -1);
const tempForward = new Vector3();
const tempRight = new Vector3();
const tempForwardHoriz = new Vector3();
const tempHorizonRight = new Vector3();
const tempCross = new Vector3();

function arrayToQuaternion(arr = []) {
  return tempQuatA.set(arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 1);
}

function quaternionToArray(quat) {
  return [quat.x, quat.y, quat.z, quat.w];
}

function getTelemetryQuat(sample) {
  const source = sample.telemetryQuaternion ?? sample.quaternion;
  return source;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateVector(vecA = [], vecB = [], t) {
  return vecA.map((value, index) => lerp(value, vecB[index] ?? value, t));
}

export function sampleAtTime(samples, time) {
  if (!samples?.length) {
    return null;
  }
  if (time <= 0) {
    return samples[0];
  }
  const last = samples[samples.length - 1];
  if (time >= last.time) {
    return last;
  }

  let low = 0;
  let high = samples.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTime = samples[mid].time;
    if (midTime === time) {
      return samples[mid];
    }
    if (midTime < time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const leftIndex = Math.max(0, low - 1);
  const rightIndex = Math.min(samples.length - 1, low);
  const left = samples[leftIndex];
  const right = samples[rightIndex];

  if (left === right) {
    return left;
  }

  const span = right.time - left.time;
  const t = span > 0 ? (time - left.time) / span : 0;

  const qLeft = arrayToQuaternion(left.quaternion);
  const qRight = tempQuatB.set(
    right.quaternion[0],
    right.quaternion[1],
    right.quaternion[2],
    right.quaternion[3],
  );
  const quat = tempQuatOut.copy(qLeft).slerp(qRight, t);
  const tLeftArr = getTelemetryQuat(left);
  const tRightArr = getTelemetryQuat(right);
  const tLeft = tempTelemetryA.set(
    tLeftArr[0],
    tLeftArr[1],
    tLeftArr[2],
    tLeftArr[3],
  );
  const tRight = tempTelemetryB.set(
    tRightArr[0],
    tRightArr[1],
    tRightArr[2],
    tRightArr[3],
  );
  const telemetryQuat = tempTelemetryOut.copy(tLeft).slerp(tRight, t);
  const euler = tempEuler.setFromQuaternion(telemetryQuat, "XYZ");

  return {
    time,
    quaternion: quaternionToArray(quat),
    telemetryQuaternion: quaternionToArray(telemetryQuat),
    position: interpolateVector(left.position, right.position, t),
    velocity: interpolateVector(left.velocity, right.velocity, t),
    altitude: lerp(left.altitude, right.altitude, t),
    altitudeRelative: lerp(left.altitudeRelative ?? left.altitude, right.altitudeRelative ?? right.altitude, t),
    euler: [euler.x, euler.y, euler.z],
    speed: lerp(left.speed, right.speed, t),
    flightMode: left.flightMode ?? right.flightMode ?? "Unknown",
    vehicleState: left.vehicleState ?? right.vehicleState ?? "Unknown",
  };
}

export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) {
    return "--:--";
  }
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export function toDegrees(value) {
  return value * (180 / Math.PI);
}

export function attitudeFromQuaternion(quaternion) {
  if (!quaternion) {
    return [0, 0, 0];
  }

  tempForward.set(1, 0, 0).applyQuaternion(quaternion);
  tempRight.set(0, 1, 0).applyQuaternion(quaternion);

  const pitch = Math.asin(Math.max(-1, Math.min(1, -tempForward.z)));

  tempForwardHoriz.copy(tempForward);
  tempForwardHoriz.z = 0;
  const horizLenSq = tempForwardHoriz.lengthSq();

  if (horizLenSq < 1e-8) {
    return [0, pitch, 0];
  }

  tempForwardHoriz.multiplyScalar(1 / Math.sqrt(horizLenSq));
  tempHorizonRight.copy(tempForwardHoriz).cross(WORLD_UP).normalize();

  const rollCos = Math.max(-1, Math.min(1, tempHorizonRight.dot(tempRight)));
  const rollSin = tempForward.dot(tempCross.copy(tempHorizonRight).cross(tempRight));
  const roll = Math.atan2(rollSin, rollCos);
  const yaw = Math.atan2(tempForwardHoriz.y, tempForwardHoriz.x);

  return [roll, pitch, yaw];
}

export function formatDegrees(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(1)}°`;
}
