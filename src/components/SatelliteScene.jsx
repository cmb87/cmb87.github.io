import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PMREMGenerator, Quaternion, SRGBColorSpace, TextureLoader, Vector3 } from "three";

const CAMERA_POSITION = [85, 56, 85];
const CAMERA_MODE_FREE = "free";
const CAMERA_MODE_FOLLOW_THIRD = "follow-third";
const CAMERA_MODE_FOLLOW_FIRST = "follow-first";
const METERS_PER_DEG_LAT = 111320;
const TILE_LOAD_RADIUS_METERS = 280;
const TILE_UNLOAD_RADIUS_METERS = 460;
const DEFAULT_STL = "/models/quad.stl";
const DEFAULT_MODEL_SCALE = 0.3;
const qTailOffset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
const qSimStlOffset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
const qRotate90Offset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

function parseTileManifest(csvText) {
  const lines = csvText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      if (parts.length < 5) {
        return null;
      }

      const id = parts[0].replace(/"/g, "");
      const northLat = Number(parts[1]);
      const westLon = Number(parts[2]);
      const southLat = Number(parts[3]);
      const eastLon = Number(parts[4]);

      if (![northLat, westLon, southLat, eastLon].every(Number.isFinite)) {
        return null;
      }

      return {
        id,
        northLat,
        westLon,
        southLat,
        eastLon,
        centerLat: (northLat + southLat) * 0.5,
        centerLon: (westLon + eastLon) * 0.5,
      };
    })
    .filter(Boolean);

  if (!parsed.length) {
    return null;
  }

  const minLat = Math.min(...parsed.map((tile) => Math.min(tile.northLat, tile.southLat)));
  const maxLat = Math.max(...parsed.map((tile) => Math.max(tile.northLat, tile.southLat)));
  const minLon = Math.min(...parsed.map((tile) => Math.min(tile.westLon, tile.eastLon)));
  const maxLon = Math.max(...parsed.map((tile) => Math.max(tile.westLon, tile.eastLon)));
  const centerLat = (minLat + maxLat) * 0.5;
  const centerLon = (minLon + maxLon) * 0.5;
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.max(Math.cos((centerLat * Math.PI) / 180), 1e-6);

  const tiles = parsed.map((tile) => {
    const widthMeters = Math.abs(tile.eastLon - tile.westLon) * metersPerDegLon;
    const heightMeters = Math.abs(tile.northLat - tile.southLat) * METERS_PER_DEG_LAT;
    return {
      id: tile.id,
      xMeters: (tile.centerLon - centerLon) * metersPerDegLon,
      zMeters: -(tile.centerLat - centerLat) * METERS_PER_DEG_LAT,
      widthMeters,
      heightMeters,
      radiusMeters: Math.max(widthMeters, heightMeters) * 0.75,
    };
  });

  return {
    centerLat,
    centerLon,
    metersPerDegLon,
    bounds: {
      minLat,
      maxLat,
      minLon,
      maxLon,
    },
    tiles,
  };
}

function isWithinTileBounds(sample, bounds) {
  const lat = Number(sample?.latDeg);
  const lon = Number(sample?.lonDeg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !bounds) {
    return false;
  }
  return lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon;
}

function ExrEnvironment({ path }) {
  const { gl, scene } = useThree();
  const [envMap, setEnvMap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new EXRLoader();
    const candidates = Array.isArray(path) ? path : [path];

    async function loadFirstAvailable() {
      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        try {
          const exrTexture = await loader.loadAsync(candidate);
          if (cancelled) {
            exrTexture.dispose();
            return;
          }

          const pmrem = new PMREMGenerator(gl);
          pmrem.compileEquirectangularShader();
          const nextEnvMap = pmrem.fromEquirectangular(exrTexture).texture;
          exrTexture.dispose();
          pmrem.dispose();
          setEnvMap(nextEnvMap);
          return;
        } catch {
          continue;
        }
      }
      setEnvMap(null);
    }

    loadFirstAvailable();

    return () => {
      cancelled = true;
    };
  }, [gl, path]);

  useEffect(() => {
    if (!envMap) {
      return undefined;
    }

    const previousEnv = scene.environment;
    const previousBg = scene.background;
    scene.environment = envMap;
    scene.background = envMap;

    return () => {
      scene.environment = previousEnv;
      scene.background = previousBg;
      envMap.dispose();
    };
  }, [envMap, scene]);

  return null;
}

function getVehiclePosition(sample, centerLat, centerLon, metersPerDegLon) {
  const lat = Number(sample?.latDeg);
  const lon = Number(sample?.lonDeg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  const x = (lon - centerLon) * metersPerDegLon;
  const z = -(lat - centerLat) * METERS_PER_DEG_LAT;
  const altitudeRelative = Number(sample?.altitudeRelative);
  const y = Number.isFinite(altitudeRelative) ? Math.max(0, altitudeRelative * 0.3) : 0.1;
  return [x, y, z];
}

function getSamplePosition(sample) {
  const position = sample?.position;
  if (Array.isArray(position) && position.length >= 3 && position.every((value) => Number.isFinite(value))) {
    return position;
  }
  const display = sample?.displayPosition;
  if (Array.isArray(display) && display.length >= 3 && display.every((value) => Number.isFinite(value))) {
    return display;
  }
  return null;
}

function fallbackAnchorForSystem(systemId) {
  const sid = Number.isFinite(systemId) ? Number(systemId) : 0;
  const angle = ((sid % 12) / 12) * Math.PI * 2;
  const radius = 16;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function DummyVehicleMarker({ sample, selected }) {
  const groupRef = useRef();
  const sampleQuat = useMemo(() => new Quaternion(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);

  useEffect(() => {
    if (!groupRef.current || !sample?.quaternion) {
      return;
    }
    const q = sample.quaternion;
    if (!Array.isArray(q) || q.length < 4 || !q.every((value) => Number.isFinite(value))) {
      return;
    }
    sampleQuat.set(q[0], q[1], q[2], q[3]).normalize();
    renderQuat.copy(sampleQuat).multiply(qTailOffset).multiply(qSimStlOffset);
    groupRef.current.quaternion.copy(renderQuat);
  }, [renderQuat, sample, sampleQuat]);

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <coneGeometry args={[selected ? 1.7 : 1.3, selected ? 4.5 : 3.4, 18]} />
        <meshStandardMaterial color={selected ? "#f43f5e" : "#38bdf8"} metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[-1.4, 0, 0]}>
        <boxGeometry args={[2.2, 0.12, 0.34]} />
        <meshStandardMaterial color="#cbd5f5" />
      </mesh>
    </group>
  );
}

function StlVehicleMarker({ sample, selected, stlPath, modelScale = DEFAULT_MODEL_SCALE, rotateMesh90 = false }) {
  const geometry = useLoader(STLLoader, stlPath);
  const meshRef = useRef();
  const sampleQuat = useMemo(() => new Quaternion(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);

  useEffect(() => {
    geometry.center();
    geometry.computeVertexNormals();
  }, [geometry]);

  useEffect(() => {
    if (!meshRef.current || !sample?.quaternion) {
      return;
    }
    const q = sample.quaternion;
    if (!Array.isArray(q) || q.length < 4 || !q.every((value) => Number.isFinite(value))) {
      return;
    }
    sampleQuat.set(q[0], q[1], q[2], q[3]).normalize();
    renderQuat.copy(sampleQuat).multiply(qTailOffset).multiply(qSimStlOffset);
    if (rotateMesh90) {
      renderQuat.multiply(qRotate90Offset);
    }
    meshRef.current.quaternion.copy(renderQuat);
  }, [renderQuat, rotateMesh90, sample, sampleQuat]);

  return (
    <mesh ref={meshRef} geometry={geometry} scale={modelScale} castShadow receiveShadow>
      <meshStandardMaterial
        color={selected ? "#f8fafc" : "#d8e4ff"}
        emissive={selected ? "#38bdf8" : "#000000"}
        emissiveIntensity={selected ? 0.14 : 0}
        metalness={0.2}
        roughness={0.45}
      />
    </mesh>
  );
}

function SatelliteCameraFollower({ cameraMode, activeSample, activeScenePosition, toScenePosition, controlsRef }) {
  const { camera } = useThree();
  const offsetRef = useRef(new Vector3(...CAMERA_POSITION));
  const wasFollowingThirdRef = useRef(false);
  const userOrbitingRef = useRef(false);
  const targetPos = useMemo(() => new Vector3(), []);
  const desiredPos = useMemo(() => new Vector3(), []);
  const currentOffset = useMemo(() => new Vector3(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);
  const viewForward = useMemo(() => new Vector3(), []);
  const viewUp = useMemo(() => new Vector3(), []);
  const lookTarget = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return undefined;
    }

    const handleStart = () => {
      userOrbitingRef.current = true;
    };
    const handleEnd = () => {
      userOrbitingRef.current = false;
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);
    return () => {
      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);
    };
  }, [controlsRef]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (controls) {
      controls.enabled = cameraMode !== CAMERA_MODE_FOLLOW_FIRST;
    }

    const scenePos = activeScenePosition ?? toScenePosition(activeSample);
    if (!scenePos) {
      wasFollowingThirdRef.current = false;
      userOrbitingRef.current = false;
      return;
    }

    targetPos.set(scenePos[0], scenePos[1], scenePos[2]);

    if (cameraMode === CAMERA_MODE_FOLLOW_FIRST) {
      const q = activeSample?.quaternion;
      if (!Array.isArray(q) || q.length < 4 || !q.every((value) => Number.isFinite(value))) {
        return;
      }
      renderQuat.set(q[0], q[1], q[2], q[3]).normalize();
      viewForward.set(1, 0, 0).applyQuaternion(renderQuat).normalize();
      viewUp.set(0, 0, -1).applyQuaternion(renderQuat).normalize();
      desiredPos.copy(targetPos).addScaledVector(viewUp, 0.45).addScaledVector(viewForward, 0.55);
      camera.position.lerp(desiredPos, 0.22);
      lookTarget.copy(camera.position).addScaledVector(viewForward, 40);
      camera.up.copy(viewUp);
      camera.lookAt(lookTarget);
      wasFollowingThirdRef.current = false;
      userOrbitingRef.current = false;
      return;
    }

    if (cameraMode !== CAMERA_MODE_FOLLOW_THIRD) {
      wasFollowingThirdRef.current = false;
      userOrbitingRef.current = false;
      return;
    }

    if (!wasFollowingThirdRef.current) {
      if (controls) {
        controls.target.copy(targetPos);
        controls.update();
      }
      offsetRef.current.copy(camera.position).sub(targetPos);
      wasFollowingThirdRef.current = true;
    }

    if (controls && userOrbitingRef.current) {
      controls.target.copy(targetPos);
      controls.update();
      offsetRef.current.copy(camera.position).sub(targetPos);
      return;
    }

    if (controls) {
      currentOffset.copy(camera.position).sub(controls.target);
      const currentDistance = currentOffset.length();
      const trackedDistance = offsetRef.current.length();
      if (currentDistance > 1e-6 && Math.abs(currentDistance - trackedDistance) > 1e-4) {
        offsetRef.current.copy(currentOffset);
      }
    }

    desiredPos.copy(targetPos).add(offsetRef.current);
    camera.position.lerp(desiredPos, 0.08);
    if (controls) {
      controls.target.lerp(targetPos, 0.12);
      controls.update();
    }
  });

  return null;
}

function TilePlanes({ tiles }) {
  return tiles.map((tile) => (
    <mesh key={tile.id} position={[tile.xMeters, 0, tile.zMeters]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[tile.widthMeters, tile.heightMeters]} />
      <meshStandardMaterial map={tile.texture} metalness={0} roughness={0.85} />
    </mesh>
  ));
}

export default function SatelliteScene({
  simVehicles = [],
  simVehicleMeshSettings = {},
  selectedSystemId = null,
  cameraMode = CAMERA_MODE_FREE,
  onCanvasReady,
}) {
  const [tileData, setTileData] = useState(null);
  const [tileError, setTileError] = useState(null);
  const [tileBasePath, setTileBasePath] = useState("/satellite/tiles");
  const [hdrPaths, setHdrPaths] = useState(["/satellite/hdr/kloppenheim_07_puresky_1k.exr", "/hdr/kloppenheim_07_puresky_1k.exr"]);
  const [textureVersion, setTextureVersion] = useState(0);
  const controlsRef = useRef();
  const textureCacheRef = useRef(new Map());
  const tileLoaderRef = useRef(new TextureLoader());
  const loadingIdsRef = useRef(new Set());
  const fallbackOriginsRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      const manifestCandidates = ["/satellite/tiles/map.csv", "/tiles/map.csv"];

      for (const manifestUrl of manifestCandidates) {
        try {
          const response = await fetch(manifestUrl);
          if (!response.ok) {
            continue;
          }
          const text = await response.text();
          if (cancelled) {
            return;
          }

          const parsed = parseTileManifest(text);
          if (!parsed) {
            continue;
          }

          const base = manifestUrl.replace(/\/map\.csv$/i, "");
          setTileBasePath(base);
          setTileData(parsed);
          setTileError(null);
          if (base === "/tiles") {
            setHdrPaths(["/hdr/kloppenheim_07_puresky_1k.exr", "/satellite/hdr/kloppenheim_07_puresky_1k.exr"]);
          }
          return;
        } catch {
          continue;
        }
      }

      if (!cancelled) {
        setTileError("Unable to load map.csv. Expected /satellite/tiles/map.csv or /tiles/map.csv.");
      }
    }

    loadManifest();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => onCanvasReady?.(null), [onCanvasReady]);

  useEffect(
    () => () => {
      for (const texture of textureCacheRef.current.values()) {
        texture.dispose();
      }
      textureCacheRef.current.clear();
      loadingIdsRef.current.clear();
      fallbackOriginsRef.current.clear();
    },
    [],
  );

  const geoVehicles = useMemo(() => {
    if (!tileData) {
      return [];
    }

    const seenSystemIds = new Set();

    const vehicles = simVehicles
      .map((vehicle) => {
        const sample = vehicle?.latestSample;
        const systemId = vehicle.systemId;
        seenSystemIds.add(systemId);
        const inCoverage = isWithinTileBounds(sample, tileData.bounds);

        let scenePosition = inCoverage
          ? getVehiclePosition(sample, tileData.centerLat, tileData.centerLon, tileData.metersPerDegLon)
          : null;
        if (!scenePosition) {
          const samplePos = getSamplePosition(sample);
          if (samplePos) {
            const existingOrigin = fallbackOriginsRef.current.get(systemId);
            if (!existingOrigin) {
              const [anchorX, anchorZ] = fallbackAnchorForSystem(systemId);
              fallbackOriginsRef.current.set(systemId, {
                sampleOrigin: [...samplePos],
                anchorX,
                anchorZ,
              });
            }
            const origin = fallbackOriginsRef.current.get(systemId);
            const dx = samplePos[0] - origin.sampleOrigin[0];
            const dz = samplePos[2] - origin.sampleOrigin[2];
            const relativeAlt = Number(sample?.altitudeRelative);
            const y = Number.isFinite(relativeAlt) ? Math.max(0, relativeAlt * 0.3) : Math.max(0.1, samplePos[1] * 0.3);
            scenePosition = [origin.anchorX + dx, y, origin.anchorZ + dz];
          }
        }

        if (!scenePosition) {
          return null;
        }

        return {
          systemId,
          sample,
          scenePosition,
          inCoverage,
          meshSettings: simVehicleMeshSettings[String(systemId)] ?? null,
        };
      })
      .filter(Boolean);

    for (const systemId of Array.from(fallbackOriginsRef.current.keys())) {
      if (!seenSystemIds.has(systemId)) {
        fallbackOriginsRef.current.delete(systemId);
      }
    }

    return vehicles;
  }, [simVehicleMeshSettings, simVehicles, tileData]);

  const activeVehicle =
    geoVehicles.find((vehicle) => vehicle.systemId === selectedSystemId) ?? geoVehicles[0] ?? null;

  const toScenePosition = useMemo(() => {
    if (!tileData) {
      return () => null;
    }
    return (sample) => getVehiclePosition(sample, tileData.centerLat, tileData.centerLon, tileData.metersPerDegLon);
  }, [tileData]);

  const focusPosition = activeVehicle ? activeVehicle.scenePosition : [0, 0, 0];

  const neededTileIds = useMemo(() => {
    if (!tileData) {
      return [];
    }
    const [focusX, , focusZ] = focusPosition;
    const needed = tileData.tiles
      .filter((tile) => {
        const dx = Math.abs(tile.xMeters - focusX);
        const dz = Math.abs(tile.zMeters - focusZ);
        const radius = TILE_LOAD_RADIUS_METERS + tile.radiusMeters;
        return dx <= radius && dz <= radius;
      })
      .map((tile) => tile.id);

    if (needed.length) {
      return needed;
    }

    const nearest = tileData.tiles
      .map((tile) => ({
        id: tile.id,
        distSq: (tile.xMeters - focusX) ** 2 + (tile.zMeters - focusZ) ** 2,
      }))
      .sort((a, b) => a.distSq - b.distSq)[0];
    return nearest ? [nearest.id] : [];
  }, [focusPosition, tileData]);

  useEffect(() => {
    if (!tileData) {
      return;
    }
    let changed = false;
    const [focusX, , focusZ] = focusPosition;

    for (const tileId of neededTileIds) {
      if (textureCacheRef.current.has(tileId) || loadingIdsRef.current.has(tileId)) {
        continue;
      }
      loadingIdsRef.current.add(tileId);
      const urlBase = tileBasePath || "/satellite/tiles";
      const tileUrl = `${urlBase}/${tileId}.png`;
      tileLoaderRef.current.load(
        tileUrl,
        (texture) => {
          loadingIdsRef.current.delete(tileId);
          texture.colorSpace = SRGBColorSpace;
          texture.needsUpdate = true;
          textureCacheRef.current.set(tileId, texture);
          setTextureVersion((prev) => prev + 1);
        },
        undefined,
        () => {
          loadingIdsRef.current.delete(tileId);
        },
      );
    }

    const tilesById = new Map(tileData.tiles.map((tile) => [tile.id, tile]));
    for (const [tileId, texture] of textureCacheRef.current.entries()) {
      const tile = tilesById.get(tileId);
      if (!tile) {
        texture.dispose();
        textureCacheRef.current.delete(tileId);
        changed = true;
        continue;
      }
      const dx = Math.abs(tile.xMeters - focusX);
      const dz = Math.abs(tile.zMeters - focusZ);
      const radius = TILE_UNLOAD_RADIUS_METERS + tile.radiusMeters;
      if (dx > radius || dz > radius) {
        texture.dispose();
        textureCacheRef.current.delete(tileId);
        changed = true;
      }
    }

    if (changed) {
      setTextureVersion((prev) => prev + 1);
    }
  }, [focusPosition, neededTileIds, tileBasePath, tileData]);

  const visibleTiles = useMemo(() => {
    if (!tileData) {
      return [];
    }
    return tileData.tiles
      .map((tile) => {
        const texture = textureCacheRef.current.get(tile.id);
        if (!texture) {
          return null;
        }
        return {
          ...tile,
          texture,
        };
      })
      .filter(Boolean);
  }, [tileData, textureVersion]);

  if (tileError) {
    return <div className="scene-empty-hint">{tileError}</div>;
  }

  return (
    <Canvas
      shadows
      camera={{ position: CAMERA_POSITION, fov: 50 }}
      dpr={[1, 1.25]}
      onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
    >
      <ambientLight intensity={0.58} />
      <directionalLight position={[90, 120, 30]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <OrbitControls ref={controlsRef} maxDistance={900} minDistance={8} enablePan enableDamping dampingFactor={0.08} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial color="#0f172a" opacity={0.22} transparent />
      </mesh>
      {visibleTiles.length > 0 && <TilePlanes tiles={visibleTiles} />}
      <ExrEnvironment path={hdrPaths} />
      {geoVehicles.map((vehicle) => {
          const modelType = vehicle.meshSettings?.modelType ?? "stl";
          const modelScale = Number.isFinite(vehicle.meshSettings?.modelScale)
            ? vehicle.meshSettings.modelScale
            : DEFAULT_MODEL_SCALE;
          const rotateMesh90 = Boolean(vehicle.meshSettings?.rotateTailsitter90) && modelType !== "dummy";
          const stlPath =
            modelType === "upload" && vehicle.meshSettings?.customStlUrl ? vehicle.meshSettings.customStlUrl : DEFAULT_STL;

          return (
            <group key={vehicle.systemId} position={vehicle.scenePosition}>
              {modelType === "dummy" ? (
                <DummyVehicleMarker sample={vehicle.sample} selected={vehicle.systemId === activeVehicle?.systemId} />
              ) : (
                <StlVehicleMarker
                  sample={vehicle.sample}
                  selected={vehicle.systemId === activeVehicle?.systemId}
                  stlPath={stlPath}
                  modelScale={modelScale}
                  rotateMesh90={rotateMesh90}
                />
              )}
            </group>
          );
        })}
      <SatelliteCameraFollower
        cameraMode={cameraMode}
        activeSample={activeVehicle?.sample ?? null}
        activeScenePosition={activeVehicle?.scenePosition ?? null}
        toScenePosition={toScenePosition}
        controlsRef={controlsRef}
      />
    </Canvas>
  );
}
