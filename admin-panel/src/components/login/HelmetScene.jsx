import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment as DreiEnvironment, Float, PerspectiveCamera } from "@react-three/drei";
import HelmetModel from "./HelmetModel";
import WorkerModel from "./WorkerModel";
import IndustrialEnvironment from "./Environment";
import { isSafetyPassed } from "./ppeSequence";

const CameraRig = ({ activated = false, safetyPassed = false }) => {
  const cameraRef = useRef(null);
  useFrame((state) => {
    if (!cameraRef.current) return;
    const t = state.clock.elapsedTime;
    const targetX = safetyPassed ? 0.36 : activated ? 0.18 : Math.sin(t * 0.22) * 0.18;
    const targetY = safetyPassed ? 1.42 : activated ? 1.32 : 1.18 + Math.sin(t * 0.18) * 0.08;
    const targetZ = safetyPassed ? 4.05 : 4.4;
    cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.025;
    cameraRef.current.position.y += (targetY - cameraRef.current.position.y) * 0.025;
    cameraRef.current.position.z += (targetZ - cameraRef.current.position.z) * 0.025;
    cameraRef.current.lookAt(0.18, 1.25, 0);
  });
  return <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.18, 4.4]} fov={38} />;
};

const Particles = () => {
  const points = useMemo(
    () =>
      Array.from({ length: 54 }, (_, index) => ({
        id: index,
        position: [
          (Math.random() - 0.5) * 7,
          0.6 + Math.random() * 2.7,
          -2.5 + Math.random() * 3.2
        ],
        scale: 0.012 + Math.random() * 0.026
      })),
    []
  );
  return (
    <group>
      {points.map((point) => (
        <Float key={point.id} speed={0.6} rotationIntensity={0.2} floatIntensity={0.4}>
          <mesh position={point.position}>
            <sphereGeometry args={[point.scale, 8, 8]} />
            <meshBasicMaterial color="#bae6fd" transparent opacity={0.34} />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

const TablePpe = ({ ppeStep = 0 }) => (
  <group position={[1.35, 0.98, 0.08]}>
    {ppeStep < 1 ? <HelmetModel scale={0.52} rotation={[0, -0.35, 0]} /> : null}
    {ppeStep < 2 ? (
      <group position={[0.1, -0.18, -0.28]} rotation={[-0.08, 0, 0.08]}>
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.05, 0.38]} />
          <meshStandardMaterial color="#f97316" roughness={0.48} emissive="#f97316" emissiveIntensity={0.06} />
        </mesh>
        <mesh position={[0, 0.035, 0.02]}>
          <boxGeometry args={[0.46, 0.012, 0.03]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      </group>
    ) : null}
    {ppeStep < 3 ? (
      <group position={[-0.52, -0.18, -0.24]}>
        {[-0.08, 0.12].map((x) => (
          <mesh key={x} castShadow position={[x, 0, 0]}>
            <boxGeometry args={[0.18, 0.08, 0.34]} />
            <meshStandardMaterial color="#111827" roughness={0.42} metalness={0.08} />
          </mesh>
        ))}
      </group>
    ) : null}
  </group>
);

const HelmetScene = ({ activated = false, authenticated = false, ppeStep = 0 }) => {
  const safetyPassed = isSafetyPassed(ppeStep);
  return (
    <div className="absolute inset-0">
      <Canvas shadows dpr={[1, 1.6]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Suspense fallback={null}>
          <CameraRig activated={activated} safetyPassed={safetyPassed} />
          <ambientLight intensity={0.38} />
          <directionalLight
            castShadow
            position={[-3, 4.5, 4]}
            intensity={safetyPassed ? 2.45 : activated ? 2.1 : 1.25}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight
            position={[2.2, 1.8, 1.2]}
            intensity={activated ? 3.2 : 1.1}
            color={safetyPassed ? "#22c55e" : activated ? "#38bdf8" : "#f97316"}
          />
          <spotLight
            position={[0, 4.5, 2.2]}
            angle={0.42}
            penumbra={0.55}
            intensity={activated ? 2.4 : 1.2}
            color="#f8fafc"
          />
          <IndustrialEnvironment activated={activated} />
          <WorkerModel activated={activated} authenticated={authenticated} ppeStep={ppeStep} />
          <TablePpe ppeStep={ppeStep} />
          <Particles />
          <ContactShadows position={[0, 0.01, 0]} opacity={0.4} blur={2.6} far={4} />
          <DreiEnvironment preset="warehouse" />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default HelmetScene;
