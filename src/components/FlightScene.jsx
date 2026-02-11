import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

const CAMERA_POSITION = [30, 18, 35];
const qTailOffset = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
const DEFAULT_STL = "/tailsitter.stl";
const PATH_ELEVATION = 0.08;
const MIN_PATH_POINT_SEPARATION_SQ = 0.0004;
const MAX_PATH_POINTS = 12000;

function StlVehicle({ sample, stlPath, modelScale }) {
  const geometry = useLoader(STLLoader, stlPath);
  const meshRef = useRef();
  const sampleRef = useRef(sample ?? null);
  const sampleQuat = useMemo(() => new Quaternion(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);

  useEffect(() => {
    sampleRef.current = sample ?? null;
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
    meshRef.current.position.set(current.position[0], current.position[1], current.position[2]);
    sampleQuat.set(
      current.quaternion[0],
      current.quaternion[1],
      current.quaternion[2],
      current.quaternion[3],
    );
    renderQuat.copy(sampleQuat).multiply(qTailOffset);
    meshRef.current.quaternion.copy(renderQuat);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} scale={modelScale} castShadow receiveShadow>
      <meshStandardMaterial color="#d8e4ff" metalness={0.25} roughness={0.4} />
    </mesh>
  );
}

function DummyVehicle({ sample }) {
  const groupRef = useRef();
  const sampleRef = useRef(sample ?? null);
  const sampleQuat = useMemo(() => new Quaternion(), []);
  const renderQuat = useMemo(() => new Quaternion(), []);

  useEffect(() => {
    sampleRef.current = sample ?? null;
  }, [sample]);

  useFrame(() => {
    const current = sampleRef.current;
    if (!groupRef.current || !current) {
      return;
    }
    groupRef.current.position.set(current.position[0], current.position[1], current.position[2]);
    sampleQuat.set(
      current.quaternion[0],
      current.quaternion[1],
      current.quaternion[2],
      current.quaternion[3],
    );
    renderQuat.copy(sampleQuat).multiply(qTailOffset);
    groupRef.current.quaternion.copy(renderQuat);
  });

  return (
    <group ref={groupRef} scale={1.1}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.4, 0.4]} />
        <meshStandardMaterial color="#cbd5f5" metalness={0.1} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[0.5, 0.5, 1.4]} />
        <meshStandardMaterial color="#7dd3fc" />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.8, 0.2, 0.3]} />
        <meshStandardMaterial color="#a5b4fc" />
      </mesh>
      <mesh position={[0, -0.6, 0]} castShadow>
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

function CameraFollower({ activeSample, followCamera, controlsRef }) {
  const { camera } = useThree();
  const offsetRef = useRef(new Vector3(...CAMERA_POSITION));
  const wasFollowingRef = useRef(false);
  const targetPos = useMemo(() => new Vector3(), []);
  const desiredPos = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!followCamera || !activeSample) {
      wasFollowingRef.current = false;
      return;
    }

    targetPos.set(activeSample.position[0], activeSample.position[1], activeSample.position[2]);
    if (!wasFollowingRef.current) {
      offsetRef.current.copy(camera.position).sub(targetPos);
      wasFollowingRef.current = true;
    }

    desiredPos.copy(targetPos).add(offsetRef.current);
    camera.position.lerp(desiredPos, 0.08);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.lerp(targetPos, 0.12);
      controls.update();
    }
  });

  return null;
}

export default function FlightScene({ samples, activeSample, modelType, modelScale, customModelUrl, followCamera }) {
  const stlPath = modelType === "upload" && customModelUrl ? customModelUrl : DEFAULT_STL;
  const controlsRef = useRef();

  return (
    <Canvas shadows camera={{ position: CAMERA_POSITION, fov: 50 }} dpr={[1, 1.75]}>
      <color attach="background" args={["#050912"]} />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[45, 60, 30]}
        intensity={1.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <OrbitControls ref={controlsRef} maxDistance={160} minDistance={6} enablePan enableDamping dampingFactor={0.08} />
      <gridHelper args={[400, 80, 0x2b5b88, 0x1d3b58]} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#13253b" metalness={0} roughness={1} opacity={0.92} transparent />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#f8fafc" emissive="#38bdf8" emissiveIntensity={0.45} />
      </mesh>
      <axesHelper args={[12]} />
      <FlightPath samples={samples} />
      <CameraFollower activeSample={activeSample} followCamera={followCamera} controlsRef={controlsRef} />
      <Suspense fallback={null}>
        {activeSample &&
          (modelType === "dummy" ? (
            <DummyVehicle sample={activeSample} />
          ) : (
            <StlVehicle sample={activeSample} stlPath={stlPath} modelScale={modelScale} />
          ))}
      </Suspense>
    </Canvas>
  );
}
