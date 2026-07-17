import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import HelmetModel from "./HelmetModel";
import { PPE_STEPS, isSafetyPassed } from "./ppeSequence";

const limbMaterial = {
  color: "#1f2937",
  roughness: 0.62,
  metalness: 0.04
};

const WorkerModel = ({ activated = false, authenticated = false, ppeStep = 0 }) => {
  const groupRef = useRef(null);
  const vestRef = useRef(null);
  const helmetRef = useRef(null);
  const leftArmRef = useRef(null);
  const rightArmRef = useRef(null);
  const shoesRef = useRef(null);
  const helmetProgress = useRef(0);
  const vestProgress = useRef(0);
  const shoeProgress = useRef(0);
  const safetyPassed = isSafetyPassed(ppeStep);
  const helmetEquipped = ppeStep >= 1;
  const vestEquipped = ppeStep >= 2;
  const shoesEquipped = ppeStep >= 3;
  const bodyMaterial = useMemo(
    () => ({
      color: vestEquipped ? "#f97316" : "#334155",
      roughness: 0.52,
      metalness: 0.08,
      emissive: "#fb923c",
      emissiveIntensity: vestEquipped ? 0.14 : 0
    }),
    [vestEquipped]
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const target = helmetEquipped ? 1 : 0;
    helmetProgress.current += (target - helmetProgress.current) * Math.min(1, delta * 1.6);
    vestProgress.current += ((vestEquipped ? 1 : 0) - vestProgress.current) * Math.min(1, delta * 2.4);
    shoeProgress.current += ((shoesEquipped ? 1 : 0) - shoeProgress.current) * Math.min(1, delta * 2.2);
    groupRef.current.position.x = -0.2 + helmetProgress.current * 0.28;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.04;
    if (helmetRef.current) {
      helmetRef.current.position.set(
        0.36 - helmetProgress.current * 0.36,
        1.46 + helmetProgress.current * 0.54,
        0.08 - helmetProgress.current * 0.08
      );
      helmetRef.current.rotation.z = (1 - helmetProgress.current) * -0.65;
    }
    if (leftArmRef.current && rightArmRef.current) {
      const reach = Math.sin(helmetProgress.current * Math.PI);
      leftArmRef.current.rotation.z = 0.45 - reach * 0.95;
      rightArmRef.current.rotation.z = -0.45 + reach * 0.95;
    }
    if (vestRef.current?.material) {
      vestRef.current.material.emissiveIntensity =
        vestProgress.current * (0.22 + Math.sin(state.clock.elapsedTime * 5) * (safetyPassed || authenticated ? 0.16 : 0.04));
      vestRef.current.scale.y = 0.45 + vestProgress.current * 0.55;
    }
    if (shoesRef.current) {
      shoesRef.current.children.forEach((shoe) => {
        if (shoe.material) {
          shoe.material.emissiveIntensity = shoeProgress.current * (safetyPassed ? 0.32 : 0.12);
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[-0.2, 0, 0]} scale={1}>
      <mesh castShadow position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.28, 32, 24]} />
        <meshStandardMaterial color="#d6a47a" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 1.42, 0]}>
        <capsuleGeometry args={[0.34, 0.7, 16, 28]} />
        <meshStandardMaterial {...bodyMaterial} />
      </mesh>
      <mesh ref={vestRef} castShadow position={[0, 1.45, 0.045]} scale={[1, vestEquipped ? 1 : 0.45, 1]}>
        <boxGeometry args={[0.5, 0.78, 0.07]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#f59e0b"
          emissiveIntensity={vestEquipped ? 0.2 : 0}
          transparent
          opacity={vestEquipped ? 0.96 : 0.22}
          roughness={0.44}
        />
      </mesh>
      {PPE_STEPS.map((step, index) => (
        <mesh key={step.key} position={[-0.26 + index * 0.26, 1.92, 0.31]} visible={ppeStep > index}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshBasicMaterial color={safetyPassed ? "#22c55e" : "#38bdf8"} />
        </mesh>
      ))}
      <mesh ref={leftArmRef} castShadow position={[-0.43, 1.4, 0]} rotation={[0, 0, 0.45]}>
        <capsuleGeometry args={[0.08, 0.52, 10, 16]} />
        <meshStandardMaterial {...limbMaterial} />
      </mesh>
      <mesh ref={rightArmRef} castShadow position={[0.43, 1.4, 0]} rotation={[0, 0, -0.45]}>
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
      <group ref={shoesRef}>
        {[-0.16, 0.16].map((x) => (
          <mesh key={x} castShadow position={[x, 0.28, 0.1]}>
            <boxGeometry args={[0.2, 0.1, 0.36]} />
            <meshStandardMaterial
              color={shoesEquipped ? "#111827" : "#0f172a"}
              emissive={shoesEquipped ? "#38bdf8" : "#000000"}
              emissiveIntensity={shoesEquipped ? 0.1 : 0}
              roughness={0.42}
              metalness={0.12}
            />
          </mesh>
        ))}
      </group>
      {activated || helmetEquipped ? (
        <group ref={helmetRef} position={[0.36, 1.46, 0.08]} rotation={[0, 0, -0.65]}>
          <HelmetModel scale={0.58} glow={authenticated} />
        </group>
      ) : null}
    </group>
  );
};

export default WorkerModel;
