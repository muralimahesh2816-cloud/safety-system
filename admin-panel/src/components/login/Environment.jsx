const Environment = ({ activated = false }) => (
  <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[12, 9]} />
      <meshStandardMaterial color="#07111f" roughness={0.82} metalness={0.08} />
    </mesh>

    <group position={[1.35, 0.42, 0.08]}>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[1.72, 0.12, 0.78]} />
        <meshStandardMaterial color="#1f2937" roughness={0.48} metalness={0.28} />
      </mesh>
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} castShadow position={[x, -0.05, 0]}>
          <boxGeometry args={[0.08, 0.78, 0.08]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.24} />
        </mesh>
      ))}
    </group>

    {[-4.2, -2.1, 2.1, 4.2].map((x) => (
      <mesh key={x} position={[x, 1.4, -2.8]}>
        <boxGeometry args={[0.08, 2.8, 0.08]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
    ))}

    <mesh position={[0, 2.72, -2.8]}>
      <boxGeometry args={[8.8, 0.08, 0.08]} />
      <meshStandardMaterial color="#334155" roughness={0.55} />
    </mesh>

    <mesh position={[0, 2.15, -2.9]}>
      <boxGeometry args={[8.2, 0.03, 0.04]} />
      <meshStandardMaterial
        color={activated ? "#38bdf8" : "#0f172a"}
        emissive={activated ? "#38bdf8" : "#000000"}
        emissiveIntensity={activated ? 0.45 : 0}
      />
    </mesh>
  </group>
);

export default Environment;
