import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { formatSeconds } from "../lib/telemetryMath";

const DEFAULT_ZOOM = 17;
const HEADING_LINE_METERS = 16;
const TREND_WINDOW = 200;
const TREND_WIDTH = 420;
const TREND_HEIGHT = 150;
const TREND_LABELS = ["Altitude", "Speed", "Vel E", "Vel U", "Vel -N"];
const TREND_COLORS = ["#f59e0b", "#22d3ee", "#38bdf8", "#a78bfa", "#84cc16"];
const ACTUATOR_COUNT = 8;
const TRIANGLE_FRONT_METERS = 20;
const TRIANGLE_REAR_METERS = 14;

function formatCoord(value, digits = 6) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatCoordWithHemisphere(value, positive, negative, digits = 6) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const suffix = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(digits)}deg ${suffix}`;
}

function formatHeading(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const normalized = ((value % 360) + 360) % 360;
  return `${normalized.toFixed(1)}deg`;
}

function moveByMeters(latDeg, lonDeg, headingDeg, meters) {
  const headingRad = (headingDeg * Math.PI) / 180;
  const dNorth = Math.cos(headingRad) * meters;
  const dEast = Math.sin(headingRad) * meters;
  const dLat = dNorth / 111320;
  const dLon = dEast / (111320 * Math.max(Math.cos((latDeg * Math.PI) / 180), 1e-6));
  return [latDeg + dLat, lonDeg + dLon];
}

function ensureVisibleSet(prev, count) {
  if (prev.size === 0) {
    return new Set(Array.from({ length: count }, (_, index) => index));
  }
  const next = new Set(Array.from(prev).filter((index) => index < count));
  return next.size ? next : new Set(Array.from({ length: count }, (_, index) => index));
}

function toCanvasPoint(time, value, start, end, width, height, minValue, maxValue) {
  const x = ((time - start) / Math.max(end - start, 1e-6)) * width;
  const ratio = (value - minValue) / Math.max(maxValue - minValue, 1e-6);
  const y = (1 - ratio) * height;
  return [x, y];
}

function renderTrendPlot(series, visibleChannels) {
  if (!series.length || !visibleChannels.size) {
    return null;
  }

  const start = series[0].time;
  const end = series[series.length - 1].time;

  let min = Infinity;
  let max = -Infinity;
  for (const item of series) {
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
    return null;
  }

  const span = Math.max(1, max - min);
  const yMin = min - span * 0.15;
  const yMax = max + span * 0.15;

  const paths = Array.from({ length: TREND_LABELS.length }, () => []);
  for (const item of series) {
    for (let i = 0; i < TREND_LABELS.length; i += 1) {
      if (!visibleChannels.has(i)) {
        continue;
      }
      const value = item.channels[i];
      if (!Number.isFinite(value)) {
        continue;
      }
      const [x, y] = toCanvasPoint(item.time, value, start, end, TREND_WIDTH, TREND_HEIGHT, yMin, yMax);
      paths[i].push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  }

  return (
    <svg viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`} preserveAspectRatio="none" className="signal-svg">
      <line x1="0" x2={TREND_WIDTH} y1={TREND_HEIGHT / 2} y2={TREND_HEIGHT / 2} className="signal-midline" />
      {paths.map((points, index) =>
        points.length ? (
          <polyline
            key={index}
            points={points.join(" ")}
            fill="none"
            stroke={TREND_COLORS[index % TREND_COLORS.length]}
            strokeWidth="1.9"
          />
        ) : null,
      )}
    </svg>
  );
}

function toTriangle(currentGeo, headingDeg) {
  if (!currentGeo) {
    return [];
  }
  const heading = Number.isFinite(headingDeg) ? headingDeg : 0;
  const nose = moveByMeters(currentGeo[0], currentGeo[1], heading, TRIANGLE_FRONT_METERS);
  const left = moveByMeters(currentGeo[0], currentGeo[1], heading + 145, TRIANGLE_REAR_METERS);
  const right = moveByMeters(currentGeo[0], currentGeo[1], heading - 145, TRIANGLE_REAR_METERS);
  return [nose, right, left];
}

function MapViewportController({ currentGeo }) {
  const map = useMap();

  useEffect(() => {
    if (!currentGeo) {
      return;
    }
    map.setView(currentGeo, DEFAULT_ZOOM, { animate: false });
  }, [currentGeo, map]);

  return null;
}

function SimMapOverlay({ simVehicles, selectedSystemId, showInterVehicleLinks }) {
  const [activeTab, setActiveTab] = useState("map");
  const [visibleTrend, setVisibleTrend] = useState(new Set());

  const selectedVehicle = useMemo(
    () => simVehicles.find((vehicle) => vehicle.systemId === selectedSystemId) ?? simVehicles[0] ?? null,
    [selectedSystemId, simVehicles],
  );
  const selectedSample = selectedVehicle?.latestSample ?? null;
  const selectedSamples = selectedVehicle?.trailSamples ?? [];

  const allVehicleGeos = useMemo(
    () =>
      simVehicles
        .map((vehicle) => ({
          systemId: vehicle.systemId,
          latest: vehicle.latestSample,
        }))
        .filter(
          (vehicle) => Number.isFinite(vehicle.latest?.latDeg) && Number.isFinite(vehicle.latest?.lonDeg),
        )
        .map((vehicle) => ({
          systemId: vehicle.systemId,
          geo: [vehicle.latest.latDeg, vehicle.latest.lonDeg],
          headingDeg: vehicle.latest.headingDeg,
        })),
    [simVehicles],
  );

  const selectedGeoSamples = useMemo(
    () => selectedSamples.filter((item) => Number.isFinite(item?.latDeg) && Number.isFinite(item?.lonDeg)),
    [selectedSamples],
  );

  const currentGeo = useMemo(() => {
    if (Number.isFinite(selectedSample?.latDeg) && Number.isFinite(selectedSample?.lonDeg)) {
      return [selectedSample.latDeg, selectedSample.lonDeg];
    }
    return allVehicleGeos[0]?.geo ?? null;
  }, [allVehicleGeos, selectedSample?.latDeg, selectedSample?.lonDeg]);

  const selectedTrailCoords = useMemo(
    () => selectedGeoSamples.map((item) => [item.latDeg, item.lonDeg]),
    [selectedGeoSamples],
  );
  const startGeo = selectedTrailCoords.length ? selectedTrailCoords[0] : null;

  const headingDeg = useMemo(() => {
    if (Number.isFinite(selectedSample?.headingDeg)) {
      return selectedSample.headingDeg;
    }
    const tailHeading = selectedGeoSamples[selectedGeoSamples.length - 1]?.headingDeg;
    return Number.isFinite(tailHeading) ? tailHeading : null;
  }, [selectedGeoSamples, selectedSample?.headingDeg]);

  const headingLineCoords = useMemo(() => {
    if (!currentGeo || !Number.isFinite(headingDeg)) {
      return [];
    }
    const [endLat, endLon] = moveByMeters(currentGeo[0], currentGeo[1], headingDeg, HEADING_LINE_METERS);
    return [currentGeo, [endLat, endLon]];
  }, [currentGeo, headingDeg]);

  const selectedTriangle = useMemo(() => toTriangle(currentGeo, headingDeg), [currentGeo, headingDeg]);

  const interVehicleLinks = useMemo(() => {
    if (!showInterVehicleLinks) {
      return [];
    }
    const links = [];
    for (let i = 0; i < allVehicleGeos.length; i += 1) {
      for (let j = i + 1; j < allVehicleGeos.length; j += 1) {
        links.push({
          key: `${allVehicleGeos[i].systemId}-${allVehicleGeos[j].systemId}`,
          positions: [allVehicleGeos[i].geo, allVehicleGeos[j].geo],
        });
      }
    }
    return links;
  }, [allVehicleGeos, showInterVehicleLinks]);

  const actuatorValues = useMemo(() => {
    const source = Array.isArray(selectedSample?.u) ? selectedSample.u : [];
    return Array.from({ length: ACTUATOR_COUNT }, (_, index) => {
      const value = Number(source[index]);
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.max(-1, Math.min(1, value));
    });
  }, [selectedSample?.u]);

  const trendSeries = useMemo(() => {
    const withTrendData = selectedSamples.filter((item) => {
      const velocity = item?.velocity ?? [];
      return (
        Number.isFinite(item?.time) &&
        (Number.isFinite(item?.altitude) ||
          Number.isFinite(item?.speed) ||
          Number.isFinite(velocity[0]) ||
          Number.isFinite(velocity[1]) ||
          Number.isFinite(velocity[2]))
      );
    });

    return withTrendData.slice(-TREND_WINDOW).map((item) => {
      const velocity = item?.velocity ?? [];
      const speed = Number.isFinite(item?.speed)
        ? item.speed
        : Number.isFinite(velocity[0]) && Number.isFinite(velocity[1]) && Number.isFinite(velocity[2])
          ? Math.hypot(velocity[0], velocity[1], velocity[2])
          : null;
      return {
        time: item.time,
        channels: [
          Number.isFinite(item?.altitude) ? item.altitude : null,
          speed,
          Number.isFinite(velocity[0]) ? velocity[0] : null,
          Number.isFinite(velocity[1]) ? velocity[1] : null,
          Number.isFinite(velocity[2]) ? velocity[2] : null,
        ],
      };
    });
  }, [selectedSamples]);

  useEffect(() => {
    setVisibleTrend((prev) => ensureVisibleSet(prev, TREND_LABELS.length));
  }, []);

  const hasGeoData = allVehicleGeos.length > 0;

  return (
    <div className="sim-map-stack">
      <div className="signal-tabs">
        <button
          type="button"
          className={`signal-tab ${activeTab === "map" ? "active" : ""}`}
          onClick={() => setActiveTab("map")}
        >
          Geo Map
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "data" ? "active" : ""}`}
          onClick={() => setActiveTab("data")}
        >
          Coordinates
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "trend" ? "active" : ""}`}
          onClick={() => setActiveTab("trend")}
        >
          Alt + Vel
        </button>
        <button
          type="button"
          className={`signal-tab ${activeTab === "actuators" ? "active" : ""}`}
          onClick={() => setActiveTab("actuators")}
        >
          Actuators
        </button>
      </div>

      {activeTab === "map" && (
        <div className="sim-map-panel">
          <div className="sim-map-toolbar">
            <span className="label">All vehicles rendered (north-up, locked follow)</span>
          </div>
          {!hasGeoData ? (
            <div className="sim-map-empty">No LLA points received yet.</div>
          ) : (
            <div className="sim-map-real-wrap">
              <MapContainer
                center={currentGeo}
                zoom={DEFAULT_ZOOM}
                className="sim-map-real"
                zoomControl={false}
                attributionControl
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                boxZoom={false}
                keyboard={false}
                touchZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapViewportController currentGeo={currentGeo} />
                {simVehicles.map((vehicle) => {
                  const coords = (vehicle.trailSamples ?? [])
                    .filter((item) => Number.isFinite(item?.latDeg) && Number.isFinite(item?.lonDeg))
                    .map((item) => [item.latDeg, item.lonDeg]);
                  if (!coords.length) {
                    return null;
                  }
                  const isSelected = vehicle.systemId === selectedVehicle?.systemId;
                  return (
                    <Polyline
                      key={`trail-${vehicle.systemId}`}
                      positions={coords}
                      pathOptions={{
                        color: isSelected ? "#22d3ee" : "#60a5fa",
                        weight: isSelected ? 3 : 2,
                        opacity: isSelected ? 0.95 : 0.5,
                      }}
                    />
                  );
                })}
                {interVehicleLinks.map((link) => (
                  <Polyline
                    key={`link-${link.key}`}
                    positions={link.positions}
                    pathOptions={{ color: "#3b82f6", weight: 2, opacity: 0.9, dashArray: "6, 6" }}
                  />
                ))}
                {allVehicleGeos.map((vehicle) => {
                  const isSelected = vehicle.systemId === selectedVehicle?.systemId;
                  const triangle = toTriangle(vehicle.geo, vehicle.headingDeg);
                  return (
                    <Polygon
                      key={`veh-tri-${vehicle.systemId}`}
                      positions={triangle}
                      pathOptions={{
                        color: isSelected ? "#fecaca" : "#93c5fd",
                        weight: 1,
                        fillColor: isSelected ? "#ef4444" : "#2563eb",
                        fillOpacity: isSelected ? 0.95 : 0.72,
                      }}
                    />
                  );
                })}
                {allVehicleGeos.map((vehicle) => {
                  const isSelected = vehicle.systemId === selectedVehicle?.systemId;
                  return (
                    <CircleMarker
                      key={`veh-dot-${vehicle.systemId}`}
                      center={vehicle.geo}
                      radius={isSelected ? 4 : 3}
                      pathOptions={{
                        color: isSelected ? "#f8fafc" : "#bfdbfe",
                        weight: 1,
                        fillColor: isSelected ? "#ef4444" : "#2563eb",
                        fillOpacity: 1,
                      }}
                    />
                  );
                })}
                {startGeo && (
                  <CircleMarker
                    center={startGeo}
                    radius={4}
                    pathOptions={{ color: "#f59e0b", weight: 1, fillColor: "#f59e0b", fillOpacity: 1 }}
                  />
                )}
                {selectedTriangle.length > 2 && (
                  <Polygon
                    positions={selectedTriangle}
                    pathOptions={{ color: "#fecaca", weight: 1, fillColor: "#ef4444", fillOpacity: 0.95 }}
                  />
                )}
                {headingLineCoords.length > 1 && (
                  <Polyline positions={headingLineCoords} pathOptions={{ color: "#f43f5e", weight: 3, opacity: 0.95 }} />
                )}
              </MapContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === "data" && (
        <div className="sim-map-panel sim-map-stats">
          {!selectedVehicle ? (
            <div className="sim-map-empty">Select a vehicle to view its coordinates.</div>
          ) : (
            <>
              <div className="sim-map-stats-grid">
                <div className="sim-map-stat sim-map-stat-primary">
                  <span className="label">Latitude</span>
                  <strong>{formatCoordWithHemisphere(selectedSample?.latDeg, "N", "S")}</strong>
                  <span className="subvalue">{formatCoord(selectedSample?.latDeg)} deg</span>
                </div>
                <div className="sim-map-stat sim-map-stat-primary">
                  <span className="label">Longitude</span>
                  <strong>{formatCoordWithHemisphere(selectedSample?.lonDeg, "E", "W")}</strong>
                  <span className="subvalue">{formatCoord(selectedSample?.lonDeg)} deg</span>
                </div>
              </div>

              <div className="sim-map-stats-grid sim-map-stats-grid-compact">
                <div className="sim-map-stat">
                  <span className="label">System ID</span>
                  <strong>{selectedVehicle.systemId}</strong>
                </div>
                <div className="sim-map-stat">
                  <span className="label">Heading</span>
                  <strong>{formatHeading(selectedSample?.headingDeg)}</strong>
                </div>
                <div className="sim-map-stat">
                  <span className="label">Mission time</span>
                  <strong>{formatSeconds(selectedSample?.time)}</strong>
                </div>
              </div>

              <div className="sim-map-stats-grid sim-map-stats-grid-pair">
                <div className="sim-map-stat">
                  <span className="label">Start fix</span>
                  <strong>
                    {formatCoord(selectedGeoSamples[0]?.latDeg, 5)}, {formatCoord(selectedGeoSamples[0]?.lonDeg, 5)}
                  </strong>
                </div>
                <div className="sim-map-stat">
                  <span className="label">Current fix</span>
                  <strong>
                    {formatCoord(selectedGeoSamples[selectedGeoSamples.length - 1]?.latDeg, 5)},{" "}
                    {formatCoord(selectedGeoSamples[selectedGeoSamples.length - 1]?.lonDeg, 5)}
                  </strong>
                </div>
              </div>

              <div className="sim-map-raw-row">
                <span className="label">Raw LLA</span>
                <code>
                  {formatCoord(selectedSample?.latDeg)} deg, {formatCoord(selectedSample?.lonDeg)} deg
                </code>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "trend" && (
        <div className="sim-map-panel">
          <div className="signal-header sim-trend-header">
            <span>Selected vehicle altitude + velocity samples</span>
            <small>{trendSeries.length} points</small>
          </div>
          <div className="signal-legend sim-trend-legend">
            <div className="signal-legend-controls">
              <button
                type="button"
                className="legend-link"
                onClick={() => setVisibleTrend(new Set(Array.from({ length: TREND_LABELS.length }, (_, index) => index)))}
              >
                all
              </button>
              <button type="button" className="legend-link" onClick={() => setVisibleTrend(new Set())}>
                none
              </button>
            </div>
            {TREND_LABELS.map((label, index) => {
              const active = visibleTrend.has(index);
              return (
                <button
                  key={label}
                  type="button"
                  className={`legend-item ${active ? "active" : ""}`}
                  onClick={() => {
                    setVisibleTrend((prev) => {
                      const next = new Set(prev);
                      next.has(index) ? next.delete(index) : next.add(index);
                      return next;
                    });
                  }}
                >
                  <span className="legend-swatch" style={{ backgroundColor: TREND_COLORS[index] }} />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="signal-canvas sim-trend-canvas">
            {renderTrendPlot(trendSeries, visibleTrend) ?? (
              <div className="sim-map-empty">Need more samples from the selected vehicle to draw this trend.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "actuators" && (
        <div className="sim-map-panel">
          <div className="signal-header sim-trend-header">
            <span>Selected vehicle normalized actuator commands</span>
            <small>u[0..7] in [-1, 1]</small>
          </div>
          <div className="sim-actuator-grid">
            {actuatorValues.map((value, index) => {
              const widthPct = Math.abs(value) * 50;
              const leftPct = value >= 0 ? 50 : 50 - widthPct;
              return (
                <div key={index} className="sim-actuator-row">
                  <span className="sim-actuator-label">U{index}</span>
                  <div className="sim-actuator-track" role="img" aria-label={`Actuator U${index} ${value.toFixed(2)}`}>
                    <span className="sim-actuator-center" />
                    <span className="sim-actuator-fill" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                  </div>
                  <code className="sim-actuator-value">{value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}</code>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SimMapOverlay;
