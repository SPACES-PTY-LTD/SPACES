"use client"

import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { LocationMesh } from "../../src/app/admin/logistics/shipments/monitoring/components/location-meshes"
import { LOCATION_TYPE_ICONS } from "../../src/lib/location-type-icons"
import { LocationTypesManager } from "../../src/components/settings/location-types-manager"

function CaptureFrame() {
  const frames = useRef(0)
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera)
    if (++frames.current === 3) gl.domElement.dataset.png = gl.domElement.toDataURL("image/png")
  }, 1)
  return null
}

// Stable, unhovered scenes for transparent canvas export; also exercises the real editor.
export default function LocationIconsPreview({ renderModels = false, iconValue }: { renderModels?: boolean; iconValue?: string }) {
  return (
    <main className="p-6" data-icon-catalogue={JSON.stringify(LOCATION_TYPE_ICONS.map(icon => icon.value))}>
      <h1 className="mb-4 text-xl font-semibold">Location icon previews</h1>
      {renderModels ? <div className="flex flex-wrap gap-4">
        {LOCATION_TYPE_ICONS.filter(icon => icon.value === (iconValue ?? "warehouse")).map((icon) => (
          <div key={icon.value}>
            <h2>{icon.label}</h2>
            <div data-icon={icon.value} style={{ width: 512, height: 512, pointerEvents: "none" }}>
              <Canvas orthographic dpr={1} camera={{ position: [9, 8, 11], zoom: 54, near: 0.1, far: 100 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} onCreated={({ camera, gl }) => {
                camera.lookAt(0, 0.9, -0.9)
                camera.updateProjectionMatrix()
                gl.setClearColor(0x000000, 0)
              }}>
                <CaptureFrame />
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 10, 8]} intensity={3} />
                <directionalLight position={[-8, 5, -6]} intensity={1} />
                <LocationMesh location={{ locationId: icon.value, index: 0, category: "depot", meshType: icon.meshType, status: "active", changedAt: 0 }} x={0} z={0} showLocationLabels={false} />
              </Canvas>
            </div>
          </div>
        ))}
      </div> : null}
      {!renderModels ? <section className="mt-8" aria-label="Location type editor fixture"><LocationTypesManager merchantId="00000000-0000-0000-0000-000000000001" accessToken="fixture-token" /></section> : null}
    </main>
  )
}
