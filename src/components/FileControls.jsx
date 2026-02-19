function FileControls({
  onLogSelected,
  onLoadSample,
  onClear,
  status,
  error,
  loading,
  ulogName,
  modelType,
  onModelChange,
  modelScale,
  onModelScaleChange,
  rotateTailsitter90,
  onRotateTailsitter90Change,
  onCustomStlSelected,
  customStlName,
}) {
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onLogSelected(file);
    }
    event.target.value = "";
  };

  const handleStlChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onCustomStlSelected(file);
    }
    event.target.value = "";
  };

  return (
    <div className="panel">
      <h2>Data & Assets</h2>
      <p className="panel-subtitle">
        Load a PX4 ULog and choose bundled, dummy, or uploaded STL mesh.
      </p>

      <div className="panel-block">
        <label className="file-input">
          <span>ULog file (.ulg)</span>
          <input type="file" accept=".ulg" onChange={handleFileChange} disabled={loading} />
        </label>
        <div className="input-meta">{ulogName || "No log selected"}</div>
        <div className="control-row">
          <button type="button" onClick={onLoadSample} className="ghost" disabled={loading}>
            Load sample flight
          </button>
          <button type="button" onClick={onClear} disabled={loading}>
            Clear
          </button>
        </div>
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
              <input type="file" accept=".stl" onChange={handleStlChange} disabled={loading} />
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
      </div>

      <div className="status-block">
        <p className="status-line">
          <span className="status-dot" data-busy={loading} />
          {status}
        </p>
        {error && <p className="error-line">{error}</p>}
      </div>
    </div>
  );
}

export default FileControls;
