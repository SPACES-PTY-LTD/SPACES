# Driver dashboard plan

Version: 1.91
Last updated: 2026-10-08
Status: Core mobile/API implementation is complete. GPS history and recorded maps are implemented behind disabled rollout flags. Targeted verification is recorded below; native GPS-map interaction, production load, live AI and physical-camera checks remain release gates.

## Purpose and maintenance

This is the canonical behaviour plan for the Spaces driver dashboard and delivery-note upload journey. Read it before changing the dashboard, its run APIs, routing, or document import flow. It describes the intended behaviour; it is not a claim that every requirement already exists in the app.

**Whenever the dashboard plan changes, update this README in the same task.** Update the relevant Figma screens, acceptance checklist, revision history, and implementation status together. Remove superseded requirements rather than leaving conflicting instructions. Record unresolved choices explicitly. Runtime/code changes also require an entry in `docs/release-notes.md`.

### Design references

- [Scenario guide and implementation notes](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=32-980)
- [Active-run dashboard](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-294)
- [No-current-run dashboard](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=28-213)
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

- Remove the secondary **Upload delivery note** and **Contact dispatch** rows from the dashboard. Retain the no-run primary upload action and the delivery-note-required notice; dispatch messaging is available through Messages.

- Use an Uber-inspired light grey basemap: pale grey land/parks, white roads, grey water and subdued readable street labels. Hide POI/transit clutter; keep route, truck and shipment markers in their existing colours. Centralise the native Google map styling in `mobile_app/src/components/dashboard/run-map-style.ts`.
- Show delivery counts in the current-run summary only. Do not show the separate Today’s deliveries summary, progress bar or View shipments shortcut on the dashboard; shipment navigation remains available through Runs → run details → shipments and dashboard timeline links.
- Map above a white persistent bottom sheet, with a visible but restrained shadow and drag handle.
- Default sheet position: 50%. Supported positions: 25%, 50%, 92%.
- At 25%, reveal more map. The map must never shrink below its 50% minimum; the 92% sheet overlays it.
- Keep the bottom navigation and scroll long sheet content without obscuring controls. Respect safe areas and the keyboard.
- App-owned information, confirmations and error dialogs use the shared `MessageSheet` built on `BottomSheet`, including non-location event details, dispatch contact, permission guidance, photo confirmation and action errors. Preserve all actions; execute them after sheet dismissal. Native operating-system permission prompts and pickers remain native.
- Android floating sheets leave a visible 16-point gap above the bottom safe-area inset so gesture and three-button system navigation do not touch the sheet. Dynamic height accounts for this clearance. Implemented locally; physical Android verification pending.
- Use shared `BottomSheet`, `PersistentBottomSheet`, `ActionSheet`, and sheet theme controls so styling can be maintained centrally.
- Modal upload sheets fit their content, growing only as needed and scrolling when content exceeds the available height.
- Do not restore the online/offline control or the avatar/name/role in the dashboard's top-right corner.

### Timeline location details (1.91)

Implemented locally: dashboard and run-detail timeline locations open `StopDetailsSheet` on the shared scrollable `BottomSheet`. Show the event kind in the short header, a prominent wrapping location name, full address, a rounded 200-point map preview with one coral location marker, and labelled local date/time metadata. Preserve optional departure time, planned **Not visited yet** and speeding/limit details. Dismiss through the shared 44-point close control, backdrop, swipe or Android Back; omit the generic oversized OK action. Preserve safe areas, long text and theme-aware surfaces.

Use shared `NativeMap` provider selection with a fixed close region; disable map gestures so the enclosing sheet can scroll. Mark the selected location, never the latest truck. Dashboard and run-detail stop payloads add nullable numeric `latitude`/`longitude`: use the scoped saved location for visits/planned stops, recorded event coordinates for speeding and unlocated physical stops. Validate coordinate pairs/ranges; zero is valid. Do not geocode or invent coordinates. Missing/invalid coordinates show **Map coordinates unavailable**, without claiming the saved location lacks coordinates; web retains its explicit mobile-map guidance. Reject foreign-account/merchant planned endpoints. For older API responses omitting both timeline coordinate fields, reuse an exact normalized name-and-full-address match from the stop’s linked authorized shipment locations or authorized trip endpoints only when every candidate supplies the same valid pair. Do not substitute a saved location for speeding, override explicit null/invalid coordinates, or use unrelated shipments. The live API omission is confirmed in the simulator; the William Nicol stop resolves its linked shipment’s saved coordinates. Unlinked legacy stops still need the API addition for maps.

Verification: the initial sheet/API change passed 37 Laravel tests (267 assertions). Provider/data-path follow-up passes 17 mobile map/provider/coordinate/filter tests, TypeScript, focused lint excluding the existing dashboard effect and recorded-map purity rules, and diff checks. iOS simulator verifies actual Apple map tiles, coral location pin and readable metadata for **Engen Isando - William Nicol Convenience Cntr**, plus dashboard map/markers. Close dismissal is verified. The [Figma scenario handoff](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=32-985) is aligned; no separate composed mockup is claimed. Android, Google-equipped builds, dark mode, large text and short-screen scrolling remain acceptance gates.

### Native map providers and recovery (1.91)

Implemented locally: share `NativeMap` across the dashboard and location preview. Probe registered Fabric (`RNMapsMapView`, `RNMapsGoogleMapView`) and legacy (`AIRMap`, `AIRGoogleMap`) views through `UIManager.hasViewManagerConfig`. Choose Google where available; choose native default Apple Maps on iOS when Google is absent. This is capability-based, not a simulator/Expo Go assumption. Android uses Google if registered and **Map unavailable** otherwise; it cannot use Apple Maps.

A scoped React error boundary marks a provider failed and selects the next available provider for every mounted map in this app session. An iOS **Use Apple Maps** control allows recovery from silent Google tile/key/network failures when Apple is available. Preserve markers, caller coordinates, routes and refs; refit the dashboard when the replacement map becomes ready. Google alone receives the custom neutral JSON style; Apple uses `mutedStandard`, with native light/dark appearance. Remove the old timeout diagnostic; elapsed time never triggers a provider change.

`react-native-maps` exposes map-ready/loaded callbacks but no general map/tile loading-error callback. Catchable React rendering errors can trigger automatic fallback; silent tile failures need explicit recovery. A native SDK crash cannot be caught by a React boundary, and no provider can guarantee tiles without network access. Do not claim full recovery from API-key, billing or native SDK crashes. Selection and failure-transition tests pass; automatic Apple readiness/tiles/pins are verified in the available iOS simulator. Google-equipped iOS recovery, Android, native error injection and dark mode remain release checks. Expo stays running on port 8097 with the existing `api.spaces.za.com` API environment; no deployment or production data edits are performed.

### Runs tab and history (1.83)

Implemented locally: **Runs** replaces the Shipments tab with a route icon and **Active / Completed** filters, defaulting to Active. Active includes assigned `draft`/`dispatched` (**Ready to start**) and `in_progress` runs, with in-progress first. Completed includes only `completed` runs ordered by newest closure time; cancelled runs are excluded. Deliveries completed or an end request awaiting approval do not move a run to Completed before dispatch closure.

Cards use the selected Bold route spine (1.89 below): reference, status, vehicle, connected locations, shipment/delivered/remaining counts and planned/start/completion date. Missing locations show Unknown; missing vehicle/time remain explicit. Use the shared fixed PageHeader, white canvas, grey cards, white endpoint panels and theme-aware dark surfaces. Support pagination, refresh, loading/empty/retry, retained stale results after refresh failure, and ignore superseded requests; reset results on filter/session changes and refresh on focus/foreground.

`/runs/[run_id]` shows summary, attached shipments and recorded timeline using the shared `RunTimeline` component. Active details offer **Open dashboard**, passing the selected run ID to existing dashboard selection/actions. Completed details and linked shipment screens are read-only: hide status/scan/POD/cancel/upload controls and retain scoped file reads/downloads. Shipment fields reflect current records, not historical snapshots. Preserve recorded physical visits without inventing stops or planned visits. `/bookings` redirects to `/runs`; shipment, scan and delivery-note import routes remain available.

API: driver-role `GET /api/v1/driver/runs?status=active|completed&page=…&per_page=…` defaults to active, 20/page (1–100), returning lightweight summaries with existing pagination metadata. `GET /api/v1/driver/runs/{run_uuid}` adds shipments/recorded stops. Optional `run_id` on shipment GET, driver shipment-file GET and file download authorizes reads through an owned completed run, including reassigned shipments; it grants no mutation access. Run reads scope driver/account/merchant and exclude removed assignments/deleted shipments and foreign related records. Inaccessible runs return 404; inactive/missing driver profiles cannot list runs. Shared `DriverRunDataService` preserves dashboard selection and stop grouping. No migration or lifecycle change.

[Figma Runs lists/details and dark example](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=187-1490) and reusable run summaries align with local code; navigation labels/icons updated across 69 existing screens. New static screen links could not be wired: Figma rejected the prototype navigation reaction. Fixtures are illustrative.

Verification: 61 focused Laravel tests (430 assertions), mobile TypeScript, five map/filter tests and new-screen lint pass. Legacy dashboard/shipment-detail lint passes with existing `react-hooks/set-state-in-effect` errors excluded. iOS verifies active list/pending notice, Completed empty state, run details, existing shipment entry and Open dashboard; no run/shipment mutations submitted. Completed-content, pagination, retry/network races, session-switch, Android and native dark checks remain acceptance gates. The Account theme switch did not change the simulator theme during this check; dark Figma surfaces were reviewed, but native dark verification is not claimed.

### Run-card route spine (1.89 — selected option 2, implemented locally)

[Option 2 — Bold route spine](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=194-2029) is selected and implemented locally in the shared list/detail `RunSummaryCard`. Retain the other four directions as references. Use 20-point outer corners/padding, 16-point section gaps, a white/dark inset route panel, coral start/current markers and solid route connector, a tinted current-location panel, dashed grey unknown future segment, three shipment-count columns and merchant-timezone date. Text and rows can grow without clipping; decorative rails stay 24 points wide and extend with growing rows. Bundle the eight exact light/dark Figma SVG assets locally.

When an incomplete run has no planned end, show **Starting point → Current location → Planned end / Unknown**. Known planned destinations retain the two-endpoint route. Current location uses the scoped run vehicle's last report only for an in-progress run, at/after its start and within the last 15 minutes, not in the future or logged in by another driver. Use supplied name/address or valid coordinates; missing/stale/unstarted data shows Unknown. Completed runs use **End point** only for an account/merchant-scoped `run_ended` event on that run/vehicle at its completion timestamp with an accessible location. Otherwise retain **Planned end** when known, or **End point / Unknown**. Never use a completed run's truck's present location, an unrelated last visit or a planned destination as actual finish evidence. The connector does not imply intermediate stops, distance, ETA or delivery completion.

API list/detail add nullable `current_location: {name, address, reported_at}` and `recorded_end: {location_id, name, address}`; reuse eager scoped vehicle data and one bounded recorded-end relation, without loading full GPS/activity histories. Fields are optional in Expo for compatibility with older responses. No migration or lifecycle change. The dashboard, shipment mutations and completed-history read-only access remain unchanged.

Verification: 63 focused Laravel tests (474 assertions), eight mobile route/map/filter tests, TypeScript, focused card/API lint and iOS production bundle export (including all eight route SVGs) pass. Figma selected component, five Runs list/detail/light/dark screen instances and dark completed reference align; editable SF Pro/vector structure and visual review pass. Native iOS/Android light/dark, long-address/large-text, navigation and asset-rendering verification remain pending because simulator UI access timed out; no native visual pass is claimed.

### Shipment-detail exploration (1.88 — awaiting selection)

[Five editable Figma directions and shared action sheets](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=196-1938): **1 Next stop**, **2 Guided checklist**, **3 Route itinerary**, **4 Compact manifest**, and **5 Shipment workspace**. Each direction has a 390 × 844 active-shipment view and a completed-run read-only view. These are static design proposals, not implemented app changes; no direction is selected. The existing mobile shipment page and approved dashboard screens remain unchanged.

The proposals replace the oversized black shipment banner with a compact full reference/status, reuse Spaces PageHeader/button instances, SF Pro and existing colour/spacing tokens, and keep one primary action visible above the bottom safe area. Destination, instructions and context-appropriate contact tools precede administrative metadata. Supporting detail scrolls; the bottom action area must not cover it. Active examples have 1/1 parcels scanned and In transit; completed-run examples preserve the supplied screenshot's current In transit status and 0/1 scan record. Run completion does not establish shipment delivery or scan completion. Fixture names/instructions/document references are illustrative, not extracted facts.

Reviewed sources: `mobile_app/app/shipments/[shipment_id].tsx`, `mobile_app/src/lib/api.ts`, website `shipment-detail-view.tsx`, `shipment-detail-actions.tsx` and `shipment-detail-content.tsx`. Useful website fields are location/company name, contact phone, pickup/dropoff instructions, collection date, delivery-note reference, parcel contents/weight/dimensions, files and recorded visits. Most are already in the driver resource; typed visit durations need contract review. Keep assignment, invoice edits, pricing and printing in admin. History, odometers and secondary references remain reachable without filling the first screen with metadata.

Shared proposed actions: Navigate to the selected collection/delivery address, Call location only when a phone exists, Scan parcels, Update delivery status, Add delivery proof, Upload shipment file, Message dispatch, and existing Cancel shipment under More actions with reason/confirmation. Preserve driver status choices Delivered / In transit / Failed Delivery, failure-reason validation, odometer requirements, upload/download authorisation and retry/error handling. Primary actions should follow actual progress: scan when collection scanning is incomplete, navigation while travelling, and explicit outcome recording at delivery; do not infer arrival or invent an ETA. No new mutation rights are implied by these designs.

POD improvement is a proposal: replace technical file-key/file-type entry with photo/file selection, preview, upload progress and retry, then attach the authorised upload result through the existing POD contract. Verify storage/upload compatibility before implementation; camera capture or handwritten signature is not claimed as shipped. Initial proof saving and status continuation stay disabled until required input/selection exists. Missing location/phone/POD/history and absent booking require clear states. Completed-run access hides scan/status/POD/cancel/upload mutations while retaining scoped files and history; use server-authorised capability/context, not display status alone. Current shipment fields are not historical snapshots.

Design verification: five directions, ten full-screen states, five shared action/validation concepts, 20 existing header/button instances in the main comparison, editable native text/vector layers, SF Pro family and horizontal overflow checks pass. Active layouts and completed Next stop state visually reviewed. Native implementation, live website visual review, prototype wiring, dark/large-text/small-screen states and action integration remain pending user selection. No runtime tests are required for this design-only addition.

### Tab page surfaces (1.82)

Runs, Documents and Account use white light-mode page backgrounds with soft grey `#F5F5F8` cards/loading/empty panels. Run filters use a grey track and white selected tab; nested run endpoint/document metadata panels use white for separation. Keep existing status/required/expired colours and action buttons. Dark mode retains a dark page with existing card/muted surfaces. Messages already uses a white canvas. Dashboard/map/sheets and document-upload modal styling are unchanged. Implemented locally; TypeScript and focused lint excluding the existing Shipments memoization warning pass; native surface review remains pending.

### Shared tab headers (1.81)

`PageHeader({ title, status?, leading?, action? })` is implemented locally on Messages, Runs, Documents and Account. Keep its 28-point bold accessibility heading and thin theme-aware divider fixed above scrolling body content, with 24-point side margins, 14-point top padding and 20-point bottom padding. Each screen applies the top safe-area inset once; the component adds none. Replace coloured introductory cards and marketing subtitles with page names. Keep Upload document at the top right of the Documents header and the account name in the profile-details card. Retain conditional Closed status on Messages and all filters, refresh, navigation, badges and actions. [Figma header component examples](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=175-1478) and Messages/Documents instances align.

Verification: mobile TypeScript passes. Focused lint passes with the existing Shipments `react-hooks/preserve-manual-memoization` warning excluded; its data-loading hook is unchanged. iOS light-mode Shipments/Documents/Account headers and document-upload form entry verified without upload. Remaining checks: all-tab scrolling/refresh, latest Messages keyboard, dark mode and Android. Simulator interaction was interrupted before these could be completed.

### Navigation and driver messaging (1.53)

**Messages UI (1.79, implemented locally):** Use selected [Figma option 1 — Calm conversation](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=169-1477). White/theme-aware canvas, Messages heading with a subtle divider and no user-name subtitle, an illustrated **No messages yet** state and first-message guidance. Only show the empty state after a conversation loads successfully. Omit the default composer helper text. Keep a rounded multiline composer with 44-point attachment/send controls, a disabled send button until text or a file is present, selected-file removal, sending/retry feedback and closed-chat guidance. Preserve chronological history, sender/time labels, older messages, private attachment downloads, polling and unread badges. Local Figma SVG assets ship with the app; retain existing tab icons. iOS simulator verifies empty state, icons, typing/clear/send gating and composer visibility above the keyboard; Android, dark-mode and file/send/retry interaction checks remain pending.


The five tabs are **Dashboard / Runs / Messages / Documents / Account**. Messages replaces Vehicles and opens the authenticated driver's private conversation with authorized merchant dispatch staff directly. Account includes **Vehicles assigned to me**, opening `/account/vehicles` with back navigation and the existing vehicle-detail links. Messages shows a red received-unread count badge (99+ above 99); hide it at zero. Refresh every ten seconds while foregrounded, on navigation/foreground and after read acknowledgement. Preserve required-document badges and all dashboard/run behavior.

Text and private attachments are available on mobile and website `/admin/messages`. Normal conversations use explicit active membership and remain website/API-only initially. Visible chat refreshes every ten seconds and on focus; stop background polling, ignore stale responses, and retain failed drafts. Notifications use generic text, authorize taps and suppress banners for the visible chat. See [messaging handoff](../../messaging.md) for access rules, API, storage and push rollout.

Implementation status: mobile/API/website and notification integration implemented locally; the new migrations are applied to local MAMP. Focused backend and client checks pass. Figma navigation updated across 61 dashboard/scenario screens and the guide describes account vehicle access. iOS simulator verifies direct chat entry, saving a local test message and account vehicle navigation. FCM/APNs credentials, rebuilt device clients, live push delivery, authenticated website visual review and production-engine concurrency remain acceptance gates; no production deployment is claimed.

## 2. Checking the driver's run

On dashboard entry, check the authenticated driver's current run. While the first check is pending, the sheet contains only a loading indicator and **Checking your current run…**. Do not flash an empty-run message or a previous driver's work.

| Result/state | Dashboard behaviour |
| --- | --- |
| No current run | Keep the map above the persistent bottom sheet, centred on the current assigned truck when GPS is known. Show **YOUR DAY**, **No current run**, the preparation guidance and a primary **Upload delivery note** button. Keep all five bottom tabs and the required-document badge available; document summaries live on Documents. |
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

- Consecutive automatic shipment guard (1.91, implemented locally): before creating a new geofence shipment, compare the candidate location ID with the latest `shipment_created` activity by insertion ID for the same account, merchant, vehicle and run. The activity location is the creation/delivery geofence, not the shared pickup location. Suppress a second consecutive creation there even if the earlier shipment's destination/reference changed, assignment was removed or shipment was soft-deleted. Keep the physical visit linked to the run without linking it to the edited/removed shipment. Existing per-run destination reuse, reference-based restoration and audited-cleanup protection remain in effect. Other delivery locations and later runs remain eligible; manual/imported shipments and driver-planned workflow are unchanged. Local lifecycle regression coverage passes; the supplied production example requires sign-in and has not been inspected or repaired. No Figma screen, control or interaction changes.

- Cleanup audit performance (1.44, implemented locally): reuse bounded run/location/polygon evidence snapshots within one audit, retaining per-shipment checks and fresh apply/restore validation. CLI reports processed counts; composite lookup indexes support shipment, creation-event, run-activity and entity-log queries. Cache changes no evidence rules; newly arriving history can make an audit stale and is rejected during apply. Production load verification remains pending; no Figma screen changes.

- Historical geofence shipment cleanup (1.42, implemented locally): the explicitly invoked `shipments:cleanup-geofence` command audits a bounded merchant/date/run scope against current drawn polygons, then applies only selected reviewed candidates, either named by UUID or explicitly selected together with `--all-candidates` (1.43). Original creation events and retained trip samples determine candidacy; later interior evidence keeps a shipment. Incomplete/compressed GPS, known polygon changes, open/ambiguous runs and operational/manual/billing evidence prevent cleanup. No cleanup occurs during deployment or ordinary detection.
- Cleanup soft-deletes eligible shipments/internal bookings, marks assignments removed and hides only their automatic shipment markers. Physical visits, runs and GPS remain. Durable batches record evidence/fingerprints and reversible changes; stale inputs and intervening restore edits are refused. Lifecycle cannot silently restore cleanup-deleted shipments. [Command usage and coverage limits](../../geofence-shipment-cleanup.md). Local command/API regressions pass; production execution and engine verification remain pending. This administrative command changes no Figma screen.

- Polygon-only detection (1.41, implemented locally): match a location only when the truck is strictly inside its valid saved polygon. Edges/vertices are outside; no radius or distance buffer is used. Ignore missing, malformed, degenerate or self-intersecting polygons. Convert WKT longitude/latitude into latitude/longitude correctly; support spatial production storage and SQLite WKT fixtures. Centre coordinates only break ties between containing locations, never establish membership.
- Apply this rule to future GPS processing only. Existing open visits exit through the normal workflow on the next outside sample, including visits previously retained by a radius. Do not rewrite past visits or shipments. Raw GPS, motion and speeding recording continues outside polygons. Stored radius metadata is retained but ignored.
- Admin simulated arrival requires a valid polygon and uses a verified interior point, including for concave polygons or a centre outside the fence. Missing/invalid polygons return validation errors. Existing manual simulated exit remains available.
- Verification: polygon geometry, lifecycle, tracking and simulator regressions pass locally; production spatial-engine and live map checks remain pending. No mobile Figma screen changes.

- Automatic geofence processing (1.45, implemented locally) tracks one continuous visit per containing polygon, including nested and partially overlapping locations. Each newly entered location runs its configured entry automation once; each departed polygon runs its normal exit workflow independently. Remaining inside an outer fence never suppresses an inner entry or closes the outer visit. Repeated samples reuse each visit and existing per-run/location shipments; re-entry opens a new visit while retaining shipment reuse rules.
- On one GPS update, process departures before new arrivals. New arrivals retain the existing collection+delivery, collection, delivery, other priority, then centre distance and location ID as execution order. All matches are processed, not just a winner. Existing merchant automation settings and driver-planned-run safeguards remain effective. Raw motion/speeding is recorded once per GPS sample. Existing visits are reconciled on the next sample; no history is replayed. Simulator reports the requested location when it has an open visit. No Figma controls change; live production verification remains pending.
- New runs created by upload start **Ready to start**.
- Automatically start when the assigned vehicle departs a collection point linked to the run.
- If the run has no linked collection point, departure from any recognised collection point can be the fallback. Newly prepared runs should use the explicit collection location chosen in Step 3.
- Retain **Start run** as a manual fallback.
- Delivering all shipments does not close the run. Dispatch closes it. Driver **End Run** submits a required-reason request for dispatch approval; the run remains active until approved.
- Arrival at the planned end does not itself close the run. Actual visit events and planned endpoints are different information.
- Define and verify departure detection, GPS quality, geofence thresholds and backend run-state mappings before implementing automatic start. No specific threshold is prescribed by this design.

### Active-run Actions (1.52)

**Actions** appears beside the timeline filter only for `in_progress` runs. Its shared action sheet contains **End Run**, **Edit Run**, **Add additional cost**, and Cancel. Open the selected form after dismissal. Preserve map, filter, timeline and navigation.

Actions button styling (1.55, implemented locally): use 10-point rounded corners and a thin soft grey `#dedee1` border matching the dashboard separators. iOS simulator appearance verified; Figma header aligned. Android visual verification remains pending.

- **End Run** requires a trimmed nonblank free-text reason (maximum 2,000 characters). **Request approval** records a request without closing the run. Show **End run requested — awaiting dispatch approval** and disable duplicate requests while pending. Rejection displays its reason and permits resubmission. Editing endpoints and adding costs remain available while pending.
- CRM runs list displays a Pending approval badge; run details show requester, time, reason and unfinished-delivery count. Authorised dispatch users approve only after explicitly confirming closure even with unfinished deliveries, or reject with a required reason. Approval can close an empty or unfinished run, sets `completed`/completion time and preserves shipment/booking statuses, assignments and recorded visits. No email notifications or automatic reassignment. Ordinary completion rules remain unchanged. Other supported closure resolves pending requests.
- **Edit Run** preloads the selected planned origin/end, with names and addresses. Reuse authorised saved-location/address search. Save both endpoints in one transaction; accept identical endpoints for round trips. Compare the original endpoint IDs under a run lock; stale conflicting edits receive 409 and must be refreshed/reviewed. Expired draft locations require reselection. Never rewrite departure times, physical visits or shipment destinations. Refresh the planned route after saving.
- **Shared location search (1.75):** Choose final destination and Edit Run planned start/end use `mobile_app/src/components/LocationSearchPicker.tsx`. All shared location searches automatically focus the rounded name/address input when opened (including Choose another location), ready for typing with the keyboard. Start/end search opens with an empty input and no initial result fetch. Keyboard Enter/Search accepts any nonblank query; share routable cards, paginated loading/deduplication, clear/reset, loading/empty/retry states, selection previews and native keyboard avoidance. Confirm with **Use starting point** or **Use planned end location** to update the edit draft; **Back to endpoints** discards an unconfirmed selection. **Save endpoints** still persists both endpoints together with existing conflict protection. Final destination retains its explicit save action. Implemented locally; mobile TypeScript and focused lint pass, Figma run-action handoff aligned; native iOS/Android interaction, keyboard and dark-theme checks remain pending.
- **Simple location scrolling (1.78):** All three location pickers use a regular React Native `ScrollView` and controlled native `TextInput`. The title, search field, results and feedback scroll together; no sticky/fixed search header or custom header/content measurement. Use a bounded sheet height, iOS keyboard avoidance and Android resize; disable sheet content-pan gestures in picker mode. Retain search, pagination, clear/retry and selection/save behavior. Implemented locally; TypeScript/focused lint pass; iOS simulator confirms visible typed text; search submission, keyboard/scroll and Android verification pending.
- **Add additional cost** requires **Description** (CRM `title`, maximum 255 characters) and **Amount (ZAR)**. Require a positive decimal-string amount with at most two fractional digits. Persist `source=manual`, `currency=ZAR`, actor and a unique retry UUID in the existing run-cost ledger; retries return the prior charge without duplication. No receipts or mobile cost edit/delete flow.
- Forms use shared keyboard/safe-area-aware sheets, preserve drafts on recoverable errors, disable duplicate saves and reset on driver/run changes. Focus/foreground and successful mutations refresh the dashboard; closure transitions to the next eligible run or no-current-run view.
- Driver contracts: `POST /driver/runs/{run_uuid}/end-requests` (`reason`); `PATCH /driver/runs/{run_uuid}/endpoints` (both selected endpoint UUIDs and nullable `expected_origin_location_id`/`expected_destination_location_id`); `POST /driver/runs/{run_uuid}/additional-costs` (`title`, decimal-string `amount`, `client_request_id`). Source/currency/geofence overrides are prohibited. All mutations require the active assigned driver and matching account/merchant/environment.
- CRM contract: `POST /runs/{run_uuid}/end-requests/{request_uuid}/review` with `decision=approved|rejected`, rejection `reason`, and `confirm_early_closure=true` for approval. Review requires existing run-update permission. Lock run/request, reject conflicting decisions and audit changes. Dashboard/run resources expose `end_request`; CRM summaries eager-load the latest request without embedding activity history.

Implementation status: mobile/API/CRM flows are implemented locally, migrations applied to the local development database. Targeted API regressions and Actions TypeScript checks pass. Full mobile and website TypeScript now pass after messaging dependencies and generated routes are available. iOS menu/form handoff, endpoint selection, reason gating, cost validation and cancellation are verified; Android native interaction, CRM authenticated visual review and production deployment remain acceptance gates. [Figma flow handoff](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0/Spaces-Driver-Dashboard?node-id=131-1445) uses existing component instances and SF Pro; the active-run header and scenario guide are aligned.

### Admin run shipments (1.90)

Implemented locally: the website run-detail **Shipments** card has a top-right **Add shipment** button for users with run-update permission on draft, dispatched or in-progress runs. The dialog supports reference search and selection of an existing eligible shipment, or **Create new shipment** using the shared pickup/destination/parcels form. Successful saves refresh the run table/counts. Keep failed drafts and show actionable errors; disable duplicate attachment submissions. Hide the action for completed/cancelled runs and viewers.

`POST /api/v1/runs/{run_uuid}/shipments` now accepts authorised additions to in-progress runs as `active` assignments; draft/dispatched assignments remain `planned`. Existing merchant/environment, terminal-shipment and other-active-run assignment guards remain enforced. Search excludes currently attached, terminal, different-environment and other-active-run shipments from returned matches. Backend validation remains authoritative. Repeated attachment does not duplicate assignments or change shipment status.

New `POST /api/v1/runs/{run_uuid}/shipments/create` validates the existing shipment-create payload and requires both run-update and shipment-create permission. Derive environment from the run, disable carrier auto-assignment and create parcels plus run assignment in one transaction under a run lock. Reject duplicate references with guidance to select the existing shipment. A failed attachment rolls back creation. Do not imply delivery, invent recorded visits, close a run or change the driver's mobile controls. Run detail adds `can_add_shipments` for action visibility; no migration.

Verification: targeted API/lifecycle/import tests, website TypeScript, focused lint and diff checks are recorded in release notes. Authenticated browser interaction remains pending. Existing mobile Figma screens and actions are unaffected; no corresponding admin shipment-card Figma design is referenced in this plan.

## 4. Map and full planned trip

Admin marker grouping (1.46, implemented locally): display one event pin per exact GPS coordinate. Preserve all original events in click details and replay; apply type filters before selecting a visible representative. Prefer the latest-stop car, then speeding, then stop events over GPS-only observations. Counts reflect distinct coordinate pins (type counts may overlap). Different coordinates remain separate. Local marker tests and static checks pass; live visual verification pending. Mobile Figma screens unchanged.

Admin Runs list performance (1.29, implemented locally): request the opt-in run-list summary for table rows. Do not load or transmit activity details, route stops, parcels, bookings or document imports for this table. Keep existing displayed counts, costs, dates, odometer/GPS distance fallback and shipment-based endpoint fallback. Load activity coordinates only for runs without complete odometers. Default API consumers and run detail remain unchanged. API regression tests cover summary parity and all sort columns; production latency/deployment remain unverified. No Figma screen or interaction changes.

Use Google map routing for road directions. The full planned trip is:

**Selected collection location → ordered shipment stops → selected planned end location.**

- Include the final leg after the last delivery; the planned end may be a depot, yard or another chosen location.
- A return to the collection location is valid. Do not reject it merely because the two endpoint locations match.
- Include shipment stops, the collection point and planned end in the route bounds and distinguish the endpoint roles.
- Show the truck's current GPS position when known. Do not show the old truck timestamp/status banner when the position is available.
- Without a current run, show only the assigned truck marker: no shipment pins, planned endpoints, route line, Planned/Recorded switch or route-information control. Resolve position independently through `GET /api/v1/driver/position`; refresh every 30 seconds while the dashboard is focused and foregrounded. Prefer the latest logged-in active truck scoped to the driver's account/merchant, then an unclaimed assigned truck. Never reuse another driver's truck or a closed run as a location fallback.
- When position is unavailable, show a clear unavailable state; do not fabricate a truck position. Demo coordinates belong only in clearly identified demo data.
- Put an info icon at the map's bottom right to show/hide route distance and estimated duration. Keep it at the visible map edge as the sheet resizes.
- Planned-trip distance/time includes collection through to the chosen end. If remaining-trip metrics are also added, label them separately; do not replace the full planned route silently with truck-to-next-stop directions.
- Missing coordinates must not remove a stop or shipment from the timeline. Keep its address and explain that its position is unavailable; omit its pin until resolved.
- A Google routing failure must preserve the run and timeline. Show a routing retry/unavailable state rather than treating a straight line as verified road directions.
- Do not infer that planned endpoints have been visited. Recorded visits and events remain factual history.

Map diagnostics (2026-10-07): development-only `[RunMap]` logs report platform/host, native Google view registration, layout size, ready/loaded events, coordinate availability and directions status. A 15-second missing-event watchdog is a diagnostic, not an SDK error. Do not log credentials, keys, run identifiers or raw GPS data. On the local iOS 26.1 simulator with Expo Go 57.0.9, Google never reported ready/loaded despite nonzero layout, valid truck GPS and ready directions. A temporary Apple Maps comparison rendered the same data; Google remains the configured provider. No Maps authorization error was captured. Verify Google with a rebuilt native app using the configured iOS key and `com.spaces.logistics`; native initialization remains unresolved in this Expo Go host. Screen design and routing behavior are unchanged.

Native map verification setup (2026-10-07): Expo development client and EAS development/device/simulator profiles are configured locally. The unsigned iOS simulator profile will test Google Maps with the app's own native configuration. After explicit user approval, both Maps keys and development API settings are configured on EAS and an Android development build retry is submitted (1fb1ff0a-dd1d-4929-98d8-1f1d3ae3c433). Build completion and successful native Google rendering are not yet verified. Existing map acceptance gates remain pending.

### Recorded GPS history (1.21)

Admin geofence names (1.32, implemented locally): hovering over a displayed polygon boundary shows a compact name tooltip beside the pointer. Hit-test all loaded polygons at the pointer and list every containing location once, so nested/overlapping geofences cannot conceal each other (1.37). Load Google geometry only when geofences are enabled. Use location name, then company/code, then “Unnamed geofence”. Render plain text; the tooltip must not intercept pointer events. Hide it on pointer exit, map dragging/zooming, toggle-off and cleanup. No mobile/Figma changes; live visual verification pending.

Admin basemap labels (1.31): use dark slate text with an explicit thin white outline so street names remain distinct from roads, land and route lines at close zoom. Implemented locally; live zoomed-map visual verification pending. Mobile Figma styles are unchanged.

Admin geofence overlay (1.30, implemented locally): a top-left Geofences switch starts on (1.39). Mounting the map automatically fetches each distinct location linked to recorded run stops/activities using the existing authorised location-details endpoint, with at most four requests in flight. Draw only saved polygons, with no centre-radius circles (1.41), in translucent colours from a 12-colour palette. Assign colours by the complete sorted run location-ID list so partial fetches/retries do not shift them; each location’s polygon uses its assigned colour. The palette repeats after 12 locations (1.33, implemented locally). Disabling removes overlays and stops queued loads; ignore late responses. Cache successful responses for this run/auth context and retry failures only. Changing run or auth resets to on. Preserve map viewport, marker filters and replay. Stack controls on narrow screens. These are current saved boundaries, not historical boundary snapshots or every location along the route. No mobile/Figma screen change.

**Temporary mobile visibility (1.59, implemented locally):** hide the **Planned / Recorded** buttons and keep the map in Planned mode. Retain the switch, mode state, Recorded rendering, lazy fetching, refresh and paging for later re-enabling via `SHOW_MAP_MODE_SWITCH` in `RunMap.tsx`. While hidden, Recorded history is not fetched by the mobile map. Figma switch is hidden and the handoff aligned; TypeScript/focused lint verification is recorded in release notes. Native visual verification remains pending. Planned routing and its distance/time information remain unchanged. Recorded uses a separate lazy route endpoint and the current truck position. Label it **Recorded GPS**; never run directions or road matching to fill missing roads. Break lines across gaps longer than five minutes. Keep explicit loading, empty, stale, disabled and recoverable failure states. Preserve prior data for the same run/window on refresh failure.

On mobile, refresh the active run every minute only while Recorded is visible and the app is foregrounded. Stop fetching when hidden/backgrounded. Bound each response to 2,000 displayed coordinates while preserving segment endpoints and stop boundaries; provide Earlier route / Latest route controls on mobile for large histories; admin maps aggregate the bounded pages for trip replay. Older activity-only traces must say **Limited historical data**. No history is embedded in the general dashboard payload.

Store GPS separately from business activities forever. Merge only newer stationary observations within five minutes, reported speed at most 3 km/h and within 25 metres of the original stop position; thresholds are configurable. Missing speed stays an individual point. Preserve original position/time and latest details/count. Serialize ingestion per vehicle and deduplicate retries. Keep delayed observations at their source times without rewinding live location or lifecycle. Associate by the actual vehicle/run interval; ambiguous samples stay unassigned and are logged. Do not change odometer totals or shipment-distance calculations.

Admin recorded maps fit all located run stops, stationary observations and the displayed GPS segments with padding. Keep stop pins visible while history loads or is empty, disabled or unavailable; report the route state separately. Draw each available GPS segment as a blue line without connecting missing history. This admin viewport correction is implemented and fixture-verified; live run verification is blocked by local database authentication. The referenced mobile Figma screens and their Planned / Recorded behavior are unchanged.

Admin marker inspection (1.23, implemented): clicking any run-stop, stationary-GPS or isolated-position marker opens its recorded context. Run stops show event type, location name/address/category, arrival/departure and duration, plus shipment, driver, vehicle, speed and departure reason when present. Complete visit intervals determine duration; stopped-to-next-moving transitions for the same vehicle/run provide explicitly estimated duration when available. Missing or invalid intervals remain unknown. GPS stationary duration is an observation interval, not a confirmed visit or inferred reason. Co-located pins expose all visible records at those exact coordinates. A top-right checkbox dropdown toggles activity types independently, with counts, Show all / Hide all and a clear all-hidden state. Filtering preserves the route, viewport and stop numbering. The shared Run KM map uses the same behavior. Existing Figma references describe mobile screens only; this admin-only addition does not change those designs.

Admin marker styling (1.24, implemented): collections are blue, deliveries green, other stops slate, speeding red with an exclamation mark and isolated GPS positions purple. Keep stop numbering, readable marker titles and matching filter swatches (the separate colour key was removed at the user’s request in 1.25). Include existing speeding activities without duplicating events already supplied as stops. A car icon identifies the latest dated, located stop in the available history; it is explicitly labelled **Latest mapped stop**, not live vehicle location. Select by visit/event start time, exclude speeding/isolated positions, omit when no usable dated stop exists, and expose its details on click. The car is independently toggleable in Marker types.

Admin trip scrubber (1.26, implemented): [selected option 3](../run-map/README.md) is a straight linear timeline footer with stop-duration bands, point-event dots, GPS gaps, selected date/time/time zone, Time range and a concise activity/location/duration summary. Render the admin map and timeline directly in the page without an outer Card or Recorded GPS heading. Omit the introductory route paragraph and generic incomplete-coverage notice; retain contextual timeline gap/error states. Keep an 8px margin between the heading row and the slider container. Dragging or keyboard adjustment updates a compact 32px replay car. When the car leaves the current viewport, pan to its position without changing zoom; keep the viewport still while the car is visible and do not pan across unavailable GPS positions (1.36, implemented locally). Confirmed visits and observed stationary intervals hold the car at their recorded coordinates; stopped-to-moving estimates are explicitly labelled. Unknown endpoints remain point events, not assumed ongoing stops. Interpolate only within valid GPS segments with sample gaps no longer than five minutes; hide the car when position is unavailable, including between paginated segments whose continuity is unproven. Stop context survives missing coordinates. The Time range dialog replaces Back to latest: separate From date/time and To date/time fields accept only a positive interval within the run start/completion bounds (recorded-time bounds when unavailable; latest recorded time for an active run). Apply narrows timeline ticks, events and gap bands and moves replay to the selected start; the route shows the journey from the trip start up to the selected replay time. Whole trip clears the range and restores the latest-stop view. A Clear filter button beside Time range is visible only while a range is applied; clicking it performs the same reset and hides the button (1.35, implemented locally). Use local time with the displayed zone, validate on submit and reset on run/auth changes. Implemented locally in 1.34; range/replay tests and static checks pass, live browser verification pending.

Admin progressive route (1.40, implemented locally): dragging or keyboard adjustment grows/retracts the blue route up to the selected time, with a smoothly interpolated endpoint within valid GPS segments. Keep earlier segments visible and future segments hidden; never connect across missing GPS history or invent a route to a stop coordinate. Latest view and clearing a range restore the full recorded route. Update existing polylines without resetting the viewport or rebuilding markers on each drag. Automated interpolation, rewind, reset and gap checks pass; live visual verification pending. This admin-only interaction does not change the referenced mobile Figma screens.

Admin history loads every available cursor page once when the map first becomes visible. Do not poll or refresh on tab-focus or viewport re-entry. A Refresh button beside Geofences explicitly fetches GPS history, refreshes the server-rendered run details without a full browser reload, and reloads geofence data when enabled. Disable the button while history or run-detail refresh is pending; retain map/filter/replay state. Also provide Refresh when no mapped positions exist (1.38, implemented locally). Preserve prior same-run data after failure; expose loading, partial, limited-history and retry states, and guard repeated cursors. History remains bounded per API response; older activity-only data may still be incomplete. Timeline data and selection are scoped by run/auth context. Filter changes preserve the timeline, route and viewport. The separate colour key is removed; colours remain in filter swatches and pins. The muted basemap follows the selected visual. The native map-only fullscreen control is disabled so replay controls cannot disappear outside fullscreen. Mobile Figma screens and mobile paging are unchanged.

Verification: fifteen focused marker/replay tests, website TypeScript and focused lint pass. Browser fixture checks cover desktop/mobile layouts, drag and keyboard replay, movement, stationary delivery context, GPS-gap hiding, Back to latest and marker filtering; no browser console errors. The requested real run requires browser authentication and has not been verified with its live data. A development-only preview at `/dev-run-replay-preview` uses labelled illustrative data and returns not found outside development.

Implementation: migration, ingestion, scoped API and admin/mobile consumers are implemented behind independent recording/display flags, both default off. Figma active-run map retains the temporarily hidden toggle; its scenario handoff documents Planned-only visibility and retained Recorded behavior. Native device behavior and production-engine load checks remain rollout gates. See [capture contract, rollout and monitoring](../../vehicle-location-history.md).

## 5. Timeline

Replace the single next-delivery card with the current run timeline and a summary of shipment counts. Show all recorded run stops, including collection stops and stops without shipments. Follow recorded chronology, then show outstanding planned delivery stops in run order.

Implementation fix (1.51): use the shared Gorhom floating bottom action sheet with dynamic sizing, rounded outlined options, safe-area spacing, optional handle/close controls, Cancel and swipe/backdrop dismissal. Present after populated content commits; run actions after dismissal. A scoped Babel compatibility transform replaces Gorhom references to the removed React Native 0.86 `StyleSheet.absoluteFillObject` alias with `StyleSheet.absoluteFill`, restoring container/background/backdrop layout without editing installed dependencies. This supersedes the 1.50 native-modal workaround and restores the existing intended Figma filter flow. iOS Expo Go simulator verifies the floating card/dimmed backdrop, reopening/selection, both filters and Cancel preserving the filter. TypeScript, focused lint and scoped Babel transform checks pass; Android/web, swipe/backdrop interaction and document-source handoff remain rollout checks.

The **Filter timeline** button sits beside the timeline-entry count below the shipment summary. **Actions** remains beside **Current run**. The filter offers:

| Filter | Includes |
| --- | --- |
| All stops | Collection visits, delivery visits, other recorded stops, speeding events and planned deliveries. Show the planned end as an explicitly planned endpoint, never as a completed visit. |
| Shipment deliveries | Only stops where delivery occurred or is planned. A collection-only stop does not qualify just because shipments were collected there. |
| Speeding events | Only speeding events. |

- Collection icon circles are blue; delivery circles green; speeding circles red; other stops grey. Use labels/symbols as well as colour.
- For a combined collection/delivery visit, show the delivery role in green and retain its collection detail. This follows the existing event-colour convention.
- Group shipments sharing one physical stop without duplicating the visit. Each shipment link branches from the main grey timeline rail with a thin grey curved join, aligned to the link centre. Keep joins decorative and shipment links independently tappable in a compact group (36-point minimum row height, no extra gap between shipment rows; grow for wrapping text). Extend the rail for child shipments even on the last stop.
- Dashboard and run details use the same `RunTimeline` presentation. The component owns a single container for all event rows so screen-level section gaps never separate rails. Keep identical markers, typography, row spacing and shipment branches while retaining each page's data and navigation. Implementation (1.86): shared container implemented locally; TypeScript and focused lint pass. Native visual verification remains pending because the simulator host is locked. [Figma Runs handoff](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=191-1602) aligned.
- Speeding details include recorded speed, speed limit, time, location and duration when available. Missing values remain unavailable, not zero.
- Opening an event shows the corresponding stop, shipments or speeding details. Returning should retain filter and scroll position.
- Every filter has a clear empty state. Filtering the timeline must not silently remove locations from the full planned route.
- When an assigned run has no planned final destination, append a grey flag entry to **All stops** labelled **Planned final destination**, with **Choose final destination**. It is a planning action, not a visited stop or shipment; exclude it from Shipment deliveries and Speeding events. Show it even when there are no recorded stops.
- The button opens the shared bottom sheet with a fully rounded pill-shaped icon-led name/address search field without a separate Find a location label, an initially empty list with no location fetch and keyboard Enter/Search submission for any non-empty query length, without a separate search button or minimum-length hint, and compact left-aligned location cards with 10-point padding/gaps and a 70-point minimum height under Search results (heading visible only when matches exist), without a Select one to continue hint, with pin icons, distinct name/address typography and chevrons. Selection shows a highlighted flag/check preview, full address, a primary **Save final destination** action and **Choose another location**, without the Your run’s planned end… explanation. Support light/dark themes and keyboard-aware input; a native ScrollView and TextInput use iOS keyboard avoidance and Android resize, with the search field scrolling naturally with results; preserve clear loading, empty, retry and disabled states. Search results load in pages of 20 saved locations; nearing the list end appends the next page with a Loading more… indicator inside a reserved 120-point footer with 16-point bottom padding, keeping loading/retry visible at the scroll boundary. Preserve loaded results on page failure with retry, deduplicate by UUID and ignore obsolete searches. Geocoding fallback is a terminal result set. Save only after explicit selection; allow dismissal without changes and preserve selection on retry. Require authorised, routable locations. Refresh the map route and timeline after saving, replacing the action with the planned end entry. Do not change run status, origin, shipment addresses or recorded visits. A destination saved concurrently must not be overwritten; show a conflict and refresh guidance.
- API: `PATCH /driver/runs/{run_uuid}/final-destination` with `destination_location_id`. The run must still be active/ready and assigned to the authenticated driver. Repeated saving of the same location is idempotent; a different pre-existing destination returns 409.

- Counts refer to shipments, not stop/event rows; a speeding event or planned end does not increase shipment totals.

## 6. Driver document summaries

Show required and expired document summary tiles below the fixed Documents header and above the compact uploaded file list. The header has a top-right coral **Upload document** action. Do not show either summary card in the dashboard sheet.

- Show the count and **Required uploads** only when the authenticated driver's confirmed `missing_required_count` is greater than zero. Tapping it opens the existing Upload document form.
- Show the count and **Expired document(s)** only when confirmed `expired_count` is greater than zero. Full replacement guidance lives on document details.
- Use singular wording for one document; hide each summary at zero or before its first count is known.
- Keep the red numeric Documents tab badge using the same missing-required count. Active driver file types without an uploaded file remain applicable requirements, including dispatch-managed types; inactive/deleted types are excluded.

Share both server counts in the session-scoped mobile provider. Refresh on dashboard return/refresh, Documents return/list refresh, successful upload and app foreground. Clear on session changes, ignore superseded responses and preserve confirmed counts on refresh failure. Missing and expired counts reflect the driver's applicable requirements and expiry dates. Keep summaries nonblocking; do not add a run-start/upload lock.

Implementation (1.84, implemented locally): selected [simplified Figma option 1](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=184-1485) uses conditional summary tiles and compact tappable rows with document type, filename, expired status and chevron. `/documents/[file_id]` loads the authenticated driver's file list and resolves the UUID, keeping Documents selected in the tab bar. Details has a back icon beside its heading, full metadata, expiry guidance and authorized Download with loading/error feedback. Preserve upload form, counts, refresh and white/theme-aware surfaces; dashboard unchanged. TypeScript, focused Documents/header lint and diff checks pass; native verification is recorded in release notes.

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

### No-current-run dashboard (1.47)

- Implemented locally: primary upload action and no-run copy match the existing Figma screen; dispatch contact and bottom tabs remain available; document summaries moved to Documents in 1.49. The persistent sheet uses native layout with a draggable/tappable handle and 25/50/92% snap positions, avoiding the invisible initial third-party sheet. Native scrolling retains pull-to-refresh and long content.
- Truck position no longer requires a run. The new scoped position endpoint uses existing vehicle GPS fields and the same coordinate validation as the run-position endpoint. Missing assignment, missing GPS and request failure have explicit states; no demo position is used at runtime.
- Existing Figma no-run screen now includes an illustrative truck marker, dispatch contact and a conditional Documents tab badge. The example count is illustrative; runtime uses actual document counts.
- Verification: 30 driver API regressions (191 assertions) pass. Simulator and final static verification are recorded in the release notes; native active-run/map gestures remain separate acceptance gates.

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
- [x] Mobile Planned / Recorded functionality and foreground/visibility refresh guards retained; switch hidden and effective mode forced to Planned while `SHOW_MAP_MODE_SWITCH` is false.
- [ ] Verify on native devices that both mode buttons are absent and the planned route/truck/route information remain usable.
- [x] Retry, timestamp, authorization, large-dataset and concurrent-ingestion automated checks.
- [x] Figma default toggle, scenario notes, this plan and release notes updated.
- [ ] Native iOS/Android map/toggle/background/network-state interaction verified on a release build.
- [ ] Production database load, row-lock behavior, indexes, monitoring alerts and storage capacity verified before enabling flags broadly.

### Acceptance checklist

- [x] Dashboard and run-detail timelines share a dedicated location sheet with event/name/address hierarchy, local time, planned/speeding metadata and a real-coordinate map pin or explicit unavailable state.
- [x] Driver API tests verify scoped location coordinates, zero/missing/invalid pairs, recorded speeding positions and foreign planned endpoint exclusion.
- [x] iOS native dashboard tiles/markers and William Nicol stop preview tiles/coral pin/metadata/close verified; live timeline omits coordinate fields and the stop resolves an exact linked saved-location match.
- [x] Capability-based Google/Apple/unavailable selection, scoped render-failure recovery and legacy coordinate matching pass 17 mobile tests; no timer-based switching.
- [ ] Verify Google-equipped iOS automatic/manual recovery, Android Back/safe areas, unavailable-native-map states, dark mode, long text and short-screen scrolling.


- [x] Consecutive automatic creation at the same delivery geofence is suppressed using scoped creation history after destination/reference edits, assignment removal or soft deletion; physical visits remain recorded.
- [x] Different delivery locations sharing a pickup and the same delivery location on a later run remain eligible; existing reuse and driver-planned safeguards retain regression coverage.
- [ ] Verify the reported production run and real telemetry after authorised deployment; no production data changes are part of this fix.


- [x] Admin run Shipments card supports existing selection and transactional creation/attachment for authorised open runs, including in-progress runs.
- [x] API guards reject terminal/foreign/different-environment/other-active-run shipments, closed runs and viewers; creation failure rolls back and duplicate reference is explicit.
- [ ] Verify authenticated desktop/mobile-width admin dialog, search, creation drawer, error recovery and refreshed table/counts against live data.

- [x] Five editable shipment-detail directions include active and completed-run states, shared driver actions and website-informed field priorities.
- [ ] User selects a shipment-detail direction before implementation; verify capability gating, primary-action rules, native POD upload contract, light/dark/accessibility layouts and validation/retry behavior.

- [x] Five connected-route run-card design options include completed and active/unknown-end states in Figma.
- [x] User selected Bold route spine; list/detail implementation and scoped current-location/recorded-end data are complete locally.
- [ ] Verify selected card on native iOS/Android in both themes, including long addresses, large text, assets and navigation.

- [x] Shared timeline owns event-row spacing; run detail section gaps cannot break the rail between stops.
- [ ] Compare dashboard and run detail timelines on iOS/Android, including wrapping addresses, multiple shipment links and dark mode.

- [x] Shared final-destination and planned start/end search inputs request focus automatically on opening and when returning from selection.
- [ ] Verify automatic focus/software keyboard on physical iOS/Android devices.

- [x] Documents uses the selected compact list, top-right Upload document, conditional summary tiles and a separate authorized details page with a back icon beside its heading.
- [x] iOS Documents list/details/back and top-right upload-form entry verified without upload.
- [ ] Verify Documents download/error states, dark mode and Android.

- [x] Runs replaces Shipments; Active includes ready/in-progress and Completed includes dispatch-closed history, with paginated driver/account/merchant-scoped APIs.
- [x] Run details share recorded-stop grouping/presentation, preserve shipment navigation, and support read-only completed-run shipment/file reads after reassignment.
- [x] iOS active/pending summary, Completed empty state, run details, shipment navigation and Open dashboard verified without mutations.
- [ ] Verify native completed history/read-only files, ready runs, long-list pagination, refresh/retry, out-of-order responses and session changes on iOS/Android in both themes.
- [ ] Wire Figma Runs prototype navigation when the connector accepts screen destinations; static designs and handoff are present.


- [x] White Shipments/Documents/Account light-mode backgrounds with soft grey cards and contrasting nested panels; dashboard styling unchanged.
- [ ] Verify page/card contrast and selected shipment filters in native light/dark modes.


- [x] Four tabs use the shared fixed, accessible PageHeader; safe-area inset is owned by each screen.
- [x] Retain document upload below the divider and account name in profile details.
- [ ] Verify all four tab headers while scrolling/refreshing, in dark mode and on Android; recheck Messages keyboard after extraction.


- [x] Messages header omits the user-name subtitle while retaining conditional closed status.
- [x] Implement selected Messages option 1 with illustrated empty state, theme-aware bubbles and rounded attachment/send composer.
- [x] Verify iOS empty state, bundled icons, typing/clear/send gating and keyboard-visible composer without sending a test message.
- [ ] Verify Messages dark mode, Android keyboard behaviour and attachment/send/retry/closed states on devices.


- [x] Edit Run uses compact themed endpoint cards with inline Change/Choose and clear Save/Cancel; iOS layout reviewed without saving.
- [x] Secondary Upload delivery note and Contact dispatch rows are removed; no-run primary upload and required-note notice remain.
- [x] Filter timeline sits beside the timeline-entry count; Actions remains in the Current run heading row.
- [x] Messages tab unread badge counts received live messages, clears on read and resets between sessions; foreground polling pauses in background.
- [x] Messages replaces Vehicles in the third tab; Account → Vehicles assigned to me retains assigned-vehicle details and back navigation.
- [x] Driver chat and normal membership/merchant isolation, private attachments, retry deduplication and closed conversations are covered by focused backend tests.
- [x] Figma dashboard/scenario navigation and guide agree with the new tabs and account vehicle access.
- [ ] Verify website chat/member controls in an authenticated browser and production MySQL concurrency under load.
- [ ] Configure FCM/APNs, rebuild signed clients and verify foreground/background/terminated notification delivery, authorized taps, permission denial and logout on iOS/Android devices.

- [x] No-run truck location is available through a driver/account/merchant-scoped endpoint without an active run; invalid GPS and other drivers' vehicles are excluded by regression tests.
- [x] Native simulator verifies the visible persistent sheet, initial loading/error states, five tabs, 25/50/92% resizing and handle drag.
- [x] Local pending migrations applied; `vehicle_activity.geofence_cleanup_batch_uuid` exists and simulator dashboard retry loads the current run and five-required-documents notice.
- [ ] Verify live no-run truck GPS and notification/upload/dispatch actions with a driver without a current run; the simulator's current driver has an active run.

- [x] Coincident map events share one visible pin; all details remain accessible, filters reveal remaining types and nearby distinct positions remain separate.

- [x] Repeated audit shipments reuse trip evidence, preserve classifications and reject newly changed GPS during apply; cache clears between audits and CLI reports progress.

- [x] Cleanup audit is non-destructive to domain data, scoped and evidence-based; apply requires explicit reviewed candidates via shipment UUIDs or `--all-candidates`; all-candidate selection remains audit-scoped and revalidates every row. Cleanup/restore preserve physical history, reject changed records and prevent silent resurrection. Command, rollback, report/run/booking visibility and regression tests pass locally.
- [ ] Verify cleanup reports against a real selected run and production-engine transaction/spatial behavior before any production apply.

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
- [x] Nested/overlapping polygons retain independent visits and automation; repeated interior samples do not duplicate shipments, inner exits leave outer visits open, and simultaneous arrivals use deterministic priority. Lifecycle regression tests cover three nested fences and collection/delivery ordering.
- [x] Runs without a final destination expose Choose final destination in All stops; selection saves through a scoped bottom sheet and refreshes the planned end/route without changing lifecycle or overwriting a concurrent destination.

- [x] Initial loading contains only the indicator and checking message.
- [ ] No-run, ready, active, empty-run, completed, closed, failure and stale states are distinct.
- [x] Driver/run/account scoping prevents other drivers' data appearing or being mutated.
- [ ] Sheet positions work at 25/50/92%; map never shrinks below 50%; content and safe areas remain usable.
- [x] All stops, Shipment deliveries and Speeding events contain the correct events and empty states.
- [x] Counts exclude non-shipment events; multi-shipment visits and missing coordinates remain understandable.
- [x] Required/expired summaries appear below the Documents header; neither card appears on the dashboard. Required notice opens Upload document; expired guidance points to the files below.
- [x] API summaries distinguish missing requirements, completed uploads and no configured driver document types (2 regression tests, 10 assertions).
- [ ] Visually verify Documents required summary and tab badge share the count, disappear at zero, refresh after uploads/foreground, and clear across driver sessions on native devices.
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
- [x] Automatic start, manual fallback and dispatch-only closure remain covered by backend regressions; driver End Run requests approval rather than closing directly.
- [x] Active-run Actions, required reasons, pending/rejected state, early dispatch approval and idempotent decisions have API coverage.
- [x] Actions button has 10-point rounded corners and a thin soft grey border; iOS simulator and Figma appearance reviewed.
- [x] Atomic endpoint changes enforce scope, round trips, stale-edit conflicts, expired selections and rollback; existing route keys refresh planned directions.
- [x] Manual ZAR costs validate exact decimal values and prevent duplicate retries.
- [ ] Verify CRM runs badge/review UI with authenticated dispatch, Android native form/keyboard handoff and production database concurrency.
- [ ] Verify foreground dispatch-approval refresh and next/no-run transition on native devices.
- [ ] Bottom action sheet opens/reopens with selected state, filters timeline correctly, cancels without changes and dismisses by swipe/backdrop; verify Android/web and document-source picker handoff.
- [ ] README, Figma, tests, implementation status and release notes agree before completion.

Edit Run presentation (1.72, implemented locally): show compact bordered start/end cards with map/flag markers, inline Change/Choose buttons and distinct name/address text. Use a soft context notice, rounded primary Save endpoints and neutral Cancel. Preserve endpoint validation, optimistic conflict checks and existing selection behavior. iOS layout reviewed without saving; Android/dark-theme verification pending.

Additional cost presentation (1.74, implemented locally): use a soft expense notice, rounded themed description and amount inputs, an example expense placeholder, a prominent amount with an R prefix and cents hint, and red focus borders. Retain Description and Amount (ZAR) labels, the 255-character description limit, exact positive-decimal validation and retry protection. Use a rounded plus/Add cost action with a saving indicator and no bottom Cancel button; dismiss with the header close control, backdrop or swipe. Lock inputs and dismissal while saving. Existing Figma cost-sheet examples and native handoff are aligned. Mobile TypeScript and focused lint pass; native keyboard/layout and dark-theme verification remain pending.

- [x] Additional cost form uses themed rounded inputs, explicit rand currency styling and a single Add cost action without a bottom Cancel button; Figma examples/handoff aligned.
- [ ] Verify additional cost field focus, large text, keyboard visibility, saving/error states and light/dark appearance on native iOS/Android.

- [x] Final destination and Edit Run start/end share one location-search component with keyboard search, paginated cards and explicit selection confirmation.
- [ ] Verify shared start/end search, pagination, clear/retry, preview/back and endpoint-save behavior on native iOS/Android in light/dark themes.

- [x] Shared location pickers use a regular native ScrollView/TextInput, without sticky headers or header measurements.
- [ ] Verify native typing/backspace, clear/search submission, keyboard avoidance and long-list pagination on iOS/Android in light/dark themes.

## 9. Revision history

| Date | Version | Change |
| --- | --- | --- |
| 2026-10-08 | 1.91 | Consolidate location-details sheet, capability-based Apple/Google recovery, exact authorized legacy-coordinate resolution and the consecutive automatic-shipment guard into the saved main working tree, preserving existing v1.90 work. Native iOS dashboard/selected-stop tiles/pin/close verified; combined checks recorded in release notes. Other device/provider checks remain gates. |
| 2026-10-08 | 1.90 | Add admin run-card Add shipment with existing search and atomic new-shipment creation; permit authorised in-progress attachments, retain scope/status/assignment guards and expose capability. API/static verification recorded in release notes; live browser checks pending. Mobile Figma unaffected. |
| 2026-10-08 | 1.89 | Implement selected Bold route spine card in Runs list/details with connected endpoints, highlighted current location, explicit Unknown future end, three counts and light/dark assets. Add scoped recent-current/recorded-finish API fields; preserve lifecycle/history rights. 63 Laravel tests/474 assertions, eight mobile tests, TypeScript and focused lint pass; native UI verification pending. |
| 2026-10-08 | 1.88 | Add five unselected shipment-detail directions with active/completed views and shared driver-action concepts, informed by mobile/website sources. Editable layers and visual/layout checks pass; implementation awaits selection. |
| 2026-10-08 | 1.87 | Add five unselected run-card route designs with connected start/end markers and explicit current location plus unknown planned end for active runs. Editable components and visual comparison verified; app/data contract work awaits selection. |
| 2026-10-08 | 1.86 | Keep dashboard/run detail timeline rows inside one shared container so detail section gaps do not break connecting rails. TypeScript/focused lint pass; Figma handoff aligned; native visual verification pending on locked host. |
| 2026-10-08 | 1.85 | Automatically focus the shared location search input when opened or returning from selection. Native autofocus preserves existing keyboard avoidance and search flow; device keyboard verification pending. |
| 2026-10-08 | 1.84 | Implement refined Documents option 1: header upload, summary tiles, minimal tappable rows and nested details with back icon/full metadata/authorized download; preserve dashboard and badges. |
| 2026-10-08 | 1.83 | Replace Expo Shipments with Runs; add paginated active/completed summaries, detail/timeline and scoped read-only shipment/file history. Preserve dashboard/lifecycle. 61 Laravel tests/430 assertions, TypeScript, five map/filter tests and focused lint pass with legacy effect rule excluded; iOS active/empty/details/navigation verified. Figma static designs/navigation aligned; prototype-link and remaining native acceptance gaps recorded. |
| 2026-10-08 | 1.82 | Use white Shipments/Documents/Account canvases, soft grey cards and white nested panels/selected filters; preserve dark mode, status colours and dashboard. TypeScript/focused lint excluding existing memoization warning pass; native review pending. |
| 2026-10-08 | 1.81 | Extract shared fixed PageHeader for Messages/Shipments/Documents/Account; remove introductory cards, retain upload action and profile name. TypeScript and focused lint excluding existing Shipments memoization warning pass; iOS light-mode three-tab/upload entry verified, remaining native checks pending. |
| 2026-10-08 | 1.80 | Remove the user-name subtitle beneath Messages; retain conditional closed status and message sender labels. Selected Figma aligned; TypeScript/focused lint pass. |
| 2026-10-08 | 1.79 | Implement selected Messages option 1: centred empty state, rounded composer with attachment/send controls, theme-aware history and draft/closed feedback. TypeScript/focused lint and iOS empty/input/keyboard checks pass; Android, dark mode and file/send/retry checks pending. |
| 2026-10-08 | 1.78 | Simplify location pickers to native ScrollView/TextInput; remove pinned headers, render callbacks and custom header sizing. Search and results scroll naturally; preserve pagination/confirmation and native keyboard avoidance. TypeScript/focused lint pass; iOS typing visibly confirmed, search/scroll/Android checks pending. |
| 2026-10-08 | 1.77 | Repair pinned location input interaction by placing editable controls outside the animated ScrollView sticky-header wrapper. Measure header/results for bounded sheet sizing; retain search and pagination. TypeScript/focused lint pass; native typing/scroll verification pending. |
| 2026-10-08 | 1.76 | Pin the shared location search input and sheet title above scrolling result cards using an opaque themed sticky header. Preserve search, pagination and confirmation. Implemented locally; TypeScript/focused lint pass; native scroll/keyboard verification pending. |
| 2026-10-08 | 1.75 | Extract final-destination search into LocationSearchPicker and reuse it for Edit Run planned start/end, including keyboard search, pagination and previews. Preserve atomic endpoint save/conflict checks. Implemented locally; TypeScript/focused lint pass, Figma handoff aligned; native verification pending. |
| 2026-10-08 | 1.74 | Remove the additional-cost form’s bottom Cancel button; retain header close, backdrop/swipe dismissal and save protection. App/Figma aligned; focused lint and diff checks pass. |
| 2026-10-08 | 1.73 | Improve the additional cost form with themed rounded fields, expense placeholder/notice, prominent rand amount, cents guidance, focus styling and clear Add cost/Cancel. Implemented locally; TypeScript/focused lint and Figma layout checks pass; native keyboard/layout and dark-theme checks pending. |
| 2026-10-08 | 1.72 | Redesign Edit Run with compact themed endpoint cards, map/flag icons, inline Change/Choose actions, concise context notice and clear Save/Cancel. Implemented locally; iOS layout reviewed without saving, TypeScript/focused lint pass; Android/dark-theme checks pending. |
| 2026-10-08 | 1.71 | Remove the planned-end explanatory sentence from the selected destination preview. Implemented locally; selection/save actions retained and targeted diff verified. |
| 2026-10-08 | 1.70 | Reserve destination pagination footer space before loading so Loading more… and retry remain visible at the list end. Implemented locally; focused verification recorded in release notes. |
| 2026-10-08 | 1.69 | Paginate saved destination search matches and append pages near the scroll end with Loading more… and retry. Implemented locally; focused verification recorded in release notes. |
| 2026-10-08 | 1.68 | Enable fill-parent keyboard avoidance for destination search with safe top clearance and restore-on-blur. Implemented locally; physical Android keyboard verification pending. |
| 2026-10-08 | 1.67 | Add 16 points of Android floating-sheet clearance beyond the bottom system safe area, including ActionSheet; bound dynamic height accordingly. Implemented locally; physical Android verification pending. |
| 2026-10-07 | 1.66 | Show locations only after search, with Search results heading only for non-empty matches. Clear/empty submissions reset results; no-match feedback follows searches only. Implemented locally; focused verification recorded in release notes. |
| 2026-10-07 | 1.65 | Reduce final-destination card padding/gaps to 10 points and minimum height to 70 points. Implemented locally; targeted diff verified. |
| 2026-10-07 | 1.64 | Remove destination search minimum-length hint and accept one-character searches in client/API. Empty submission restores saved locations. Implemented locally; focused verification recorded in release notes. |
| 2026-10-07 | 1.63 | Make the final-destination search field fully rounded. Implemented locally; search behavior unchanged and targeted diff verified. |
| 2026-10-07 | 1.62 | Remove Select one to continue from the destination list heading; retain selectable location cards. Implemented locally; targeted diff verified. |
| 2026-10-07 | 1.61 | Remove the redundant Find a location label from the final-destination picker; retain input placeholder/accessibility and keyboard search. Implemented locally; targeted diff verified. |
| 2026-10-07 | 1.60 | Remove the final-destination search button; submit location search using the keyboard Enter/Search key with the existing three-character minimum. Implemented locally; TypeScript/focused lint verified. |
| 2026-10-07 | 1.59 | Temporarily hide mobile Planned / Recorded buttons and force Planned while retaining all Recorded functionality. Figma switch/handoff aligned; native visual verification pending. |
| 2026-10-07 | 1.58 | Redesign the final-destination sheet with searchable location cards and a highlighted selection/save preview. Implemented locally; iOS list/selection/return verified without saving, TypeScript/focused lint pass; Android/dark-theme/device keyboard checks pending. |
| 2026-10-07 | 1.57 | Remove the dashboard secondary Upload delivery note and Contact dispatch rows, retaining contextual upload actions. Implemented locally; Figma handoff aligned. |
| 2026-10-07 | 1.56 | Move Filter timeline beside the entry count and retain Actions beside Current run. Implemented locally; filter behavior unchanged; Figma active-run handoff aligned. |
| 2026-10-07 | 1.55 | Round the active-run Actions button to 10 points and use the dashboard's soft grey border. Implemented locally and verified in the iOS simulator; Figma aligned. Android visual verification pending. |
| 2026-10-07 | 1.54 | Add the Expo Messages unread count badge, driver-only unread summary endpoint and session-safe foreground refresh. Implemented locally; physical-device verification remains pending. |
| 2026-10-07 | 1.53 | Replace Vehicles with Messages; move assigned fleet under Account. Add merchant-scoped driver chats, member-based normal chats, private attachments, website inbox and queued Expo notifications. Implemented locally; Figma navigation aligned; platform credentials/builds and production verification pending. |
| 2026-10-07 | 1.52 | Add active-run Actions: reasoned dispatch closure requests/review, atomic planned endpoint edits and retry-safe Manual ZAR costs. Mobile/API/CRM implemented locally; Figma flows/guide aligned, targeted regressions pass; Android/CRM visual and production verification pending. |
| 2026-10-07 | 1.51 | Restore the requested Gorhom bottom action sheet, outlined options and optional controls; fix React Native 0.86 absolute-fill compatibility at build time. Existing Figma bottom-sheet flow retained. |
| 2026-10-07 | 1.50 | Restore visible All stops action-menu presentation through a native modal card; preserve existing filter flow and Figma design. iOS filter/reopen/cancel checks pass; Android/web verification pending. |
| 2026-10-07 | 1.49 | Move required/expired summary cards from dashboard to Documents; retain required tab badge and share both confirmed server counts with session/stale-response guards. Figma examples and guide aligned; native visual verification pending. |
| 2026-10-07 | 1.48 | Share the driver-required-document count between the dashboard notice and a red Documents tab badge; hide both at zero/unknown and refresh after uploads, dashboard return and foreground. Existing API count regressions pass; Figma examples/notes aligned. Native visual verification pending. |
| 2026-10-07 | 1.47 | Implement the existing no-run dashboard with a primary upload action and independent truck GPS lookup; restore persistent-sheet layout. Keep document reminders, dispatch contact and bottom tabs. Existing Figma screen aligned; 30 API regressions pass. Local migrations subsequently applied and simulator dashboard loads successfully; live no-run acceptance remains pending. |
| 2026-09-23 | 1.46 | Group exact-coordinate run-map pins, retain popup events/replay and update filtered pin counts. Automated checks pass; live visual verification pending. Figma unchanged. |
| 2026-09-22 | 1.45 | Track all containing polygons independently; run entry/exit automation per location and retain duplicate prevention. Simulator prefers requested open visit. Local regressions cover nested and overlapping fences; live verification pending. Figma unchanged. |
| 2026-09-22 | 1.44 | Optimize cleanup audits with bounded evidence reuse, lookup indexes and progress counts. Fresh apply/restore validation retained; production timing remains unverified. Figma unchanged. |
| 2026-09-22 | 1.43 | Add explicit --all-candidates selection for a completed cleanup audit, with bounded iteration, unchanged per-item checks and rejection of mixed/empty selection. Regression tests pass; no production cleanup executed. Figma unchanged. |
| 2026-09-22 | 1.42 | Added scoped historical geofence shipment audit/apply/restore with protected records, reversible ledger, hidden invalidated shipment markers and lifecycle restoration guard. Local regression/API tests pass; production cleanup not executed. Figma unchanged. |
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
