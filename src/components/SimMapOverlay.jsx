import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_ZOOM = 17;
const HEADING_LINE_METERS = 16;

function formatCoord(value, digits = 6) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
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

function SimMapOverlay({ samples, activeSample }) {
  const [activeTab, setActiveTab] = useState("map");
  const [mapOrientation, setMapOrientation] = useState("north");

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const trailRef = useRef(null);
  const currentRef = useRef(null);
  const startRef = useRef(null);
  const headingRef = useRef(null);
  const firstCenterRef = useRef(true);

  const geoSamples = useMemo(
    () => samples.filter((item) => Number.isFinite(item?.latDeg) && Number.isFinite(item?.lonDeg)),
    [samples],
  );

  const currentGeo = useMemo(() => {
    if (Number.isFinite(activeSample?.latDeg) && Number.isFinite(activeSample?.lonDeg)) {
      return [activeSample.latDeg, activeSample.lonDeg];
    }
    const last = geoSamples[geoSamples.length - 1];
    return last ? [last.latDeg, last.lonDeg] : null;
  }, [activeSample?.latDeg, activeSample?.lonDeg, geoSamples]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    trailRef.current = L.polyline([], {
      color: "#22d3ee",
      weight: 3,
      opacity: 0.9,
    }).addTo(map);

    startRef.current = L.circleMarker([0, 0], {
      radius: 4,
      color: "#f59e0b",
      weight: 1,
      fillColor: "#f59e0b",
      fillOpacity: 1,
    }).addTo(map);

    currentRef.current = L.circleMarker([0, 0], {
      radius: 5,
      color: "#f8fafc",
      weight: 1,
      fillColor: "#38bdf8",
      fillOpacity: 1,
    }).addTo(map);

    headingRef.current = L.polyline([], {
      color: "#f43f5e",
      weight: 3,
      opacity: 0.95,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      trailRef.current = null;
      currentRef.current = null;
      startRef.current = null;
      headingRef.current = null;
      firstCenterRef.current = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const trail = trailRef.current;
    const current = currentRef.current;
    const start = startRef.current;
    const headingLine = headingRef.current;

    if (!map || !trail || !current || !start || !headingLine) {
      return;
    }

    if (!geoSamples.length || !currentGeo) {
      trail.setLatLngs([]);
      headingLine.setLatLngs([]);
      return;
    }

    const latLngs = geoSamples.map((item) => [item.latDeg, item.lonDeg]);
    trail.setLatLngs(latLngs);

    start.setLatLng(latLngs[0]);
    current.setLatLng(currentGeo);

    const heading = Number.isFinite(activeSample?.headingDeg)
      ? activeSample.headingDeg
      : Number.isFinite(geoSamples[geoSamples.length - 1]?.headingDeg)
        ? geoSamples[geoSamples.length - 1].headingDeg
        : null;

    if (Number.isFinite(heading)) {
      const [endLat, endLon] = moveByMeters(currentGeo[0], currentGeo[1], heading, HEADING_LINE_METERS);
      headingLine.setLatLngs([currentGeo, [endLat, endLon]]);
    } else {
      headingLine.setLatLngs([]);
    }

    if (firstCenterRef.current) {
      map.setView(currentGeo, DEFAULT_ZOOM, { animate: false });
      firstCenterRef.current = false;
      return;
    }

    map.panTo(currentGeo, { animate: false });
  }, [activeSample?.headingDeg, currentGeo, geoSamples]);

  const rotationDeg =
    mapOrientation === "course" && Number.isFinite(activeSample?.headingDeg) ? -activeSample.headingDeg : 0;

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
      </div>

      {activeTab === "map" && (
        <div className="sim-map-panel">
          <div className="sim-map-toolbar">
            <span className="label">Orientation</span>
            <div className="sim-map-orientation-tabs">
              <button
                type="button"
                className={`sim-map-orientation-tab ${mapOrientation === "north" ? "active" : ""}`}
                onClick={() => setMapOrientation("north")}
              >
                North-up
              </button>
              <button
                type="button"
                className={`sim-map-orientation-tab ${mapOrientation === "course" ? "active" : ""}`}
                onClick={() => setMapOrientation("course")}
              >
                Course-up
              </button>
            </div>
          </div>
          {!geoSamples.length ? (
            <div className="sim-map-empty">No LLA points received yet.</div>
          ) : (
            <div className="sim-map-real-wrap" style={{ "--map-rotation": `${rotationDeg}deg` }}>
              <div ref={mapContainerRef} className="sim-map-real" />
            </div>
          )}
        </div>
      )}

      {activeTab === "data" && (
        <div className="sim-map-panel sim-map-stats">
          <div>
            <span className="label">Latitude</span>
            <strong>{formatCoord(activeSample?.latDeg)}</strong>
          </div>
          <div>
            <span className="label">Longitude</span>
            <strong>{formatCoord(activeSample?.lonDeg)}</strong>
          </div>
          <div>
            <span className="label">Heading</span>
            <strong>{formatHeading(activeSample?.headingDeg)}</strong>
          </div>
          <div>
            <span className="label">Start</span>
            <strong>
              {formatCoord(geoSamples[0]?.latDeg, 5)}, {formatCoord(geoSamples[0]?.lonDeg, 5)}
            </strong>
          </div>
          <div>
            <span className="label">Current</span>
            <strong>
              {formatCoord(geoSamples[geoSamples.length - 1]?.latDeg, 5)}, {formatCoord(geoSamples[geoSamples.length - 1]?.lonDeg, 5)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimMapOverlay;
