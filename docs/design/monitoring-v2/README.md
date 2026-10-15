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

### Two-sided location layout (2026-10-15)

The user-approved refinement pairs locations across the lower road, superseding the single row in the image references. Both rows face the road, with mirrored vehicle bays and selection cameras. Overview framing includes both rows; the curved elevated-highway ramp remains connected. Implemented and visually checked locally; deployment pending.

### Aerial overview refinement (2026-10-15)

Superseded by the latest user reference: Overview now looks lengthwise along both parallel roads at about 39 degrees above ground, with the highway on the left and the joining curve in the distance. Both inward-facing yard rows remain visible. Road, Top and close selection angles are unchanged.

### Visible rotation controls (2026-10-15)

Pan / Rotate buttons beside zoom select the left-drag and one-finger interaction. Pan is the default; switching preserves the camera. Reset view restores Pan and the camera preset. Wheel/pinch zoom, right-drag rotation and the ground limits remain available. Buttons expose pressed state and a mode-specific hint; the toolbar wraps on narrow screens. Physical touch validation remains pending.

Local verification: keyboard activation and pressed state, mouse rotation/pan switching, Reset to Pan, preset navigation, lower angle limit and 390px toolbar wrapping checked. TypeScript and focused ESLint pass. Physical touch/pinch and production-refresh validation remain pending. See [control evidence](verification/14-pan-rotate.png).

The Overview / Road / Top preset selector is hidden in location detail, returning when leaving that view. Pan / Rotate, zoom and Reset remain available. Latest overview evidence: [lengthwise roads](verification/15-lengthwise-overview.png).

Local location-detail verification: presets disappear on entry and return with Back to overview. See [location controls](verification/16-location-controls.png).

### Canvas-only pinch zoom (2026-10-15)

While V2 is mounted, touch scrolling remains available outside the canvas but browser pinch scaling is disabled. Trackpad pinch is prevented from scaling the page; only canvas-targeted input reaches scene zoom controls. Safari gesture defaults are suppressed. Cleanup restores normal behavior on exit. Physical touch/trackpad verification remains pending.

### Optional multiple roads (2026-10-15)

The latest supplied road-network reference informs the Multiple roads option: compact location rows served by shorter parallel streets and end connectors. The existing paired frontage layout remains the default 1 road option. Each yard uses its own street position, parking moves beyond the last row, and the highway ramp connects to the first street. Overview adapts to the network; changing layout resets framing. This is local UI state, with no URL/API changes. Shipment journey staging stays dedicated. Eight model tests cover identities, bay clearance, compactness, reorder stability and restoration of single-road placements. See [multiple roads](verification/17-multiple-roads.png).

### Dynamic junctions and landscaping (2026-10-15)

Multiple-road joins now mask overlapping lane markings, use stop bars and illustrative static traffic signals at three-way junctions, and add occasional roundabouts with planted islands and yield markings. Two-arm bends do not receive signals. Road rows determine junction placement; verge trees are spaced between junctions and excluded near buildings or vehicles. No frame-by-frame randomness or traffic-control API is involved. Nine model tests pass, including empty/single-site layouts and networks with 4, 20 and 60 locations.

Local network visual check: [junctions and trees](verification/18-dynamic-junctions.png). Signal and yield markings use left-hand approach lanes.
