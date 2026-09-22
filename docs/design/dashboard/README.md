# Driver dashboard plan

Version: 1.41
Last updated: 2026-09-22
Status: Core mobile/API implementation is complete. GPS history and recorded maps are implemented behind disabled rollout flags. Targeted verification is recorded below; native GPS-map interaction, production load, live AI and physical-camera checks remain release gates.

## Purpose and maintenance

This is the canonical behaviour plan for the Spaces driver dashboard and delivery-note upload journey. Read it before changing the dashboard, its run APIs, routing, or document import flow. It describes the intended behaviour; it is not a claim that every requirement already exists in the app.

**Whenever the dashboard plan changes, update this README in the same task.** Update the relevant Figma screens, acceptance checklist, revision history, and implementation status together. Remove superseded requirements rather than leaving conflicting instructions. Record unresolved choices explicitly. Runtime/code changes also require an entry in `docs/release-notes.md`.

### Design references

- [Scenario guide and implementation notes](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=32-980)
- [Active-run dashboard](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-294)
- [Step 3: confirm collection and end locations](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-1233)
- [Step 5: no current run](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-1308)
- [Step 5: another eligible run](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=32-2024)
- [Step 5: current run or new run](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-1381)
- [Upload completed](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-1679)
- [Collection location selector](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=42-1254)
- [Planned end location selector](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=42-1336)
- [Step 4: confirm shipments found](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-1456)

Figma simulates file selection, AI reading, GPS, searches and server responses. Its example locations and roads are illustrative. The location picker currently demonstrates saved-location choices; real address search, geocoding and routing must be implemented and verified in the app. Native document management, keyboard entry and telephone calls are implementation handoffs.

## 1. Dashboard layout

- Use an Uber-inspired light grey basemap: pale grey land/parks, white roads, grey water and subdued readable street labels. Hide POI/transit clutter; keep route, truck and shipment markers in their existing colours. Centralise the native Google map styling in `mobile_app/src/components/dashboard/run-map-style.ts`.
- Show delivery counts in the current-run summary only. Do not show the separate Today’s deliveries summary, progress bar or View shipments shortcut on the dashboard; shipment navigation remains available through the Shipments tab and timeline links.
- Map above a white persistent bottom sheet, with a visible but restrained shadow and drag handle.
- Default sheet position: 50%. Supported positions: 25%, 50%, 92%.
- At 25%, reveal more map. The map must never shrink below its 50% minimum; the 92% sheet overlays it.
- Keep the bottom navigation and scroll long sheet content without obscuring controls. Respect safe areas and the keyboard.
- App-owned information, confirmations and error dialogs use the shared `MessageSheet` built on `BottomSheet`, including timeline event details, dispatch contact, permission guidance, photo confirmation and action errors. Preserve all actions; execute them after sheet dismissal. Native operating-system permission prompts and pickers remain native.
- Use shared `BottomSheet`, `PersistentBottomSheet`, `ActionSheet`, and sheet theme controls so styling can be maintained centrally.
- Modal upload sheets fit their content, growing only as needed and scrolling when content exceeds the available height.
- Do not restore the online/offline control or the avatar/name/role in the dashboard's top-right corner.

## 2. Checking the driver's run

On dashboard entry, check the authenticated driver's current run. While the first check is pending, the sheet contains only a loading indicator and **Checking your current run…**. Do not flash document reminders, an empty-run message or a previous driver's work.

| Result/state | Dashboard behaviour |
| --- | --- |
| No current run | Show **No current run** and **Upload delivery note**. Open the upload bottom sheet. |
| Ready run | Show the assigned timeline and **Start run**, plus an upload action. |
| Active run | Show **Current run**, summary, timeline, filter and upload action. |
| Active run with no shipments | Show **We noticed you are on the road and have no shipments on this run. Upload a delivery note now.** The message/action opens upload for that run. Keep recorded collection/other stops visible. |
| Run with no recorded activity | Show **No stops recorded yet** and an upload action. Do not invent visits. |
| All deliveries completed | Keep the timeline and show **Deliveries completed — awaiting dispatch closure.** |
| Dispatch closes the run | Refresh to the no-current-run state. |
| Initial check fails | Show an explicit error and **Retry**. Failure is not proof of no run. |
| Connection fails after a successful check | Retain the last successful timeline, show that it is stale, its last-updated time and **Retry**. |

Run queries, shipments, documents, telemetry and mutations must stay scoped to the authenticated driver and authorised account/merchant. Recheck when returning from import or after a run-state change; avoid showing an older request over a newer result.

## 3. Run lifecycle

- Polygon-only detection (1.41, implemented locally): match a location only when the truck is strictly inside its valid saved polygon. Edges/vertices are outside; no radius or distance buffer is used. Ignore missing, malformed, degenerate or self-intersecting polygons. Convert WKT longitude/latitude into latitude/longitude correctly; support spatial production storage and SQLite WKT fixtures. Centre coordinates only break ties between containing locations, never establish membership.
- Apply this rule to future GPS processing only. Existing open visits exit through the normal workflow on the next outside sample, including visits previously retained by a radius. Do not rewrite past visits or shipments. Raw GPS, motion and speeding recording continues outside polygons. Stored radius metadata is retained but ignored.
- Admin simulated arrival requires a valid polygon and uses a verified interior point, including for concave polygons or a centre outside the fence. Missing/invalid polygons return validation errors. Existing manual simulated exit remains available.
- Verification: polygon geometry, lifecycle, tracking and simulator regressions pass locally; production spatial-engine and live map checks remain pending. No mobile Figma screen changes.

- Automatic geofence visits stay open while the truck remains inside the current location, including overlaps with nearer or higher-priority locations. Repeated positions reuse that visit and its shipment; selecting an overlapping geofence must not create another shipment, mark delivery, or restart a run. Once the truck leaves the current fence, normal exit and entry rules apply. Existing per-run/location shipment reuse remains in place after a return visit.
- Implementation (1.28): active-geofence retention and regression coverage are implemented locally. The overlapping-radius regression reproduced premature delivery and a second shipment before the fix. Production deployment and investigation/cleanup of historical records are not included. This backend rule changes no Figma screen or control.
- New runs created by upload start **Ready to start**.
- Automatically start when the assigned vehicle departs a collection point linked to the run.
- If the run has no linked collection point, departure from any recognised collection point can be the fallback. Newly prepared runs should use the explicit collection location chosen in Step 3.
- Retain **Start run** as a manual fallback.
- Delivering all shipments does not close the run. Dispatch closes it; there is no driver **Finish run** action.
- Arrival at the planned end does not itself close the run. Actual visit events and planned endpoints are different information.
- Define and verify departure detection, GPS quality, geofence thresholds and backend run-state mappings before implementing automatic start. No specific threshold is prescribed by this design.

## 4. Map and full planned trip

Admin Runs list performance (1.29, implemented locally): request the opt-in run-list summary for table rows. Do not load or transmit activity details, route stops, parcels, bookings or document imports for this table. Keep existing displayed counts, costs, dates, odometer/GPS distance fallback and shipment-based endpoint fallback. Load activity coordinates only for runs without complete odometers. Default API consumers and run detail remain unchanged. API regression tests cover summary parity and all sort columns; production latency/deployment remain unverified. No Figma screen or interaction changes.

Use Google map routing for road directions. The full planned trip is:

**Selected collection location → ordered shipment stops → selected planned end location.**

- Include the final leg after the last delivery; the planned end may be a depot, yard or another chosen location.
- A return to the collection location is valid. Do not reject it merely because the two endpoint locations match.
- Include shipment stops, the collection point and planned end in the route bounds and distinguish the endpoint roles.
- Show the truck's current GPS position when known. Do not show the old truck timestamp/status banner when the position is available.
- When position is unavailable, show a clear unavailable state; do not fabricate a truck position. Demo coordinates belong only in clearly identified demo data.
- Put an info icon at the map's bottom right to show/hide route distance and estimated duration. Keep it at the visible map edge as the sheet resizes.
- Planned-trip distance/time includes collection through to the chosen end. If remaining-trip metrics are also added, label them separately; do not replace the full planned route silently with truck-to-next-stop directions.
- Missing coordinates must not remove a stop or shipment from the timeline. Keep its address and explain that its position is unavailable; omit its pin until resolved.
- A Google routing failure must preserve the run and timeline. Show a routing retry/unavailable state rather than treating a straight line as verified road directions.
- Do not infer that planned endpoints have been visited. Recorded visits and events remain factual history.

### Recorded GPS history (1.21)

Admin geofence names (1.32, implemented locally): hovering over a displayed polygon boundary shows a compact name tooltip beside the pointer. Hit-test all loaded polygons at the pointer and list every containing location once, so nested/overlapping geofences cannot conceal each other (1.37). Load Google geometry only when geofences are enabled. Use location name, then company/code, then “Unnamed geofence”. Render plain text; the tooltip must not intercept pointer events. Hide it on pointer exit, map dragging/zooming, toggle-off and cleanup. No mobile/Figma changes; live visual verification pending.

Admin basemap labels (1.31): use dark slate text with an explicit thin white outline so street names remain distinct from roads, land and route lines at close zoom. Implemented locally; live zoomed-map visual verification pending. Mobile Figma styles are unchanged.

Admin geofence overlay (1.30, implemented locally): a top-left Geofences switch starts on (1.39). Mounting the map automatically fetches each distinct location linked to recorded run stops/activities using the existing authorised location-details endpoint, with at most four requests in flight. Draw only saved polygons, with no centre-radius circles (1.41), in translucent colours from a 12-colour palette. Assign colours by the complete sorted run location-ID list so partial fetches/retries do not shift them; each location’s polygon uses its assigned colour. The palette repeats after 12 locations (1.33, implemented locally). Disabling removes overlays and stops queued loads; ignore late responses. Cache successful responses for this run/auth context and retry failures only. Changing run or auth resets to on. Preserve map viewport, marker filters and replay. Stack controls on narrow screens. These are current saved boundaries, not historical boundary snapshots or every location along the route. No mobile/Figma screen change.

Add **Planned / Recorded** above the map, with Planned selected initially. Planned routing and its distance/time information remain unchanged. Recorded uses a separate lazy route endpoint and the current truck position. Label it **Recorded GPS**; never run directions or road matching to fill missing roads. Break lines across gaps longer than five minutes. Keep explicit loading, empty, stale, disabled and recoverable failure states. Preserve prior data for the same run/window on refresh failure.

On mobile, refresh the active run every minute only while Recorded is visible and the app is foregrounded. Stop fetching when hidden/backgrounded. Bound each response to 2,000 displayed coordinates while preserving segment endpoints and stop boundaries; provide Earlier route / Latest route controls on mobile for large histories; admin maps aggregate the bounded pages for trip replay. Older activity-only traces must say **Limited historical data**. No history is embedded in the general dashboard payload.

Store GPS separately from business activities forever. Merge only newer stationary observations within five minutes, reported speed at most 3 km/h and within 25 metres of the original stop position; thresholds are configurable. Missing speed stays an individual point. Preserve original position/time and latest details/count. Serialize ingestion per vehicle and deduplicate retries. Keep delayed observations at their source times without rewinding live location or lifecycle. Associate by the actual vehicle/run interval; ambiguous samples stay unassigned and are logged. Do not change odometer totals or shipment-distance calculations.

Admin recorded maps fit all located run stops, stationary observations and the displayed GPS segments with padding. Keep stop pins visible while history loads or is empty, disabled or unavailable; report the route state separately. Draw each available GPS segment as a blue line without connecting missing history. This admin viewport correction is implemented and fixture-verified; live run verification is blocked by local database authentication. The referenced mobile Figma screens and their Planned / Recorded behavior are unchanged.

Admin marker inspection (1.23, implemented): clicking any run-stop, stationary-GPS or isolated-position marker opens its recorded context. Run stops show event type, location name/address/category, arrival/departure and duration, plus shipment, driver, vehicle, speed and departure reason when present. Complete visit intervals determine duration; stopped-to-next-moving transitions for the same vehicle/run provide explicitly estimated duration when available. Missing or invalid intervals remain unknown. GPS stationary duration is an observation interval, not a confirmed visit or inferred reason. Co-located pins expose all visible records at those exact coordinates. A top-right checkbox dropdown toggles activity types independently, with counts, Show all / Hide all and a clear all-hidden state. Filtering preserves the route, viewport and stop numbering. The shared Run KM map uses the same behavior. Existing Figma references describe mobile screens only; this admin-only addition does not change those designs.

Admin marker styling (1.24, implemented): collections are blue, deliveries green, other stops slate, speeding red with an exclamation mark and isolated GPS positions purple. Keep stop numbering, readable marker titles and matching filter swatches (the separate colour key was removed at the user’s request in 1.25). Include existing speeding activities without duplicating events already supplied as stops. A car icon identifies the latest dated, located stop in the available history; it is explicitly labelled **Latest mapped stop**, not live vehicle location. Select by visit/event start time, exclude speeding/isolated positions, omit when no usable dated stop exists, and expose its details on click. The car is independently toggleable in Marker types.

Admin trip scrubber (1.26, implemented): [selected option 3](../run-map/README.md) is a straight linear timeline footer with stop-duration bands, point-event dots, GPS gaps, selected date/time/time zone, Time range and a concise activity/location/duration summary. Render the admin map and timeline directly in the page without an outer Card or Recorded GPS heading. Omit the introductory route paragraph and generic incomplete-coverage notice; retain contextual timeline gap/error states. Keep an 8px margin between the heading row and the slider container. Dragging or keyboard adjustment updates a compact 32px replay car. When the car leaves the current viewport, pan to its position without changing zoom; keep the viewport still while the car is visible and do not pan across unavailable GPS positions (1.36, implemented locally). Confirmed visits and observed stationary intervals hold the car at their recorded coordinates; stopped-to-moving estimates are explicitly labelled. Unknown endpoints remain point events, not assumed ongoing stops. Interpolate only within valid GPS segments with sample gaps no longer than five minutes; hide the car when position is unavailable, including between paginated segments whose continuity is unproven. Stop context survives missing coordinates. The Time range dialog replaces Back to latest: separate From date/time and To date/time fields accept only a positive interval within the run start/completion bounds (recorded-time bounds when unavailable; latest recorded time for an active run). Apply narrows timeline ticks, events and gap bands and moves replay to the selected start; the route shows the journey from the trip start up to the selected replay time. Whole trip clears the range and restores the latest-stop view. A Clear filter button beside Time range is visible only while a range is applied; clicking it performs the same reset and hides the button (1.35, implemented locally). Use local time with the displayed zone, validate on submit and reset on run/auth changes. Implemented locally in 1.34; range/replay tests and static checks pass, live browser verification pending.

Admin progressive route (1.40, implemented locally): dragging or keyboard adjustment grows/retracts the blue route up to the selected time, with a smoothly interpolated endpoint within valid GPS segments. Keep earlier segments visible and future segments hidden; never connect across missing GPS history or invent a route to a stop coordinate. Latest view and clearing a range restore the full recorded route. Update existing polylines without resetting the viewport or rebuilding markers on each drag. Automated interpolation, rewind, reset and gap checks pass; live visual verification pending. This admin-only interaction does not change the referenced mobile Figma screens.

Admin history loads every available cursor page once when the map first becomes visible. Do not poll or refresh on tab-focus or viewport re-entry. A Refresh button beside Geofences explicitly fetches GPS history, refreshes the server-rendered run details without a full browser reload, and reloads geofence data when enabled. Disable the button while history or run-detail refresh is pending; retain map/filter/replay state. Also provide Refresh when no mapped positions exist (1.38, implemented locally). Preserve prior same-run data after failure; expose loading, partial, limited-history and retry states, and guard repeated cursors. History remains bounded per API response; older activity-only data may still be incomplete. Timeline data and selection are scoped by run/auth context. Filter changes preserve the timeline, route and viewport. The separate colour key is removed; colours remain in filter swatches and pins. The muted basemap follows the selected visual. The native map-only fullscreen control is disabled so replay controls cannot disappear outside fullscreen. Mobile Figma screens and mobile paging are unchanged.

Verification: fifteen focused marker/replay tests, website TypeScript and focused lint pass. Browser fixture checks cover desktop/mobile layouts, drag and keyboard replay, movement, stationary delivery context, GPS-gap hiding, Back to latest and marker filtering; no browser console errors. The requested real run requires browser authentication and has not been verified with its live data. A development-only preview at `/dev-run-replay-preview` uses labelled illustrative data and returns not found outside development.

Implementation: migration, ingestion, scoped API and admin/mobile consumers are implemented behind independent recording/display flags, both default off. Figma active-run map includes the default toggle; its scenario guide documents Recorded states and behavior. Native device behavior and production-engine load checks remain rollout gates. See [capture contract, rollout and monitoring](../../vehicle-location-history.md).

## 5. Timeline

Replace the single next-delivery card with the current run timeline and a summary of shipment counts. Show all recorded run stops, including collection stops and stops without shipments. Follow recorded chronology, then show outstanding planned delivery stops in run order.

The action-sheet filter beside **Current run** offers:

| Filter | Includes |
| --- | --- |
| All stops | Collection visits, delivery visits, other recorded stops, speeding events and planned deliveries. Show the planned end as an explicitly planned endpoint, never as a completed visit. |
| Shipment deliveries | Only stops where delivery occurred or is planned. A collection-only stop does not qualify just because shipments were collected there. |
| Speeding events | Only speeding events. |

- Collection icon circles are blue; delivery circles green; speeding circles red; other stops grey. Use labels/symbols as well as colour.
- For a combined collection/delivery visit, show the delivery role in green and retain its collection detail. This follows the existing event-colour convention.
- Group shipments sharing one physical stop without duplicating the visit. Each shipment link branches from the main grey timeline rail with a thin grey curved join, aligned to the link centre. Keep joins decorative and shipment links independently tappable in a compact group (36-point minimum row height, no extra gap between shipment rows; grow for wrapping text). Extend the rail for child shipments even on the last stop.
- Speeding details include recorded speed, speed limit, time, location and duration when available. Missing values remain unavailable, not zero.
- Opening an event shows the corresponding stop, shipments or speeding details. Returning should retain filter and scroll position.
- Every filter has a clear empty state. Filtering the timeline must not silently remove locations from the full planned route.
- When an assigned run has no planned final destination, append a grey flag entry to **All stops** labelled **Planned final destination**, with **Choose final destination**. It is a planning action, not a visited stop or shipment; exclude it from Shipment deliveries and Speeding events. Show it even when there are no recorded stops.
- The button opens the shared bottom sheet with saved-location/address search, full address preview and **Save final destination**. Save only after explicit selection; allow dismissal without changes and preserve selection on retry. Require authorised, routable locations. Refresh the map route and timeline after saving, replacing the action with the planned end entry. Do not change run status, origin, shipment addresses or recorded visits. A destination saved concurrently must not be overwritten; show a conflict and refresh guidance.
- API: `PATCH /driver/runs/{run_uuid}/final-destination` with `destination_location_id`. The run must still be active/ready and assigned to the authenticated driver. Repeated saving of the same location is idempotent; a different pre-existing destination returns 409.

- Counts refer to shipments, not stop/event rows; a speeding event or planned end does not increase shipment totals.

## 6. Driver document reminders

After the initial run check finishes, show nonblocking dashboard notices when needed:

- **X required documents need uploading**.
- **X documents have expired**.

Use concise titles and a link to Documents. Do not list all document names in the dashboard notice. The Documents destination provides details and upload/renewal actions. Missing and expired counts must reflect the driver's applicable requirements and expiry dates. Do not add a run-start/upload lock solely because these notices exist; blocking policy is outside this approved plan.

## 7. Delivery-note upload journey

All entry points open the same bottom-sheet flow, preserving whether the driver came from an existing run or no run. Keep the file, selected run, trip locations and reviewed edits through back navigation and recoverable failures.

### Step 1 — Upload a delivery note

- Title: **Upload a delivery note**.
- **Choose document** opens the shared ActionSheet with **Photo**, **File**, **Camera**, in that order, plus **Cancel**. **Change document** uses the same sheet.
- **Photo** opens the device photo library; **File** opens the system document picker; **Camera** opens the camera to capture a delivery note. Let the driver confirm or retake a captured photo before accepting it.
- Cancel/dismiss returns to Step 1 without changing an existing selection. Permission denial, unavailable camera and picker failures preserve the draft and offer retry, appropriate settings guidance, or another source. Request platform permissions only when needed for the selected source.
- Validate the selected/captured file using the same supported formats and 20 MB limit. If a device supplies an unsupported format, explicitly convert to a supported format or explain the issue; do not silently accept it. Show the valid selected document before Continue; choosing a source alone must not begin AI processing.
- Figma simulates successful Photo/File/Camera selections with distinct example filenames. Native pickers, capture confirmation and permission handling remain implementation handoffs.
- Select a PDF, JPG, PNG or WebP, up to 20 MB; enforce the supported types and size on both client and server.
- Do not show recent uploads or the removed “Next: AI reads your document…” message.
- Show **Continue** only after a valid file is selected. Allow changing the document.
- Invalid file, unreadable file and cancelled selection are separate from a successful selection.

### Step 2 — Reading File

- After Continue, show a loading animation and progress messages: **Uploading file**, **Processing file**, **Reading delivery note shipments**.
- Use a consistent loading layout for all three stages: matching white sheet height, handle, 24-point side padding, typography and 16-point vertical gaps. Reserve two lines for the heading and keep the same 28-point loading indicator below the description in every stage. Use vertical auto-layout so the spinner never overlaps text or clips against the sheet edge. At the reference size the sheets are 288 points tall; grow for accessibility text or longer content instead of clipping. Spinner animation rotates around its centre without changing its layout position.
- Show real request/job stages where available; do not claim AI reading is complete just because a timer elapsed.
- Preserve the file and offer retry or replacement after failure. No shipments or run are created during extraction.
- An empty extraction has its own message and lets the driver choose another document.

### Step 3 — Confirm Collection & End Locations

Choose **Run starting point** and **Planned end location (where the run will end)** before reviewing the extracted shipments and choosing the destination run.

1. Label the two independent selectors **Run starting point** and **Planned end location**. Show the location name with its full formatted address underneath (street, locality, region, country and postal code when available). Keep long addresses readable; grow the field/sheet rather than truncate it. Saved locations or extracted suggestions may prefill the draft, but the driver can change them. Changing a location must update its name and address together. Figma addresses are illustrative demo data.
2. Search authorised saved facilities or an address, choose an unambiguous result and confirm its address/map position.
3. Explain the full planned trip: **Collection → ordered shipment stops → planned end**. The end may differ from the last delivery; returning to the collection location is valid.
4. Press **Continue** to review shipments in Step 4 against the selected starting point. Both valid, routable locations are required before final submission. Explain unresolved addresses and offer selection/retry rather than claiming a complete route.

Keep the header, location selectors, helper text and one Continue action in a vertical auto-layout. The header contains no embedded or hidden action buttons. Fit the sheet to content and scroll only when required.

These run-level trip boundaries do not overwrite individual shipment pickup/drop-off addresses. Preserve stable location/place references where available, names, formatted addresses and coordinates. Exact API fields remain an implementation decision. Never silently use the truck position or final delivery as the end location.

### Step 4 — Confirm Shipments found

List **every shipment found in the document**, including duplicates, invalid records and records already assigned elsewhere. Do not collapse this into a count or hide excluded rows. Above the list show the compact summary **4 shipments · 1 needs attention.** using actual draft counts. Count distinct shipments requiring attention, not the number of warnings, and recalculate after edits.

- Compare each shipment’s collection point with the **run starting/collection location confirmed in Step 3**. Show **Collection point doesn’t match run start** for a differing location, identify the shipment reference, and display both locations with full addresses when available. Place each detailed warning **inside its affected shipment card**, below the collection/destination details. Do not use a detached warning banner above unrelated cards. The shared card exposes a Collection mismatch visibility property.
- Offer **Edit shipment** to correct extracted collection information and **Change run start** to return to Step 3. Preserve all draft edits and re-evaluate every warning after either location changes. Never overwrite an address silently. A legitimate different collection point is informational and may remain; this requirement does not impose a same-location restriction on all shipments.
- Use stable place/location identities and normalised full addresses, not display-name equality alone. An unresolved/missing location is **Unable to compare collection point**, not a confirmed mismatch or match; retain existing location validation and correction paths.
- Step 5 still selects the destination run. Compare against the confirmed planned start during review, then revalidate against that plan and the selected run before saving. Explain any conflicting existing-run starting point and return to Step 3/4 as needed; do not silently replace the reviewed plan.


- Each row/card shows its reference, **quantity**, **shipment type**, destination/date where extracted, and eligibility/validation status.
- Card design: white surface, subtle border and rounded corners; reference at top left and a labelled status badge at top right. Show **Quantity** and **Shipment type** as separate labelled values (for example **2** and **Box**). Show clearly labelled **Collection** and **Deliver to** address rows below the quantity/type fields. Use blue for the collection label and green for the delivery label, with readable full addresses that wrap. Show an explicit **Collection date** label above the muted date value below with a separate **Edit** button using a 44-point touch target. Keep New, Existing/skipped and Other run/excluded visually distinct without relying only on colour.
- Figma uses the reusable **Spaces / Shipment review card** component on **Dashboard • Components & guide**. Editable properties: Reference, Quantity, Shipment type, Collection location, Delivery location, Collection date, Delivery status and match, Collection mismatch (visibility), and State (New / Existing / Excluded). State controls badge text and colour. Update the main component variants to change shared styling; all eight review cards are linked instances and retain per-shipment Edit actions. [Open the component](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=59-1264).
- Collection and delivery on each card refer to that shipment’s actual pickup and destination. Show a facility name when available plus its specific address; a suburb alone is insufficient. Do not substitute the run-level collection/end selections or truck position. Unreadable/missing locations need an explicit correction state, not an invented address.
- The card date (for example **16 Sep**) is the shipment’s **collection date**, not its delivery date. Label it **Collection date** on the card and in the edit form; preserve extracted values. Any separate delivery date must be stored and labelled independently.
- Cards sit in a scrollable list while the single Continue action stays outside the scrolling region and remains accessible. Preserve per-shipment edit data and actions when changing the presentation.
- Each eligible shipment card has a prominent, full-width **Change delivery status** button beside its status information, opening the three-option status sheet directly for that shipment. Preserve the required Failed Delivery reason flow. Existing/skipped and other-run/excluded shipments do not gain permission to mutate their status through import; use their authorised details flow where appropriate.
- Every shipment has an **Edit shipment** action. Open that shipment's own values, not the first record's values.
- Support correcting quantity, shipment type, reference, collection date, pickup/drop-off addresses, parcel details and delivery status. Use the backend's allowed shipment-type taxonomy; Box/Pallet/Crate are illustrative Figma fixture types, not a newly defined backend enumeration.
- Quantity must be valid for the chosen type; flag missing/unsupported types and unreadable values instead of guessing them. Confirm detailed unit/type rules against existing models.
- Save edits to the import draft and reflect them immediately in the shipment list. Back navigation and retries retain corrections. No live shipment is created or updated in this step.
- Distinguish new shipments, existing duplicates, invalid shipments and shipments already on another run. Correct or explicitly exclude invalid records before continuing; do not silently move other-run shipments.
- Show one **Continue** action after the list. Long lists scroll; quantities, types, editing and the action remain accessible.
- An empty extraction or no eligible shipments has an explicit recovery state and must not create an empty run.
- **All reviewed eligible shipment dates attach to the selected run**, including other dates. The older today-only rule remains superseded.

### Matching recorded delivery stops and editing status

- During processing, compare extracted destinations with **recorded visits on the candidate run**. A unique, reliable destination match links the new shipment to that existing delivery stop and proposes **Delivered**. Multiple shipments may share the same visit; do not create duplicate stops.
- Step 4 shows **Delivery status**, matched stop/location and visit time, and that the match is provisional for the named run. Keep this separate from import eligibility badges: a **New** shipment can already be **Delivered**.
- Match stable authorised location/place identities or verified full addresses against recorded visits in this run. A planned stop, GPS pass-through, collection-only stop, or visit from another run is insufficient. Ambiguous locations or repeat visits require review; show **Needs review** and do not auto-deliver until resolved. Missing evidence does not mean delivered.
- The driver can change delivery status in **Edit shipment** during review. Persist the selected status and its manual source in the import draft; refresh the row, retain it through back navigation/retry, and do not overwrite it with subsequent matching. Correcting a destination invalidates its old stop match and triggers a new match review.
- Driver-selectable delivery statuses are exactly **Delivered**, **In transit**, and **Failed Delivery**, both during import review and after upload. Other lifecycle statuses may be displayed as existing system state but must not appear as driver-selectable choices. Map these labels to the existing backend values (`delivered`, `in_transit`, `failed`); enforce the restricted choices server-side as well as in the UI. Preserve existing ownership checks and valid delivery-evidence requirements; do not invent values to satisfy validation.
- Choosing **Failed Delivery** opens **Failure reason · Required**, a multiline text field asking why delivery could not be completed. Disable **Save Failed Delivery** while the trimmed reason is empty; reject empty or whitespace-only reasons on the server with **Enter a failure reason**. Do not change the saved status until the reason and status are accepted together. Cancel retains the previous status.
- Store the failure reason with the status change, shipment, actor and timestamp. Show it in shipment details/history. Preserve the draft reason through back navigation and failed requests; submission failures keep the old saved status and support retry. During import, this is draft data until final Step 5 submission. Later status changes preserve previous failure reasons in history but do not require a new reason for Delivered or In transit.
- The Figma failure-reason overlay includes empty/disabled and entered/enabled states. Tapping its field simulates example text entry; real keyboard input, draft persistence, validation and saving remain mobile/backend implementation work.
- Step 5 revalidates matching against the **final chosen run**. Show current-run matching effects and new-run effects before final confirmation, within the same fifth step. A new run has no historical visits: remove automatic links from previous runs and reset only automatically inferred Delivered statuses to the normal initial status. Preserve deliberate driver status edits, explaining any validation conflict before submission.
- If final matching differs materially from what was reviewed (changed run, ambiguous visit, concurrent run change), keep the draft, explain the changed matches/statuses, and require confirmation within Step 5 or return to Step 4. Do not silently submit a changed result or add a sixth numbered step.
- Persist shipment creation, run assignment, existing-stop linkage and confirmed status together at final submission. Use the recorded visit time for an automatically inferred delivery time when reliable, keeping the later import time separate. Never fabricate proof-of-delivery photos, signatures or odometer readings.
- Existing duplicate shipments remain skipped and other-run shipments remain excluded. Matching does not authorise overwriting an existing shipment's status. Offer a separate authorised shipment-details update where appropriate.
- After upload, drivers can open an assigned shipment and use **Update status**. Show the current status and matched stop; validate the new status server-side, confirm success and refresh dashboard counts. Failure preserves the previous saved status and offers retry. Keep historical visit evidence when status is corrected; do not delete/rewrite the vehicle's visit history.
- Record status changes with old/new status, source (matched visit or driver), actor, timestamp and linked stop. A manual correction takes precedence over automatic rematching. Reopening a delivered shipment updates outstanding counts and future delivery planning without inventing another completed visit or closing the run.
- Figma shows an illustrative Melrose delivery visit at 09:42 and a status selector. Native per-shipment edit persistence, changed-match confirmation, post-upload status updates and server matching are now implemented; see the verification notes below.

### Step 5 — Current run or new run?

Ask **Is this delivery note for your current run or a new run?** after the shipments and locations have been confirmed.

- If a current run is available, show its identity/status and assigned vehicle, with **Use current run** and **Create new run** actions.
- If no current run exists, explain that and offer **Create new run**; do not offer a nonexistent current run.
- If multiple existing runs are eligible, selection must make the destination run explicit before submission. A ready existing run remains ready unless a lifecycle event starts it.
- Selecting the run previews its matching effects within Step 5. **Confirm & upload** commits that explicitly selected run after the driver can see the final statuses and endpoints. Disable repeated taps and show creation progress. Do not add a sixth review step.
- Preserve the locations already confirmed in Step 3 when choosing current versus new. Do not silently reload different endpoint defaults. If the selected run conflicts with the confirmed plan, explain the conflict and offer an explicit return to Step 3 or cancellation before saving.
- All earlier steps edit a draft only. No run, shipment, assignment or live trip-plan change is persisted until this final confirmation.
- Existing-run plan changes must preserve actual departure and recorded visits. Server-side authorisation, current run state and concurrent changes must be revalidated.

### Submission and upload completed (after the five steps)

- Revalidate driver/account ownership, selected run, assigned vehicle, both endpoints, quantities, shipment types, corrected data and duplicates.
- Create eligible shipments and attach them to the chosen existing run, or create a new **Ready to start** run. Save the confirmed trip plan with the import operation and refresh full Google road routing.
- Apply confirmed stop matches and delivery statuses, and report how many newly imported shipments were already delivered. Refresh delivered/remaining counts without duplicating visits.
- Skip existing duplicates; never silently move shipments from another run. Avoid empty runs when nothing can be created/attached.
- Use an idempotent/transactional strategy for double taps, retries and partial or uncertain responses. Preserve reviewed data on failure and offer retry using the same run choice.
- Missing vehicle assignment has a dispatch/retry path, never an arbitrary vehicle assignment.
- Only after successful processing, show **Upload completed**, a prominent success check icon, and truthful created/attached/skipped counts.
- Show one button labelled **Continue**. It opens the resulting current-run dashboard, reflecting the chosen run, its correct ready/active state, shipments, counts and confirmed route endpoints.
- Completion is a result screen, not Step 6. Figma file reading and native form inputs remain simulations/handoffs, not proof of implemented AI or backend behaviour.

## 8. Implementation handoff

### Implemented mobile/API contract (2026-09-16)

- The Expo dashboard now distinguishes initial checking, no run, ready, active, stale/error and awaiting-dispatch states. Existing map/sheet/filter behavior is retained; planned endpoints are included in the map and the planned end appears in All stops.
- Import follows upload → reading → locations → editable shipment review → current/new run selection. Step 5 previews each final status and uses **Confirm & upload** in that same step after explicit run selection. Nothing is committed by selecting a run alone.
- `/driver/document-imports/{id}/preview` returns scoped match proposals and a review token. Confirmation recalculates proposals, rejects stale matches, locks the driver/import/run and atomically saves the run, new shipments, assignment, status and audit events. Retries return the stored result.
- `runs.driver_workflow` opts imported/planned runs into departure-based start and dispatch-only closure. Ready maps to `draft`; active maps to `in_progress`. Manual fallback uses `/driver/runs/{run_uuid}/start`. Legacy automation remains unchanged for runs outside this workflow.
- `/driver/trip-locations/search` searches authorised saved locations first, then Google Geocoding. New results are driver-scoped draft selections cached for two hours and saved only at confirmation. Expired choices require reselection. Context includes a bounded saved-location list and current-run endpoints; search accesses the remaining facilities.
- Draft edits and selected location snapshots persist locally per authenticated user/import. Server validation always rechecks ownership and location coordinates. Shipment types follow the existing free-text parcel type contract (50 characters), rather than introducing a Box/Pallet-only enumeration.
- Recorded delivery events and completed visits at delivery facilities are eligible evidence. Repeated/ambiguous visits are not auto-matched. Manual status choices survive review; pickup/delivery odometer requirements are retained for manual changes. Failure reasons and previous status are recorded in history.
- Completion returns to the specifically selected/resulting run. All eligible dates attach; duplicates and excluded rows are skipped. Explicitly excluded unreadable rows do not block valid shipments.

**Verification:** 66 Laravel import, shipment, directions and lifecycle tests (419 assertions); TypeScript; focused ESLint; five map/filter unit checks; simulator inspection of checking, map/timeline, filter, expanded sheet and upload entry. The local MySQL migration was applied and upload context was checked against the simulator driver.

**Environment limits:** the local OpenAI key is absent, so live file extraction cannot be verified or used until `OPENAI_API_KEY` is configured. Extraction tests use mocked provider responses. Google routing/geocoding keys are configured, but address-search permissions and every full-route variant still need live service acceptance checks. Camera capture/permissions require a physical-device acceptance pass; simulator inspection is not proof of physical camera behavior. The mobile permission strings take effect in the next native build.

### Relevant implementation areas

- `mobile_app/app/(tabs)/index.tsx` — dashboard screen.
- `mobile_app/src/components/dashboard/` — map data, map rendering and stop filters.
- `mobile_app/app/shipments/load.tsx` and `mobile_app/app/shipments/imports/[import_id].tsx` — upload/review journey.
- `mobile_app/component/ui/` and `mobile_app/docs/bottom-sheets.md` — shared sheets and styling.
- `app/Http/Controllers/Api/V1/DriverDashboardController.php` — dashboard API work.
- `app/Http/Controllers/Api/V1/DriverDocumentImportController.php` and `app/Services/DeliveryNoteImportService.php` — import work.
- `app/Services/RunDirectionsService.php` — run routing work.

These are the implementation entry points. Preserve unrelated local changes and rerun the relevant regression checks when modifying this flow.

### Backend contract and regression checks

- Map the intended ready/active/completed/closed lifecycle to actual backend statuses.
- Confirm storage/API support for explicit run collection and planned end locations; agree migrations only after inspecting current models.
- Define location search/geocoding provider integration and validation of saved location ownership and coordinates.
- Define routing order and endpoint de-duplication when a shipment is at a trip endpoint. Include the return leg when applicable.
- Define endpoint updates for active runs, version/conflict checks, automatic departure detection and dispatch-only closure.
- Verify driver-scoped run selection, all-date import assignment, duplicate matching, idempotent retries and partial-failure recovery.
- Keep server keys/configuration on the server. Test with real configured services before claiming live AI or Google routing works.

- Define reliable recorded-visit matching, repeated-visit ambiguity, manual status overrides, delivery-time provenance and status correction permissions. Audit existing odometer/proof requirements; never fabricate required evidence.

### GPS history acceptance (1.27)

- [x] Admin marker colours/legend and latest dated mapped-stop car icon implemented; chronology and speeding deduplication regression tests pass.
- [x] Admin map outer card/title and introductory copy removed; map/timeline controls and contextual history states retained.
- [x] Timeline heading-to-slider margin reduced from 32px to 8px; timeline dimensions and controls preserved.
- [x] Option 3 trip slider implemented with whole-history pagination, gap states, keyboard/drag interaction and replay activity updates; fixture-browser verified.
- [ ] Requested real run verified after browser sign-in; live-data acceptance remains outstanding.
- [x] Admin markers expose recorded activity/location/duration context and independent activity-type toggles; duration/data-safety regression tests pass. Live browser interaction remains unverified.
- [x] Separate permanent history and deduplication receipts; configurable stop merging and delayed-sample handling.
- [x] Scoped admin/assigned-driver track endpoints; bounded windows preserve stop/segment boundaries.
- [x] Admin run and expanded Run KM maps consume history separately from lists/reports.
- [x] Admin recorded-map bounds include every located stop and displayed GPS segment; stops remain visible without history and recorded lines preserve gaps (map API fixture verified).
- [x] Mobile Planned / Recorded UI and foreground/visibility refresh guards implemented.
- [x] Retry, timestamp, authorization, large-dataset and concurrent-ingestion automated checks.
- [x] Figma default toggle, scenario notes, this plan and release notes updated.
- [ ] Native iOS/Android map/toggle/background/network-state interaction verified on a release build.
- [ ] Production database load, row-lock behavior, indexes, monitoring alerts and storage capacity verified before enabling flags broadly.

### Acceptance checklist

- [x] Only valid drawn polygons admit automatic location visits; outside/edge points and radius-only locations do not. Coordinate ordering, concave interiors, invalid geometry, repeated visits, overlap retention and polygon exits are regression-tested. Simulator uses verified polygon interiors. Historical records remain unchanged.
- [ ] Verify polygon-only overlays and nested tooltips on the live map and run spatial-storage checks against the deployment database engine before rollout.

- [x] Replay route grows/retracts to the selected time, preserves GPS breaks and restores full history on reset. Automated checks pass; live drag/keyboard visual verification pending.

- [ ] Verify the admin run page stays unchanged across timer intervals/tab switches and Refresh retrieves details, GPS and enabled geofences while retaining view state. Polling/focus triggers removed and static/loader checks pass; live browser verification pending.

- [ ] Verify nested/overlapping geofence tooltips list every containing location once regardless of overlay order. Geometry hit-testing is implemented and static checks pass; live visual check pending.

- [ ] Visually verify timeline dragging follows the replay car only when it moves off-screen, preserves zoom and does not pan for GPS gaps. Implementation and static checks complete.

- [x] Clear filter appears beside Time range only for an applied range and restores the whole trip/latest view. Static checks passed; live interaction verification pending.

- [x] Time range replaces Back to latest, provides four date/time fields, rejects outside-trip/reversed/empty ranges and narrows the replay slider. Whole trip resets the range. Automated boundary/replay checks pass; live visual review pending.

- [x] Geofence polygons use per-location colours, stable across toggles and partial loads for the same run location set. Static checks passed; live visual review pending.

- [ ] Verify geofence-name hover tooltips on the live map, including nested polygons and toggle-off cleanup. Implementation and static checks complete.
- [ ] Visually verify admin street-label readability at close zoom on the live map. Explicit dark fill/white outline is implemented; TypeScript and lint checks pass.
- [x] Admin geofences default on, automatically load stop-linked locations on mount and clean up independently of route/replay. Loader tests cover deduplication, cache reuse, partial failures/retry and cancellation. Live authenticated browser verification remains pending.
- [x] Admin Runs requests lightweight row summaries with unchanged table values, pagination and sorting; detail-only relationships are omitted. Verified with Run API tests; production timing pending.
- [x] Repeated positions and movement inside overlapping geofences retain one continuous visit and shipment until departure; leaving the active fence permits the next location visit and shipment. Verified by run-lifecycle regression tests.
- [x] Runs without a final destination expose Choose final destination in All stops; selection saves through a scoped bottom sheet and refreshes the planned end/route without changing lifecycle or overwriting a concurrent destination.

- [x] Initial loading contains only the indicator and checking message.
- [ ] No-run, ready, active, empty-run, completed, closed, failure and stale states are distinct.
- [x] Driver/run/account scoping prevents other drivers' data appearing or being mutated.
- [ ] Sheet positions work at 25/50/92%; map never shrinks below 50%; content and safe areas remain usable.
- [x] All stops, Shipment deliveries and Speeding events contain the correct events and empty states.
- [x] Counts exclude non-shipment events; multi-shipment visits and missing coordinates remain understandable.
- [x] Required/expired document notices are concise and navigate to Documents.
- [ ] Choose/Change document opens Photo, File, Camera and Cancel; each source invokes its corresponding native picker/camera, with cancellation and permission recovery preserving draft state.
- [x] Valid selection is required before Step 1 Continue; no recent uploads appear.
- [x] Steps run in order: upload → reading → confirm locations → confirm/edit shipments → choose current/new run → completed.
- [ ] Uploading, processing and reading use consistent sheet geometry, typography, spacing and indicator placement; long text and accessibility sizes do not overlap or clip.
- [x] Step 4 lists every detected shipment with quantity, type and per-shipment editing; saved draft changes appear in the list.
- [x] Unique recorded delivery visits on the chosen run link new shipments to existing stops and mark them Delivered; planned/pass-through/other-run stops do not.
- [x] Delivery status is separate from import eligibility, with matched location/time visible and ambiguous matches requiring review.
- [x] Driver status edits survive retries/rematching; both draft and post-upload updates are authorised, audited and reflected in dashboard counts.
- [x] Choosing a new/different run revalidates links and inferred statuses before submission; manual edits are retained and conflicts explained.
- [x] Duplicates/excluded records are not modified by automatic matching; reopening preserves factual visit history.
- [x] Every shipment card labels its date Collection date; the editable property and edit form use the same meaning without changing date values.
- [x] Drivers can select only Delivered, In transit and Failed Delivery, in both import review and post-upload status updates.
- [x] Failed Delivery requires a trimmed nonblank reason; client/server reject missing reasons, cancellation preserves status, and status/reason save together with an audit history.
- [x] Step 4 flags collection/start mismatches with shipment references and both locations; editing either side rechecks warnings while retaining the draft. Missing locations are not treated as a match.
- [x] Step 3 displays Run starting point and Planned end location with full addresses beneath the names; both update together when selection changes.
- [x] Step 4 warnings are inside affected cards, its summary reflects distinct shipments needing attention, and eligible cards open the status selector directly.
- [x] Step 3 lets the driver choose/change both trip endpoints.
- [x] Steps 3 and 4 each have one Continue action, without overlapping/hidden duplicates; Step 5 provides explicit current/new run submission actions.
- [x] Endpoint choices survive selection, review, back navigation and retry; choosing a run never silently replaces the confirmed endpoints.
- [x] Step 5 preserves confirmed endpoints and submits only after the explicit run choice; no earlier step creates a run or shipments.
- [x] Completion shows a success icon and one Continue button leading to the correct resulting run.
- [x] Invalid/unresolved endpoints receive clear guidance; a valid round trip with matching endpoints works.
- [ ] Google routing includes collection, shipment stops and the final leg to the chosen planned end.
- [x] Active-run plan edits preserve historical visits; changing an endpoint does not close the run.
- [x] Other-date shipments are included, duplicates skipped, and other-run assignments never moved silently.
- [x] Missing vehicle, no extracted shipments, invalid fields, AI failure and submission failure are recoverable.
- [x] Double taps and uncertain retries do not create duplicate shipments/runs or empty runs.
- [x] Success returns to the correct run with updated counts, timeline, trip endpoints and route.
- [x] Automatic start, manual fallback and dispatch-only closure are verified against real backend behaviour.
- [ ] README, Figma, tests, implementation status and release notes agree before completion.

## 9. Revision history

| Date | Version | Change |
| --- | --- | --- |
| 2026-09-22 | 1.41 | Require strict polygon-only location detection, fix WKT coordinate ordering, remove map radius circles and use verified polygon interiors for simulated arrival. Local regressions pass; production spatial/live visual verification pending. Historical records and mobile Figma unchanged. |
| 2026-09-22 | 1.40 | Draw the admin blue GPS route progressively with timeline selection, preserve gaps and restore the full route in latest view. Automated checks pass; live visual verification pending. Mobile Figma unchanged. |
| 2026-09-22 | 1.39 | Show admin run geofences by default and load their boundaries on mount. The switch still hides them. Static checks passed; live visual verification pending. Mobile Figma unchanged. |
| 2026-09-22 | 1.38 | Replaced admin map polling/tab-focus reloads with manual Refresh beside Geofences. Refresh updates run details, GPS and enabled geofences; mobile polling remains unchanged. Live browser verification pending. |
| 2026-09-22 | 1.37 | Hit-test every loaded geofence for hover names, including nested polygons/circles, deduplicating by location ID. Geometry loads on demand. Live visual verification pending; mobile Figma unchanged. |
| 2026-09-22 | 1.36 | Pan to off-screen replay car positions during timeline use, preserving zoom and remaining still for visible cars or GPS gaps. Live drag verification pending; mobile Figma unchanged. |
| 2026-09-22 | 1.35 | Added conditional Clear filter beside Time range to restore the whole-trip timeline/latest view. Admin-only; mobile Figma unchanged. |
| 2026-09-22 | 1.34 | Replaced Back to latest with a bounded trip time-range dialog, narrowed timeline and Whole trip reset. Range/replay tests pass; live visual verification pending. Admin-only; mobile Figma unchanged. |
| 2026-09-22 | 1.33 | Added a 12-colour geofence palette with stable assignment for the run location set and matching polygon/radius colours. Mobile Figma unchanged; live visual verification pending. |
| 2026-09-22 | 1.32 | Added geofence-name hover tooltips to admin polygon and radius overlays with pointer-safe rendering and cleanup. Static checks pass; live visual verification pending. |
| 2026-09-22 | 1.31 | Set explicit white label outlines and darker text on the admin run basemap to improve close-zoom street-name contrast. Live visual verification pending; mobile Figma unchanged. |
| 2026-09-22 | 1.30 | Added an off-by-default admin geofence switch with on-demand location fetches, polygon/radius overlays, caching and retry. Loader tests pass; live browser verification pending. Mobile Figma unchanged. |
| 2026-09-21 | 1.29 | Added opt-in run-list summaries and used them for the admin Runs table to avoid loading and transmitting detail-only data. Regression checks passed; production timing/deployment unverified. Figma unchanged. |
| 2026-09-21 | 1.28 | Retain the active location while its geofence still contains the truck; prevent overlapping fences from triggering premature exit/delivery and another shipment. Added regression tests; deployment and historical cleanup remain outstanding. No Figma UI change. |
| 2026-09-21 | 1.27 | Removed the admin map outer card and Recorded GPS heading; recorded the earlier introductory-copy removal. Timeline and contextual states retained; mobile Figma unchanged. |
| 2026-09-21 | 1.26 | Tightened the admin timeline heading-to-slider margin from 32px to 8px per user feedback; slider geometry and behavior unchanged. Mobile Figma unaffected. |
| 2026-09-21 | 1.25 | Implemented selected option 3 trip replay with paginated history, stop bands, gap handling and responsive activity summary. Removed the colour key and reduced the vehicle icon to 32px per review. Fixture-browser and automated checks passed; live run requires sign-in. Mobile Figma unchanged. |
| 2026-09-21 | 1.24 | Implemented colour-coded admin markers, speeding pins and latest mapped-stop car icon. Created three illustrative trip-slider mockups; slider implementation awaits design selection. Mobile Figma unchanged. |
| 2026-09-21 | 1.23 | Added admin marker detail popups and top-right activity-type filters, with observed/estimated/unknown duration provenance and overlapping event access. Shared Run KM maps inherit the behavior; mobile Figma designs are unaffected. |
| 2026-09-18 | 1.22 | Corrected admin recorded-map bounds to include all located stops and displayed GPS history; preserved stop visibility without route data and clarified route legend. TypeScript, lint and map fixture passed; live database verification unavailable. Mobile Figma behavior unchanged. |
| 2026-09-18 | 1.21 | Implemented separate GPS history, merged stationary observations, scoped bounded recorded-route APIs, admin maps and mobile Planned / Recorded mode behind staged rollout flags. Figma toggle/notes updated; native and production-capacity verification remain rollout gates. |
| 2026-09-17 | 1.20 | Removed the separate daily-delivery summary, progress bar and View shipments dashboard shortcut. |
| 2026-09-17 | 1.19 | Replaced app-owned native alerts with reusable message bottom sheets, preserving actions and dismiss behaviour. |
| 2026-09-17 | 1.18 | Tightened shipment links from 52-point spacing to 36-point rows with no inter-row gap; realigned curved branches. |
| 2026-09-16 | 1.17 | Added curved grey branches connecting each shipment link to the timeline rail, including shipments on the last stop. |
| 2026-09-16 | 1.16 | Applied a muted grey native basemap while preserving coloured route/truck/stop overlays. |
| 2026-09-16 | 1.15 | Added the missing-final-destination timeline action, shared location sheet, scoped atomic save, route refresh and concurrent-update protection. Figma scenario notes synchronised. |
| 2026-09-16 | 1.14 | Implemented approved mobile/API flow, transactional reviewed imports, trip endpoints, recorded-stop matching, driver status corrections, departure start and dashboard states. Documented runtime contract and live-service verification limits. |
| 2026-09-16 | 1.13 | Moved mismatch warnings into affected cards, added compact attention summary and direct status controls, and clarified Step 3 labels with full addresses. |
| 2026-09-16 | 1.12 | Swapped Steps 3 and 4: confirm trip locations before reviewing shipments. Added shipment collection/run-start mismatch warnings and correction paths; rewired Figma progression. |
| 2026-09-16 | 1.11 | Standardised all three Step 2 loading sheets with flowing content, aligned spinner, matching dimensions and reserved heading space. |
| 2026-09-16 | 1.10 | Added shared document-source action sheet: Photo, File, Camera and Cancel, selection previews, capture confirmation and permission/cancellation handling. |
| 2026-09-16 | 1.9 | Restricted driver status choices to Delivered, In transit and Failed Delivery. Added required failure-reason overlay, validation, persistence and audit requirements for draft and post-upload updates. |
| 2026-09-16 | 1.8 | Clarified shipment card dates as Collection date; added visible labels to all shared card variants and aligned the editable component property and edit form. |
| 2026-09-16 | 1.7 | Added recorded delivery-stop matching, automatic Delivered status, driver corrections before/after import, selected-run reconciliation and audit requirements. Extended Figma card/status picker and Step 5 matching explanation. Design only. |
| 2026-09-16 | 1.6 | Added explicit Collection and Deliver to address rows and editable component properties; separated delivery date from destination. Preserved per-shipment destinations across all eight instances. |
| 2026-09-16 | 1.5 | Converted shipment cards to editable Figma component instances with New/Existing/Excluded states. Split Quantity and Shipment type into separately labelled fields and properties. |
| 2026-09-16 | 1.4 | Redesigned shipment result cards with reference/status hierarchy, prominent quantity/type, muted date/destination, and a separate Edit action. Added scrolling card lists with an accessible Continue button. Figma/documentation only. |
| 2026-09-16 | 1.3 | Reordered import into five steps: upload, reading, confirm/edit every shipment with quantity/type, confirm locations, then choose current/new run and submit. Added success icon and Continue result screen. Supersedes the four-step order and its late shipment review. Figma/documentation only. |
| 2026-09-16 | 1.2 | Fixed Step 3 and review layout: removed embedded duplicate action buttons, separated the information header, and kept locations and one primary action in a flowing vertical layout. Figma/documentation only. |
| 2026-09-16 | 1.1 | Created this canonical README; added Step 3 collection and planned end selection, review persistence and full-trip routing requirements. Figma updated; no mobile/API runtime changes in this documentation task. |
| 2026-09-16 | 1.0 | Prior approved Figma dashboard plan: map/sheet states, run lifecycle, timeline filters, document reminders, upload/review and error recovery. Recorded here retrospectively. |
