# 3D Monitor V2

Implemented locally at `/admin/logistics/shipments/monitoring_v2`; V1/sidebar are preserved.

## Design references

`references/00-original.png` is the selected original. The numbered references map to overview, vehicle tracking, location detail, attention, shipment journey and standby/unknown. Implementation keeps the pale scene, blue controls, location cards and contextual details while rendering native interactive geometry instead of a static image. Existing location models and truck geometry are reused; V2 warehouses add loading doors, skylights and yard props.

## Verification

`verification/` contains development fixture screenshots, including mobile and pan/zoom evidence. Sample data is isolated to the development-only `/dev-monitoring-v2-preview` route; `count=500` and `count=1000` exercise larger fleets. Counts never aggregate vehicle geometry. Observed local fixture frame rates were approximately 50–60 FPS, not a production-device guarantee.

Mouse drag pans on the ground plane, wheel zooms toward the cursor, one finger pans and two fingers zoom/rotate. Camera height and polar limits prevent underside views. Presets and reset remain available; manual input interrupts preset movement. Pinch needs a physical device check.

18 targeted tests pass. Authenticated APIs, live GPS maps, deployed performance and physical touch remain release checks. Native low-poly models intentionally differ in realism from the image-generated concepts.

V2 location anchors are compact icons. Hover or keyboard focus reveals details; Hide locations clears the overlays. This supersedes the always-expanded reference cards to keep yards visible when zoomed out.

## Location-type verification

All 26 catalog types rendered in the V2 browser fixture. Each marker opened the matching location detail view (28 selection checks including missing/unsupported fallback). Reviewed the captured model contact sheet; both fallback cases render the warehouse. No browser console errors were recorded. Evidence: `docs/design/monitoring-v2/verification/location-type-contact-sheet.png` and individual captures in `verification/location-types/`. Reproduce with `/dev-monitoring-v2-preview?catalog=1`; choose Preview location type. Catalog mapping/asset/registry tests also pass.

## Elevated highway refinement

The 2.260 refinement raises the highway and its vehicles above the depots. The selection camera and labels use the same elevation. A smooth ramp joins the nearest highway lane to the ground-level frontage road; its endpoint slope is zero at both decks. This preserves the joining curve as highway lanes increase. See verification captures 10 and 11.
