import { useState } from "react";

const DEFAULT_SIM_HOST = "127.0.0.1";
const DEFAULT_SIM_PORT = "8765";

function normalizeWsPort(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return 8765;
  }
  return parsed;
}

function buildWsUrl(host, port) {
  return `ws://${host.trim() || DEFAULT_SIM_HOST}:${normalizeWsPort(port || DEFAULT_SIM_PORT)}`;
}

function SimulatorControls({
  connections,
  onConnectionFieldChange,
  onAddConnection,
  onRemoveConnection,
  onConnectConnection,
  onDisconnectConnection,
  vehicles,
  selectedSystemId,
  onSelectedSystemIdChange,
  status,
  modelType,
  onModelChange,
  modelScale,
  onModelScaleChange,
  rotateTailsitter90,
  onRotateTailsitter90Change,
  tailsitterPitchCorrection,
  onTailsitterPitchCorrectionChange,
  onCustomStlSelected,
  customStlName,
}) {
  const [expandedConnectionIds, setExpandedConnectionIds] = useState(() => new Set());

  const vehicleIdsByConnection = connections.reduce((acc, connection) => {
    const ids = vehicles
      .filter((vehicle) => vehicle.connectionId === connection.id)
      .map((vehicle) => vehicle.systemId)
      .sort((a, b) => a - b);
    acc.set(connection.id, ids);
    return acc;
  }, new Map());

  const handleStlChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onCustomStlSelected(file);
    }
    event.target.value = "";
  };

  const toggleConnectionInputs = (connectionId) => {
    setExpandedConnectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(connectionId)) {
        next.delete(connectionId);
      } else {
        next.add(connectionId);
      }
      return next;
    });
  };

  const hasSelectedVehicle = Number.isFinite(selectedSystemId);

  return (
    <div className="panel">
      <h2>Simulator Streams</h2>
      <p className="panel-subtitle">Connect multiple PX4 SITL websockets and render all vehicle system IDs together.</p>

      <div className="panel-block">
        <span className="label">WebSocket connections</span>
        <div className="sim-connection-list">
          {connections.map((connection) => {
            const wsUrl = buildWsUrl(connection.host, connection.port);
            const connectionVehicleIds = vehicleIdsByConnection.get(connection.id) ?? [];
            const title =
              connectionVehicleIds.length === 1
                ? `Socket ${connection.id} - SYS ${connectionVehicleIds[0]}`
                : connectionVehicleIds.length > 1
                  ? `Socket ${connection.id} - SYS ${connectionVehicleIds.join(", ")}`
                  : `Socket ${connection.id}`;
            const showInputs = expandedConnectionIds.has(connection.id);
            return (
              <div key={connection.id} className="sim-connection-card">
                <div className="sim-connection-head">
                  <strong>{title}</strong>
                  <button
                    type="button"
                    className={`ghost sim-endpoint-toggle ${showInputs ? "active" : ""}`}
                    onClick={() => toggleConnectionInputs(connection.id)}
                    title={showInputs ? "Hide endpoint" : "Show endpoint"}
                    aria-label={showInputs ? "Hide endpoint" : "Show endpoint"}
                  >
                    <span className="sim-endpoint-toggle-icon" aria-hidden="true">
                      ☰
                    </span>
                  </button>
                </div>
                <div className="sim-connection-actions">
                    {connection.connected ? (
                      <button type="button" onClick={() => onDisconnectConnection(connection.id)}>
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onConnectConnection(connection.id)}
                        disabled={connection.connecting}
                      >
                        {connection.connecting ? "Connecting..." : "Connect"}
                      </button>
                    )}
                </div>

                {showInputs && (
                  <div className="ws-input-grid sim-connection-inputs">
                    <label>
                      <span>Host</span>
                      <input
                        type="text"
                        value={connection.host}
                        onChange={(event) => onConnectionFieldChange(connection.id, "host", event.target.value)}
                        placeholder="127.0.0.1"
                        disabled={connection.connected || connection.connecting}
                      />
                    </label>
                    <label>
                      <span>Port</span>
                      <input
                        type="number"
                        value={connection.port}
                        onChange={(event) => onConnectionFieldChange(connection.id, "port", event.target.value)}
                        min="1"
                        max="65535"
                        placeholder="8765"
                        disabled={connection.connected || connection.connecting}
                      />
                    </label>
                  </div>
                )}

                <div className="sim-connection-meta">
                  <div className="sim-connection-details">
                    <div className="input-meta">{wsUrl}</div>
                    <span className="sim-connection-frames">
                      {connection.frameCount} frames{connectionVehicleIds.length ? ` - SYS ${connectionVehicleIds.join(", ")}` : ""}
                    </span>
                    <p className="sim-connection-status">{connection.status}</p>
                  </div>
                  <button
                    type="button"
                    className="ghost sim-connection-remove"
                    onClick={() => onRemoveConnection(connection.id)}
                    disabled={connections.length <= 1}
                    title="Remove connection"
                    aria-label="Remove connection"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
                {connection.error && <p className="error-line">{connection.error}</p>}
              </div>
            );
          })}
        </div>

        <div className="control-row sim-add-websocket-row">
          <button type="button" onClick={onAddConnection}>
            Add connection
          </button>
          <details className="sim-json-help">
            <summary aria-label="Incoming websocket JSON">?</summary>
            <div className="sim-json-popover">
              <div className="sim-json-title">Incoming websocket JSON</div>
              <pre>{`{
  "system_id": 1,
  "time_usec": 1710000000000,
  "position_ned_m": [north, east, down],
  "quaternion_wxyz": [w, x, y, z],
  "lla": {
    "lat_deg": 47.397742,
    "lon_deg": 8.545594,
    "alt_m": 488.3
  },
  "heading_deg": 123.4,
  "u": [u0, u1, u2, u3, u4, u5, u6, u7]
}`}</pre>
            </div>
          </details>
        </div>
      </div>

      <div className="panel-block">
        <span className="label">Vehicles</span>
        {!vehicles.length ? (
          <div className="input-meta">No active vehicle system IDs yet.</div>
        ) : (
          <div className="sim-vehicle-chip-list">
            {vehicles.map((vehicle) => {
              const isSelected = vehicle.systemId === selectedSystemId;
              return (
                <button
                  key={vehicle.systemId}
                  type="button"
                  className={`sim-vehicle-chip ${isSelected ? "active" : ""}`}
                  onClick={() => onSelectedSystemIdChange(vehicle.systemId)}
                >
                  SYS {vehicle.systemId}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel-block">
        <span className="label">Vehicle mesh {hasSelectedVehicle ? `(SYS ${selectedSystemId})` : "(select vehicle first)"}</span>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="sim-selected-vehicle-model"
              value="stl"
              checked={modelType === "stl"}
              onChange={(event) => onModelChange(event.target.value)}
              disabled={!hasSelectedVehicle}
            />
            Bundled STL (public/tailsitter.stl)
          </label>
          <label>
            <input
              type="radio"
              name="sim-selected-vehicle-model"
              value="dummy"
              checked={modelType === "dummy"}
              onChange={(event) => onModelChange(event.target.value)}
              disabled={!hasSelectedVehicle}
            />
            Dummy cubes (debug)
          </label>
          <label>
            <input
              type="radio"
              name="sim-selected-vehicle-model"
              value="upload"
              checked={modelType === "upload"}
              onChange={(event) => onModelChange(event.target.value)}
              disabled={!hasSelectedVehicle}
            />
            Upload STL
          </label>
        </div>
        {modelType === "upload" && hasSelectedVehicle && (
          <>
            <label className="file-input upload-file-row">
              <span>Custom STL (.stl)</span>
              <input type="file" accept=".stl" onChange={handleStlChange} />
            </label>
            <div className="input-meta">{customStlName || "No STL selected"}</div>
          </>
        )}
        <label className="range-row">
          <span>STL scale</span>
          <input
            type="range"
            min="0.2"
            max="5"
            step="0.05"
            value={modelScale}
            onChange={(event) => onModelScaleChange(Number(event.target.value))}
            disabled={!hasSelectedVehicle || modelType === "dummy"}
          />
          <strong>{modelScale.toFixed(2)}x</strong>
        </label>
        {hasSelectedVehicle && (
          <>
            {modelType !== "dummy" && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={rotateTailsitter90}
                  onChange={(event) => onRotateTailsitter90Change(event.target.checked)}
                />
                Rotate STL mesh by 90 deg pitch
              </label>
            )}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={tailsitterPitchCorrection}
                onChange={(event) => onTailsitterPitchCorrectionChange(event.target.checked)}
              />
              Tailsitter pitch correction
            </label>
          </>
        )}
      </div>

      <div className="status-block">
        <p className="status-line">{status}</p>
      </div>
    </div>
  );
}

export default SimulatorControls;
