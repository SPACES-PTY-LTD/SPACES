"use client"

import { useState } from "react"
import { Canvas } from "@react-three/fiber"
import { TruckMesh, RoadTruckMesh } from "../../src/app/admin/logistics/shipments/monitoring/components/truck-mesh"
import type { TruckRender } from "../../src/app/admin/logistics/shipments/monitoring/types"

const truck: TruckRender = {
  truckId: "preview", plateNumber: "BOX 001 GP", locationId: "depot", slot: 0,
  status: "parked", changedAt: 0, driver: "Preview driver",
  shipment: { reference: "PREVIEW", description: "Preview", destination: "Depot", weightKg: 0, pallets: 0, temperatureControlled: false },
}

export default function TruckPreview() {
  const [selected, setSelected] = useState(false)
  const [speeding, setSpeeding] = useState(false)
  const [overdue, setOverdue] = useState(false)
  const [labels, setLabels] = useState(false)
  const [status, setStatus] = useState<TruckRender["status"]>("parked")
  const [changedAt, setChangedAt] = useState(0)
  const [departures, setDepartures] = useState(0)
  const liveTruck = { ...truck, isSpeeding: speeding, isWaitingOverdue: overdue, status, changedAt }
  return <main className="p-6">
    <h1 className="text-xl font-semibold">Refined box truck — monitoring models</h1>
    <p className="my-2">Actual road and location components. Click a truck to select it; hover for its registration.</p>
    <div className="flex flex-wrap gap-5 py-3">
      {[["Selected", selected, setSelected], ["Speeding", speeding, setSpeeding], ["Waiting overdue", overdue, setOverdue], ["Registration labels", labels, setLabels]].map(([label, checked, setter]) => <label key={String(label)} className="flex items-center gap-2"><input type="checkbox" checked={checked as boolean} onChange={e => (setter as (value: boolean) => void)(e.target.checked)} />{label as string}</label>)}
      <button className="border rounded px-3" onClick={() => { setStatus("arriving"); setChangedAt(Date.now()) }}>Replay arrival</button>
      <button className="border rounded px-3" onClick={() => { setStatus("departing"); setChangedAt(Date.now()) }}>Replay departure</button>
    </div>
    <p aria-live="polite">Departure callbacks: {departures}</p>
    <div className="grid gap-4 md:grid-cols-2">
      {(["Location", "Road"] as const).map(kind => <section key={kind} className="rounded border p-3">
        <h2 className="font-semibold">{kind}</h2>
        <div style={{ height: 350 }}>
          <Canvas orthographic dpr={1} camera={{ position: kind === "Road" ? [6, 4, 7] : [-6, 4, 7], zoom: kind === "Road" ? 65 : 120, near: .1, far: 100 }} onCreated={({ camera }) => { camera.lookAt(0, .55, 0); camera.updateProjectionMatrix() }}>
            <color attach="background" args={["#edf0f3"]} />
            <ambientLight intensity={1} /><directionalLight position={[-5, 8, 6]} intensity={2.5} /><directionalLight position={[5, 4, -6]} intensity={.6} />
            {kind === "Location" ? <group rotation={[0, Math.PI / 2, 0]}><TruckMesh truck={liveTruck} warehouseX={2.025} warehouseZ={-2.6} isSelected={selected} showRegNumbers={labels} onSelect={() => setSelected(true)} onDepartDone={() => setDepartures(n => n + 1)} /></group> : <RoadTruckMesh truck={liveTruck} x={-1.67} z={0} isSelected={selected} showRegNumbers={labels} onSelect={() => setSelected(true)} />}
          </Canvas>
        </div>
      </section>)}
    </div>
    <section className="mt-4 rounded border p-3"><h2 className="font-semibold">Fleet scale — normal, alert, selected</h2><div style={{ height: 230 }}>
      <Canvas orthographic dpr={1} camera={{ position: [-6, 7, 9], zoom: 40, near: .1, far: 100 }} onCreated={({ camera }) => { camera.lookAt(2, 0, 0); camera.updateProjectionMatrix() }}>
        <color attach="background" args={["#30343b"]} /><ambientLight intensity={1} /><directionalLight position={[-5, 8, 6]} intensity={2.5} />
        {Array.from({ length: 12 }, (_, index) => <TruckMesh key={index} truck={{ ...truck, truckId: `fleet-${index}`, slot: index % 4, isSpeeding: index >= 4 && index < 8 }} warehouseX={2.025} warehouseZ={-5.6 + Math.floor(index / 4) * 3} isSelected={index >= 8} showRegNumbers={false} onSelect={() => setSelected(true)} onDepartDone={() => {}} />)}
      </Canvas>
    </div></section>
  </main>
}
