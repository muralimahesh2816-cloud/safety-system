import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";

const HelmetModel = ({ position = [0, 0, 0], scale = 1, rotation = [0, 0, 0], glow = false }) => {
  const material = useMemo(
    () => ({
      color: glow ? "#f59e0b" : "#f97316",
      roughness: 0.42,
      metalness: 0.16,
      emissive: glow ? "#fb923c" : "#000000",
      emissiveIntensity: glow ? 0.5 : 0
    }),
    [glow]
  );

  useFrame((state) => {
    if (!glow) return;
    const pulse = 0.35 + Math.sin(state.clock.elapsedTime * 4) * 0.12;
    state.scene.traverse((node) => {
      if (node.userData?.helmetGlow && node.material) node.material.emissiveIntensity = pulse;
    });
  });

  return (
    <group position={position} scale={scale} rotation={rotation}>
      <mesh castShadow userData={{ helmetGlow: true }}>
        <sphereGeometry args={[0.58, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh castShadow position={[0, -0.02, 0.38]} userData={{ helmetGlow: true }}>
        <boxGeometry args={[1.18, 0.12, 0.34]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh castShadow position={[0, 0.24, 0.02]}>
        <boxGeometry args={[0.14, 0.44, 1.02]} />
        <meshStandardMaterial color="#fed7aa" roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[0, -0.08, -0.05]}>
        <torusGeometry args={[0.46, 0.035, 12, 42]} />
        <meshStandardMaterial color="#c2410c" roughness={0.5} />
      </mesh>
    </group>
  );
};

export default HelmetModel;
