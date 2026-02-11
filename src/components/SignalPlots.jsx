import { useEffect, useMemo, useState } from "react";

const ACTUATOR_COLORS = ["#38bdf8", "#a78bfa", "#22d3ee", "#f59e0b", "#f97316", "#f43f5e", "#84cc16", "#eab308"];
const MOTOR_COLORS = ["#22d3ee", "#38bdf8", "#7dd3fc", "#0ea5e9", "#a78bfa", "#f59e0b", "#84cc16", "#f43f5e"];
const MANUAL_COLORS = [
  "#38bdf8",
  "#f43f5e",
  "#a78bfa",
  "#22d3ee",
  "#84cc16",
  "#f59e0b",
  "#eab308",
  "#f97316",
  "#06b6d4",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#facc15",
  "#14b8a6",
];
const ATTITUDE_COLORS = ["#38bdf8", "#f43f5e", "#a78bfa", "#22d3ee", "#f97316", "#84cc16"];
const RATES_COLORS = ["#38bdf8", "#f43f5e", "#a78bfa", "#22d3ee", "#f97316", "#84cc16"];
const VELOCITY_ALT_COLORS = ["#38bdf8", "#22d3ee", "#a78bfa", "#f59e0b", "#eab308"];
const FAILSAFE_COLORS = ["#f97316"];

const MANUAL_STICK_LABELS = ["Roll", "Pitch", "Yaw", "Throttle"];
const MANUAL_SWITCH_LABELS = [
  "Arm",
  "Kill",
  "Return",
  "Loiter",
  "Offboard",
  "Gear",
  "Transition",
  "Main Motor",
  "Photo",
  "Video",
  "Mode Slot",
];
const ATTITUDE_LABELS = ["Roll", "Pitch", "Yaw", "Roll SP", "Pitch SP", "Yaw SP"];
const RATES_LABELS = ["Roll Rate", "Pitch Rate", "Yaw Rate", "Roll Rate SP", "Pitch Rate SP", "Yaw Rate SP"];
const VELOCITY_ALT_LABELS = ["Vel E", "Vel U", "Vel -N", "Alt Rel", "Alt AMSL"];
const FAILSAFE_LABELS = ["Active Flags"];

function toCanvasPoint(time, value, start, end, width, height, minValue, maxValue) {
  const x = ((time - start) / Math.max(end - start, 1e-6)) * width;
  const ratio = (value - minValue) / Math.max(maxValue - minValue, 1e-6);
  const y = (1 - ratio) * height;
  return [x, y];
}

function computeYRange(inRange, visibleChannels, fixedRange) {
  if (fixedRange) {
    return fixedRange;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const item of inRange) {
    for (const channel of visibleChannels) {
      const value = item.channels[channel];
      if (!Number.isFinite(value)) {
        continue;
      }
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [-1, 1];
  }
  const span = Math.max(1, max - min);
  return [min - span * 0.15, max + span * 0.15];
}

function renderPlot({ series, colors, width, height, windowRange, cursorTime, visibleChannels, fixedRange, dashedFrom }) {
  if (!series.length || !visibleChannels.size) {
    return null;
  }

  const [start, end] = windowRange;
  const inRange = series.filter((item) => item.time >= start && item.time <= end);
  if (!inRange.length) {
    return null;
  }

  const channelCount = inRange[0].channels.length;
  const [yMin, yMax] = computeYRange(inRange, visibleChannels, fixedRange);

  const paths = Array.from({ length: channelCount }, () => []);
  for (const item of inRange) {
    for (let i = 0; i < channelCount; i += 1) {
      if (!visibleChannels.has(i)) {
        continue;
      }
      const value = item.channels[i];
      if (!Number.isFinite(value)) {
        continue;
      }
      const [x, y] = toCanvasPoint(item.time, value, start, end, width, height, yMin, yMax);
      paths[i].push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  }

  const cursorX = ((cursorTime - start) / Math.max(end - start, 1e-6)) * width;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="signal-svg">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="signal-midline" />
      {paths.map((points, index) =>
        points.length ? (
          <polyline
            key={index}
            points={points.join(" ")}
            fill="none"
            stroke={colors[index % colors.length]}
            strokeWidth="1.8"
            strokeDasharray={dashedFrom != null && index >= dashedFrom ? "6 4" : undefined}
          />
        ) : null,
      )}
      <line
        x1={Math.max(0, Math.min(width, cursorX))}
        x2={Math.max(0, Math.min(width, cursorX))}
        y1="0"
        y2={height}
        className="signal-cursor"
      />
    </svg>
  );
}

function Legend({ labels, colors, visibleChannels, onToggle, onAll, onNone }) {
  return (
    <div className="signal-legend">
      <div className="signal-legend-controls">
        <button type="button" className="legend-link" onClick={onAll}>
          all
        </button>
        <button type="button" className="legend-link" onClick={onNone}>
          none
        </button>
      </div>
      {labels.map((label, index) => {
        const active = visibleChannels.has(index);
        return (
          <button
            key={`${label}-${index}`}
            type="button"
            className={`legend-item ${active ? "active" : ""}`}
            onClick={() => onToggle(index)}
          >
            <span className="legend-swatch" style={{ backgroundColor: colors[index % colors.length] }} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ensureVisibleSet(prev, count) {
  if (prev.size === 0) {
    return new Set(Array.from({ length: count }, (_, index) => index));
  }
  const next = new Set(Array.from(prev).filter((index) => index < count));
  return next.size ? next : new Set(Array.from({ length: count }, (_, index) => index));
}

function toggleChannel(setter, index) {
  setter((prev) => {
    const next = new Set(prev);
    next.has(index) ? next.delete(index) : next.add(index);
    return next;
  });
}

function SignalPlots({
  actuatorSeries,
  motorSeries,
  manualSeries,
  attitudeSeries,
  ratesSeries,
  velocityAltitudeSeries,
  failsafeSeries,
  eventSeries,
  failsafeTransitions,
  time,
  duration,
  actuatorLabels,
}) {
  const [activeTab, setActiveTab] = useState("actuator");

  const actuatorCount = actuatorSeries[0]?.channels?.length ?? 0;
  const motorCount = motorSeries[0]?.channels?.length ?? 0;
  const manualCount = manualSeries[0]?.channels?.length ?? MANUAL_STICK_LABELS.length + MANUAL_SWITCH_LABELS.length;
  const attitudeCount = attitudeSeries[0]?.channels?.length ?? ATTITUDE_LABELS.length;
  const ratesCount = ratesSeries[0]?.channels?.length ?? RATES_LABELS.length;
  const velocityAltCount = velocityAltitudeSeries[0]?.channels?.length ?? VELOCITY_ALT_LABELS.length;
  const failsafeCount = failsafeSeries[0]?.channels?.length ?? FAILSAFE_LABELS.length;

  const [visibleActuators, setVisibleActuators] = useState(new Set());
  const [visibleMotors, setVisibleMotors] = useState(new Set());
  const [visibleManual, setVisibleManual] = useState(new Set());
  const [visibleAttitude, setVisibleAttitude] = useState(new Set());
  const [visibleRates, setVisibleRates] = useState(new Set());
  const [visibleVelocityAlt, setVisibleVelocityAlt] = useState(new Set());
  const [visibleFailsafe, setVisibleFailsafe] = useState(new Set());

  useEffect(() => {
    setVisibleActuators((prev) => ensureVisibleSet(prev, actuatorCount));
  }, [actuatorCount]);

  useEffect(() => {
    setVisibleMotors((prev) => ensureVisibleSet(prev, motorCount));
  }, [motorCount]);

  useEffect(() => {
    setVisibleManual((prev) => ensureVisibleSet(prev, manualCount));
  }, [manualCount]);

  useEffect(() => {
    setVisibleAttitude((prev) => ensureVisibleSet(prev, attitudeCount));
  }, [attitudeCount]);

  useEffect(() => {
    setVisibleRates((prev) => ensureVisibleSet(prev, ratesCount));
  }, [ratesCount]);

  useEffect(() => {
    setVisibleVelocityAlt((prev) => ensureVisibleSet(prev, velocityAltCount));
  }, [velocityAltCount]);

  useEffect(() => {
    setVisibleFailsafe((prev) => ensureVisibleSet(prev, failsafeCount));
  }, [failsafeCount]);

  const windowRange = useMemo(() => {
    const span = Math.min(30, Math.max(8, duration || 8));
    const start = Math.max(0, time - span * 0.35);
    return [start, start + span];
  }, [time, duration]);

  const actuatorLegend = useMemo(
    () => Array.from({ length: actuatorCount }, (_, index) => actuatorLabels[index] ?? `A${index + 1}`),
    [actuatorCount, actuatorLabels],
  );
  const motorLegend = useMemo(() => Array.from({ length: motorCount }, (_, index) => `M${index + 1}`), [motorCount]);
  const manualLegend = useMemo(() => {
    const labels = [...MANUAL_STICK_LABELS, ...MANUAL_SWITCH_LABELS];
    return Array.from({ length: manualCount }, (_, index) => labels[index] ?? `Manual ${index + 1}`);
  }, [manualCount]);
  const attitudeLegend = ATTITUDE_LABELS.slice(0, attitudeCount);
  const ratesLegend = RATES_LABELS.slice(0, ratesCount);
  const velocityAltLegend = VELOCITY_ALT_LABELS.slice(0, velocityAltCount);
  const failsafeLegend = FAILSAFE_LABELS.slice(0, failsafeCount);
  const recentEvents = useMemo(() => {
    const [start, end] = windowRange;
    return eventSeries.filter((item) => item.time >= start && item.time <= end).slice(-20).reverse();
  }, [eventSeries, windowRange]);
  const recentFailsafeTransitions = useMemo(() => {
    const [start, end] = windowRange;
    return failsafeTransitions.filter((item) => item.time >= start && item.time <= end).slice(-20).reverse();
  }, [failsafeTransitions, windowRange]);

  return (
    <div className="plot-stack">
      <div className="signal-tabs">
        <button
          type="button"
          className={`signal-tab ${activeTab === "actuator" ? "active" : ""}`}
          onClick={() => setActiveTab("actuator")}
        >
          Actuators
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "motor" ? "active" : ""}`}
          onClick={() => setActiveTab("motor")}
        >
          Motor Outputs
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "manual" ? "active" : ""}`}
          onClick={() => setActiveTab("manual")}
        >
          Manual Inputs
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          Events & Failsafes
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "attitude" ? "active" : ""}`}
          onClick={() => setActiveTab("attitude")}
        >
          Attitude vs Setpoint
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "rates" ? "active" : ""}`}
          onClick={() => setActiveTab("rates")}
        >
          Rates
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "velocity-alt" ? "active" : ""}`}
          onClick={() => setActiveTab("velocity-alt")}
        >
          Velocity + Altitude
        </button>
      </div>

      {activeTab === "rates" && (
        <div className="signal-plot">
          <div className="signal-header">
            <span>Body Rates / Setpoints (deg/s)</span>
            <small>{ratesSeries.length} samples</small>
          </div>
          <Legend
            labels={ratesLegend}
            colors={RATES_COLORS}
            visibleChannels={visibleRates}
            onToggle={(index) => toggleChannel(setVisibleRates, index)}
            onAll={() => setVisibleRates(new Set(Array.from({ length: ratesCount }, (_, i) => i)))}
            onNone={() => setVisibleRates(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: ratesSeries,
              colors: RATES_COLORS,
              width: 360,
              height: 120,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleRates,
              dashedFrom: 3,
            })}
          </div>
        </div>
      )}

      {activeTab === "velocity-alt" && (
        <div className="signal-plot">
          <div className="signal-header">
            <span>Velocity / Altitude</span>
            <small>{velocityAltitudeSeries.length} samples</small>
          </div>
          <Legend
            labels={velocityAltLegend}
            colors={VELOCITY_ALT_COLORS}
            visibleChannels={visibleVelocityAlt}
            onToggle={(index) => toggleChannel(setVisibleVelocityAlt, index)}
            onAll={() => setVisibleVelocityAlt(new Set(Array.from({ length: velocityAltCount }, (_, i) => i)))}
            onNone={() => setVisibleVelocityAlt(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: velocityAltitudeSeries,
              colors: VELOCITY_ALT_COLORS,
              width: 360,
              height: 120,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleVelocityAlt,
            })}
          </div>
        </div>
      )}

      {activeTab === "actuator" && (
        <div className="signal-plot">
          <div className="signal-header">
            <span>Actuator Commands</span>
            <small>{actuatorSeries.length} samples</small>
          </div>
          <Legend
            labels={actuatorLegend}
            colors={ACTUATOR_COLORS}
            visibleChannels={visibleActuators}
            onToggle={(index) => toggleChannel(setVisibleActuators, index)}
            onAll={() => setVisibleActuators(new Set(Array.from({ length: actuatorCount }, (_, i) => i)))}
            onNone={() => setVisibleActuators(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: actuatorSeries,
              colors: ACTUATOR_COLORS,
              width: 360,
              height: 120,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleActuators,
              fixedRange: [-1.05, 1.05],
            })}
          </div>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="signal-plot">
          <div className="signal-header">
            <span>Manual Inputs + Switches</span>
            <small>{manualSeries.length} samples</small>
          </div>
          <Legend
            labels={manualLegend}
            colors={MANUAL_COLORS}
            visibleChannels={visibleManual}
            onToggle={(index) => toggleChannel(setVisibleManual, index)}
            onAll={() => setVisibleManual(new Set(Array.from({ length: manualCount }, (_, i) => i)))}
            onNone={() => setVisibleManual(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: manualSeries,
              colors: MANUAL_COLORS,
              width: 360,
              height: 120,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleManual,
            })}
          </div>
        </div>
      )}

      {activeTab === "attitude" && (
        <div className="signal-plot">
          <div className="signal-header">
            <span>Attitude / Setpoint (deg)</span>
            <small>{attitudeSeries.length} samples</small>
          </div>
          <Legend
            labels={attitudeLegend}
            colors={ATTITUDE_COLORS}
            visibleChannels={visibleAttitude}
            onToggle={(index) => toggleChannel(setVisibleAttitude, index)}
            onAll={() => setVisibleAttitude(new Set(Array.from({ length: attitudeCount }, (_, i) => i)))}
            onNone={() => setVisibleAttitude(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: attitudeSeries,
              colors: ATTITUDE_COLORS,
              width: 360,
              height: 120,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleAttitude,
              dashedFrom: 3,
            })}
          </div>
        </div>
      )}

      {activeTab === "motor" && (
        <div className="signal-plot">
          <div className="signal-header">
            <span>Motor Outputs</span>
            <small>{motorSeries.length} samples</small>
          </div>
          <Legend
            labels={motorLegend}
            colors={MOTOR_COLORS}
            visibleChannels={visibleMotors}
            onToggle={(index) => toggleChannel(setVisibleMotors, index)}
            onAll={() => setVisibleMotors(new Set(Array.from({ length: motorCount }, (_, i) => i)))}
            onNone={() => setVisibleMotors(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: motorSeries,
              colors: MOTOR_COLORS,
              width: 360,
              height: 120,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleMotors,
              fixedRange: [-1.05, 1.05],
            })}
          </div>
        </div>
      )}

      {activeTab === "events" && (
        <div className="signal-plot events-plot">
          <div className="signal-header">
            <span>Failsafes / Events Timeline</span>
            <small>{failsafeSeries.length + eventSeries.length} records</small>
          </div>
          <Legend
            labels={failsafeLegend}
            colors={FAILSAFE_COLORS}
            visibleChannels={visibleFailsafe}
            onToggle={(index) => toggleChannel(setVisibleFailsafe, index)}
            onAll={() => setVisibleFailsafe(new Set(Array.from({ length: failsafeCount }, (_, i) => i)))}
            onNone={() => setVisibleFailsafe(new Set())}
          />
          <div className="signal-canvas">
            {renderPlot({
              series: failsafeSeries,
              colors: FAILSAFE_COLORS,
              width: 360,
              height: 110,
              windowRange,
              cursorTime: time,
              visibleChannels: visibleFailsafe,
            })}
          </div>
          <div className="event-lists">
            <div className="event-list">
              <div className="event-list-title">Events</div>
              {recentEvents.length ? (
                recentEvents.map((item, index) => (
                  <div key={`${item.time}-${item.id}-${index}`} className="event-row">
                    <span>{item.time.toFixed(2)}s</span>
                    <span>{item.level}</span>
                    <span>ID {item.id}</span>
                    <span>{item.summary}</span>
                  </div>
                ))
              ) : (
                <div className="event-empty">No event messages in current time window</div>
              )}
            </div>
            <div className="event-list">
              <div className="event-list-title">Failsafe Changes</div>
              {recentFailsafeTransitions.length ? (
                recentFailsafeTransitions.map((item, index) => (
                  <div key={`${item.time}-${item.flag}-${index}`} className="event-row">
                    <span>{item.time.toFixed(2)}s</span>
                    <span>{item.active ? "ACTIVE" : "CLEAR"}</span>
                    <span>{item.label}</span>
                  </div>
                ))
              ) : (
                <div className="event-empty">No failsafe changes in current time window</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SignalPlots;
