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

### Three road layouts (2026-10-15)

Multiple Roads Mixed Grid is now the default. The dropdown also offers 1 Road and Multiple Roads Square Grid. Mixed blocks follow a stable one/three/two location rhythm with staggered building rows and varied street spacing, avoiding random repositioning during refresh. Both network layouts retain junctions, roundabouts and tree-clearance rules. This supersedes the earlier single-road default.

Verified initial selection after reload and all three options. Ten model tests, TypeScript and focused lint pass. [Mixed Grid preview](verification/19-mixed-grid.png).

### Multiple blocks per row — 2026-10-15

Mixed Grid now packs up to three blocks across each row, rotating the 1/3/2 location capacities. Connecting streets join rows with deterministic traffic lights and occasional roundabouts. The 25-location fixture uses five rows instead of thirteen; buildings and bays remain clear of internal streets. The first frontage row remains open toward the highway.

Development preview: `/dev-monitoring-v2-preview?count=150&locations=25&camera=overview&status=at_location`. The optional locations parameter generates sample locations (including fuel stops); production data is unaffected. Screenshot 20 records the earlier long strip; screenshot 21 records the compact layout.

Verification: ten model tests, TypeScript and focused ESLint pass. The 25-location / 150-vehicle overview was visually checked locally, including internal roundabouts and signals. Not deployed.

### Location hover details — 2026-10-15

Floating building icons are removed. Hover the building or yard to show the location name, address, visible vehicle count and overdue count. The popup ignores pointer input so it cannot block selection or canvas gestures. Hide location info disables popups. Screenshot 22 verifies a single location popup in the 25-location overview with no persistent icons. TypeScript and focused ESLint pass.

### Compact location name labels — 2026-10-15

Supersedes the expanded hover card above: location hover now displays only the name using the same compact label style as vehicles. No icon, address or counts appear in the hover label. Full details remain available by selecting the location.

TypeScript and focused lint pass. Selected-location scene reload checked locally; hover-label visual confirmation remains pending.

### Location navigation — 2026-10-15

Location camera maximum distance is max(45, twice yard depth), using all assigned vehicle positions so filters do not shrink the limit. Both controls and button-driven destinations share the limit. Back to overview uses a three-cycle 1.8-second blue halo, stops on hover/focus and disables for reduced motion. Other view types retain their camera range. Physical pinch verification remains pending.

### Illustrated scene preparation — 2026-10-15

A lightweight inline SVG road/warehouse scene and blue truck replace the plain dynamic-import fallback. A workspace-owned overlay remains through module download and canvas initialization; the scene signals readiness on its second frame callback (after the first render). It fades in 200 ms and unmounts at 220 ms. No percentage is fabricated. Background refreshes retain readiness.

Overview says “Preparing your fleet view”; a known location says “Opening [name]”; other contexts say “Preparing your view”. A polite live region switches supporting copy after ten seconds. Fleet list opens the existing list; available header and summary stay outside the overlay. API/empty/error states retain their own banner above it. Existing error-boundary and context-loss paths remove the illustration and open the list fallback. Timers clean up on readiness/unmount; reduced motion disables truck movement and fading.

Verification: TypeScript and focused ESLint passed. A temporary component harness verified location copy, the ten-second message, Fleet list callback, ready dismissal, and a 375 px layout without horizontal overflow; the harness was removed. The real 25-location preview completed scene initialization and removed the overlay. Screenshot `verification/25-loading-preview.png` records the delayed component state. Reduced-motion rules and timer cleanup were inspected; OS reduced-motion, forced WebGL failure and network-throttled module download were not exercised.

### Pointer affordance — 2026-10-15

Vehicle and location hover now share a canvas-scoped pointer cursor. The existing hover labels and selection stay unchanged. The cursor returns to auto on exit or scene unmount; hidden locations/vehicles do not retain the pointer.

### Building and yard motion — 2026-10-15

Buildings rise over 650 ms when mounted. Vehicles enter from the location road via the side aisle and turn into their assigned bay. A changed location/status drives them back to the old road before switching to the new schematic position; unrelated sites and the elevated highway are never joined by a straight flying interpolation. Departures remain visible briefly through status filters. Filter/layout changes do not simulate departures; missing API records are removed without inventing one. Pause freezes motion and reduced motion settles immediately. Selection labels/rings follow the vehicle. Movements are illustrative, not measured GPS routes; vehicles do not perform collision avoidance.

Verification: five focused motion tests cover arrival, filtered departure, opposite-side yards, pause/reduced motion, and filter/layout stability. TypeScript and focused lint passed. The 150-vehicle/25-location preview loaded successfully; `verification/26-yard-motion.png` captures the settled scene. Live production arrival/departure timing has not been verified.

### Building-only hover — 2026-10-16

Location hover targets the building group, excluding the outer yard, trees and lamps. Shared location meshes retain their own hover name; only V2 warehouses receive the custom name label, preventing duplicate labels.

### Vehicle-free location models — 2026-10-16

Removed decorative transport from staging-area, fuel-depot, sasol-depot, mine, weighbridge, seaport, airport-cargo and rail-freight. Infrastructure remains; fleet instances are the only vehicles shown by the monitor. Eight corresponding public location-type images were regenerated from the shared models and visually checked. Older verification screenshots are historical captures and may show the previous decoration. TypeScript and focused lint passed.

### Attention bounce — 2026-10-16

The same speeding/overdue predicate used for red vehicles now adds a gentle vertical attention cue: a two-second cosine cycle between zero and 0.24 scene units. Pause freezes the clock, reduced motion removes the offset, and clearing attention returns the vehicle to its base height. The selection ring remains on the yard/road.

### Active filter badge — 2026-10-16

Filters displays a blue count for non-empty search, status, location, location type and alert values. Count derives from the existing URL filter state, disappears at zero and is announced in the button name. Camera/view/selection parameters are excluded.

### Fleet drawer — 2026-10-16

All Fleet list entry points open the shared modal Sheet from the right. The filtered fleet scrolls independently under a fixed title/count; narrow screens use full width. Escape, backdrop and Close dismiss it. Vehicle selection closes the drawer and opens tracking. Radix traps focus; dismissal restores the originating control where available.

### Transport landmark exceptions — 2026-10-16

Rail freight retains its train, seaport its ship, and airport cargo its aircraft, as requested. These three model previews match the restored geometry. The five road-truck removals remain in place. This supersedes the blanket transport removal above.

### Road layout select — 2026-10-16

The road layout uses the shared shadcn Select with Route, Grid2X2 and PanelsTopLeft icons for single, square and mixed layouts. Labels and layout/reset behavior are unchanged; the menu supports keyboard navigation and selected-state indication.

### Filter popover — 2026-10-16

Filters now opens the shared shadcn Popover beneath its button, aligned to the right edge. The two-column form overlays rather than displacing the scene, becomes one column on very narrow screens, and retains URL filtering, badge counts and clearing. Close, Escape and outside click dismiss it.

### Stable fleet summary — 2026-10-16

Overview summary cards count the complete loaded fleet, independently of status, search, location and alert filters. Filtering changes scene/list results only; the fleet-list result count continues to reflect filtered vehicles.

### Operational summary cards — 2026-10-16

Unread Messages uses the current merchant unread endpoint and opens Messages. Compliance counts missing required document uploads across drivers, vehicles and shipments using the missing-documents report total (not unique vehicles or expired documents), and opens that report. Counts ignore scene filters, refresh with fleet updates and on focus/visibility; messages-read also refreshes them. Unavailable initial data shows a dash; transient failures retain confirmed counts. Preview uses illustrative counts of 8 and 12. Summary cards wrap on narrow widths.

### Location-info control removed — 2026-10-16

Remove the Show/Hide location info toolbar toggle. Location hover labels remain enabled in overview and shipment views.

### Info drawer — 2026-10-16

Info beside Fleet list opens a right-side Sheet with the former overview footer: Latest reported events, Fleet attention and Locations. The overview footer is removed; detail-view footers remain. Drawer content scrolls on small screens. Escape/backdrop/Close dismiss it and restore focus to Info; attention/location actions close the drawer and navigate.

### Single-row stats — 2026-10-16

All eight summary cards stay in one horizontal row. Narrow screens scroll horizontally instead of wrapping cards into a second row. Supersedes the four-column responsive stats layout.

### Fill unused scene space — 2026-10-16

Remove the bottom vehicle-count/version/date strip, including preview FPS. The scene grows into remaining workspace height; overview no longer reserves height for its removed information footer. Detail panels retain their content.

### In-transit highway navigation — 2026-10-16

Selecting In transit closes Fleet list, filters to in-transit vehicles and focuses the elevated highway in Road view. The camera targets highway height and centre with framing based on road dimensions, including when no vehicles are in transit. Repeated clicks reset focus and zoom; background refreshes do not reset the camera when geometry is unchanged.

### Total vehicles reset — 2026-10-16

Total vehicles clears search, status, location, location-type and alert filters plus detail selections. It returns to Overview camera, resets zoom/focus and closes Fleet list and Info. Road layout remains selected.

### At-locations framing — 2026-10-16

At locations closes drawers, resets zoom and selects the Overview angle centred on the full location layout. Framing includes location footprints and parked vehicles, expands for narrow canvases and is independent of scene filters.

### Small mixed grids — 2026-10-16

Mixed Grid starts with blocks of one and two locations, then uses three mixed blocks per subsequent row. Four or more locations now create multiple road rows rather than fitting six on a single long road. Capacities are independent of fleet size so adding locations preserves assigned positions.
