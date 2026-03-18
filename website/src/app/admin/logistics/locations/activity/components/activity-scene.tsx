import { Html, MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { PerspectiveCamera } from "three";
import { Vector3 } from "three";
import { BASE_ROAD_LANE_COUNT, ROAD_COLUMNS_PER_ROW, TRUCK_ROW_GAP, TRUCKS_PER_WAREHOUSE_ROW } from "../constants";
import type { LocationNode, TruckRender } from "../types";
import { LocationMesh } from "./location-meshes";
import { RoadTruckMesh, RoadTruckPlaceholderMesh, TruckMesh } from "./truck-mesh";

export type CameraPresetView = "reset" | "overview" | "road" | "top" | "selected";

export type SceneCameraApi = {
  setView: (view: CameraPresetView) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};
const DEFAULT_MIN_POLAR_ANGLE = Math.PI / 9.2;
const DEFAULT_MAX_POLAR_ANGLE = Math.PI / 2.04;

function AreaLabel({ x, y, z, text }: { x: number; y: number; z: number; text: string }) {
  return (
    <Html position={[x, y, z]} center transform={false} zIndexRange={[18, 0]}>
      <div
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.88)",
          color: "#e2e8f0",
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: "nowrap",
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          border: "1px solid rgba(226,232,240,0.24)",
          boxShadow: "0 8px 20px rgba(15,23,42,0.2)"
        }}
      >
        {text}
      </div>
    </Html>
  );
}

function AnimatedRoadDivider({
  dividerZ,
  roadWidth,
  dashCount,
  speed = 1
}: {
  dividerZ: number;
  roadWidth: number;
  dashCount: number;
  speed?: number;
}) {
  const groupRef = useRef<Group>(null);
  const dashRefs = useRef<Array<Mesh | null>>([]);
  const dashGap = roadWidth / dashCount;
  const dashLength = dashGap * 0.52;
  const startX = -(roadWidth) / 2 + dashGap / 2;
  const renderDashCount = Math.max(dashCount - 1, 1);
  const travelWidth = (roadWidth - dashGap)+1;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const shift = clock.getElapsedTime() * speed;

    for (let index = 0; index < renderDashCount; index += 1) {
      const dash = dashRefs.current[index];
      if (!dash) continue;

      let wrapped = (index * dashGap - shift) % travelWidth;
      if (wrapped < 0) wrapped += travelWidth;
      dash.position.x = startX + wrapped;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: renderDashCount }).map((_, index) => {
        return (
          <mesh
            key={`divider-dash-${dividerZ}-${index}`}
            ref={(node) => {
              dashRefs.current[index] = node;
            }}
            position={[startX + index * dashGap, 0.07, dividerZ]}
          >
            <boxGeometry args={[dashLength, 0.02, 0.14]} />
            <meshStandardMaterial color="#f3f4f6" roughness={0.75} />
          </mesh>
        );
      })}
    </group>
  );
}

type RoadSignType = "clock" | "pulse" | "eta";

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandomSignType(): RoadSignType {
  const variants: RoadSignType[] = ["clock", "pulse", "eta"];
  return variants[Math.floor(Math.random() * variants.length)];
}

function AnimatedRoadTimingSign({
  roadWidth,
  roadCenterZ,
  laneCount,
  laneGap,
  speed = 3
}: {
  roadWidth: number;
  roadCenterZ: number;
  laneCount: number;
  laneGap: number;
  speed?: number;
}) {
  const groupRef = useRef<Group>(null);
  const activeRef = useRef(false);
  const laneIndexRef = useRef(0);
  const xRef = useRef(0);
  const nextSpawnAtRef = useRef(randomInRange(1.2, 3.8));
  const [signType, setSignType] = useState<RoadSignType>("clock");

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const now = clock.getElapsedTime();
    const minX = -roadWidth / 2 + 1.2;
    const maxX = roadWidth / 2 - 1.2;

    if (!activeRef.current) {
      group.visible = false;
      if (now < nextSpawnAtRef.current) return;

      activeRef.current = true;
      laneIndexRef.current = Math.floor(Math.random() * Math.max(laneCount, 1));
      xRef.current = maxX;
      setSignType(pickRandomSignType());
      group.visible = true;
    }

    xRef.current -= delta * speed;
    const laneZ = roadCenterZ + (laneIndexRef.current - (laneCount - 1) / 2) * laneGap;
    group.position.set(xRef.current, 0, laneZ);

    if (xRef.current < minX) {
      activeRef.current = false;
      group.visible = false;
      nextSpawnAtRef.current = now + randomInRange(2.4, 6.2);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0.071, 0]}>
        <boxGeometry args={[1.35, 0.01, 0.78]} />
        <meshStandardMaterial color="#f5f7fb" roughness={0.42} />
      </mesh>

      {signType === "clock" ? (
        <>
          <mesh position={[0, 0.078, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.01, 20]} />
            <meshStandardMaterial color="#374151" roughness={0.5} />
          </mesh>
          <mesh position={[0.05, 0.083, 0]}>
            <boxGeometry args={[0.12, 0.01, 0.03]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
          <mesh position={[0, 0.083, -0.05]}>
            <boxGeometry args={[0.03, 0.01, 0.12]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </>
      ) : null}

      {signType === "pulse" ? (
        <>
          <mesh position={[0, 0.078, 0]}>
            <boxGeometry args={[0.72, 0.01, 0.07]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.16, 0.083, 0]}>
            <boxGeometry args={[0.06, 0.01, 0.2]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.16, 0.083, 0]}>
            <boxGeometry args={[0.06, 0.01, 0.2]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </>
      ) : null}

      {signType === "eta" ? (
        <>
          <mesh position={[0, 0.078, 0]}>
            <boxGeometry args={[0.68, 0.01, 0.08]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.22, 0.083, 0]}>
            <boxGeometry args={[0.04, 0.01, 0.18]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.12, 0.083, 0]}>
            <boxGeometry args={[0.04, 0.01, 0.18]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.26, 0.083, 0]}>
            <boxGeometry args={[0.04, 0.01, 0.18]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function HighwayLightPost() {
  return (
    <group>
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 2.7, 16]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.42} metalness={0.22} />
      </mesh>

      <mesh position={[0.55, 2.45, 0]}>
        <boxGeometry args={[1.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.48} metalness={0.18} />
      </mesh>

      <mesh position={[1.14, 2.38, 0]}>
        <boxGeometry args={[0.44, 0.2, 0.22]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.48} metalness={0.18} />
      </mesh>

      <mesh position={[1.1, 2.23, 0]}>
        <boxGeometry args={[0.24, 0.05, 0.16]} />
        <meshStandardMaterial color="#f59e0b" emissive="#facc15" emissiveIntensity={0.75} roughness={0.35} />
      </mesh>
    </group>
  );
}

function AnimatedRoadEdgeDecor({
  roadWidth,
  roadCenterZ,
  roadDepth,
  speed = 1
}: {
  roadWidth: number;
  roadCenterZ: number;
  roadDepth: number;
  speed?: number;
}) {
  const lightRefs = useRef<Array<Group | null>>([]);
  const lightGap = 12;
  const lightCount = Math.max(4, Math.ceil(roadWidth / lightGap) + 1);
  const xPadding = 2.2;
  const startX = -roadWidth / 2 + xPadding;
  const travelWidth = Math.max(roadWidth - xPadding * 2, 1);
  const topEdgeZ = roadCenterZ - roadDepth / 2 - 0.4;

  useFrame(({ clock }) => {
    const baseShift = clock.getElapsedTime() * speed;
    const lightShift = (baseShift * 1.15) % lightGap;

    for (let index = 0; index < lightCount; index += 1) {
      const light = lightRefs.current[index];
      if (!light) continue;
      let wrapped = (index * lightGap - lightShift) % travelWidth;
      if (wrapped < 0) wrapped += travelWidth;
      light.position.set(startX + wrapped, 0, topEdgeZ);
    }
  });

  return (
    <>
      {Array.from({ length: lightCount }).map((_, index) => (
        <group
          key={`edge-light-${index}`}
          ref={(node) => {
            lightRefs.current[index] = node;
          }}
          position={[startX + index * lightGap, 0, topEdgeZ]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <HighwayLightPost />
        </group>
      ))}
    </>
  );
}

export function ActivityScene({
  locations,
  trucks,
  roadSlots,
  parkingTrucks,
  showVehicleRegNumbers,
  showLocationLabels,
  onDepartDone,
  onSelectTruck,
  onSelectLocation,
  selectedTruck,
  onCameraApiReady
}: {
  locations: LocationNode[];
  trucks: TruckRender[];
  roadSlots: Array<TruckRender | null>;
  parkingTrucks: TruckRender[];
  showVehicleRegNumbers: boolean;
  showLocationLabels: boolean;
  onDepartDone: (truckId: string) => void;
  onSelectTruck: (truckId: string) => void;
  onSelectLocation: (locationId: string) => void;
  selectedTruck: TruckRender | null;
  onCameraApiReady?: (api: SceneCameraApi) => void;
}) {
  const columnsPerRow = ROAD_COLUMNS_PER_ROW;
  const spacingX = 8;
  const baseSpacingZ = 12;
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [minPolarAngle, setMinPolarAngle] = useState(DEFAULT_MIN_POLAR_ANGLE);
  const [maxPolarAngle, setMaxPolarAngle] = useState(DEFAULT_MAX_POLAR_ANGLE);
  const hasManualViewRef = useRef(false);
  const desiredCameraRef = useRef<Vector3 | null>(null);
  const desiredTargetRef = useRef<Vector3 | null>(null);
  const desiredOrbitDistanceRef = useRef<number | null>(null);
  const cancelProgrammaticCameraMotion = useCallback(() => {
    desiredCameraRef.current = null;
    desiredTargetRef.current = null;
    desiredOrbitDistanceRef.current = null;
  }, []);

  const positionByLocationId = useMemo(() => {
    const map = new Map<string, { x: number; z: number }>();
    const rowCount = Math.max(1, Math.ceil(locations.length / columnsPerRow));
    const maxSlotByLocation = new Map<string, number>();
    const rowExtraDepth = Array.from({ length: rowCount }, () => 0);
    const rowCenters = Array.from({ length: rowCount }, () => 0);
    const centerOffsetX = ((columnsPerRow - 1) * spacingX) / 2;

    for (const truck of trucks) {
      const currentMaxSlot = maxSlotByLocation.get(truck.locationId) ?? -1;
      if (truck.slot > currentMaxSlot) {
        maxSlotByLocation.set(truck.locationId, truck.slot);
      }
    }

    for (const location of locations) {
      const row = Math.floor(location.index / columnsPerRow);
      const maxSlot = maxSlotByLocation.get(location.locationId);
      const truckRowsNeeded = maxSlot === undefined ? 1 : Math.floor(maxSlot / TRUCKS_PER_WAREHOUSE_ROW) + 1;
      rowExtraDepth[row] = Math.max(rowExtraDepth[row], (truckRowsNeeded - 1) * TRUCK_ROW_GAP);
    }

    for (let row = 1; row < rowCount; row += 1) {
      rowCenters[row] = rowCenters[row - 1] + baseSpacingZ + rowExtraDepth[row - 1];
    }

    const centerOffsetZ = rowCount > 1 ? (rowCenters[0] + rowCenters[rowCount - 1]) / 2 : 0;

    for (const location of locations) {
      const column = location.index % columnsPerRow;
      const row = Math.floor(location.index / columnsPerRow);
      map.set(location.locationId, {
        x: column * spacingX - centerOffsetX,
        z: rowCenters[row] - centerOffsetZ
      });
    }

    return map;
  }, [locations, trucks, columnsPerRow]);

  const roadLayout = useMemo(() => {
    const minLaneCount = BASE_ROAD_LANE_COUNT;
    const laneGap = 2.6;
    const lanePadding = 1.4;
    const roadGapFromLocations = 7.5;
    const centerOffsetX = ((columnsPerRow - 1) * spacingX) / 2;

    const laneCount = Math.max(minLaneCount, Math.ceil(Math.max(roadSlots.length, 1) / columnsPerRow));
    const roadWidth = columnsPerRow * spacingX;
    const roadDepth = laneCount * laneGap + lanePadding * 2;

    let minLocationZ = 0;
    if (locations.length > 0) {
      minLocationZ = Number.POSITIVE_INFINITY;
      for (const location of locations) {
        const position = positionByLocationId.get(location.locationId);
        if (!position) continue;
        minLocationZ = Math.min(minLocationZ, position.z);
      }
      if (!Number.isFinite(minLocationZ)) minLocationZ = 0;
    }

    const roadCenterZ = minLocationZ - (roadGapFromLocations + roadDepth / 2);

    const placements = roadSlots.map((truck, index) => {
      const laneIndex = Math.floor(index / columnsPerRow);
      const slotIndex = index % columnsPerRow;
      const laneOffsetZ = (laneIndex - (laneCount - 1) / 2) * laneGap;
      const x = slotIndex * spacingX - centerOffsetX;
      const z = roadCenterZ + laneOffsetZ;
      return { truck, x, z };
    });

    return { laneCount, laneGap, roadWidth, roadDepth, roadCenterZ, placements };
  }, [roadSlots, locations, positionByLocationId, columnsPerRow]);

  const parkingLayout = useMemo(() => {
    const rows = Math.max(1, Math.ceil(Math.max(parkingTrucks.length, 1) / columnsPerRow));
    const spacingZ = 2.5;
    const paddingZ = 1.2;
    const parkingGapFromRoad = 7.5;
    const parkingWidth = columnsPerRow * spacingX;
    const parkingDepth = rows * spacingZ + paddingZ * 2;
    const centerOffsetX = ((columnsPerRow - 1) * spacingX) / 2;
    const parkingCenterZ =
      roadLayout.roadCenterZ - (roadLayout.roadDepth / 2 + parkingGapFromRoad + parkingDepth / 2);

    const placements = parkingTrucks.map((truck, index) => {
      const rowIndex = Math.floor(index / columnsPerRow);
      const slotIndex = index % columnsPerRow;
      const rowOffsetZ = (rowIndex - (rows - 1) / 2) * spacingZ;
      const x = slotIndex * spacingX - centerOffsetX;
      const z = parkingCenterZ + rowOffsetZ;
      return { truck, x, z };
    });

    return { rows, parkingWidth, parkingDepth, parkingCenterZ, placements, spacingZ };
  }, [parkingTrucks, columnsPerRow, spacingX, roadLayout.roadCenterZ, roadLayout.roadDepth]);

  const controlsTarget = useMemo(() => {
    if (locations.length === 0) {
      return [0, 1.8, (roadLayout.roadCenterZ + parkingLayout.parkingCenterZ) / 2] as const;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const location of locations) {
      const position = positionByLocationId.get(location.locationId);
      if (!position) continue;

      minX = Math.min(minX, position.x);
      maxX = Math.max(maxX, position.x);
      minZ = Math.min(minZ, position.z);
      maxZ = Math.max(maxZ, position.z);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return [0, 1.8, 0] as const;

    minZ = Math.min(
      minZ,
      roadLayout.roadCenterZ - roadLayout.roadDepth / 2,
      parkingLayout.parkingCenterZ - parkingLayout.parkingDepth / 2
    );
    return [(minX + maxX) / 2, 1.8, (minZ + maxZ) / 2] as const;
  }, [locations, positionByLocationId, roadLayout, parkingLayout.parkingCenterZ, parkingLayout.parkingDepth]);

  const parkedTruckPositionById = useMemo(() => {
    const map = new Map<string, { x: number; z: number }>();
    for (const truck of trucks) {
      const warehouse = positionByLocationId.get(truck.locationId);
      if (!warehouse) continue;

      const columnIndex = truck.slot % TRUCKS_PER_WAREHOUSE_ROW;
      const rowIndex = Math.floor(truck.slot / TRUCKS_PER_WAREHOUSE_ROW);
      const slotOffset = (columnIndex - 1.5) * 1.35;
      const x = warehouse.x + slotOffset;
      const z = warehouse.z + 2.6 + rowIndex * TRUCK_ROW_GAP;
      map.set(truck.truckId, { x, z });
    }
    return map;
  }, [trucks, positionByLocationId]);

  const roadTruckPositionById = useMemo(() => {
    const map = new Map<string, { x: number; z: number }>();
    for (const placement of roadLayout.placements) {
      if (!placement.truck) continue;
      map.set(placement.truck.truckId, { x: placement.x, z: placement.z });
    }
    return map;
  }, [roadLayout.placements]);

  const parkingTruckPositionById = useMemo(() => {
    const map = new Map<string, { x: number; z: number }>();
    for (const placement of parkingLayout.placements) {
      map.set(placement.truck.truckId, { x: placement.x, z: placement.z });
    }
    return map;
  }, [parkingLayout.placements]);

  const selectedTruckPosition = useMemo(() => {
    if (!selectedTruck) return null;
    return (
      roadTruckPositionById.get(selectedTruck.truckId) ??
      parkedTruckPositionById.get(selectedTruck.truckId) ??
      parkingTruckPositionById.get(selectedTruck.truckId) ??
      null
    );
  }, [selectedTruck, roadTruckPositionById, parkedTruckPositionById, parkingTruckPositionById]);

  const sceneTopBounds = useMemo(() => {
    const roadMinX = -roadLayout.roadWidth / 2;
    const roadMaxX = roadLayout.roadWidth / 2;
    const roadMinZ = roadLayout.roadCenterZ - roadLayout.roadDepth / 2;
    const roadMaxZ = roadLayout.roadCenterZ + roadLayout.roadDepth / 2;

    const parkingMinX = -parkingLayout.parkingWidth / 2;
    const parkingMaxX = parkingLayout.parkingWidth / 2;
    const parkingMinZ = parkingLayout.parkingCenterZ - parkingLayout.parkingDepth / 2;

    let minX = Math.min(roadMinX, parkingMinX);
    let maxX = Math.max(roadMaxX, parkingMaxX);
    let minZ = Math.min(roadMinZ, parkingMinZ);
    let maxZ = roadMaxZ;

    for (const position of positionByLocationId.values()) {
      minX = Math.min(minX, position.x - 3.8);
      maxX = Math.max(maxX, position.x + 3.8);
      minZ = Math.min(minZ, position.z - 3.2);
      maxZ = Math.max(maxZ, position.z + 6.8);
    }

    for (const position of parkedTruckPositionById.values()) {
      minX = Math.min(minX, position.x - 1.8);
      maxX = Math.max(maxX, position.x + 1.8);
      minZ = Math.min(minZ, position.z - 1.8);
      maxZ = Math.max(maxZ, position.z + 1.8);
    }

    for (const position of roadTruckPositionById.values()) {
      minX = Math.min(minX, position.x - 1.8);
      maxX = Math.max(maxX, position.x + 1.8);
      minZ = Math.min(minZ, position.z - 1.8);
      maxZ = Math.max(maxZ, position.z + 1.8);
    }

    for (const position of parkingTruckPositionById.values()) {
      minX = Math.min(minX, position.x - 1.8);
      maxX = Math.max(maxX, position.x + 1.8);
      minZ = Math.min(minZ, position.z - 1.8);
      maxZ = Math.max(maxZ, position.z + 1.8);
    }

    return { minX, maxX, minZ, maxZ };
  }, [roadLayout, parkingLayout, positionByLocationId, parkedTruckPositionById, roadTruckPositionById, parkingTruckPositionById]);

  const overviewPose = useMemo(() => {
    const boundsCenterX = (sceneTopBounds.minX + sceneTopBounds.maxX) / 2;
    const boundsCenterZ = (sceneTopBounds.minZ + sceneTopBounds.maxZ) / 2;
    const spanX = Math.max(sceneTopBounds.maxX - sceneTopBounds.minX, 1);
    const spanZ = Math.max(sceneTopBounds.maxZ - sceneTopBounds.minZ, 1);
    const dominantSpan = Math.max(spanX, spanZ);
    const height = Math.max(26, dominantSpan * 0.5);
    const zOffset = Math.max(24, dominantSpan * 0.72);

    return {
      cameraPos: [boundsCenterX, height, boundsCenterZ + zOffset] as [number, number, number],
      targetPos: [boundsCenterX, 1.8, boundsCenterZ] as [number, number, number]
    };
  }, [sceneTopBounds]);

  const queueCameraPose = useCallback((cameraPos: [number, number, number], targetPos: [number, number, number], markManual = true) => {
    desiredCameraRef.current = new Vector3(cameraPos[0], cameraPos[1], cameraPos[2]);
    desiredTargetRef.current = new Vector3(targetPos[0], targetPos[1], targetPos[2]);
    if (markManual) hasManualViewRef.current = true;
  }, []);

  const setView = useCallback(
    (view: CameraPresetView) => {
      if (view === "top") {
        setMinPolarAngle(0.01);
        setMaxPolarAngle(Math.PI / 2.02);
      } else {
        setMinPolarAngle(DEFAULT_MIN_POLAR_ANGLE);
        setMaxPolarAngle(DEFAULT_MAX_POLAR_ANGLE);
      }

      if (view === "reset") {
        hasManualViewRef.current = false;
        queueCameraPose([0, 22, 28], [controlsTarget[0], controlsTarget[1], controlsTarget[2]], false);
        return;
      }

      if (view === "overview") {
        queueCameraPose(overviewPose.cameraPos, overviewPose.targetPos);
        return;
      }

      if (view === "road") {
        const roadViewHeight = Math.max(30, roadLayout.roadWidth * 0.20);
        const roadViewZOffset = Math.max(16, roadLayout.roadWidth * 0.42);
        queueCameraPose(
          [0, roadViewHeight, roadLayout.roadCenterZ + roadViewZOffset],
          [0, 0.8, roadLayout.roadCenterZ]
        );
        return;
      }

      if (view === "top") {
        const boundsCenterX = (sceneTopBounds.minX + sceneTopBounds.maxX) / 2;
        const boundsCenterZ = (sceneTopBounds.minZ + sceneTopBounds.maxZ) / 2;
        const spanX = sceneTopBounds.maxX - sceneTopBounds.minX;
        const spanZ = sceneTopBounds.maxZ - sceneTopBounds.minZ;
        const margin = 1.14;
        const targetSpanX = Math.max(spanX * margin, 1);
        const targetSpanZ = Math.max(spanZ * margin, 1);

        const perspectiveCamera = camera as PerspectiveCamera;
        const verticalFov = (perspectiveCamera.fov * Math.PI) / 180;
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (size.width / Math.max(size.height, 1)));
        const requiredHeightFromX = targetSpanX / (2 * Math.tan(horizontalFov / 2));
        const requiredHeightFromZ = targetSpanZ / (2 * Math.tan(verticalFov / 2));
        const topHeight = Math.max(24, requiredHeightFromX, requiredHeightFromZ);

        queueCameraPose([boundsCenterX, topHeight, boundsCenterZ + Math.max(0.5, topHeight * 0.02)], [boundsCenterX, 0, boundsCenterZ]);
        return;
      }

      if (!selectedTruckPosition) return;
      queueCameraPose(
        [selectedTruckPosition.x + 8, 7, selectedTruckPosition.z + 8],
        [selectedTruckPosition.x, 0.9, selectedTruckPosition.z]
      );
    },
    [overviewPose, roadLayout.roadCenterZ, roadLayout.roadWidth, selectedTruckPosition, sceneTopBounds, queueCameraPose, camera, size, controlsTarget]
  );

  const zoomIn = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const currentDistance = camera.position.distanceTo(controls.target);
    const nextDistance = Math.max(controls.minDistance, currentDistance / 1.25);
    desiredOrbitDistanceRef.current = nextDistance;
  }, [camera.position]);

  const zoomOut = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const currentDistance = camera.position.distanceTo(controls.target);
    const nextDistance = Math.min(controls.maxDistance, currentDistance * 1.25);
    desiredOrbitDistanceRef.current = nextDistance;
  }, [camera.position]);

  useEffect(() => {
    if (onCameraApiReady) onCameraApiReady({ setView, zoomIn, zoomOut });
  }, [onCameraApiReady, setView, zoomIn, zoomOut]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || hasManualViewRef.current) return;
    controls.target.set(controlsTarget[0], controlsTarget[1], controlsTarget[2]);
    controls.update();
  }, [controlsTarget]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const desiredCamera = desiredCameraRef.current;
    const desiredTarget = desiredTargetRef.current;
    if (!controls) return;

    if (desiredCamera && desiredTarget) {
      const alpha = 1 - Math.exp(-delta * 6);
      camera.position.lerp(desiredCamera, alpha);
      controls.target.lerp(desiredTarget, alpha);
      controls.update();

      if (camera.position.distanceTo(desiredCamera) < 0.05 && controls.target.distanceTo(desiredTarget) < 0.05) {
        camera.position.copy(desiredCamera);
        controls.target.copy(desiredTarget);
        controls.update();
        desiredCameraRef.current = null;
        desiredTargetRef.current = null;
      }
      return;
    }

    const desiredOrbitDistance = desiredOrbitDistanceRef.current;
    if (desiredOrbitDistance === null) return;

    const target = controls.target;
    const toCamera = camera.position.clone().sub(target);
    const currentDistance = toCamera.length();
    if (currentDistance < 0.0001) {
      desiredOrbitDistanceRef.current = null;
      return;
    }

    const zoomAlpha = 1 - Math.exp(-delta * 9);
    const nextDistance = currentDistance + (desiredOrbitDistance - currentDistance) * zoomAlpha;
    toCamera.setLength(nextDistance);
    camera.position.copy(target.clone().add(toCamera));
    controls.update();

    if (Math.abs(nextDistance - desiredOrbitDistance) < 0.02) {
      toCamera.setLength(desiredOrbitDistance);
      camera.position.copy(target.clone().add(toCamera));
      controls.update();
      desiredOrbitDistanceRef.current = null;
    }
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[20, 18, 12]} intensity={4.2} />
      <directionalLight position={[-10, 8, -12]} intensity={0.45} />

      <mesh position={[0, -0.11, roadLayout.roadCenterZ]}>
        <boxGeometry args={[roadLayout.roadWidth, 0.22, roadLayout.roadDepth]} />
        <meshStandardMaterial color="#333333" roughness={0.92} />
      </mesh>

      <mesh position={[0, -0.23, roadLayout.roadCenterZ]}>
        <boxGeometry args={[roadLayout.roadWidth + 0.5, 0.03, roadLayout.roadDepth + 0.5]} />
        <meshStandardMaterial color="#38383a" roughness={0.95} />
      </mesh>

      <mesh position={[0, -0.11, parkingLayout.parkingCenterZ]}>
        <boxGeometry args={[parkingLayout.parkingWidth, 0.18, parkingLayout.parkingDepth]} />
        <meshStandardMaterial color="#4b5563" roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.21, parkingLayout.parkingCenterZ]}>
        <boxGeometry args={[parkingLayout.parkingWidth + 0.5, 0.02, parkingLayout.parkingDepth + 0.5]} />
        <meshStandardMaterial color="#374151" roughness={0.95} />
      </mesh>
      {Array.from({ length: parkingLayout.rows + 1 }).map((_, rowIndex) => {
        const dividerZ =
          parkingLayout.parkingCenterZ +
          (rowIndex - parkingLayout.rows / 2) * parkingLayout.spacingZ;
        return (
          <mesh key={`parking-divider-${rowIndex}`} position={[0, -0.015, dividerZ]}>
            <boxGeometry args={[parkingLayout.parkingWidth, 0.01, 0.06]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
          </mesh>
        );
      })}

      {Array.from({ length: Math.max(roadLayout.laneCount - 1, 0) }).map((_, laneDividerIndex) => {
        const dividerLane = laneDividerIndex + 1;
        const dividerZ =
          roadLayout.roadCenterZ + (dividerLane - roadLayout.laneCount / 2) * roadLayout.laneGap;
        const dashCount = Math.max(columnsPerRow * 2, 1);
        return (
          <AnimatedRoadDivider
            key={`road-divider-${laneDividerIndex}`}
            dividerZ={dividerZ}
            roadWidth={roadLayout.roadWidth}
            dashCount={dashCount}
          />
        );
      })}

      <AnimatedRoadEdgeDecor
        roadWidth={roadLayout.roadWidth}
        roadCenterZ={roadLayout.roadCenterZ}
        roadDepth={roadLayout.roadDepth}
      />

      <AnimatedRoadTimingSign
        roadWidth={roadLayout.roadWidth}
        roadCenterZ={roadLayout.roadCenterZ}
        laneCount={roadLayout.laneCount}
        laneGap={roadLayout.laneGap}
      />
      <AreaLabel x={0} y={1.7} z={roadLayout.roadCenterZ} text="Vehicles in transit" />
      <AreaLabel x={0} y={1.5} z={parkingLayout.parkingCenterZ} text="Unknown location vehicle" />

      {locations.map((location) => {
        const x = positionByLocationId.get(location.locationId)?.x ?? 0;
        const z = positionByLocationId.get(location.locationId)?.z ?? 0;
        return (
          <LocationMesh
            key={location.locationId}
            location={location}
            x={x}
            z={z}
            showLocationLabels={showLocationLabels}
            onSelectLocation={onSelectLocation}
          />
        );
      })}

      {trucks.map((truck) => {
        const position = positionByLocationId.get(truck.locationId);
        if (!position) return null;

        return (
          <TruckMesh
            key={truck.truckId}
            truck={truck}
            warehouseX={position.x}
            warehouseZ={position.z}
            isSelected={selectedTruck?.truckId === truck.truckId}
            showRegNumbers={showVehicleRegNumbers}
            onSelect={onSelectTruck}
            onDepartDone={onDepartDone}
          />
        );
      })}

      {roadLayout.placements.map(({ truck, x, z }, index) => (
        truck ? (
          <RoadTruckMesh
            key={`road-${truck.truckId}`}
            truck={truck}
            x={x}
            z={z}
            isSelected={selectedTruck?.truckId === truck.truckId}
            showRegNumbers={showVehicleRegNumbers}
            onSelect={onSelectTruck}
          />
        ) : (
          <RoadTruckPlaceholderMesh key={`road-placeholder-${index}`} x={x} z={z} />
        )
      ))}

      {parkingLayout.placements.map(({ truck, x, z }) => (
        <RoadTruckMesh
          key={`parking-${truck.truckId}`}
          truck={truck}
          x={x}
          z={z}
          isSelected={selectedTruck?.truckId === truck.truckId}
          showRegNumbers={showVehicleRegNumbers}
          onSelect={onSelectTruck}
        />
      ))}

      <MapControls
        ref={controlsRef}
        enablePan
        enableDamping
        dampingFactor={0.05}
        screenSpacePanning
        zoomToCursor
        minPolarAngle={minPolarAngle}
        maxPolarAngle={maxPolarAngle}
        minDistance={8}
        maxDistance={180}
        zoomSpeed={1.15}
        panSpeed={1.1}
        onStart={cancelProgrammaticCameraMotion}
      />
    </>
  );
}
