import { useEffect, useMemo } from "react";
import { MeshStandardMaterial } from "three";
import { REFINED_TRUCK_GEOMETRIES as geometry } from "./refined-truck-geometry";

// These neutral materials and the geometry are shared for the lifetime of the scene.
const materials = {
  dark: new MeshStandardMaterial({ color: "#26313d", roughness: 0.85 }),
  windows: new MeshStandardMaterial({ color: "#426b82", roughness: 0.3, metalness: 0.12 }),
  metal: new MeshStandardMaterial({ color: "#a9b4c2", roughness: 0.55, metalness: 0.3 }),
  tyres: new MeshStandardMaterial({ color: "#101820", roughness: 0.95 }),
  lights: new MeshStandardMaterial({ color: "#fff1d5", emissive: "#fff1d5", emissiveIntensity: 0.12, roughness: 0.5 }),
  rearLights: new MeshStandardMaterial({ color: "#be2932", roughness: 0.5 }),
};

export function RefinedBoxTruck({ bodyColor, truckId }: { bodyColor: string; truckId: string }) {
  const paint = useMemo(() => new MeshStandardMaterial({ color: bodyColor, roughness: 0.72 }), [bodyColor]);
  useEffect(() => () => paint.dispose(), [paint]);
  return (
    <group dispose={null}>
      <mesh name={`truck-${truckId}-body`} geometry={geometry.painted} material={paint} />
      {Object.entries(materials).map(([part, material]) => (
        <mesh key={part} name={`truck-${truckId}-${part}`} geometry={geometry[part as keyof typeof materials]} material={material} dispose={null} />
      ))}
    </group>
  );
}
