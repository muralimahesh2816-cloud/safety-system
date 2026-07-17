import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import HelmetModel from "./HelmetModel";

const limbMaterial = {
  color: "#1f2937",
  roughness: 0.62,
  metalness: 0.04
};

const WorkerModel = ({ activated = false, authenticated = false }) => {
  const groupRef = useRef(null);
  const vestRef = useRef(null);
  const helmetRef = useRef(null);
  const helmetProgress = useRef(0);
  const bodyMaterial = useMemo(
    () => ({
      color: "#f97316",
      roughness: 0.48,
      metalness: 0.08,
      emissive: "#fb923c",
      emissiveIntensity: activated ? 0.16 : 0.03
    }),
    [activated]
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const target = activated ? 1 : 0;
    helmetProgress.current += (target - helmetProgress.current) * Math.min(1, delta * 1.6);
    groupRef.current.position.x = -0.2 + helmetProgress.current * 0.28;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.04;
    if (helmetRef.current) {
      helmetRef.current.position.y = 1.72 + helmetProgress.current * 0.28;
      helmetRef.current.rotation.z = (1 - helmetProgress.current) * -0.55;
    }
    if (vestRef.current?.material) {
      vestRef.current.material.emissiveIntensity =
        (activated ? 0.34 : 0.08) + Math.sin(state.clock.elapsedTime * 5) * (authenticated ? 0.16 : 0.04);
    }
  });

  return (
    <group ref={groupRef} position={[-0.2, 0, 0]} scale={1.1}>
      <mesh castShadow position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.28, 32, 24]} />
        <meshStandardMaterial color="#d6a47a" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 1.42, 0]}>
        <capsuleGeometry args={[0.32, 0.62, 16, 28]} />
        <meshStandardMaterial {...bodyMaterial} />
      </mesh>
      <mesh ref={vestRef} castShadow position={[0, 1.45, 0.025]}>
        <boxGeometry args={[0.44, 0.7, 0.06]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.12} roughness={0.44} />
      </mesh>
      <mesh castShadow position={[-0.42, 1.4, 0]} rotation={[0, 0, 0.35]}>
        <capsuleGeometry args={[0.08, 0.52, 10, 16]} />
        <meshStandardMaterial {...limbMaterial} />
      </mesh>
      <mesh castShadow position={[0.42, 1.4, 0]} rotation={[0, 0, -0.35]}>
        <capsuleGeometry args={[0.08, 0.52, 10, 16]} />
        <meshStandardMaterial {...limbMaterial} />
      </mesh>
      <mesh castShadow position={[-0.15, 0.74, 0]}>
        <capsuleGeometry args={[0.1, 0.72, 10, 16]} />
        <meshStandardMaterial {...limbMaterial} />
      </mesh>
      <mesh castShadow position={[0.15, 0.74, 0]}>
        <capsuleGeometry args={[0.1, 0.72, 10, 16]} />
        <meshStandardMaterial {...limbMaterial} />
      </mesh>
      {activated ? (
        <group ref={helmetRef} position={[0, 1.72, 0]} rotation={[0, 0, -0.55]}>
          <HelmetModel scale={0.58} glow={authenticated} />
        </group>
      ) : null}
    </group>
  );
};

export default WorkerModel;
