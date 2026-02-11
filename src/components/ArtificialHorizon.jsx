import { formatDegrees, toDegrees } from "../lib/telemetryMath";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function ArtificialHorizon({ sample }) {
  const roll = sample ? toDegrees(sample.euler[0]) : 0;
  const pitch = sample ? toDegrees(sample.euler[1]) : 0;
  const pitchShift = clamp(pitch, -35, 35) / 35 * 50;

  return (
    <div className="horizon-widget">
      <div className="horizon-ring">
        <div className="horizon-dial" style={{ transform: `rotate(${roll * -1}deg)` }}>
          <div className="horizon-sky" style={{ transform: `translateY(${pitchShift}%)` }} />
          <div className="horizon-ground" style={{ transform: `translateY(${pitchShift}%)` }} />
          <div className="horizon-line" />
          <div className="horizon-graticule">
            {[ -30, -15, 0, 15, 30 ].map((deg) => (
              <span key={deg} style={{ transform: `translateY(${(deg / 35) * -45}%)` }} />
            ))}
          </div>
        </div>
        <div className="horizon-pointer" />
      </div>
      <div className="horizon-readout">
        <div>
          <span className="label">Roll</span>
          <strong>{sample ? formatDegrees(roll) : "—"}</strong>
        </div>
        <div>
          <span className="label">Pitch</span>
          <strong>{sample ? formatDegrees(pitch) : "—"}</strong>
        </div>
      </div>
    </div>
  );
}

export default ArtificialHorizon;
