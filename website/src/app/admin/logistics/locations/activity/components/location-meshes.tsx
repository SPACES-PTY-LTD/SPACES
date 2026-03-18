import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import { LOCATION_ENTER_MS, LOCATION_EXIT_MS } from "../constants";
import type { LocationNode } from "../types";

function AnimatedLocationGroup({
  x,
  z,
  status,
  changedAt,
  children,
  onPointerEnter,
  onPointerLeave,
  onClick
}: {
  x: number;
  z: number;
  status: "active" | "leaving";
  changedAt: number;
  children: React.ReactNode;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onClick?: () => void;
}) {
  const animatedRef = useRef<Group>(null);

  useFrame(() => {
    if (!animatedRef.current) return;

    const elapsed = Date.now() - changedAt;
    let scale = 1;
    let y = 0;

    if (status === "active") {
      const t = Math.min(elapsed / LOCATION_ENTER_MS, 1);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      scale = 0.82 + eased * 0.18;
      y = (1 - t) * 0.55;
    } else {
      const t = Math.min(elapsed / LOCATION_EXIT_MS, 1);
      scale = 1 - t * 0.34;
      y = -t * 0.45;
    }

    animatedRef.current.position.set(0, y, 0);
    animatedRef.current.scale.set(scale, scale, scale);
  });

  return (
    <group
      position={[x, 0, z]}
      onPointerEnter={(event) => {
        event.stopPropagation();
        onPointerEnter?.();
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        onPointerLeave?.();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      <group ref={animatedRef}>{children}</group>
    </group>
  );
}

function LocationBadge({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null;

  return (
    <Html position={[0, 3.1, -0.4]} center zIndexRange={[20, 0]}>
      <div
        style={{
          padding: "4px 8px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.88)",
          color: "#e2e8f0",
          fontSize: 8,
          fontWeight: 700,
          whiteSpace: "nowrap",
          zIndex: 10,
          fontFamily: "ui-sans-serif, system-ui, -apple-system"
        }}
      >
        {label}
      </div>
    </Html>
  );
}

function WarehouseMesh({
  x,
  z,
  locationId,
  label,
  status,
  changedAt,
  showLocationLabels,
  onSelectLocation
}: {
  x: number;
  z: number;
  locationId: string;
  label: string;
  status: "active" | "leaving";
  changedAt: number;
  showLocationLabels: boolean;
  onSelectLocation?: (locationId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const warehouseBodyColor = isHovered ? "#dbeafe" : "#f3f2ee";
  const warehouseRoofColor = isHovered ? "#1e3a8a" : "#444444";

  return (
    <AnimatedLocationGroup
      x={x}
      z={z}
      status={status}
      changedAt={changedAt}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={() => onSelectLocation?.(locationId)}
    >
      <mesh name={`warehouse-${locationId}-pad`} position={[0, 0.05, -0.95]}>
        <boxGeometry args={[6.4, 0.1, 4.4]} />
        <meshStandardMaterial color="#d8dde6" roughness={0.95} />
      </mesh>

      <mesh name={`warehouse-${locationId}-body`} position={[0, 1.2, -0.95]}>
        <boxGeometry args={[5.2, 2.4, 3.2]} />
        <meshStandardMaterial color={warehouseBodyColor} roughness={0.88} />
      </mesh>

      <mesh name={`warehouse-${locationId}-roof`} position={[0, 2.5, -0.95]}>
        <boxGeometry args={[5.5, 0.2, 3.5]} />
        <meshStandardMaterial color={warehouseRoofColor} roughness={0.72} />
      </mesh>

      <mesh name={`warehouse-${locationId}-base`} position={[0, 0.35, -0.95]}>
        <boxGeometry args={[5.22, 0.08, 3.22]} />
        <meshStandardMaterial color="#fff" roughness={0.92} />
      </mesh>

      <mesh name={`warehouse-${locationId}-roller-door`} position={[0, 0.85, 0.69]}>
        <boxGeometry args={[2.35, 1.7, 0.12]} />
        <meshStandardMaterial color="#445976" roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.65, 0.76]} name={`warehouse-${locationId}-roller-door-line1`}>
        <boxGeometry args={[2.3, 0.06, 0.03]} />
        <meshStandardMaterial color="#6e819c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.35, 0.76]} name={`warehouse-${locationId}-roller-door-line2`}>
        <boxGeometry args={[2.3, 0.06, 0.03]} />
        <meshStandardMaterial color="#6e819c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.05, 0.76]} name={`warehouse-${locationId}-roller-door-line3`}>
        <boxGeometry args={[2.3, 0.06, 0.03]} />
        <meshStandardMaterial color="#6e819c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.75, 0.76]} name={`warehouse-${locationId}-roller-door-line4`}>
        <boxGeometry args={[2.3, 0.06, 0.03]} />
        <meshStandardMaterial color="#6e819c" roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.45, 0.76]} name={`warehouse-${locationId}-roller-door-line5`}>
        <boxGeometry args={[2.3, 0.06, 0.03]} />
        <meshStandardMaterial color="#6e819c" roughness={0.8} />
      </mesh>

      <mesh name={`warehouse-${locationId}-side-door`} position={[1.72, 0.5, 0.67]}>
        <boxGeometry args={[0.44, 1, 0.1]} />
        <meshStandardMaterial color="#3f5678" roughness={0.72} />
      </mesh>
      <mesh name={`warehouse-${locationId}-side-window`} position={[1.72, 0.62, 0.73]}>
        <boxGeometry args={[0.18, 0.26, 0.03]} />
        <meshStandardMaterial color="#3ca5e3" roughness={0.35} metalness={0.1} />
      </mesh>

      <mesh position={[-1.15, 0.08, 1.1]}>
        <boxGeometry args={[0.86, 0.08, 0.64]} />
        <meshStandardMaterial color="#d8aa62" roughness={0.88} />
      </mesh>
      <mesh position={[-1.15, 0.3, 1.1]}>
        <boxGeometry args={[0.78, 0.34, 0.56]} />
        <meshStandardMaterial color="#d9b17a" roughness={0.85} />
      </mesh>

      <mesh position={[-0.24, 0.08, 1.12]}>
        <boxGeometry args={[0.86, 0.08, 0.64]} />
        <meshStandardMaterial color="#d8aa62" roughness={0.88} />
      </mesh>
      <mesh position={[-0.24, 0.26, 1.12]}>
        <boxGeometry args={[0.78, 0.28, 0.56]} />
        <meshStandardMaterial color="#d9b17a" roughness={0.85} />
      </mesh>

      <LocationBadge
        label={label}
        visible={status === "active" && (showLocationLabels || isHovered)}
      />
    </AnimatedLocationGroup>
  );
}

function WorkshopMesh({
  x,
  z,
  locationId,
  label,
  status,
  changedAt,
  showLocationLabels,
  onSelectLocation
}: {
  x: number;
  z: number;
  locationId: string;
  label: string;
  status: "active" | "leaving";
  changedAt: number;
  showLocationLabels: boolean;
  onSelectLocation?: (locationId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const workshopBodyColor = isHovered ? "#c7d2fe" : "#e5e7eb";
  const workshopRoofColor = isHovered ? "#1e40af" : "#334155";

  return (
    <AnimatedLocationGroup
      x={x}
      z={z}
      status={status}
      changedAt={changedAt}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={() => onSelectLocation?.(locationId)}
    >
      <mesh position={[0, 0.05, -1]}>
        <boxGeometry args={[6.4, 0.1, 4.4]} />
        <meshStandardMaterial color="#d7dde6" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.2, -1]}>
        <boxGeometry args={[5.2, 2.4, 3.2]} />
        <meshStandardMaterial color={workshopBodyColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.2, -1]}>
        <boxGeometry args={[5.4, 0.18, 3.4]} />
        <meshStandardMaterial color={workshopRoofColor} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.2, 0.74]}>
        <boxGeometry args={[2.2, 1.8, 0.12]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} />
      </mesh>
      <mesh position={[-1.5, 1.35, 0.72]}>
        <boxGeometry args={[0.75, 0.75, 0.03]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.45} />
      </mesh>
      <mesh position={[-1.5, 1.35, 0.74]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.55, 0.08, 0.03]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>
      <mesh position={[-1.5, 1.35, 0.74]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.55, 0.08, 0.03]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>

      <LocationBadge
        label={label}
        visible={status === "active" && (showLocationLabels || isHovered)}
      />
    </AnimatedLocationGroup>
  );
}

function WaypointMesh({
  x,
  z,
  locationId,
  label,
  status,
  changedAt,
  showLocationLabels,
  onSelectLocation
}: {
  x: number;
  z: number;
  locationId: string;
  label: string;
  status: "active" | "leaving";
  changedAt: number;
  showLocationLabels: boolean;
  onSelectLocation?: (locationId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const waypointSphereColor = isHovered ? "#67e8f9" : "#22d3ee";
  const waypointRingColor = isHovered ? "#0284c7" : "#0ea5e9";

  return (
    <AnimatedLocationGroup
      x={x}
      z={z}
      status={status}
      changedAt={changedAt}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={() => onSelectLocation?.(locationId)}
    >
      <mesh position={[0, 0.05, -1]}>
        <boxGeometry args={[5.8, 0.1, 4]} />
        <meshStandardMaterial color="#dbe7f3" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.7, -1]}>
        <cylinderGeometry args={[0.12, 0.12, 1.4, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.45, -1]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={waypointSphereColor} emissive="#0e7490" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0.07, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.15, 24]} />
        <meshStandardMaterial color={waypointRingColor} roughness={0.4} metalness={0.2} />
      </mesh>

      <LocationBadge
        label={label}
        visible={status === "active" && (showLocationLabels || isHovered)}
      />
    </AnimatedLocationGroup>
  );
}

function RestAreaMesh({
  x,
  z,
  locationId,
  label,
  status,
  changedAt,
  showLocationLabels,
  onSelectLocation
}: {
  x: number;
  z: number;
  locationId: string;
  label: string;
  status: "active" | "leaving";
  changedAt: number;
  showLocationLabels: boolean;
  onSelectLocation?: (locationId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const restRoofColor = isHovered ? "#65a30d" : "#3f6212";

  return (
    <AnimatedLocationGroup
      x={x}
      z={z}
      status={status}
      changedAt={changedAt}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={() => onSelectLocation?.(locationId)}
    >
      <mesh position={[0, 0.05, -1]}>
        <boxGeometry args={[6.1, 0.1, 4.2]} />
        <meshStandardMaterial color="#d7e0d4" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.2, -1]}>
        <boxGeometry args={[4.2, 0.18, 2.2]} />
        <meshStandardMaterial color={restRoofColor} roughness={0.7} />
      </mesh>
      <mesh position={[-1.7, 0.62, -1]}>
        <boxGeometry args={[0.12, 1.1, 0.12]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[1.7, 0.62, -1]}>
        <boxGeometry args={[0.12, 1.1, 0.12]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.4, 0.45]}>
        <boxGeometry args={[2.8, 0.12, 0.5]} />
        <meshStandardMaterial color="#8b5e34" roughness={0.8} />
      </mesh>
      <mesh position={[-1.2, 0.26, 0.45]}>
        <boxGeometry args={[0.15, 0.28, 0.45]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[1.2, 0.26, 0.45]}>
        <boxGeometry args={[0.15, 0.28, 0.45]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>

      <LocationBadge
        label={label}
        visible={status === "active" && (showLocationLabels || isHovered)}
      />
    </AnimatedLocationGroup>
  );
}

function FuelStationMesh({
  x,
  z,
  locationId,
  label,
  status,
  changedAt,
  showLocationLabels,
  onSelectLocation
}: {
  x: number;
  z: number;
  locationId: string;
  label: string;
  status: "active" | "leaving";
  changedAt: number;
  showLocationLabels: boolean;
  onSelectLocation?: (locationId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const fuelCanopyColor = isHovered ? "#1d4ed8" : "#1e40af";

  return (
    <AnimatedLocationGroup
      x={x}
      z={z}
      status={status}
      changedAt={changedAt}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={() => onSelectLocation?.(locationId)}
    >
      <mesh position={[0, 0.05, -1]}>
        <boxGeometry args={[6.4, 0.1, 4.4]} />
        <meshStandardMaterial color="#d8dde6" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.1, -1]}>
        <boxGeometry args={[5.2, 0.2, 3.2]} />
        <meshStandardMaterial color={fuelCanopyColor} roughness={0.55} />
      </mesh>
      <mesh position={[-2, 1.03, -2.2]}>
        <boxGeometry args={[0.18, 2.06, 0.18]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[2, 1.03, -2.2]}>
        <boxGeometry args={[0.18, 2.06, 0.18]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[-2, 1.03, 0.2]}>
        <boxGeometry args={[0.18, 2.06, 0.18]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[2, 1.03, 0.2]}>
        <boxGeometry args={[0.18, 2.06, 0.18]} />
        <meshStandardMaterial color="#475569" roughness={0.75} />
      </mesh>
      <mesh position={[-0.8, 0.75, 0.28]}>
        <boxGeometry args={[0.55, 1.3, 0.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.75} />
      </mesh>
      <mesh position={[0.8, 0.75, 0.28]}>
        <boxGeometry args={[0.55, 1.3, 0.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.75} />
      </mesh>

      <LocationBadge
        label={label}
        visible={status === "active" && (showLocationLabels || isHovered)}
      />
    </AnimatedLocationGroup>
  );
}

function PlaceholderMesh({ x, z, changedAt }: { x: number; z: number; changedAt: number }) {
  return (
    <AnimatedLocationGroup x={x} z={z} status="active" changedAt={changedAt}>
      <mesh position={[0, 0.04, -1]}>
        <boxGeometry args={[6, 0.08, 4.2]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.95} />
      </mesh>
    </AnimatedLocationGroup>
  );
}

export function LocationMesh({
  location,
  x,
  z,
  showLocationLabels,
  onSelectLocation
}: {
  location: LocationNode;
  x: number;
  z: number;
  showLocationLabels: boolean;
  onSelectLocation?: (locationId: string) => void;
}) {
  if (location.meshType === "placeholder") {
    return <PlaceholderMesh x={x} z={z} changedAt={location.changedAt} />;
  }
  if (location.meshType === "warehouse") {
    const locationLabel = location.label ?? location.company ?? location.category.toUpperCase();
    return (
      <WarehouseMesh
        x={x}
        z={z}
        locationId={location.locationId}
        label={locationLabel}
        status={location.status}
        changedAt={location.changedAt}
        showLocationLabels={showLocationLabels}
        onSelectLocation={onSelectLocation}
      />
    );
  }
  if (location.meshType === "workshop") {
    const locationLabel = location.label ?? location.company ?? "WORKSHOP";
    return (
      <WorkshopMesh
        x={x}
        z={z}
        locationId={location.locationId}
        label={locationLabel}
        status={location.status}
        changedAt={location.changedAt}
        showLocationLabels={showLocationLabels}
        onSelectLocation={onSelectLocation}
      />
    );
  }
  if (location.meshType === "waypoint") {
    const locationLabel = location.label ?? location.company ?? "WAYPOINT";
    return (
      <WaypointMesh
        x={x}
        z={z}
        locationId={location.locationId}
        label={locationLabel}
        status={location.status}
        changedAt={location.changedAt}
        showLocationLabels={showLocationLabels}
        onSelectLocation={onSelectLocation}
      />
    );
  }
  if (location.meshType === "rest") {
    const locationLabel = location.label ?? location.company ?? "REST AREA";
    return (
      <RestAreaMesh
        x={x}
        z={z}
        locationId={location.locationId}
        label={locationLabel}
        status={location.status}
        changedAt={location.changedAt}
        showLocationLabels={showLocationLabels}
        onSelectLocation={onSelectLocation}
      />
    );
  }

  const locationLabel = location.label ?? location.company ?? "FUEL STATION";
  return (
    <FuelStationMesh
      x={x}
      z={z}
      locationId={location.locationId}
      label={locationLabel}
      status={location.status}
      changedAt={location.changedAt}
      showLocationLabels={showLocationLabels}
      onSelectLocation={onSelectLocation}
    />
  );
}
