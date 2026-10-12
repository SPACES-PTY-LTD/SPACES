# Refined box truck design QA

Result: **passed** for the selected component implementation and local monitoring-component checks (2026-10-12). Authenticated live data/polling and production fleet load are not claimed.

Selected source: `/Users/leroygwirize/.codex/generated_images/01a13076-ccb0-7702-a364-62aa525dd34e/exec-96dfab92-6f62-4a0a-a023-7904ab539f2a.png`.

Rendered evidence: `/Users/leroygwirize/.codex/visualizations/2026/10/12/01a13076-ccb0-7702-a364-62aa525dd34e/refined-box-truck-preview.jpg`.

Preview: `http://localhost:3012/dev-location-icons-preview?truck=1` (development only). Uses actual TruckMesh/RoadTruckMesh; no raster truck substitution.

## Comparison

- Structure/silhouette: separate raised bevelled cargo box and compact angled cab match the selected direction. The model stays within existing hitboxes and keeps original road/parking orientation.
- Materials/colour: grey cab/cargo, blue-grey glass, black tyres/chassis, metallic hubs/steps and cream lights. Both painted sections switch to existing selected blue and alert red; alerts override selection. Geometry batches share immutable neutral materials.
- Detail/scale: mirrors, grille slats, door handles, wheel arches, rear seam and tail lamps are present. Thumbnail fleet review shows distinct cab and cargo with recognisable grey/red/blue states.
- Spacing/lighting: softened geometry edges use the monitoring scene's lighting. Preview cameras differ from the generated presentation to inspect both direction wrappers. No production lighting or parking spacing was changed.
- Typography/UI: existing plate label and monitoring controls remain unchanged. The concept board's captions and presentation cards are not production UI requirements.

## Interaction and checks

- Actual road and parked trucks: click selects blue; hover reveals registration with global labels off; global registration toggle shows both labels.
- Selected plus speeding renders red; waiting-overdue uses the same alert resolver. Existing speed fallback and explicit false semantics covered by tests.
- Arrival/departure replay exercised; parked departure reports exactly one completion callback. Road nudge remains active.
- Fixed material batching limits the model to seven draw calls excluding label/hitbox. Bounds and finite positions/normals verified by geometry regression. No fleet performance benchmark claimed.
- Website TypeScript and focused ESLint pass. All 12 targeted truck, waiting-time and location-icon regressions pass. No browser runtime errors; existing Three Clock deprecation warning observed.

Intentional translation: implement a compact native model with the selected silhouette/material zones rather than photorealistic source lighting. This preserves dynamic colours, picking and the existing scene scale.

---

# Admin run-map replay visual verification

Date: 2026-09-21

Source visual truth: `../docs/design/run-map/timeline-option-3.png` (1586 × 992 pixels).
Implementation evidence: `../docs/design/run-map/implemented-timeline-desktop.png` (1440 × 1000 pixels, 1440 × 1000 CSS viewport, 1×); `../docs/design/run-map/implemented-timeline-mobile.png` (390px CSS viewport, 1×, full-page capture).
State: illustrative delivery visit, 10:36 within the selected reference's 10:30–10:48 18-minute stop. The reference uses 10:42 within that same interval. This is a component comparison, not a geographic/data match.

## Findings and comparison

No remaining actionable P0/P1/P2 UI differences in the selected timeline. The reference and browser capture were opened together in the same comparison input. The full view and readable bottom timeline show the same hierarchy: title/time/reset row, straight rail, coloured duration bands, point events, dashed gap and activity summary. At these capture sizes, a separate crop is unnecessary to read those details.

- Typography: retains the existing Space Grotesk/Inter stack and admin text sizes. Strong activity title and selected time; muted detail text. Date and time zone are added for real multi-day histories.
- Spacing/layout: white integrated footer, generous horizontal padding, full-width rail, summary below. Mobile wraps controls/summary and shows only endpoint time labels; no horizontal overflow was observed.
- Colours/tokens: blue played route/rail, green delivery, slate other stops, red speeding. Muted map geometry reduces competing visual weight. The separate legend is intentionally removed by subsequent user instruction; filter swatches remain.
- Image/icon fidelity: live Google Maps rather than generated geography, preserving attribution. The car icon is now 32px per user feedback rather than the larger reference icon. Sample route geometry is test data, not the requested run.
- Copy/content: activity, duration and interval appear under the rail. Gaps explicitly say position is unavailable; the replay car disappears. Latest view avoids presenting an old stop as live location.

## Comparison history

1. Initial rendered map had colourful POI clutter and an oversized 48px car. Applied muted map styling and reduced the car to 32px. Removed the colour key following direct user feedback. The final desktop screenshot records all three changes.
2. Numeric epoch values produced imprecise accessibility values in the native range control. Switched the input to relative seconds, retaining full timestamps in the model and accessible value description. Keyboard and drag tests passed afterward.
3. Preserved map/viewport on scrub/filter changes and corrected refit on a newly mounted map. Screenshot and browser state confirm the replay uses the expected route bounds.

## Interaction verification

- Keyboard Home/PageUp selects travel and delivery states.
- Delivery interval holds the car at the stop with an 18-minute duration.
- Dragging to 12:08 enters the GPS gap: vehicle hidden, unavailable summary shown.
- Back to latest restores the latest-stop marker and exits replay.
- Speeding filter changes marker count from 8/8 to 7/8 without removing the timeline.
- Desktop and 390px layouts render usable controls; keyboard focus is visible.
- Browser console errors: none. Existing Google legacy Marker deprecation warning only.
- Fifteen focused unit tests cover gaps, invalid samples, chronology, unknown intervals, same-vehicle/run durations, safe popup text, all-page loading, cursor loops and fetch failure/cancellation.

## Remaining verification limits

The requested authenticated run redirects to sign-in in this browser. Live data, production-scale history and native touch-device behavior were not validated. The development-only preview uses the actual component and Google Maps with explicitly labelled fixture data; it returns 404 outside development. No backend data was mutated.

final result: passed
