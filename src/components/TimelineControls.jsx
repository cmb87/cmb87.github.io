import { formatSeconds } from "../lib/telemetryMath";

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];

function TimelineControls({
  duration,
  time,
  playing,
  speed,
  disabled,
  onPlayToggle,
  onScrub,
  onSpeedChange,
  cameraMode,
  onCameraModeChange,
  onReset,
}) {
  const handleScrub = (event) => {
    const nextValue = Number(event.target.value);
    onScrub(Number.isFinite(nextValue) ? nextValue : 0);
  };

  const handleSpeed = (event) => {
    onSpeedChange(Number(event.target.value));
  };

  const sliderMax = Math.max(duration, 0.0001);

  return (
    <div className="timeline-controls">
      <button type="button" onClick={onPlayToggle} disabled={disabled}>
        {playing ? "Pause" : "Play"}
      </button>
      <input
        type="range"
        min="0"
        max={sliderMax}
        step="0.01"
        value={Math.min(time, sliderMax)}
        onChange={handleScrub}
        disabled={disabled}
      />
      <div className="timeline-meta">
        <span>
          {formatSeconds(time)} / {formatSeconds(duration)}
        </span>
        <label>
          Speed
          <select value={speed} onChange={handleSpeed} disabled={disabled}>
            {SPEED_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}×
              </option>
            ))}
          </select>
        </label>
        <label>
          Camera
          <select value={cameraMode} onChange={(event) => onCameraModeChange(event.target.value)} disabled={disabled}>
            <option value="free">Free moving</option>
            <option value="follow-third">Follow 3rd person</option>
            <option value="follow-first">First person</option>
          </select>
        </label>
        <button type="button" className="ghost" onClick={onReset} disabled={disabled}>
          Reset
        </button>
      </div>
    </div>
  );
}

export default TimelineControls;
