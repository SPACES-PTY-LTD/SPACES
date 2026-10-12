import { RoundedBox } from "@react-three/drei"
import { useMemo } from "react"
import { CatmullRomCurve3, Quaternion, Vector3 } from "three"
import type { LocationIconMeshType } from "@/lib/location-type-icons"

type V3 = [number, number, number]
export type AdditionalLocationMeshType = Exclude<LocationIconMeshType, "warehouse" | "workshop" | "waypoint" | "rest" | "fuel">
const steel = "#475569", glass = "#38bdf8", cream = "#f1f5f9", orange = "#f59e0b"

function Block({ at, size, color, rotation }: { at: V3; size: V3; color: string; rotation?: V3 }) {
  return <mesh position={at} rotation={rotation}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
}
function RoundBlock({ at, size, color, radius = 0.1 }: { at: V3; size: V3; color: string; radius?: number }) {
  return <RoundedBox position={at} args={size} radius={radius} smoothness={2}><meshStandardMaterial color={color} roughness={0.6} /></RoundedBox>
}
function Cylinder({ at, radius, height, color, top = radius, rotation }: { at: V3; radius: number; height: number; color: string; top?: number; rotation?: V3 }) {
  return <mesh position={at} rotation={rotation}><cylinderGeometry args={[top, radius, height, 16]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>
}
function Beam({ from, to, color = steel, width = 0.08 }: { from: V3; to: V3; color?: string; width?: number }) {
  const a = new Vector3(...from), b = new Vector3(...to), delta = b.clone().sub(a)
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.clone().normalize())
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={rotation}><boxGeometry args={[width, delta.length(), width]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>
}
function Hose({ points, color = "#172033", radius = 0.045 }: { points: V3[]; color?: string; radius?: number }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(point => new Vector3(...point))), [points])
  return <mesh><tubeGeometry args={[curve, 16, radius, 6, false]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
}
function Pad({ color = "#d8dde6" }: { color?: string }) {
  return <RoundBlock at={[0, 0.04, -0.85]} size={[6.4, 0.12, 4.4]} radius={0.05} color={color} />
}
function Container({ at, color = "#0284c7" }: { at: V3; color?: string }) {
  return <group position={at}>
    <Block at={[0, 0.4, 0]} size={[1.7, 0.8, 0.8]} color={color} />
    {[-0.7, -0.45, -0.2, 0.05, 0.3, 0.55, 0.75].map(x => <Block key={x} at={[x, 0.4, 0.414]} size={[0.035, 0.72, 0.025]} color="#ffffff" />)}
    <Beam from={[-0.75, 0.1, -0.415]} to={[-0.75, 0.7, -0.415]} color={cream} width={0.04} />
  </group>
}
function Crane({ at = [0, 0, 0], height = 3.2 }: { at?: V3; height?: number }) {
  return <group position={at}>
    {[-0.5, 0.5].map(x => <group key={x}>
      <Block at={[x, height / 2, 0]} size={[0.12, height, 0.12]} color={orange} />
      {[0.4, 1.1, 1.8, 2.5].filter(y => y < height - 0.3).map(y => <Beam key={y} from={[-0.5, y, 0]} to={[0.5, y + 0.5, 0]} color={orange} width={0.055} />)}
    </group>)}
    <Block at={[0.7, height, 0]} size={[3.5, 0.18, 0.22]} color={orange} />
    <Beam from={[-0.5, height, 0]} to={[1.8, height - 0.18, 0]} color={steel} width={0.04} />
    <Beam from={[1.9, height, 0]} to={[1.9, height - 1.2, 0]} width={0.045} />
    <Cylinder at={[1.9, height - 1.23, 0]} radius={0.12} height={0.12} color={steel} />
    <Block at={[0, height - 0.4, 0]} size={[0.6, 0.5, 0.5]} color={cream} />
    <Block at={[0.12, height - 0.35, 0.26]} size={[0.28, 0.25, 0.02]} color={glass} />
  </group>
}
function MiniTruck({ at, color = orange }: { at: V3; color?: string }) {
  return <group position={at}>
    <Block at={[0, 0.35, 0]} size={[1.35, 0.16, 0.75]} color={steel} />
    <RoundBlock at={[0.43, 0.75, 0]} size={[0.6, 0.7, 0.75]} color={color} radius={0.06} />
    <Block at={[0.74, 0.86, 0]} size={[0.025, 0.25, 0.55]} color={glass} />
    <Block at={[-0.35, 0.78, 0]} size={[0.95, 0.55, 0.75]} color={color} />
    {[-0.48, 0.43].flatMap(x => [-0.42, 0.42].map(z => <Cylinder key={`${x}-${z}`} at={[x, 0.3, z]} radius={0.25} height={0.14} rotation={[Math.PI / 2, 0, 0]} color="#1e293b" />))}
  </group>
}
function Building({ color = cream }: { color?: string }) {
  return <group>
    <Block at={[0, 1, -1.4]} size={[4.6, 1.8, 2.5]} color={color} />
    <RoundBlock at={[0, 1.95, -1.4]} size={[4.8, 0.18, 2.7]} color={steel} radius={0.06} />
    <Block at={[0.8, 0.65, -0.12]} size={[1.4, 1.2, 0.04]} color="#64748b" />
    {[-1.65, -0.85].map(x => <Block key={x} at={[x, 1.2, -0.12]} size={[0.6, 0.6, 0.04]} color={glass} />)}
  </group>
}
function ContainerTerminal() {
  return <><Pad /><Container at={[-1.55, 0.1, -1.8]} color="#ea580c" /><Container at={[-1.55, 0.9, -1.8]} color="#0284c7" /><Container at={[-1.55, 0.1, -0.85]} color="#16a34a" /><Container at={[0.45, 0.1, -0.3]} color="#0e7490" /><Crane at={[0.55, 0.1, -2]} height={3.1} /></>
}
function Seaport() {
  return <><Pad color="#7dd3fc" />
    <Block at={[-2.45, 0.25, -0.85]} size={[1.4, 0.4, 4.3]} color="#a8b0bb" />
    <group position={[0.65, 0, -0.9]}>
      <RoundBlock at={[0, 0.45, 0]} size={[3.7, 0.6, 1.55]} color="#164e63" radius={0.26} />
      <RoundBlock at={[0, 0.27, 0]} size={[3.5, 0.2, 1.4]} color="#ef4444" radius={0.08} />
      <Block at={[0, 0.77, 0]} size={[3.1, 0.1, 1.3]} color={cream} />
      <Container at={[-0.35, 0.85, 0]} color="#f97316" />
      <Block at={[1.25, 1.3, 0]} size={[0.6, 1, 1]} color={cream} />
      <Block at={[1.25, 1.65, 0.52]} size={[0.5, 0.22, 0.03]} color={glass} />
      <Cylinder at={[1.25, 2, 0]} radius={0.13} height={0.5} color={steel} />
    </group>
    <Beam from={[-2.5, 0.3, -2]} to={[-2.5, 2.2, -2]} color={orange} width={0.13} />
    <Beam from={[-2.5, 2.2, -2]} to={[-0.7, 2.7, -2]} color={orange} width={0.13} />
    <Beam from={[-0.7, 2.7, -2]} to={[-0.7, 1.65, -2]} width={0.04} />
  </>
}
function AirportCargo() {
  return <><Pad /><Block at={[0, 0.65, -2.1]} size={[4.8, 1.1, 1.5]} color={cream} /><Block at={[0, 1.27, -2.1]} size={[5, 0.18, 1.6]} color="#1d4ed8" />
    {[-1.5, 0, 1.5].map(x => <Block key={x} at={[x, 0.5, -1.32]} size={[1, 0.8, 0.04]} color={steel} />)}
    <group position={[0, 0.5, 0.3]} rotation={[0, 0.15, 0]}>
      <mesh scale={[2.2, 0.22, 0.28]}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color={cream} /></mesh>
      <Block at={[0, 0, 0]} size={[1.1, 0.06, 3.1]} rotation={[0, -0.2, 0]} color="#cbd5e1" />
      <Block at={[-1.65, 0, 0]} size={[0.65, 0.05, 1.35]} color="#1d4ed8" />
      <Block at={[-1.65, 0.33, 0]} size={[0.65, 0.65, 0.06]} rotation={[0, 0, -0.3]} color="#1d4ed8" />
      <Cylinder at={[0.1, -0.16, 0.8]} radius={0.15} height={0.55} rotation={[0, 0, Math.PI / 2]} color={steel} />
      <Cylinder at={[0.1, -0.16, -0.8]} radius={0.15} height={0.55} rotation={[0, 0, Math.PI / 2]} color={steel} />
      <Block at={[1.55, 0.16, 0]} size={[0.35, 0.06, 0.32]} color={glass} />
    </group>
  </>
}
function RailFreight() {
  return <><Pad color="#cbd5d1" />
    {[-0.65, 0.1].map(z => <Block key={z} at={[0, 0.16, z]} size={[6, 0.08, 0.055]} color={steel} />)}
    {[-2.7, -2.1, -1.5, -0.9, -0.3, 0.3, 0.9, 1.5, 2.1, 2.7].map(x => <Block key={x} at={[x, 0.11, -0.27]} size={[0.18, 0.06, 1.2]} color="#8b6f47" />)}
    <Block at={[-1.8, 0.9, -0.28]} size={[1.55, 1.1, 1]} color="#b91c1c" /><Block at={[-2.1, 1.2, 0.24]} size={[0.6, 0.35, 0.03]} color={glass} />
    <Block at={[-1.8, 1.5, -0.28]} size={[1.65, 0.13, 1.1]} color={steel} />
    <Container at={[0.1, 0.5, -0.28]} color="#f59e0b" /><Container at={[2, 0.5, -0.28]} color="#0284c7" />
    {[-2.3, -1.4, -0.45, 0.65, 1.5, 2.5].map(x => <Cylinder key={x} at={[x, 0.35, -0.28]} radius={0.23} height={1.04} rotation={[Math.PI / 2, 0, 0]} color="#1e293b" />)}
    <Block at={[0, 0.5, -2.4]} size={[4.4, 0.8, 0.7]} color={cream} />
  </>
}
function Mine() {
  return <><Pad color="#bda281" />
    {[{w:5.2,h:0.28,z:-1.2},{w:4.2,h:0.52,z:-1.7},{w:3.1,h:0.76,z:-2.1},{w:1.9,h:1,z:-2.45}].map(({w,h,z}) => <Block key={w} at={[-0.2, h/2+0.1, z]} size={[w, h, 0.72]} color="#b58b61" />)}
    <MiniTruck at={[1.2, 0.1, 0.4]} />
    <Beam from={[-2, 0.4, -0.4]} to={[-2, 1.6, -0.4]} color={orange} width={0.2} />
    <Beam from={[-2, 1.6, -0.4]} to={[-0.8, 0.7, -0.4]} color={orange} width={0.2} />
    <Block at={[-0.7, 0.55, -0.4]} size={[0.5, 0.45, 0.5]} color={steel} />
  </>
}
function Quarry() {
  return <><Pad color="#c3c0b5" />
    {[-2, -1, 0].map((x,i) => <mesh key={x} position={[x, 0.65 + i*0.1, -1.8]} scale={[0.8, 0.7+i*0.12, 0.8]}><dodecahedronGeometry args={[1,0]} /><meshStandardMaterial color={i===1 ? "#a8a29e" : "#78716c"} roughness={1} /></mesh>)}
    <Block at={[1.5, 0.9, -1.6]} size={[1, 1.6, 1.1]} color="#64748b" />
    <Cylinder at={[1.5, 1.95, -1.6]} radius={0.4} top={0.7} height={0.5} color={orange} />
    <Block at={[0.4, 0.7, 0]} size={[3.2, 0.18, 0.6]} rotation={[0, 0, 0.22]} color={steel} />
    {[-0.9, 0.7].map(x => <Block key={x} at={[x, 0.35, 0]} size={[0.1, 0.6, 0.5]} color={orange} />)}
    <mesh position={[-1.5, 0.3, 0.35]}><coneGeometry args={[0.7,0.65,8]} /><meshStandardMaterial color="#a8a29e" /></mesh>
  </>
}
function Factory() {
  return <><Pad /><Building color="#cbd5e1" />
    {[-1.4, 0, 1.4].map((x,i) => <group key={x}><Cylinder at={[x, 2.3, -2]} radius={0.22} height={1.8} color="#b45309" /><Cylinder at={[x, 3.15, -2]} radius={0.25} height={0.18} color={steel} /><Block at={[x, 2.2, -0.1]} size={[1.35, 0.45, 2.2]} rotation={[0, 0, i%2 ? 0.2 : -0.2]} color="#334155" /></group>)}
    <Block at={[-1.4, 0.3, 0.65]} size={[1.6, 0.4, 0.7]} color={orange} />
  </>
}
function Farm() {
  return <><Pad color="#a3b875" />
    <Block at={[-0.6, 0.85, -1.6]} size={[2.5, 1.5, 2]} color="#b91c1c" />
    {[-1, 1].map(side => <Block key={side} at={[-0.6+side*0.7, 1.8, -1.6]} size={[1.65, 0.12, 2.2]} rotation={[0,0,side*-0.5]} color="#334155" />)}
    <Block at={[-0.6, 0.6, -0.56]} size={[1.1, 1, 0.04]} color={cream} />
    <Beam from={[-1.1, 0.15, -0.52]} to={[-0.1, 1.05, -0.52]} color="#b91c1c" width={0.07} /><Beam from={[-0.1, 0.15, -0.52]} to={[-1.1, 1.05, -0.52]} color="#b91c1c" width={0.07} />
    <Cylinder at={[1.65, 1, -1.8]} radius={0.55} height={1.8} color="#cbd5e1" /><Cylinder at={[1.65, 2.12, -1.8]} radius={0.6} top={0} height={0.5} color={steel} />
    {[-0.2, 0.25, 0.7].map(z => <group key={z}><Block at={[0,0.13,z]} size={[4.8,0.12,0.25]} color="#795548" />{[-2,-1,0,1,2].map(x => <mesh key={x} position={[x,0.27,z]}><sphereGeometry args={[0.14,8,6]} /><meshStandardMaterial color="#4d7c0f" /></mesh>)}</group>)}
  </>
}
function GrainTerminal() {
  return <><Pad color="#d6cbb5" />
    {[-1.6,0,1.6].map(x => <group key={x}><Cylinder at={[x,1.3,-1.4]} radius={0.66} height={2.3} color="#e2e8f0" /><Cylinder at={[x,2.63,-1.4]} radius={0.71} top={0} height={0.45} color="#64748b" />{[0.5,1,1.5,2].map(y => <Cylinder key={y} at={[x,y,-1.4]} radius={0.677} height={0.045} color="#94a3b8" />)}</group>)}
    <Beam from={[-1.6,2.6,-1.4]} to={[1.6,2.6,-1.4]} color={orange} width={0.1} /><Beam from={[1.6,2.6,-1.4]} to={[2.5,1,0.6]} color={orange} width={0.15} />
    <Block at={[2.5,0.7,0.6]} size={[0.5,0.6,0.5]} color={steel} />
  </>
}
function ColdStorage() {
  return <><Pad color="#dceef3" /><Building color="#dbeafe" />
    <Block at={[-1.1,1.25,-0.065]} size={[1,1,0.035]} color="#0284c7" />
    {[0,Math.PI/3,Math.PI*2/3].map(angle => <Block key={angle} at={[-1.1,1.25,-0.035]} size={[0.7,0.07,0.035]} rotation={[0,0,angle]} color={cream} />)}
    {[0,1.4].map(x => <group key={x}><Block at={[x,2.17,-1.7]} size={[0.8,0.35,0.65]} color={cream} /><Cylinder at={[x,2.37,-1.7]} radius={0.24} height={0.05} color={steel} /></group>)}
    <Block at={[0.8,0.15,0.3]} size={[2,0.12,1]} color="#94a3b8" />
  </>
}
function Retail() {
  return <><Pad /><Block at={[0,0.95,-1.4]} size={[4.4,1.7,2.4]} color="#fff7ed" />
    <RoundBlock at={[0,1.9,-1.4]} size={[4.6,0.18,2.6]} color="#9f1239" radius={0.06} />
    {[-1.4,1.4].map(x => <Block key={x} at={[x,0.9,-0.16]} size={[1.05,1.25,0.04]} color={glass} />)}
    <Block at={[0,0.8,-0.14]} size={[0.65,1.35,0.04]} color="#0c4a6e" />
    {[-1.9,-1.4,-0.9,-0.4,0.1,0.6,1.1,1.6].map((x,i) => <Block key={x} at={[x,1.53,0.1]} size={[0.5,0.13,0.8]} rotation={[0.2,0,0]} color={i%2 ? cream : "#e11d48"} />)}
    <Block at={[1.45,0.23,0.7]} size={[1.2,0.3,0.6]} color="#94a3b8" /><Block at={[1.4,0.58,0.7]} size={[0.45,0.4,0.45]} color="#d9a96b" />
  </>
}
function Construction() {
  return <><Pad color="#d6cbb5" />
    {[0.7,1.65,2.6].map(y => <Block key={y} at={[-0.75,y,-1.4]} size={[2.7,0.14,2.2]} color="#cbd5e1" />)}
    {[-1.9,0.35].flatMap(x => [-2.35,-0.45].map(z => <Block key={`${x}-${z}`} at={[x,1.35,z]} size={[0.14,2.6,0.14]} color="#94a3b8" />))}
    <Crane at={[0.7,0.1,-1.8]} height={3.2} />
    <Block at={[-0.6,0.3,0.5]} size={[1.6,0.4,0.7]} color="#b45309" />
    {[-2,0.5,2.3].map(x => <Cylinder key={x} at={[x,0.25,1]} radius={0.14} top={0.025} height={0.35} color="#f97316" />)}
  </>
}
function Weighbridge() {
  return <><Pad /><RoundBlock at={[0,0.2,-0.45]} size={[4.5,0.2,1.65]} color={steel} radius={0.05} />
    {[-1.8,-1.2,-0.6,0,0.6,1.2,1.8].map(x => <Block key={x} at={[x,0.315,-0.45]} size={[0.05,0.025,1.5]} color="#94a3b8" />)}
    <MiniTruck at={[0,0.35,-0.45]} color="#0284c7" />
    <Block at={[1.8,0.8,-2.1]} size={[1.15,1.4,1.05]} color={cream} /><Block at={[1.8,1.56,-2.1]} size={[1.35,0.15,1.25]} color="#0284c7" />
    <Block at={[1.8,1.12,-1.55]} size={[0.75,0.45,0.04]} color={glass} />
    <Block at={[-1.6,1.2,-2]} size={[1.1,0.6,0.1]} color="#172033" /><Beam from={[-1.6,0.1,-2]} to={[-1.6,0.95,-2]} width={0.08} />
    {[0,1,2].map(i => <Block key={i} at={[-1.95+i*0.3,1.2,-1.94]} size={[0.16,0.25,0.02]} color="#4ade80" />)}
    {[-1,1].map(side => <Block key={side} at={[side*2.65,0.17,-0.45]} size={[0.8,0.1,1.65]} rotation={[0,0,side*-0.12]} color="#cbd5e1" />)}
  </>
}
function Barrier({ x, z }: { x: number; z: number }) {
  return <group><Block at={[x,0.65,z]} size={[0.3,1.1,0.35]} color={orange} /><Block at={[x+0.85,1.15,z]} size={[2,0.1,0.12]} color={cream} />{[0.15,0.65,1.15,1.65].map(offset => <Block key={offset} at={[x+offset,1.15,z+0.065]} size={[0.25,0.11,0.025]} color="#ef4444" />)}</group>
}
function Border() {
  return <><Pad /><Block at={[-1.7,0.8,-1.7]} size={[1.9,1.4,1.8]} color="#f1f5f9" /><Block at={[-1.7,1.55,-1.7]} size={[2.1,0.16,2]} color="#166534" />
    <Block at={[-1.7,1,-0.78]} size={[1.2,0.55,0.03]} color={glass} /><Barrier x={-0.2} z={0.25} />
    {[-2.7,2.65].map((x,i) => <group key={x}><Beam from={[x,0.1,-2.2]} to={[x,2.9,-2.2]} width={0.055} /><Block at={[x+ (i ? -0.4 : 0.4),2.6,-2.2]} size={[0.8,0.48,0.04]} color={i ? "#1d4ed8" : "#16a34a"} /></group>)}
    <Block at={[0.5,2.55,-1.65]} size={[3.3,0.45,0.22]} color="#166534" />
    {[0,2].map(x => <Block key={x} at={[x,1.3,-1.65]} size={[0.12,2.4,0.12]} color={steel} />)}
    <Block at={[1.05,0.13,0.45]} size={[0.08,0.025,1.4]} color={cream} />
  </>
}
function TollPlaza() {
  return <><Pad /><RoundBlock at={[0,2.2,-1]} size={[5.8,0.28,2.1]} color="#0f766e" radius={0.12} />
    {[-1.8,0,1.8].map(x => <group key={x}><Block at={[x,0.65,-1]} size={[0.65,1.1,1.3]} color={cream} /><Block at={[x,1.15,-0.32]} size={[0.5,0.32,0.04]} color={glass} /><Block at={[x,1.7,-1]} size={[0.12,0.75,0.12]} color={steel} /><Cylinder at={[x,2.2,0.1]} radius={0.09} height={0.04} rotation={[Math.PI/2,0,0]} color="#4ade80" /><Block at={[x-0.55,0.13,-0.45]} size={[0.04,0.03,3.5]} color={cream} /></group>)}
    <Barrier x={-2.5} z={0.4} />
  </>
}
function FuelStation2() {
  return <><Pad color="#dce3eb" />
    <RoundBlock at={[-0.35,2.15,-0.7]} size={[4.4,0.28,2.5]} color="#1d4ed8" radius={0.13} />
    <RoundBlock at={[-0.35,2,-0.7]} size={[4.25,0.09,2.35]} color={cream} radius={0.04} />
    <Block at={[-0.35,2.12,0.56]} size={[3.9,0.075,0.025]} color="#f97316" />
    {[-1.8,1.1].map(x => <Cylinder key={x} at={[x,1.05,-1.65]} radius={0.095} height={1.9} color={steel} />)}
    {[-1.2,0.55].map(x => <group key={x}>
      <RoundBlock at={[x,0.14,-0.4]} size={[1.1,0.16,0.7]} color={cream} radius={0.06} />
      <RoundBlock at={[x,0.7,-0.4]} size={[0.62,1,0.42]} color={cream} radius={0.055} />
      <Block at={[x,0.44,-0.175]} size={[0.55,0.42,0.035]} color="#1d4ed8" />
      <Block at={[x,0.94,-0.175]} size={[0.4,0.24,0.035]} color="#172033" />
      <Block at={[x,0.94,-0.15]} size={[0.25,0.065,0.015]} color="#86efac" />
      <Hose points={[[x+0.32,1,-0.35],[x+0.55,0.75,-0.35],[x+0.55,0.3,-0.3],[x+0.37,0.45,-0.18],[x+0.35,0.8,-0.15]]} />
      <Block at={[x+0.35,0.82,-0.13]} size={[0.09,0.25,0.11]} rotation={[0,0,-0.15]} color="#f97316" />
    </group>)}
    <RoundBlock at={[2.3,1.42,-1.35]} size={[0.62,2.55,0.22]} color={cream} radius={0.08} />
    <Block at={[2.3,2.35,-1.225]} size={[0.5,0.6,0.03]} color="#1d4ed8" />
    <mesh position={[2.3,2.35,-1.195]}><circleGeometry args={[0.13,16]} /><meshStandardMaterial color="#f97316" /></mesh>
    {[1.25,1.55,1.85].map(y => <group key={y}><Block at={[2.3,y,-1.225]} size={[0.5,0.2,0.03]} color="#172033" /><Block at={[2.36,y,-1.2]} size={[0.24,0.05,0.01]} color="#86efac" /></group>)}
    {[-2.1,-0.35,1.4].map(x => <Block key={x} at={[x,0.115,0.55]} size={[0.045,0.02,1.05]} color={cream} />)}
  </>
}

function FuelDepot() {
  return <><Pad color="#d8e0e8" />
    {[-1.6, 0.35].map(x => <group key={x}>
      <Cylinder at={[x, 1.2, -1.65]} radius={0.78} height={2.15} color="#e2e8f0" />
      <mesh position={[x, 2.28, -1.65]} scale={[0.78, 0.22, 0.78]}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#cbd5e1" roughness={0.55} /></mesh>
      {[0.35, 1.15, 2].map(y => <Cylinder key={y} at={[x, y, -1.65]} radius={0.793} height={0.045} color="#94a3b8" />)}
      <Cylinder at={[x, 2.62, -1.65]} radius={0.08} height={0.32} color={steel} />
      <Cylinder at={[x, 2.8, -1.65]} radius={0.12} height={0.055} color={steel} />
      <mesh position={[x, 1.48, -0.852]}><circleGeometry args={[0.2, 3]} /><meshStandardMaterial color={orange} /></mesh>
      <Block at={[x, 1.48, -0.833]} size={[0.035, 0.12, 0.015]} color="#172033" />
      <Hose points={[[x, 0.35, -0.85], [x, 0.3, -0.5], [x, 0.25, -0.2]]} radius={0.065} color="#ea580c" />
    </group>)}
    {[-1.85, -1.45].map(x => <Beam key={x} from={[x, 0.15, -0.81]} to={[x, 2.4, -0.81]} color={steel} width={0.035} />)}
    {[0.35, 0.65, 0.95, 1.25, 1.55, 1.85, 2.15].map(y => <Beam key={y} from={[-1.85, y, -0.8]} to={[-1.45, y, -0.8]} color={steel} width={0.035} />)}
    <Hose points={[[-1.6, 0.25, -0.2], [-0.7, 0.25, -0.2], [0.35, 0.25, -0.2], [1.9, 0.25, -0.2]]} radius={0.065} color="#ea580c" />
    <RoundBlock at={[2, 0.5, -1.65]} size={[0.85, 0.8, 0.9]} color="#1d4ed8" radius={0.08} />
    <Block at={[2, 0.62, -1.185]} size={[0.45, 0.25, 0.03]} color="#172033" />
    <Beam from={[2, 0.2, -0.2]} to={[2, 0.5, -1.3]} color="#ea580c" width={0.1} />
    <group position={[0.1, 0.1, 0.65]}>
      <Block at={[0, 0.32, 0]} size={[2.9, 0.12, 0.75]} color={steel} />
      <Cylinder at={[-0.35, 0.85, 0]} radius={0.38} height={1.9} rotation={[0, 0, Math.PI / 2]} color="#e2e8f0" />
      {[-0.95, 0.3].map(x => <Cylinder key={x} at={[x, 0.85, 0]} radius={0.39} height={0.05} rotation={[0, 0, Math.PI / 2]} color="#94a3b8" />)}
      <RoundBlock at={[1.13, 0.7, 0]} size={[0.75, 0.85, 0.8]} color="#0284c7" radius={0.075} />
      <Block at={[1.515, 0.87, 0]} size={[0.025, 0.3, 0.59]} color={glass} />
      <Block at={[1.12, 0.87, 0.41]} size={[0.4, 0.28, 0.025]} color={glass} />
      {[-1.05, -0.55, 1.05].flatMap(x => [-0.43, 0.43].map(z => <Cylinder key={`${x}-${z}`} at={[x, 0.27, z]} radius={0.23} height={0.14} rotation={[Math.PI / 2, 0, 0]} color="#1e293b" />))}
    </group>
    {[-2.4, 0.6].map(x => <Beam key={x} from={[x, 0.1, 0.8]} to={[x, 1.7, 0.8]} color={orange} width={0.09} />)}
    <Beam from={[-2.4, 1.7, 0.8]} to={[0.6, 1.7, 0.8]} color={orange} width={0.09} />
    <Hose points={[[-0.4, 1.7, 0.8], [-0.4, 1.45, 0.8], [-0.25, 1.25, 0.65]]} radius={0.045} />
  </>
}

function StagingArea() {
  return <><Pad color="#aebbc6" />
    <Block at={[0, 0.106, -0.75]} size={[5.7, 0.015, 3.1]} color="#667587" />
    {[-2.65, -0.85, 0.85, 2.65].map(x => <Block key={x} at={[x, 0.12, -0.75]} size={[0.055, 0.015, 3]} color={cream} />)}
    <Block at={[0, 0.12, -2.25]} size={[5.35, 0.015, 0.055]} color={cream} />
    {[-1.75, 0].map((x, i) => <group key={x} position={[x, 0.13, -0.8]} rotation={[0, -Math.PI / 2, 0]}>
      <Block at={[-0.2, 0.27, 0]} size={[2.65, 0.13, 0.75]} color={steel} />
      <RoundBlock at={[-0.45, 0.83, 0]} size={[1.85, 1.02, 0.8]} radius={0.05} color={i ? "#e2e8f0" : "#cbd5e1"} />
      <Block at={[-0.45, 0.46, 0.414]} size={[1.75, 0.075, 0.025]} color={i ? "#0284c7" : "#ea580c"} />
      <RoundBlock at={[0.98, 0.71, 0]} size={[0.72, 0.86, 0.8]} radius={0.06} color={i ? "#0284c7" : "#f59e0b"} />
      <Block at={[1.355, 0.89, 0]} size={[0.025, 0.29, 0.57]} color={glass} />
      <Block at={[0.98, 0.87, 0.413]} size={[0.44, 0.27, 0.025]} color={glass} />
      {[-1.1, -0.65, 0.93].flatMap(wheelX => [-0.43, 0.43].map(z => <Cylinder key={`${wheelX}-${z}`} at={[wheelX, 0.25, z]} radius={0.22} height={0.12} rotation={[Math.PI / 2, 0, 0]} color="#1e293b" />))}
    </group>)}
    <RoundBlock at={[1.8, 0.65, -2.55]} size={[1.1, 1.1, 0.75]} radius={0.045} color={cream} />
    <RoundBlock at={[1.8, 1.25, -2.55]} size={[1.25, 0.16, 0.85]} radius={0.06} color="#1d4ed8" />
    <Block at={[1.8, 0.9, -2.157]} size={[0.75, 0.32, 0.025]} color={glass} />
    <Beam from={[2.35, 0.1, 0.25]} to={[2.35, 1.5, 0.25]} color={steel} width={0.055} />
    <RoundBlock at={[2.35, 1.55, 0.25]} size={[0.65, 0.6, 0.12]} radius={0.04} color="#1d4ed8" />
    <Block at={[2.28, 1.56, 0.319]} size={[0.04, 0.34, 0.015]} color={cream} />
    <Block at={[2.38, 1.71, 0.319]} size={[0.23, 0.04, 0.015]} color={cream} />
    <Block at={[2.47, 1.63, 0.319]} size={[0.04, 0.2, 0.015]} color={cream} />
    <Block at={[2.38, 1.54, 0.319]} size={[0.22, 0.04, 0.015]} color={cream} />
    <Block at={[1.75, 0.13, -0.7]} size={[0.04, 0.02, 0.6]} color={cream} />
    {[-2.35, -0.45, 1.4].map(x => <group key={x}><Block at={[x, 0.125, 1.05]} size={[0.6, 0.015, 0.05]} color={cream} /><Block at={[x + 0.2, 0.125, 0.95]} size={[0.32, 0.015, 0.045]} rotation={[0, -Math.PI / 4, 0]} color={cream} /><Block at={[x + 0.2, 0.125, 1.15]} size={[0.32, 0.015, 0.045]} rotation={[0, Math.PI / 4, 0]} color={cream} /></group>)}
    {[-2.9, 2.9].map(x => <Cylinder key={x} at={[x, 0.28, 0.5]} radius={0.11} top={0.025} height={0.36} color="#f97316" />)}
  </>
}

export const ADDITIONAL_LOCATION_MODELS = {
  "staging-area": StagingArea,
  "fuel-depot": FuelDepot,
  "container-terminal": ContainerTerminal,
  seaport: Seaport,
  "airport-cargo": AirportCargo,
  "rail-freight": RailFreight,
  mine: Mine,
  quarry: Quarry,
  factory: Factory,
  farm: Farm,
  "grain-terminal": GrainTerminal,
  "cold-storage": ColdStorage,
  retail: Retail,
  construction: Construction,
  weighbridge: Weighbridge,
  border: Border,
  "toll-plaza": TollPlaza,
  "fuel-station-2": FuelStation2,
} satisfies Record<AdditionalLocationMeshType, () => React.JSX.Element>
