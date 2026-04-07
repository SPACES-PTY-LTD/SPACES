import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";
import { TRUCK_PARK_Z, TRUCK_ROW_GAP, TRUCKS_PER_WAREHOUSE_ROW } from "../constants";
import type { TruckRender } from "../types";

const ROAD_NUDGE_INITIAL_DELAY_MIN_S = 0.6;
const ROAD_NUDGE_INITIAL_DELAY_MAX_S = 4.6;
const ROAD_NUDGE_DURATION_MIN_S = 5.45;
const ROAD_NUDGE_DURATION_MAX_S = 5.9;
const ROAD_NUDGE_DISTANCE_MIN = 0.12;
const ROAD_NUDGE_DISTANCE_MAX = 3.34;
const ROAD_NUDGE_NEXT_DELAY_MIN_S = 20.8;
const ROAD_NUDGE_NEXT_DELAY_MAX_S = 30.4;
const ROAD_ENTRY_ANIMATION_S = 0.9;
const ROAD_EXIT_ANIMATION_S = 0.9;
const ROAD_ENTRY_OFFSET_X = 2.2;
const ROAD_ENTRY_DROP_HEIGHT = 6.2;
const ROAD_ENTRY_BOUNCE_HEIGHT = 0.38;
const ROAD_ENTRY_BOUNCE_START_T = 0.72;
const ROAD_EXIT_OFFSET_X = 2.4;

function easeOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function TruckVisual({
  truck,
  isSelected,
  isHovered,
  showRegNumbers
}: {
  truck: TruckRender;
  isSelected: boolean;
  isHovered: boolean;
  showRegNumbers: boolean;
}) {
  const isSpeeding =
    truck.isSpeeding ??
    (truck.speedKph !== null &&
      truck.speedKph !== undefined &&
      truck.speedLimitKph !== null &&
      truck.speedLimitKph !== undefined &&
      truck.speedKph > truck.speedLimitKph);
  const isWaitingOverdue = truck.isWaitingOverdue ?? false;
  const isAlert = isSpeeding || isWaitingOverdue;
  const bodyColor = isAlert ? (isHovered ? "#f87171" : "#ef4444") : isSelected ? "#2563eb" : isHovered ? "#9ca3af" : "#999999";

  return (
    <>
      <mesh name={`truck-${truck.truckId}-body`} position={[0, 0.53, 0]}>
        <boxGeometry args={[2.15, 0.66, 0.9]} />
        <meshStandardMaterial color={bodyColor} roughness={0.86} />
      </mesh>

      {showRegNumbers || isHovered ? (
        <Html position={[0, 1.22, 0]} center zIndexRange={[16, 0]}>
          <div
          style={{
            padding: "2px 6px",
            borderRadius: 6,
            border: "1px solid rgba(15, 23, 42, 0.22)",
            background: "rgba(255,255,255,0.95)",
            color: "#0f172a",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.25,
            whiteSpace: "nowrap",
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            pointerEvents: "none"
          }}
        >
          {truck.plateNumber}
        </div>
      </Html>
      ) : null}

      <mesh name={`truck-${truck.truckId}-front-window`} position={[-1.09, 0.57, 0]}>
        <boxGeometry args={[0.04, 0.34, 0.62]} />
        <meshStandardMaterial color="#3fa0d8" roughness={0.4} metalness={0.08} />
      </mesh>
      <mesh name={`truck-${truck.truckId}-front-grille`} position={[-1.11, 0.34, 0]}>
        <boxGeometry args={[0.03, 0.14, 0.48]} />
        <meshStandardMaterial color="#c3ccd8" roughness={0.72} />
      </mesh>

      <mesh name={`truck-${truck.truckId}-rear-door`} position={[1.09, 0.52, 0]}>
        <boxGeometry args={[0.04, 0.48, 0.72]} />
        <meshStandardMaterial color="#e8edf3" roughness={0.84} />
      </mesh>
      <mesh position={[1.11, 0.52, 0]}>
        <boxGeometry args={[0.03, 0.44, 0.02]} />
        <meshStandardMaterial color="#b8c3d1" roughness={0.75} />
      </mesh>

      <mesh position={[-0.34, 0.34, 0.42]}>
        <boxGeometry args={[0.74, 0.14, 0.05]} />
        <meshStandardMaterial color="#c3ccd8" roughness={0.75} />
      </mesh>
      <mesh position={[-0.34, 0.34, -0.42]}>
        <boxGeometry args={[0.74, 0.14, 0.05]} />
        <meshStandardMaterial color="#c3ccd8" roughness={0.75} />
      </mesh>

      <mesh name={`truck-${truck.truckId}-wheel-fr`} position={[-0.7, 0.18, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh name={`truck-${truck.truckId}-wheel-rr`} position={[0.7, 0.18, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh name={`truck-${truck.truckId}-wheel-fl`} position={[-0.7, 0.18, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh name={`truck-${truck.truckId}-wheel-rl`} position={[0.7, 0.18, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </>
  );
}

function RoadTruckVisual({
  truck,
  isSelected,
  isHovered,
  showRegNumbers
}: {
  truck: TruckRender;
  isSelected: boolean;
  isHovered: boolean;
  showRegNumbers: boolean;
}) {
  return (
    <group scale={[-1, 1, 1]}>
      <TruckVisual truck={truck} isSelected={isSelected} isHovered={isHovered} showRegNumbers={showRegNumbers} />
    </group>
  );
}

export function TruckMesh({
  truck,
  warehouseX,
  warehouseZ,
  isSelected,
  showRegNumbers,
  onSelect,
  onDepartDone
}: {
  truck: TruckRender;
  warehouseX: number;
  warehouseZ: number;
  isSelected: boolean;
  showRegNumbers: boolean;
  onSelect: (truckId: string) => void;
  onDepartDone: (truckId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const departHandledRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const columnIndex = truck.slot % TRUCKS_PER_WAREHOUSE_ROW;
  const rowIndex = Math.floor(truck.slot / TRUCKS_PER_WAREHOUSE_ROW);
  const slotOffset = (columnIndex - 1.5) * 1.35;
  const targetParkZ = warehouseZ + TRUCK_PARK_Z + rowIndex * TRUCK_ROW_GAP;
  const targetX = warehouseX + slotOffset;

  useFrame(() => {
    if (!groupRef.current) return;

    const elapsed = (Date.now() - truck.changedAt) / 1000;
    let z = targetParkZ;
    let rotationY = -Math.PI / 2;

    if (truck.status === "arriving") {
      const t = Math.min(elapsed / 1.2, 1);
      z = targetParkZ + (1 - t) * 4.4;
    }

    if (truck.status === "departing") {
      const t = Math.min(elapsed / 1.0, 1);
      z = targetParkZ + t * 4.8;
      rotationY = Math.PI / 2;

      if (t >= 1 && !departHandledRef.current) {
        departHandledRef.current = true;
        onDepartDone(truck.truckId);
      }
    } else {
      departHandledRef.current = false;
    }

    groupRef.current.position.set(targetX, 0, z);
    groupRef.current.rotation.set(0, rotationY, 0);
  });

  return (
    <group
      ref={groupRef}
      position={[targetX, 0, targetParkZ]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(truck.truckId);
      }}
    >
      <mesh
        position={[0, 0.55, 0]}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setIsHovered(true);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
      >
        <boxGeometry args={[2.6, 1.2, 1.3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <TruckVisual truck={truck} isSelected={isSelected} isHovered={isHovered} showRegNumbers={showRegNumbers} />
    </group>
  );
}

export function RoadTruckMesh({
  truck,
  x,
  z,
  isSelected,
  showRegNumbers,
  onSelect
}: {
  truck: TruckRender;
  x: number;
  z: number;
  isSelected: boolean;
  showRegNumbers: boolean;
  onSelect: (truckId: string) => void;
}) {
  const groupRef = useRef<Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const nudgeInitializedRef = useRef(false);
  const nudgeStartAtRef = useRef(0);
  const nudgeDurationRef = useRef(0.6);
  const nudgeDistanceRef = useRef(0.2);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const now = clock.getElapsedTime();
    if (!nudgeInitializedRef.current) {
      nudgeInitializedRef.current = true;
      nudgeStartAtRef.current =
        now + ROAD_NUDGE_INITIAL_DELAY_MIN_S + Math.random() * (ROAD_NUDGE_INITIAL_DELAY_MAX_S - ROAD_NUDGE_INITIAL_DELAY_MIN_S);
      nudgeDurationRef.current =
        ROAD_NUDGE_DURATION_MIN_S + Math.random() * (ROAD_NUDGE_DURATION_MAX_S - ROAD_NUDGE_DURATION_MIN_S);
      nudgeDistanceRef.current =
        ROAD_NUDGE_DISTANCE_MIN + Math.random() * (ROAD_NUDGE_DISTANCE_MAX - ROAD_NUDGE_DISTANCE_MIN);
    }

    let offsetX = 0;
    let phaseOffsetX = 0;
    let phaseOffsetY = 0;

    if (now >= nudgeStartAtRef.current) {
      const elapsed = now - nudgeStartAtRef.current;
      const duration = nudgeDurationRef.current;
      const t = elapsed / duration;

      if (t <= 1) {
        // Smooth forward-then-back motion.
        offsetX = Math.sin(t * Math.PI) * nudgeDistanceRef.current;
      } else {
        nudgeStartAtRef.current =
          now + ROAD_NUDGE_NEXT_DELAY_MIN_S + Math.random() * (ROAD_NUDGE_NEXT_DELAY_MAX_S - ROAD_NUDGE_NEXT_DELAY_MIN_S);
        nudgeDurationRef.current =
          ROAD_NUDGE_DURATION_MIN_S + Math.random() * (ROAD_NUDGE_DURATION_MAX_S - ROAD_NUDGE_DURATION_MIN_S);
        nudgeDistanceRef.current =
          ROAD_NUDGE_DISTANCE_MIN + Math.random() * (ROAD_NUDGE_DISTANCE_MAX - ROAD_NUDGE_DISTANCE_MIN);
      }
    }

    if (truck.status === "arriving") {
      const t = Math.min((Date.now() - truck.changedAt) / (ROAD_ENTRY_ANIMATION_S * 1000), 1);
      phaseOffsetX = (1 - t) * ROAD_ENTRY_OFFSET_X;
      const dropProgress = easeOutCubic(t);
      phaseOffsetY = (1 - dropProgress) * ROAD_ENTRY_DROP_HEIGHT;

      if (t > ROAD_ENTRY_BOUNCE_START_T) {
        const bounceT = (t - ROAD_ENTRY_BOUNCE_START_T) / (1 - ROAD_ENTRY_BOUNCE_START_T);
        phaseOffsetY += Math.sin(bounceT * Math.PI) * ROAD_ENTRY_BOUNCE_HEIGHT * (1 - bounceT);
      }
    } else if (truck.status === "departing") {
      const t = Math.min((Date.now() - truck.changedAt) / (ROAD_EXIT_ANIMATION_S * 1000), 1);
      phaseOffsetX = -t * ROAD_EXIT_OFFSET_X;
      offsetX = 0;
    }

    groupRef.current.position.set(x + offsetX + phaseOffsetX, phaseOffsetY, z);
  });

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      rotation={[0, 0, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(truck.truckId);
      }}
    >
      <mesh
        position={[0, 0.55, 0]}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setIsHovered(true);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
      >
        <boxGeometry args={[2.6, 1.2, 1.3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <RoadTruckVisual
        truck={truck}
        isSelected={isSelected}
        isHovered={isHovered}
        showRegNumbers={showRegNumbers}
      />
    </group>
  );
}

export function RoadTruckPlaceholderMesh({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[2.05, 0.38, 0.86]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0} roughness={0.94} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[2.45, 0.06, 1.05]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0} roughness={0.96} />
      </mesh>
    </group>
  );
}
