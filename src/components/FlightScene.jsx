import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const CAMERA_POSITION = [30, 18, 35];
const qTailOffset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
const qSimStlOffset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
const qRotate90Offset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
const DEFAULT_STL = "/tailsitter.stl";
const DEFAULT_MODEL_SCALE = 1.2;
const PATH_ELEVATION = 0.08;
const MIN_PATH_POINT_SEPARATION_SQ = 0.0004;
const MAX_PATH_POINTS = 12000;

function StlVehicle({ sample, stlPath, modelScale, simMode, simLerpAlpha, simSlerpAlpha, rotateMesh90, enableShadows }) {
  const geometry = useLoader(STLLoader, stlPath);
  const meshRef = useRef();
  const sampleRef = useRef(sample ?? null);
  const initializedRef = useRef(false);
  const sampleQuat = useMemo(() => new Quaternion(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);
  const targetPos = useMemo(() => new Vector3(), []);

  useEffect(() => {
    sampleRef.current = sample ?? null;
    if (!sample) {
      initializedRef.current = false;
    }
  }, [sample]);

  useEffect(() => {
    geometry.center();
    geometry.computeVertexNormals();
  }, [geometry]);

  useFrame(() => {
    const current = sampleRef.current;
    if (!meshRef.current || !current) {
      return;
    }
    targetPos.set(current.position[0], current.position[1], current.position[2]);
    sampleQuat.set(
      current.quaternion[0],
      current.quaternion[1],
      current.quaternion[2],
      current.quaternion[3],
    );
    renderQuat.copy(sampleQuat).multiply(qTailOffset);
    if (simMode) {
      renderQuat.multiply(qSimStlOffset);
    }
    if (rotateMesh90) {
      renderQuat.multiply(qRotate90Offset);
    }

    if (!simMode) {
      meshRef.current.position.copy(targetPos);
      meshRef.current.quaternion.copy(renderQuat);
      initializedRef.current = true;
      return;
    }

    if (!initializedRef.current) {
      meshRef.current.position.copy(targetPos);
      meshRef.current.quaternion.copy(renderQuat);
      initializedRef.current = true;
      return;
    }

    meshRef.current.position.lerp(targetPos, simLerpAlpha);
    meshRef.current.quaternion.slerp(renderQuat, simSlerpAlpha);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} scale={modelScale} castShadow={enableShadows} receiveShadow={enableShadows}>
      <meshStandardMaterial color="#d8e4ff" metalness={0.25} roughness={0.4} />
    </mesh>
  );
}

function DummyVehicle({ sample, simMode, simLerpAlpha, simSlerpAlpha, enableShadows }) {
  const groupRef = useRef();
  const sampleRef = useRef(sample ?? null);
  const initializedRef = useRef(false);
  const sampleQuat = useMemo(() => new Quaternion(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);
  const targetPos = useMemo(() => new Vector3(), []);

  useEffect(() => {
    sampleRef.current = sample ?? null;
    if (!sample) {
      initializedRef.current = false;
    }
  }, [sample]);

  useFrame(() => {
    const current = sampleRef.current;
    if (!groupRef.current || !current) {
      return;
    }
    targetPos.set(current.position[0], current.position[1], current.position[2]);
    sampleQuat.set(
      current.quaternion[0],
      current.quaternion[1],
      current.quaternion[2],
      current.quaternion[3],
    );
    renderQuat.copy(sampleQuat).multiply(qTailOffset);

    if (!simMode || !initializedRef.current) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(renderQuat);
      initializedRef.current = true;
      return;
    }

    groupRef.current.position.lerp(targetPos, simLerpAlpha);
    groupRef.current.quaternion.slerp(renderQuat, simSlerpAlpha);
  });

  return (
    <group ref={groupRef} scale={1.1}>
      <mesh castShadow={enableShadows} receiveShadow={enableShadows}>
        <boxGeometry args={[2.2, 0.4, 0.4]} />
        <meshStandardMaterial color="#cbd5f5" metalness={0.1} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.5]} castShadow={enableShadows}>
        <boxGeometry args={[0.5, 0.5, 1.4]} />
        <meshStandardMaterial color="#7dd3fc" />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow={enableShadows}>
        <boxGeometry args={[1.8, 0.2, 0.3]} />
        <meshStandardMaterial color="#a5b4fc" />
      </mesh>
      <mesh position={[0, -0.6, 0]} castShadow={enableShadows}>
        <boxGeometry args={[1.8, 0.2, 0.3]} />
        <meshStandardMaterial color="#a5b4fc" />
      </mesh>
    </group>
  );
}

function FlightPath({ samples }) {
  const path = useMemo(() => {
    const points = [];

    for (const sample of samples) {
      const x = sample?.position?.[0];
      const y = sample?.position?.[1];
      const z = sample?.position?.[2];

      if (![x, y, z].every(Number.isFinite)) {
        continue;
      }

      const elevatedPoint = [x, y + PATH_ELEVATION, z];
      const prev = points[points.length - 1];
      if (prev) {
        const dx = elevatedPoint[0] - prev[0];
        const dy = elevatedPoint[1] - prev[1];
        const dz = elevatedPoint[2] - prev[2];
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq < MIN_PATH_POINT_SEPARATION_SQ) {
          continue;
        }
      }

      points.push(elevatedPoint);
    }

    if (points.length <= MAX_PATH_POINTS) {
      return points;
    }

    const step = Math.ceil(points.length / MAX_PATH_POINTS);
    const reduced = [];
    for (let i = 0; i < points.length; i += step) {
      reduced.push(points[i]);
    }
    const lastPoint = points[points.length - 1];
    const reducedLast = reduced[reduced.length - 1];
    if (reducedLast !== lastPoint) {
      reduced.push(lastPoint);
    }
    return reduced;
  }, [samples]);

  if (path.length < 2) {
    return null;
  }
  return (
    <Line
      points={path}
      color="#38bdf8"
      lineWidth={2.8}
      opacity={0.95}
      transparent
      depthTest={false}
      depthWrite={false}
      renderOrder={20}
    />
  );
}

function InterVehicleLinks({ simVehicles, show }) {
  const links = useMemo(() => {
    if (!show) {
      return [];
    }
    const positions = simVehicles
      .map((vehicle) => ({
        systemId: vehicle.systemId,
        position: vehicle?.latestSample?.position,
      }))
      .filter(({ position }) =>
        Array.isArray(position) && position.length >= 3 && position.every((value) => Number.isFinite(value)),
      );

    const pairs = [];
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        pairs.push({
          key: `${positions[i].systemId}-${positions[j].systemId}`,
          points: [positions[i].position, positions[j].position],
        });
      }
    }
    return pairs;
  }, [show, simVehicles]);

  if (!links.length) {
    return null;
  }

  return links.map((link) => (
    <Line
      key={link.key}
      points={link.points}
      color="#60a5fa"
      lineWidth={1.6}
      opacity={0.9}
      transparent
      dashed
      dashSize={0.42}
      gapSize={0.3}
      depthTest={false}
      depthWrite={false}
      renderOrder={28}
    />
  ));
}

function CameraFollower({ activeSample, followCamera, controlsRef, targetKey = null }) {
  const { camera } = useThree();
  const offsetRef = useRef(new Vector3(...CAMERA_POSITION));
  const wasFollowingRef = useRef(false);
  const userOrbitingRef = useRef(false);
  const sampleRef = useRef(activeSample ?? null);
  const targetPos = useMemo(() => new Vector3(), []);
  const desiredPos = useMemo(() => new Vector3(), []);
  const currentOffset = useMemo(() => new Vector3(), []);

  useEffect(() => {
    sampleRef.current = activeSample ?? null;
  }, [activeSample]);

  useEffect(() => {
    const sample = sampleRef.current;
    if (!followCamera || !sample) {
      return;
    }
    targetPos.set(sample.position[0], sample.position[1], sample.position[2]);
    desiredPos.copy(targetPos).add(offsetRef.current);
    camera.position.copy(desiredPos);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(targetPos);
      controls.update();
    }
    wasFollowingRef.current = true;
    userOrbitingRef.current = false;
  }, [camera, controlsRef, desiredPos, followCamera, targetKey, targetPos]);

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
    if (!followCamera || !activeSample) {
      wasFollowingRef.current = false;
      userOrbitingRef.current = false;
      return;
    }

    targetPos.set(activeSample.position[0], activeSample.position[1], activeSample.position[2]);
    const controls = controlsRef.current;
    if (!wasFollowingRef.current) {
      if (controls) {
        controls.target.copy(targetPos);
        controls.update();
      }
      offsetRef.current.copy(camera.position).sub(targetPos);
      wasFollowingRef.current = true;
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

export default function FlightScene({
  samples,
  activeSample,
  modelType,
  modelScale,
  customModelUrl,
  followCamera,
  simMode,
  rotateTailsitter90 = false,
  simSmoothing = 0.55,
  simVehicles = [],
  simVehicleMeshSettings = {},
  selectedSystemId = null,
  showInterVehicleLinks = false,
}) {
  const stlPath = modelType === "upload" && customModelUrl ? customModelUrl : DEFAULT_STL;
  const controlsRef = useRef();
  const enableShadows = !simMode;
  const smoothing = Math.min(1, Math.max(0, simSmoothing));
  const simLerpAlpha = 0.44 - smoothing * 0.35;
  const simSlerpAlpha = 0.4 - smoothing * 0.32;
  const rotateStlMesh90 = rotateTailsitter90 && modelType !== "dummy";
  const selectedSimSample =
    simVehicles.find((vehicle) => vehicle.systemId === selectedSystemId)?.latestSample ?? simVehicles[0]?.latestSample ?? null;

  return (
    <Canvas shadows={enableShadows} camera={{ position: CAMERA_POSITION, fov: 50 }} dpr={simMode ? [1, 1.3] : [1, 1.75]}>
      <color attach="background" args={["#050912"]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[45, 60, 30]}
        intensity={1.35}
        castShadow={enableShadows}
        shadow-mapSize={enableShadows ? [2048, 2048] : [512, 512]}
      />
      <OrbitControls ref={controlsRef} maxDistance={160} minDistance={6} enablePan enableDamping dampingFactor={0.08} />
      <gridHelper args={[400, 80, 0x2b5b88, 0x1d3b58]} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow={enableShadows}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#13253b" metalness={0} roughness={1} opacity={0.92} transparent />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#f8fafc" emissive="#38bdf8" emissiveIntensity={0.45} />
      </mesh>
      <axesHelper args={[12]} />
      {!simMode && <FlightPath samples={samples} />}
      {simMode && <InterVehicleLinks simVehicles={simVehicles} show={showInterVehicleLinks} />}
      <CameraFollower
        activeSample={simMode ? selectedSimSample : activeSample}
        followCamera={followCamera}
        controlsRef={controlsRef}
        targetKey={simMode ? selectedSystemId : null}
      />
      <Suspense fallback={null}>
        {simMode
          ? simVehicles.map((vehicle) => {
              const key = String(vehicle.systemId);
              const meshSettings = simVehicleMeshSettings[key] ?? null;
              const simModelType = meshSettings?.modelType ?? "stl";
              const simModelScale = Number.isFinite(meshSettings?.modelScale) ? meshSettings.modelScale : DEFAULT_MODEL_SCALE;
              const simRotate90 = Boolean(meshSettings?.rotateTailsitter90) && simModelType !== "dummy";
              const simStlPath =
                simModelType === "upload" && meshSettings?.customStlUrl ? meshSettings.customStlUrl : DEFAULT_STL;

              return simModelType === "dummy" ? (
                <DummyVehicle
                  key={`sim-dummy-${vehicle.systemId}`}
                  sample={vehicle.latestSample}
                  simMode
                  simLerpAlpha={simLerpAlpha}
                  simSlerpAlpha={simSlerpAlpha}
                  enableShadows={enableShadows}
                />
              ) : (
                <StlVehicle
                  key={`sim-stl-${vehicle.systemId}`}
                  sample={vehicle.latestSample}
                  stlPath={simStlPath}
                  modelScale={simModelScale}
                  simMode
                  simLerpAlpha={simLerpAlpha}
                  simSlerpAlpha={simSlerpAlpha}
                  rotateMesh90={simRotate90}
                  enableShadows={enableShadows}
                />
              );
            })
          : activeSample &&
            (modelType === "dummy" ? (
              <DummyVehicle
                sample={activeSample}
                simMode={simMode}
                simLerpAlpha={simLerpAlpha}
                simSlerpAlpha={simSlerpAlpha}
                enableShadows={enableShadows}
              />
            ) : (
              <StlVehicle
                sample={activeSample}
                stlPath={stlPath}
                modelScale={modelScale}
                simMode={simMode}
                simLerpAlpha={simLerpAlpha}
                simSlerpAlpha={simSlerpAlpha}
                rotateMesh90={rotateStlMesh90}
                enableShadows={enableShadows}
              />
            ))}
      </Suspense>
    </Canvas>
  );
}
