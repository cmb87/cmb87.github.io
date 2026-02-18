function SimulatorControls({
  host,
  onHostChange,
  port,
  onPortChange,
  wsUrl,
  connected,
  connecting,
  onConnect,
  onDisconnect,
  onClearTrail,
  status,
  error,
  motionScale,
  onMotionScaleChange,
  smoothing,
  onSmoothingChange,
  modelType,
  onModelChange,
  modelScale,
  onModelScaleChange,
  onCustomStlSelected,
  customStlName,
}) {
  const handleStlChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onCustomStlSelected(file);
    }
    event.target.value = "";
  };

  return (
    <div className="panel">
      <h2>Simulator Stream</h2>
      <p className="panel-subtitle">Connect to PX4 SITL websocket and visualize live ground-truth motion.</p>

      <div className="panel-block">
        <span className="label">WebSocket connection</span>
        <div className="ws-input-grid">
          <label>
            <span>Host</span>
            <input
              type="text"
              value={host}
              onChange={(event) => onHostChange(event.target.value)}
              placeholder="127.0.0.1"
              disabled={connected || connecting}
            />
          </label>
          <label>
            <span>Port</span>
            <input
              type="number"
              value={port}
              onChange={(event) => onPortChange(event.target.value)}
              min="1"
              max="65535"
              placeholder="8765"
              disabled={connected || connecting}
            />
          </label>
        </div>
        <div className="input-meta">{wsUrl}</div>
        <div className="control-row">
          {connected ? (
            <button type="button" onClick={onDisconnect}>
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={onConnect} disabled={connecting}>
              {connecting ? "Connecting..." : "Connect"}
            </button>
          )}
          <button type="button" className="ghost" onClick={onClearTrail} disabled={connecting}>
            Clear trail
          </button>
        </div>
      </div>

      <div className="panel-block">
        <span className="label">Motion scaling</span>
        <label className="range-row">
          <span>Path scale</span>
          <input
            type="range"
            min="0.05"
            max="5"
            step="0.05"
            value={motionScale}
            onChange={(event) => onMotionScaleChange(Number(event.target.value))}
          />
          <strong>{motionScale.toFixed(2)}x</strong>
        </label>
        <label className="range-row">
          <span>Smoothing</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={smoothing}
            onChange={(event) => onSmoothingChange(Number(event.target.value))}
          />
          <strong>{(smoothing * 100).toFixed(0)}%</strong>
        </label>
      </div>

      <div className="panel-block">
        <span className="label">Vehicle mesh</span>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="model"
              value="stl"
              checked={modelType === "stl"}
              onChange={(event) => onModelChange(event.target.value)}
            />
            Bundled STL (public/tailsitter.stl)
          </label>
          <label>
            <input
              type="radio"
              name="model"
              value="dummy"
              checked={modelType === "dummy"}
              onChange={(event) => onModelChange(event.target.value)}
            />
            Dummy cubes (debug)
          </label>
          <label>
            <input
              type="radio"
              name="model"
              value="upload"
              checked={modelType === "upload"}
              onChange={(event) => onModelChange(event.target.value)}
            />
            Upload STL
          </label>
        </div>
        {modelType === "upload" && (
          <>
            <label className="file-input upload-file-row">
              <span>Custom STL (.stl)</span>
              <input type="file" accept=".stl" onChange={handleStlChange} disabled={connecting} />
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
            disabled={modelType === "dummy"}
          />
          <strong>{modelScale.toFixed(2)}x</strong>
        </label>
      </div>

      <div className="status-block">
        <p className="status-line">
          <span className="status-dot" data-busy={connecting} />
          {status}
        </p>
        {error && <p className="error-line">{error}</p>}
      </div>
    </div>
  );
}

export default SimulatorControls;
