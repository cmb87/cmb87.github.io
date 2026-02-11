import { formatDegrees, formatSeconds, toDegrees } from "../lib/telemetryMath";

function TelemetryOverlay({ sample, vehicleInfo, status, ulogName, playing, speed }) {
  const pitchDeg = sample ? toDegrees(sample.euler[1]) : null;
  const rollDeg = sample ? toDegrees(sample.euler[0]) : null;
  const yawDeg = sample ? toDegrees(sample.euler[2]) : null;
  const altitude = sample ? sample.altitude : null;
  const altitudeRelative = sample?.altitudeRelative;
  const speedValue = sample ? sample.speed : null;
  const velocity = sample ? sample.velocity : null;
  const flightMode = sample?.flightMode ?? "Unknown";
  const vehicleState = sample?.vehicleState ?? "Unknown";
  const vehicleType = sample?.vehicleType ?? vehicleInfo?.vehicleType ?? "Unknown";
  const px4Version = vehicleInfo?.px4Version ?? "Unknown";

  return (
    <div className="telemetry-overlay">
      <div className="telemetry-heading">
        <div>
          <p className="telemetry-title">{ulogName || "No ULog loaded"}</p>
          <p className="telemetry-status">{status}</p>
        </div>
        <div className="telemetry-mode">
          <span>{playing ? "Playing" : "Paused"}</span>
          <span>{speed.toFixed(2).replace(/\.00$/, "")}×</span>
        </div>
      </div>

      <div className="telemetry-grid">
        <div>
          <span className="label">Mission time</span>
          <strong>{sample ? formatSeconds(sample.time) : "--:--"}</strong>
        </div>
        <div>
          <span className="label">Altitude (AMSL)</span>
          <strong>{altitude != null ? `${altitude.toFixed(1)} m` : "—"}</strong>
          <span className="subvalue">Rel {altitudeRelative != null ? `${altitudeRelative.toFixed(1)} m` : "—"}</span>
        </div>
        <div>
          <span className="label">Ground speed</span>
          <strong>{speedValue != null ? `${speedValue.toFixed(1)} m/s` : "—"}</strong>
        </div>
        <div>
          <span className="label">Flight mode</span>
          <strong>{flightMode}</strong>
        </div>
        <div>
          <span className="label">Vehicle state</span>
          <strong>{vehicleState}</strong>
        </div>
        <div>
          <span className="label">Vehicle type</span>
          <strong>{vehicleType}</strong>
        </div>
        <div>
          <span className="label">PX4 version</span>
          <strong>{px4Version}</strong>
        </div>
        <div>
          <span className="label">Pitch</span>
          <strong>{pitchDeg != null ? formatDegrees(pitchDeg) : "—"}</strong>
        </div>
        <div>
          <span className="label">Roll</span>
          <strong>{rollDeg != null ? formatDegrees(rollDeg) : "—"}</strong>
        </div>
        <div>
          <span className="label">Yaw</span>
          <strong>{yawDeg != null ? formatDegrees(yawDeg) : "—"}</strong>
        </div>
        <div>
          <span className="label">Velocity (E/U/-N)</span>
          <strong>
            {velocity
              ? `${velocity[0].toFixed(1)}, ${velocity[1].toFixed(1)}, ${velocity[2].toFixed(1)} m/s`
              : "—"}
          </strong>
        </div>
      </div>
    </div>
  );
}

export default TelemetryOverlay;
