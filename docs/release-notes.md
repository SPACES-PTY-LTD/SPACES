# Release Notes

## 2026-10-10 | Version: driver-native-delivery-guidance-v1

- **Summary:** Add Start inside the delivery route card and implement in-app Google Navigation SDK guidance in source.
- **API Changes:** None; keep the existing phone-origin preview endpoint, with SDK routing used after Start.
- **Database Changes:** None.
- **Behavior Changes:** Start requests navigation terms, fresh phone GPS, background location and notification consent. Add native maneuvers, voice/mute, following/recenter, rerouting, live ETA/distance, Exit and arrival; retain run Actions, timeline dragging and tabs. Serialize cancellation/cleanup, stop on observed account/run/target changes, keep dispatch sharing independent, and retain preview on unsupported/older builds. Exit returns to preview; arrival never delivers a shipment. Native build scripts now compile development apps. iOS preview uses MapKit to avoid Google pod conflicts; Android uses Navigation-supplied Maps classes. Update Figma and canonical plan to 2.152.
- **Breaking Changes:** Updated native binaries and enabled/restricted Google Navigation SDK keys with billing are required for guidance. Expo Go/web/older builds retain preview with Start disabled.
- **Verification:** Full mobile TypeScript, new navigation lint, 28 targeted regression tests and Expo prebuild pass. CocoaPods/native iOS build blocked by disk full; Android Gradle blocked by missing configured Java runtime. Physical routing, voice, rerouting, arrival, background/lock-screen behavior and native layout remain unverified; see mobile_app/docs/navigation.md.

## 2026-10-10 | Version: shipment-marker-popup-pointer-v1

- **Summary:** Identify the selected stop and visually connect its popup to the map marker.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show Stop 2 (actual marker number) above the delivery location; co-located markers show all stop numbers. Add a theme-matched triangle pointing to the projected marker, slanting at horizontal map edges and pointing upward for below-marker popups. The pointer ignores touches; Shipment info and grouped shipment selection remain usable.
- **Breaking Changes:** None.
- **Verification:** Eight map/popup/navigation regressions, full mobile TypeScript, focused RunMap lint with existing effect/ref/purity exclusions and git diff --check pass. Dashboard plan v2.151 and editable Figma popup aligned. Physical Apple/Google map projection, pointer rendering, dark/large-text and sheet clearance remain pending.

## 2026-10-10 | Version: dashboard-shipment-summary-lists-v1

- **Summary:** Open actual current-run shipment lists from the Shipments, Remaining and Delivered tiles.
- **API Changes:** None; reuse authorized dashboard run_shipments.
- **Database Changes:** None.
- **Behavior Changes:** Make tiles accessible buttons and share their count/list status predicates. Preserve server order and existing Remaining semantics (exclude delivered, failed and cancelled). Present themed scrollable lists with reference, destination and status, including zero-result messages. Select a row to dismiss the list before opening the existing receipt sheet. Guard duplicate selection, cancel pending handoffs on unmount, and clear lists on run/session changes.
- **Breaking Changes:** None.
- **Verification:** 12 targeted dashboard/filter/list/handoff regressions, full mobile TypeScript, focused lint excluding existing dashboard effect-rule violations and git diff --check pass. Dashboard plan v2.150 and Figma handoff updated. Physical-device long lists, zero states, themes/large text, dismissal and receipt interaction remain pending.

## 2026-10-10 | Version: shipment-marker-popup-v1

- **Summary:** Open a location popup before shipment details when tapping a numbered delivery marker.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show a themed, map-anchored location name and 44-point Shipment info button. Open the existing receipt bottom sheet from that action; exact-coordinate groups retain the shipment chooser. Use an interactive overlay so native callout snapshots do not consume button touches. Bound popup placement, dismiss on map tap/drag/focus/context changes, reject late projections and hide changed groups. Preserve truck/endpoint callouts and navigation.
- **Breaking Changes:** Shipment marker taps now open the popup; the explicit Shipment info action opens details.
- **Verification:** 11 marker/group/cancellation/map routing regressions, full mobile TypeScript and focused map lint with existing effect/ref/purity rule exclusions pass. Dashboard plan v2.149 and editable Figma handoff aligned. Physical iOS/Android provider projection, map edges, themes, large text and sheet/touch interaction remain pending.

## 2026-10-10 | Version: location-always-permission-flow-v1

- **Summary:** Make the phone-location permission setup discoverable and request foreground access before checking background runtime support.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Account → Location always offers Open device settings and explains iPhone While Using App → Always setup, Android background access, missing Location entries and the native rebuild requirement. Enabling sharing requests foreground consent before the background-runtime gate; unavailable runtime or denied Always access cannot enable server sharing or transmit coordinates. Existing Always permission and iOS background-mode build configuration is preserved and verified.
- **Breaking Changes:** None.
- **Verification:** Expo native introspection confirms NSLocationWhenInUseUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription and UIBackgroundModes=location. Provider regression covers missing runtime requesting foreground permission without enabling sharing. All 22 targeted provider/navigation tests, full mobile TypeScript, focused Location screen/provider lint and git diff --check pass. Physical iPhone Settings/permission dialogs and installation of an updated native build remain pending.

## 2026-10-10 | Version: driver-phone-origin-navigation-v1

- **Summary:** Route in-app navigation from the user's current phone GPS instead of the truck.
- **API Changes:** Selected-shipment directions require origin_latitude, origin_longitude and origin_reported_at. Validate coordinates/date and return origin_source=phone and origin_coordinate. Existing whole-run and next-delivery ETA queries retain their truck/run sources.
- **Database Changes:** None; navigation does not persist a phone-location report.
- **Behavior Changes:** Obtain/request foreground permission and a high-accuracy current phone fix with a 20-second timeout. Reject stale/invalid/future fixes; show errors with Retry/Stop and never fall back to the truck. Refresh from a new fix every minute while focused/foreground, avoid repeating permission prompts on polling, show a phone marker/source timestamp, and verify the response matches the phone origin. Preserve cancellation/selection guards and run overview restoration. Background location reporting settings/cooldown remain independent.
- **Breaking Changes:** Deploy backend and mobile together for the required selected-route origin fields. Older truck-origin responses are rejected by the new mobile route view.
- **Verification:** 40 backend shipment/routing tests (352 assertions), 21 mobile phone-fix/routing/card/dashboard checks, full mobile TypeScript, focused lint excluding the existing map hook-rule violations and PHP/diff checks pass. Figma phone marker/source visually reviewed. Native GPS permission/service behavior, provider fitting, themes/large text and deployed routes remain pending.

## 2026-10-10 | Version: driver-in-app-delivery-route-v1

- **Summary:** Keep next-delivery Navigate inside the app and focus the map on the selected delivery route.
- **API Changes:** Add optional shipment_id UUID to GET /driver/runs/{run_uuid}/directions. Scope to the authenticated driver's run and eligible nonremoved shipment; malformed IDs return 422, inaccessible targets 404 and terminal/nonactive targets 409. Return existing road geometry/distance/duration with target/calculation/origin timestamps. Existing queries remain supported.
- **Database Changes:** None.
- **Behavior Changes:** Replace external Google Maps launch with an in-app selected-target route view, source/time, distance/estimated minutes, loading/error, retry and Stop. Hide unrelated pins and fit the truck/target/road under the measured panel. Restore overview on Stop. Refresh every minute while focused/foreground; ignore late/mismatched requests and clear selection on user/run or target eligibility changes. Destination coordinates are required; address-only destinations are disabled with an explanation.
- **Breaking Changes:** Navigate no longer opens an external maps app. The view routes from the truck's last stored report; it does not implement voice maneuvers, phone-GPS following or arrival detection. Backend deployment is required for selected-target routing.
- **Internal Changes:** Add navigation callback/state and regression coverage; align dashboard plan v2.147 and editable Figma route state.
- **Verification:** 40 backend shipment/routing tests (347 assertions) pass. All 27 mobile route lifecycle, callback, dashboard selection/reset and existing map/provider tests pass; TypeScript and focused lint excluding three existing dashboard/map hook-rule violations pass. Figma route state visually reviewed. Native providers/viewport/themes/large text, real configured Google routes and deployed-backend checks remain pending.

## 2026-10-10 | Version: dashboard-status-tiles-v1

- **Summary:** Implement corrected Design 2 Status tiles selection for shipment totals.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace Count strip dividers with three neutral rounded tiles using 12-point gaps, padding and radius. Preserve bold tabular numbers, muted labels, green Delivered, existing count/status rules, zero totals, accessible groups and font scaling. Support light/dark surfaces; retain Ready to start and feedback.
- **Internal Changes:** Align selected/canonical Figma summaries and dashboard plan v2.146. Designs 1/3 remain alternatives.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused dashboard lint excluding two pre-existing effect-rule violations pass; selected Figma layout visually reviewed. Native narrow-screen, large-number, dark-mode and large-text verification remains pending.

## 2026-10-10 | Version: dashboard-count-strip-v1

- **Summary:** Implement selected Design 1 Count strip for dashboard shipment totals.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace inline totals with three read-only number/label columns, subtle dividers and green Delivered. Preserve existing shipment/remaining/delivered calculations, zero totals, Ready to start and run feedback. Use theme colors, tabular numbers, natural wrapping/font scaling and accessible count/label groups.
- **Internal Changes:** Align selected and canonical Figma summaries and dashboard plan v2.145; retain Designs 2/3 as alternatives.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused dashboard lint excluding two pre-existing effect-rule violations, and all 11 existing dashboard checks pass. Native narrow-screen, large-number, dark-mode and large-text verification remains pending.

## 2026-10-10 | Version: dashboard-shipment-totals-design-v1

- **Summary:** Remove the active Current run title and explore three shipment-total layouts in Figma.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide the Current run heading on in-progress dashboard runs. Preserve Ready to start, inline count calculations, end-request feedback, timeline filters and header Actions. Count strip, Status tiles and Progress focus are Figma proposals only, awaiting selection.
- **Internal Changes:** Add six editable Direction × Data component variants, three current-dashboard comparisons and zero-count examples with SF Pro and existing tokens. Align dashboard plan v2.144 and active Figma title references.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript and dashboard lint with two pre-existing effect-rule violations excluded pass. Figma variants, editable text hierarchy, counts/zero states and token bindings structurally checked; final comparison visually reviewed. Native title/spacing verification and selected count-layout implementation remain pending.

## 2026-10-10 | Version: active-run-readable-duration-v1

- **Summary:** Clarify the active-run label and display elapsed hours and minutes.
- **API Changes:** None; continue deriving elapsed time from saved started_at.
- **Database Changes:** None.
- **Behavior Changes:** Show Run active for: above durations such as 10hrs 30mins, with singular 1hr / 1min where appropriate. Omit seconds and floor to completed minutes; retain zero units, hours beyond 24, future-start clamping, unavailable-time fallback and focus/background reconciliation.
- **Breaking Changes:** None.
- **Verification:** 11 timer/dashboard checks, full mobile TypeScript, focused ActiveRunDock lint and git diff --check pass. Selected Figma component visually checked and dashboard plan v2.143 aligned. Native narrow-screen, dark and large-text verification remains pending.

## 2026-10-10 | Version: active-run-timeline-info-v1

- **Summary:** Add a run-timeline info button left of Actions in the active sheet header.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** A themed 44 × 44-point info-icon button labelled Show run timeline expands the sheet to 50%; preserve 92% when already open further. Continue supporting drag resizing and independent run Actions.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused lint with pre-existing dashboard effect errors excluded, 11 timer/info/drag/visibility/refresh checks and git diff --check pass. Selected Figma header and dashboard plan v2.142 aligned; Figma rejected the info navigation reaction, so its control remains a static design handoff. iOS simulator confirms info opens the timeline at 50%, preserves 92% and shows the counting timer. Physical drag, Android, dark and large-text checks remain pending.

## 2026-10-10 | Version: driver-phone-location-rate-limit-v1

- **Summary:** Isolate phone-location rate limits and coordinate foreground/background retries.
- **API Changes:** Keep 10 report attempts per 60 seconds, now using a dedicated named limiter keyed by authenticated driver user ID. Resolve API bearer authentication before global/route throttles. Preserve 60 aggregate API attempts/minute per user; unauthenticated/public requests retain IP fallback. Standard 429 Retry-After headers remain available.
- **Database Changes:** None.
- **Behavior Changes:** Foreground/background senders share a persisted per-driver 30-second attempt gate and prevent concurrent sends within the JS runtime. Honor Retry-After cooldown across task restarts; use a 60-second fallback when missing/invalid. Skip background opt-in checks during cooldown and suppress immediate settings refresh on report 429. Keep consent/session/off guards and log expected location throttling as warnings.
- **Breaking Changes:** None in request/response payloads. Authenticated API limits now follow the user rather than shared IPs; devices/tokens for the same user share the allowance.
- **Verification:** 60 phone-location/shipment/conversation API tests (753 assertions), the authentication test (11 assertions), 22 mobile provider/task/cooldown checks, full mobile TypeScript, focused API/location lint, PHP syntax and git diff --check pass. Verify per-driver/IP isolation, numeric-bucket independence, 10-report cutoff/reset, 60 aggregate cutoff, Retry-After persistence/expiry, concurrent-send suppression and cancellation after storage reads. Dashboard plan v2.141 and Figma handoff aligned. Backend deployment and installed-client physical-device foreground/background/relaunch verification remain pending.


## 2026-10-10 | Version: active-run-sheet-header-v1

- **Summary:** Make selected 01 Compact white the top of the active dashboard bottom sheet.
- **API Changes:** No further changes; pending additive dashboard started_at supplies the timer.
- **Database Changes:** None.
- **Behavior Changes:** Start active runs with the measured timer/route/Actions summary below the handle. Drag upward to reveal the timeline at 50% / 92%; drag downward to restore summary. Keep the header above scrolling content, existing authorized Actions, normal timeline padding and default no-run snaps. Capture vertical header drags while preserving ordinary Actions taps.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint with existing dashboard effect errors excluded, 11 timer/visibility/refresh/drag-handler checks and 36 driver API tests (323 assertions) pass. Figma compact/expanded states and dashboard plan v2.140 aligned. iOS light summary and expanded timeline reviewed; physical header drag, populated timer (backend deployment), dark/large-text/Android and final-entry scrolling remain native checks.


## 2026-10-10 | Version: active-run-compact-white-v1

- **Summary:** Implement the user-edited 01 Compact white dashboard run strip above navigation.
- **API Changes:** Authorized driver dashboard current_run adds nullable ISO-8601 started_at from the recorded run start. Deploy backend support for the populated timer.
- **Database Changes:** None.
- **Behavior Changes:** Show a full-width themed strip only for in-progress dashboard runs: RUN ACTIVE, elapsed HH:MM:SS counting each second, planned endpoint names and existing run Actions. Recompute elapsed time on focus/foreground, retain hours beyond 24, clamp future starts to zero and show Time unavailable for missing/invalid starts or older APIs. Match selected square corners, top/bottom borders and padding. Remove duplicate header Actions and reserve measured strip height in timeline scroll padding. Preserve all menu permissions, conditional upload and pending End Run guard.
- **Breaking Changes:** None; started_at is additive and older APIs retain the safe fallback.
- **Verification:** Full mobile TypeScript, focused lint with two existing dashboard effect-rule errors excluded, ten mobile timer/visibility/refresh checks, 36 driver API tests (323 assertions), PHP syntax and diff checks pass. iOS simulator verifies light layout against Figma, missing-start fallback, Actions opening/dismissal and strip persistence at 25/50/92% sheet positions. Dashboard plan v2.139 and selected Figma handoff aligned. Populated native timer requires backend deployment; dark/large-text/Android and final-entry native scrolling remain pending. PHP formatter reports pre-existing style violations in the touched legacy files; no broad formatting applied.

## 2026-10-10 | Version: next-delivery-continuous-tab-join-v1

- **Summary:** Close the gap between the rounded card body and collapse tab.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Add a touch-transparent black connector behind the card body at the bottom-right corner. Fill the rounded-corner cutout without painting above Navigate. Preserve the 44 × 44-point tab, 20-point bottom radii and existing interactions.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four existing card checks and git diff --check pass. Figma connector geometry and paint order verified, screenshot visually checked; dashboard plan v2.138 aligned. Native visual/touch verification remains pending.

## 2026-10-10 | Version: next-delivery-full-bottom-rounding-v1

- **Summary:** Restore full bottom-corner rounding on the expanded next-delivery card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Restore the body bottom-right corner to its shared 20-point radius and increase both collapse-tab bottom radii to 20 points. Preserve the compact 44 × 44-point tab and normal-flow clearance below Navigate.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four existing card checks and git diff --check pass. Selected Figma body/tab corner radii structurally verified and screenshot visually checked; dashboard plan v2.137 aligned. Native visual verification remains pending.

## 2026-10-10 | Version: next-delivery-collapse-tab-overlap-fix-v1

- **Summary:** Shrink the expanded collapse tab and prevent it covering Navigate.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reduce the tab to 44 × 44 points with 14-point lower corner radii. Remove its negative top margin and overlap padding; place the tab directly below the card body in normal flow. Retain accessible collapse, action clearance and animation.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four existing card checks and git diff --check pass. Selected Figma geometry verifies the tab starts at the body bottom; screenshot visually checked. Dashboard plan v2.136 aligned. Native device visual/touch verification remains pending.

## 2026-10-10 | Version: active-run-bottom-dock-design-v1

- **Summary:** Create five Figma proposals for a floating active-run dashboard section above navigation.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime; design only, awaiting selection. Proposals show elapsed run time, planned start/end names and a right-side Actions button.
- **Internal Changes:** Dashboard plan v2.135 defines server-start-based one-second counting, foreground reconciliation, active/dashboard-only visibility, missing-data fallback, scroll clearance and reuse of authorized run actions.
- **Breaking Changes:** None.
- **Verification:** Five reusable components in editable full dashboard comparisons, SF Pro font family, token bindings, 12-point navigation clearance and 44-point action targets structurally checked; final comparison visually reviewed. Each Actions control opens a dismissible menu preview. No runtime code changed in this design task; timer, theme, large-text and native behaviour await implementation.

## 2026-10-10 | Version: next-delivery-collapse-tab-v1

- **Summary:** Match the annotated expanded-card shape with an icon-only collapse tab at the bottom right.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove visible Collapse details text and the full-width footer background. End the rounded card body below the action buttons, with only a 64-point-wide rounded black tab extending down on the right. Retain at least 44 points of exposed collapse touch height, the accessible label, upper-details collapse and existing animation.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint and four existing card checks pass. Selected Figma component structurally and visually verified against the annotated shape; dashboard plan v2.134 aligned. Native device shape/shadow/touch verification remains pending.

## 2026-10-10 | Version: next-delivery-expanded-bottom-spacing-v1

- **Summary:** Reduce the blank space below Collapse details in the expanded next-delivery card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reduce expanded bottom padding from 10 to 2 points, shortening the card by 8 points. Retain the 44-point collapse tap target, collapsed spacing and existing animated interactions.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four existing card checks and diff checks pass. Dashboard plan v2.133 and selected Figma bottom padding aligned; native visual verification pending.

## 2026-10-10 | Version: next-delivery-expanded-details-collapse-v1

- **Summary:** Collapse the expanded next-delivery card by tapping its upper details area.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reference/ETA, destination, last-truck-location source and surrounding top/side padding form an accessible collapse button. Preserve independent View shipment, Navigate and bottom Collapse details actions, existing spacing and the 200 ms animation with Reduce Motion support.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four existing card checks and diff checks pass. Dashboard plan v2.132 and selected Figma hotspot aligned; native touch/accessibility verification pending.

## 2026-10-10 | Version: next-delivery-card-animation-v1

- **Summary:** Animate next-delivery card expansion and collapse.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use stable animated surfaces for a 200 ms ease-out size transition in both directions, respecting system Reduce Motion. Retain rounded clipping, shadow, natural content height, map-fit reporting, tap-anywhere expansion and independent expanded actions.
- **Internal Changes:** Adapt the existing card test harness to mock Reanimated.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four existing card checks and diff checks pass. Dashboard plan v2.131 and selected Figma transitions aligned; native motion, Reduce Motion and rapid-toggle verification pending.

## 2026-10-10 | Version: next-delivery-card-tap-expand-v1

- **Summary:** Expand the collapsed next-delivery card when tapped anywhere.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Make the whole collapsed card, including destination, ETA, padding and chevron, one accessible expand button. Expanded shipment/navigation actions and Collapse details remain independent. Preserve compact spacing.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint and four existing card checks pass. Dashboard plan v2.130 and selected Figma prototype aligned; native touch/accessibility verification pending.

## 2026-10-10 | Version: next-delivery-compact-spacing-v1

- **Summary:** Reduce highlighted whitespace in the collapsed next-delivery card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reduce collapsed top padding from 10 to 6 points and header/destination gap from 12 to 4, making the card 12 points shorter. Preserve destination wrapping, 44-point expand target and expanded layout.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint and four existing card regressions pass. Figma compact variant aligned; native visual check pending.

## 2026-10-10 | Version: next-delivery-last-stored-location-v1

- **Summary:** Calculate next-delivery ETA from the truck's last location stored in the database.
- **API Changes:** Optional next-delivery directions use valid stored coordinates without a location-age/run-start/timestamp gate and add nullable origin_reported_at. Keep run/vehicle/destination authorization and current in-progress run requirement.
- **Database Changes:** None.
- **Behavior Changes:** Old reports, pre-run reports and coordinates without a timestamp can produce an ETA. Expanded cards show From last truck location and the stored report time when available. Missing coordinates or routing still show ETA unavailable; estimates continue refreshing and rejecting stale calculations or mismatched shipments.
- **Breaking Changes:** None.
- **Verification:** 35 driver API tests (318 assertions), four mocked card/helper tests, full mobile TypeScript, focused card/API lint and diff checks pass. API regression verifies recent, 16-minute-old, two-day-old and untimestamped locations, missing coordinates, terminal shipments and driver scope. Dashboard plan v2.128 and selected Figma metadata/handoff aligned; native layout and live configured routing remain pending.

## 2026-10-10 | Version: next-delivery-full-width-destination-v1

- **Summary:** Give the collapsed next-delivery destination the full card width.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Move the ETA and expand chevron to the top-right header alongside NEXT DELIVERY. Render the destination on a separate full-width row, retaining wrapping and the 44-point expand target.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused card lint, four mocked card/helper tests and diff checks pass. Selected Figma collapsed state and dashboard plan v2.127 aligned. Native long-name/large-text layout verification remains pending.

## 2026-10-10 | Version: next-delivery-default-collapsed-v1

- **Summary:** Start the next-delivery card collapsed by default.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** New card mounts show destination, ETA and Expand. View shipment and Navigate appear only after expansion. Preserve the user's choice while the same run remains mounted.
- **Breaking Changes:** None.
- **Verification:** Four mocked card/helper checks, full mobile TypeScript, focused card lint and diff checks pass. Updated actual-card regression verifies the initial collapsed state and subsequent action restoration. Dashboard plan v2.126 and selected Figma default aligned; native layout verification remains pending.

## 2026-10-10 | Version: next-delivery-card-v1

- **Summary:** Implement design 4 as a collapsible next-delivery card above the active-run map.
- **API Changes:** Optional `next_delivery=1` on authorized run directions returns the first remaining shipment's truck-to-dropoff road estimate with shipment_id/calculated_at. Default whole-run routing remains unchanged. Require a fresh scoped run vehicle report; no client origin is accepted. Deploy backend support to populate ETA.
- **Database Changes:** None.
- **Behavior Changes:** Black rounded card with safe-area clearance, 20-point sides, reference/destination and ETA pill. Expanded offers View shipment, Navigate and Collapse details; collapsed retains destination/ETA and Expand. Use run sequence and skip terminal work, hide without eligible work or when the delivery-note notice takes priority. Navigation uses valid coordinates or saved address and is disabled without a destination. Refresh estimates on focus/foreground and every minute; reject mismatched/stale calculations. Missing routing/position shows ETA unavailable. Adjust map-fit padding to the card height.
- **Breaking Changes:** None. Older backend responses omit matching ETA metadata and display ETA unavailable.
- **Verification:** Full mobile TypeScript, focused card/API lint and dashboard lint excluding two pre-existing effect-rule errors pass. Four mocked mobile card/helper tests and 35 driver API tests (308 assertions), plus diff checks pass. Figma selected direction/handoff and dashboard plan v2.125 aligned. Native safe-area/theme/large-text/collapse/action checks and live configured route estimates remain pending.

## 2026-10-10 | Version: next-delivery-overlay-actions-design-v1

- **Summary:** Add View shipment and Navigate buttons to the expanded next-delivery card designs.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime. All four expanded Figma directions include outlined View shipment and green Navigate actions; collapsed destination/ETA bars omit both buttons.
- **Internal Changes:** Align dashboard plan v2.124 and Figma component descriptions/handoff with the intended shipment-detail and delivery-destination navigation actions.
- **Breaking Changes:** None.
- **Verification:** Four expanded variants visually and structurally checked with two 178 × 44 buttons each; all four collapsed variants verified to omit the actions. Text, component instances and controls remain editable. No mobile code changed by this task.

## 2026-10-10 | Version: dispatch-context-actions-v1

- **Summary:** Message dispatch about the selected run or shipment directly from Actions.
- **API Changes:** None; reuse existing typed run/shipment message references.
- **Database Changes:** None.
- **Behavior Changes:** Add Message dispatch before End Run in current-run Actions and before Cancel shipment in active booked shipment Actions. Open Messages after sheet dismissal with a removable reference, preserving text/files and requiring explicit Send. Reuse the inline shipment handler; support run handoffs with account ownership, closed-chat, duplicate, five-attachment and once-only guards. Focus the loaded composer and allow reference previews.
- **Breaking Changes:** None.
- **Verification:** Thirteen actual Messages screen regressions, full mobile TypeScript and focused lint pass; dashboard lint excludes existing set-state-in-effect violations. Dashboard plan 2.123 and Figma menus/handoff aligned. Native menu/navigation/keyboard checks and GitHub Desktop draft update are blocked by the locked Mac. No live messages sent.

## 2026-10-10 | Version: next-delivery-overlay-collapse-design-v1

- **Summary:** Add collapse and expand states to all four next-delivery overlay designs.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime. Figma Collapse details reduces each card to a 64-point bar retaining destination and illustrative ETA; the down chevron restores the same design.
- **Internal Changes:** Document dashboard plan v2.122 and eight reusable Direction × State variants with reversible prototype links and 44-point controls.
- **Breaking Changes:** None.
- **Verification:** All four expanded/collapsed pairs structurally and visually checked in the comparison board. Editable SF Pro text, vector chevrons and component instances retained. No mobile implementation changed by this task.

## 2026-10-10 | Version: delivery-status-keyboard-avoidance-v1

- **Summary:** Keep delivery-status inputs and Save status reachable with the keyboard open.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace regular inputs with Gorhom BottomSheetTextInput for failure message, optional note and delivery odometer. Use fillParent keyboard avoidance with safe top clearance, Android adjustResize and blur restoration. Move Save status to the shared persistent footer and reserve footer space while fields scroll. Preserve validation, drafts, payload and busy/dismissal guards.
- **Breaking Changes:** None.
- **Verification:** Five actual-form mocked regressions, full mobile TypeScript, focused DeliveryStatusSheet lint and diff checks pass. Dashboard plan 2.121/Figma keyboard handoff aligned. Native iOS/Android keyboard, number-pad/multiline scrolling, footer reachability and blur restoration remain unverified because the Mac is locked; GitHub Desktop draft access is also blocked.

## 2026-10-10 | Version: shipment-cancel-bottom-sheet-v1

- **Summary:** Simplify shipment cancellation in a compact reusable bottom sheet.
- **API Changes:** None; retain enabled cancellation reasons and reason_code/reason/note contract.
- **Database Changes:** None.
- **Behavior Changes:** Replace the embedded/page cancellation panel and reason chips with shared CancelShipmentSheet above receipt/page. Show enabled server reasons in a dropdown, Other last; only Other reveals required Custom reason. Preserve optional Note and use an explicit red Save cancellation button in a persistent bottom footer. Use sheet-aware inputs and fillParent keyboard avoidance. Start without a selected reason, trim text and exclude stale custom text when a preset is chosen. Load reasons on opening with loading/empty/retry states and unmount guards. Preserve save errors/drafts, busy dismissal locks, authorized response refresh and completed-run read-only guards.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused cancellation/shipment lint and five mocked cancellation-form regressions pass; delivery-status regressions still pass. Checks cover codes/order/disabled reasons, Other validation/reselection, no mutation on selection, loading/retry/empty, busy/error draft preservation and late responses and keyboard/footer configuration. Dashboard plan v2.119 and editable light/dark Figma references/handoff aligned. Native page/receipt stacking, dropdown/keyboard/large-text/theme scrolling, cancellation and live save/retry remain pending; locked Mac prevented simulator and GitHub Desktop draft access. No shipment cancelled during verification.

## 2026-10-10 | Version: next-delivery-overlay-design-v1

- **Summary:** Create four editable Figma options for a floating next-shipment and ETA card above the map.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime; awaiting user design selection. Shipment and ETA data in the mockups are illustrative.
- **Internal Changes:** Record dashboard plan v2.120 and the Compact split, Arrival first, Destination first and Slim two-row Figma explorations.
- **Breaking Changes:** None.
- **Verification:** Four dashboard previews and reusable card variants structurally and visually checked. SF Pro text, vector map/context and component instances remain editable; no image-filled UI layers. Cards have 20-point side margins and rounded black surfaces. No mobile code or ETA provider changed by this task.

## 2026-10-10 | Version: shipment-status-bottom-sheet-v1

- **Summary:** Simplify shipment delivery-status editing in a reusable compact bottom sheet.
- **API Changes:** None; retain status/note/delivery-odometer contract.
- **Database Changes:** None.
- **Behavior Changes:** Replace the embedded/full-page confirmation panel with shared DeliveryStatusSheet above receipt/page. Use labelled status/reason dropdowns, a required Message only for Other, optional notes for nonfailed statuses and a green Save status button. Offer six preset failure reasons followed by Other; save the preset label or trimmed custom message as note. Remove pickup odometer entry and collection payload; preserve the booking's saved reading. If absent, block dependent statuses with collection-flow guidance. Delivered requires a whole-number reading at least equal to collection only when no saved delivery reading exists. Retain busy/dismissal, failed-request draft/retry, authorized refresh and completed-run read-only guards.
- **Breaking Changes:** None. Missing collection readings must be completed in the existing collection flow.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails/DeliveryStatusSheet lint, four mocked actual-form regressions, 15 existing backdrop/handoff regressions (19 total) and diff checks pass. Regressions cover preset/Other payloads, blank message, hidden message after reselection, no pickup payload, missing/invalid odometers, saved readings, status changes, busy/error recovery. Dashboard plan v2.118 and editable Figma light/dark states/handoff aligned. Native page/receipt stacking, dismissal, keyboard/large-text/theme scrolling and live save/retry remain pending; the locked Mac prevented simulator and GitHub Desktop draft access. No server mutations performed.

## 2026-10-09 | Version: message-draft-picture-preview-v1

- **Summary:** Preview selected pictures in the Expo message composer as small thumbnails.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace picture filename rows with 64-point local image previews and separate remove controls. Image MIME types take precedence; missing/generic MIME falls back to common image extensions. Documents retain filenames. Keep accessible picture/removal labels, draft text/references, upload limits and explicit Send behavior.
- **Breaking Changes:** None.
- **Verification:** Eleven mocked actual-Messages screen regressions, full mobile TypeScript and focused Messages lint pass. iOS simulator verifies HEIC photo selection, thumbnail without filename, removal and empty-draft send gating; no message sent. Dashboard plan v2.117 and editable Figma composer/handoff aligned. Android, dark mode, camera and document-picker image rendering remain pending.

## 2026-10-09 | Version: shipment-remove-history-menu-v1

- **Summary:** Remove the redundant Shipment history action from Shipment options.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep history inline below Shipment info and remove its duplicate panel/state. Editable booked shipments retain Update delivery status and Cancel shipment. Hide Actions in completed-run read-only views and when no booking has available actions, preventing an empty menu.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Mocked actual-component checks confirm the two-action menu, retained inline history/files, absent read-only/unbooked menu and preserved four-status selection/validation/save flow. Dashboard plan v2.116 and Figma shared menu/read-only header handoff aligned. Native status/cancellation and read-only layout checks remain pending.

## 2026-10-09 | Version: truck-popup-motion-v1

- **Summary:** Show whether the truck is moving or stationary and its reported speed in the Expo map popup.
- **API Changes:** Driver current/run-position responses add nullable `speed_kph` and `motion_status` (`moving`/`stationary`). Only expose finite nonnegative tracker speed matching the displayed position timestamp and coordinates; existing scope and response fields retained. Mobile fields are optional for older API compatibility.
- **Database Changes:** None.
- **Behavior Changes:** Stationary uses the existing configured speed threshold (default ≤3 km/h). Show status and km/h above Last reported. Reports older than 15 minutes explicitly show Last reported and Outdated; missing/invalid/future/unmatched reports show Movement unknown. Preserve address/geofence labels, accessible descriptions and existing polling.
- **Breaking Changes:** None. Deploy the backend addition for populated motion fields; older backends show Movement unknown.
- **Verification:** 34 driver API tests pass (297 assertions), including both endpoints, threshold/zero/nested provider readings, mismatched observations, malformed data and driver scope. Four mobile address/motion tests, full TypeScript, focused label/API ESLint, PHP syntax and diff checks pass. Simulator truck accessibility exposes Movement unknown for the current report; known-motion native callout, dark/large-text/Android and live tracker transitions remain unverified. Dashboard plan v2.115 and editable Figma motion references/scenario handoff aligned and visually reviewed.

## 2026-10-09 | Version: shipment-history-order-v1

- **Summary:** Show shipment history details below Shipment info.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reorder the shared inline/nested card to Shipment info, history events and lifecycle dates/odometers, then Proof of delivery. Preserve field filtering, event order and empty-section handling. Apply separators only when preceding content exists.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Mocked card rendering confirms info/history/proof order, omitted empty cards and no leading separators when preceding sections are absent. Selected Figma cards and handoff align with dashboard plan v2.114. Native theme/large-text layout remains pending.

## 2026-10-09 | Version: shipment-remove-files-menu-v1

- **Summary:** Remove the redundant Delivery note & files action from Shipment options.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove the menu action and unused duplicate files panel from the shared shipment page/sheet. Use the existing Files section below Parcels for file upload/download/loading/retry/empty feedback. Retain Update delivery status, Shipment history and destructive Cancel shipment for active bookings; completed-run views retain history and authorized inline file downloads without uploads.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Mocked status/menu checks pass; additional mocked checks confirm active/read-only menu contents and retained inline Files controls. Dashboard plan v2.113 and shared Figma menu/handoff aligned. Native menu/file interaction remains unverified; locked Mac prevents simulator and GitHub Desktop access.

## 2026-10-09 | Version: shipment-status-action-sheet-v1

- **Summary:** Show all available driver statuses in an action sheet when Update delivery status is pressed.
- **API Changes:** None; reuse authorized shipment-status update endpoint.
- **Database Changes:** None.
- **Behavior Changes:** After Shipment options dismisses, show Booked, Delivered, In transit and Failed Delivery in the shared push-stacked ActionSheet with current selection and close control. Selecting dismisses the picker, then opens the existing status confirmation form; selection does not save. Replace inline status pills with selected status and Choose a different status, which reopens the picker with the draft selected. Preserve failure-reason and odometer validation, error/retry drafts, saved-state refresh and completed-run read-only guards.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Temporary mocked flow verifies all four options/current selection, deferred form/mutation, each selection, reselection, required failure reason and successful mocked save, and omission of status actions for completed-run views. Dashboard plan v2.112 and Figma handoff aligned. Native iOS/Android stacking/dismissal/keyboard and live status saves remain unverified.

## 2026-10-09 | Version: shipment-hide-scanned-count-v1

- **Summary:** Remove the scanned-parcel subtitle from shipment details while scanning is unavailable.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide the X of Y parcels scanned line beneath Parcels on the shared shipment page/sheet, including completed-run views. Retain the Parcels heading, total parcel summary, tracking codes/contents, recorded scan data and collection-status logic.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Dashboard plan v2.111 and affected Figma receipt references/handoff aligned. Native light/dark/large-text parcel-card spacing remains pending.

## 2026-10-09 | Version: shipment-history-remove-titles-v1

- **Summary:** Remove Shipment history and Timeline titles from the shared history card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Begin the inline/nested history card with events or existing empty-history feedback and booking fields. Remove heading-only top spacing; retain Shipment info, Proof of delivery, filtering and all recorded data. Keep history menu/panel navigation titles.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Selected Figma receipt/state headings and handoff aligned; dashboard plan 2.110 updated. Native theme/large-text/layout checks and GitHub Desktop draft access remain blocked while the Mac is locked.

## 2026-10-09 | Version: shipment-actions-button-v1

- **Summary:** Replace the shipment header ellipsis with an Actions button and down chevron.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show a compact rounded outlined Actions button in the shared shipment page and receipt sheet, including completed-run read-only views. Retain the existing Shipment options menu, mutation/data disabled guards and post-dismissal action handoff. Use light/dark surfaces, a 44-point minimum target, accessible label/hint/state and disabled opacity.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript and focused ShipmentDetails lint pass; diff checks pass. Selected active/completed Figma headers visually checked and handoff aligned; dashboard plan 2.109, status, acceptance and revision history updated. Native light/dark/large-text layout and menu opening remain unverified because the Mac is locked; GitHub Desktop draft fields could not be accessed.

## 2026-10-09 | Version: remove-map-recovery-button-v1

- **Summary:** Remove the floating Use Apple Maps button from the dashboard and shared native maps.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove the manual recovery control/state/style and unused top-inset prop. Keep normal provider selection, automatic catchable-render-error fallback, routes/markers, map refs and settings/info controls. Silent tile failures no longer have an explicit manual provider switch.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused NativeMap lint and RunMap lint with its pre-existing purity-rule violation excluded, nine existing provider-policy regressions and diff checks pass. Dashboard plan v2.108 and Figma handoff aligned. Native visual/provider verification remains pending.

## 2026-10-09 | Version: delivery-order-native-drag-v1

- **Summary:** Fix delivery-order handle dragging competing with native list scrolling.
- **API Changes:** None; retain full shipment order and expected-order payload.
- **Database Changes:** None.
- **Behavior Changes:** Replace per-render PanResponder handles with stable native Gesture Handler Pan recognizers that block the list's Native scroll gesture. Preserve row-body scrolling, edge auto-scroll, accessible earlier/later moves, disabled/busy/conflict guards and final release displacement. Successful gestures commit the draft; cancellations discard drag displacement. Sheet content panning remains disabled. Retain save/reload errors and completed shipment slots.
- **Breaking Changes:** None. Uses the existing Gesture Handler dependency; reload the development client to receive the JavaScript update.
- **Verification:** Full mobile TypeScript, focused DeliveryOrderSheet lint and three mocked regressions pass for gesture ownership/stability/current callbacks, cancellation/disabled accessibility and reordered save/concurrency payload. Diff checks pass. Dashboard plan v2.107 and Figma scenario handoff aligned. Mac lock prevented simulator/desktop access; physical iOS/Android dragging, edge scrolling, interrupted gestures and live save/reload remain unverified. Gesture-callback ref lint is locally suppressed because these callbacks run on touch events, not during render.

## 2026-10-09 | Version: endpoint-search-hide-close-v1

- **Summary:** Remove the top-right close button from planned start/end location search.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide the shared BottomSheet close control only while selecting an Edit Run endpoint. Keep the leading back arrow, keyboard dismissal, confirmed endpoint drafts and existing location selection/save behavior. Other run-action steps retain close.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused RunActionForm lint and diff checks pass. Dashboard plan v2.106 and Figma scenario handoff aligned. Native light/dark/keyboard/long-title layout remains pending.

## 2026-10-09 | Version: shipment-readable-dates-v1

- **Summary:** Replace raw ISO shipment history timestamps with readable dates and times.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Format booked/collected/delivered/returned/cancelled dates, proof capture and status-event timestamps as 9 Oct 2026 · 12:56 in the device's local timezone, using 24-hour time without seconds. Apply to shared inline/nested history; retain unavailable filtering and unexpected invalid source text.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails ESLint, formatter checks and diff checks pass. Verified supplied timestamp examples, equivalent UTC/offset values, missing values and invalid source text using Africa/Johannesburg. Dashboard plan v2.104/Figma handoff aligned. Native wrapping/theme/large-text checks remain pending.

## 2026-10-09 | Version: speeding-empty-state-v1

- **Summary:** Improve the dashboard's empty speeding-events presentation.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the plain sentence with a centered activity icon in a themed green circle, No speeding events heading and wrapping recorded-events explanation. Preserve filter/count controls, populated timelines and other empty states; avoid inferring safe driving from absent records.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript and diff checks pass. Focused dashboard ESLint passes with react-hooks/set-state-in-effect excluded; normal lint still reports the two pre-existing effects at lines 79/113. Dashboard plan v2.105 and Figma empty-state reference/handoff aligned. Native light/dark/large-text and sheet-position verification pending.

## 2026-10-09 | Version: message-reference-detail-sheets-v1

- **Summary:** Open run and shipment message references in bottom sheets.
- **API Changes:** None; reuse authorized driver run/shipment APIs.
- **Database Changes:** None.
- **Behavior Changes:** Make draft reference chips tappable with separate removal; replace sent reference page navigation with detail sheets. Dismiss the keyboard and retain Messages/draft state. Reuse ShipmentDetailsSheet with optional completed-run scope. Add RunDetailsSheet with shared run summary/timeline, shipment/stop drilldowns, loading/retry and stale-response guards. Keep completed-run shipment access read-only; file downloads remain unchanged.
- **Breaking Changes:** None.
- **Verification:** Twelve mocked Messages/run-sheet regressions pass for draft/sent sheet opening, retained drafts, completed shipment scope, authorized loading/retry and ignored unmounted responses, alongside prior draft/focus/refresh checks. Full mobile TypeScript, focused Messages/RunDetailsSheet ESLint and diff checks pass. Dashboard plan v2.103/Figma handoff aligned. Native keyboard, sheet stacking/dismissal and live authorization remain unverified.

## 2026-10-09 | Version: shipment-message-autofocus-v1

- **Summary:** Focus the message input after a shipment is automatically attached from Message dispatch.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Schedule composer focus after the shipment chip is rendered and the chat is loaded/editable. Focus once per successful handoff; cancel scheduled focus on blur/unmount and preserve pending focus for return. Ordinary Messages visits, removed attachments, closed/full drafts and mismatched accounts do not trigger autofocus.
- **Breaking Changes:** None.
- **Verification:** Eight mocked Messages screen regressions, full mobile TypeScript, focused Messages ESLint and diff checks pass. Covers focus once after attachment, loaded-composer gating, blur cancellation/return and blocked handoffs. Dashboard plan v2.101/Figma handoff aligned. Physical-device keyboard/navigation remains unverified.

## 2026-10-09 | Version: shipment-inline-history-card-v1

- **Summary:** Display full shipment history in a card below Files, separated by a matching dashed receipt divider.
- **API Changes:** None; reuse the existing shipment history, booking and proof fields.
- **Database Changes:** None.
- **Behavior Changes:** Replace the receipt history link with a rounded card grouping status updates/recorded visits, booking dates/odometers/distance, shipment info and proof metadata. Share the content with the More history shortcut on page/sheet and retain completed-run scope. Preserve existing event order/source labels/timestamps and the parallel unavailable-row/empty-section filtering. Keep the upper receipt divider and Message dispatch placement.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails ESLint, 15 backdrop/sheet-handoff regressions, five actual-component rendering checks and diff checks pass. Fixtures cover missing/empty data, all existing details/long descriptions, event order/source labels, zero odometer, both card surfaces and decorative dividers. iOS Expo Go verifies completed-run shipment opening, scrolling to Files/history, the new divider/card surface and More options opening. History shortcut selection, deeper scrolling, active upload/Message dispatch, native dark/large text and Android remain unverified; the Mac locked during final checks. Dashboard plan v2.102 and selected editable Figma receipt/history references aligned and visually reviewed.

## 2026-10-09 | Version: shipment-hide-unavailable-details-v1

- **Summary:** Show only populated shipment history and metadata details.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide rows with null, empty, whitespace or literal Not available values. Omit empty Timeline, Shipment info and Proof of delivery sections and an entirely empty history card. Apply to shared inline receipt and nested history content. Preserve populated events, dates, references and valid zero odometer/distance values.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails ESLint, mocked row/section render checks and diff checks pass. Render checks cover case-insensitive unavailable values, empty history/POD, populated references/dates and zero odometer. Dashboard plan v2.100/Figma handoff aligned; native theme/large-text layouts remain unverified.

## 2026-10-09 | Version: shipment-dispatch-draft-reference-v1

- **Summary:** Automatically attach the current shipment to the Messages draft opened by Message dispatch.
- **API Changes:** None; reuse existing chat reference send payload and backend authorization.
- **Database Changes:** None.
- **Behavior Changes:** Pass shipment ID/reference, a unique handoff request and originating account to Messages. Add a removable shipment reference once after the driver chat opens, preserving draft text/files/references. Clear handoff parameters to avoid reattaching after removal, send or tab return. Keep explicit Send, duplicate prevention, closed-chat feedback and the five-attachment limit; do not apply another account's handoff. Read-only shipment availability remains unchanged.
- **Breaking Changes:** None.
- **Verification:** Seven mocked actual Messages screen regressions pass for draft prefill/removal/refocus, text preservation, duplicates/capacity and closed/account guards, alongside existing refresh behavior. Full mobile TypeScript, focused Messages/ShipmentDetails ESLint and diff checks pass. Dashboard plan v2.99/Figma handoff aligned. Native navigation/dismissal and live message send remain unverified.

## 2026-10-09 | Version: notification-registration-backoff-v1

- **Summary:** Prevent repeated message-notification device registration from flooding the API and opening the development error screen on HTTP 429.
- **API Changes:** No server contract change. Mobile API errors expose optional `retryAfterMs` parsed from Retry-After seconds or HTTP dates.
- **Database Changes:** None.
- **Behavior Changes:** Share concurrent registration across foreground, notification settings and native token callbacks. Limit attempts to once per minute, skip posting an unchanged successfully registered token for 24 hours, register changed tokens or sessions, and back off failed attempts exponentially up to 15 minutes while honoring longer server retry delays. Retain authentication/lifetime guards and retry on later foreground/token/settings triggers. Log device-registration 429 as a warning while continuing to throw its typed error; other request failures retain existing error logging. No backend limiter weakening or visual design change; existing Figma notification screens remain applicable.
- **Breaking Changes:** None. Mobile update required; no API deployment needed.
- **Verification:** 15 focused mobile registration, notification navigation and settings tests pass, including callback reentry, concurrent triggers, unchanged/rotated tokens, session expiry, failure recovery, Retry-After parsing and log severity. Full mobile TypeScript, focused API/provider/helper ESLint and diff checks pass. Live physical-device push registration and deployed rate-limit recovery remain unverified.

## 2026-10-09 | Version: shipment-empty-files-single-upload-v1

- **Summary:** Show one upload action in empty shipment Files cards.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide the top-right Upload action when the file list has no entries. Keep centered Upload a file after a confirmed empty response, retain header Upload when entries exist and preserve loading/error/read-only behavior. Applies to the shared shipment receipt/page/files panel.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails ESLint and diff checks pass. Dashboard plan v2.98 and Figma active empty/reference cards and handoff aligned; empty Figma card visually checked. Native device layout remains unverified.

## 2026-10-09 | Version: background-phone-location-v1

- **Summary:** Request background phone-location access and share opted-in driver location while the app is in the background.
- **API Changes:** None; reuse existing scoped location-sharing/report endpoints.
- **Database Changes:** None. Local AsyncStorage stores the opted-in driver ID/consent time; background reports read the existing persisted authenticated session rather than copying credentials.
- **Behavior Changes:** Explain background use before requesting foreground then iOS Always/Android Allow all the time access. Offer Allow background location to existing foreground-only users without automatic prompting; retain existing opted-in foreground fallback. Register a module-scope Expo location task with balanced native updates targeting 30 seconds/25 metres, iOS indicator and Android service notification. Recheck current session/local consent/server opt-in before sending the newest recent point; ignore pre-consent/stale coordinates. Serialize start/stop and halt on off/logout, revoked authorization or server-disabled sharing; transient failures retry on the next observation. Preserve off-warning OK flow, dispatch alerts and save/permission guidance. Account copy explains background access and force-quit/device limits.
- **Breaking Changes:** Native app rebuild required for expo-task-manager and iOS/Android background permissions; Metro reload/OTA alone cannot enable this feature. Old clients retain foreground fallback and show update guidance for background opt-in. Background execution is unavailable in Expo Go/web and is not guaranteed after force-quit or device restrictions.
- **Verification:** Full mobile TypeScript and focused location screen/provider/task lint pass. Sixteen provider/native-task mocked regressions cover permission denial, opt-in/background retention, logout/stale-session cancellation, failed off, revocation, persisted authenticated task reporting, remote-off, old/pre-consent points and transient/authorization errors. Expo config introspection confirms iOS location background mode/Always rationale and Android background/foreground-service permissions. Dashboard plan v2.97 and Figma scenario handoff aligned; diff checks pass. Rebuilt physical iOS/Android permission/background/locked-screen/off/logout, dispatch reporting and battery behavior remain unverified. No live locations transmitted or user permissions changed.

## 2026-10-09 | Version: endpoint-search-header-back-v1

- **Summary:** Move planned start/end location-search back navigation beside the title.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use the shared BottomSheet header back control to return to Edit Run and dismiss the keyboard. Remove bottom Back to endpoints and Cancel actions while searching. Preserve previously confirmed endpoint drafts, location previews/confirmation, header close and atomic Save endpoints. Edit Run retains Cancel outside the search step.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused RunActionForm ESLint and diff checks pass. Dashboard plan v2.96 and Figma run-action/scenario handoff aligned. Native back/keyboard/layout verification remains pending.

## 2026-10-09 | Version: shipment-backdrop-order-v1

- **Summary:** Prevent an opening/refreshing shipment receipt from remounting its backdrop above the content.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the inline receipt backdrop renderer with a stable module-level component. Preserve animated props, backdrop open/closed indices, close/dismissal and shipment upload/source/native-picker flows. The iOS FullWindowOverlay mounts new native children at the top; stabilizing the backdrop prevents rerenders from putting its dimming/touch layer above the receipt. Corrects the overlay defect still present after the earlier scroll change.
- **Breaking Changes:** None.
- **Verification:** Two mocked receipt-host regressions pass for stable identity on open/refresh and retained header close/post-removal dismissal; both fail with the prior inline renderer. Full mobile TypeScript, focused ShipmentDetails ESLint and diff checks pass. Dashboard plan v2.95 and Figma handoff aligned. Simulator/device interaction remains unverified: computer-use reports the Mac is locked and requires manual unlock.

## 2026-10-09 | Version: location-off-alert-sheet-v1

- **Summary:** Show the location-sharing dispatch warning only when the user tries to switch sharing off.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove the permanent dispatch warning card from Account Location. Present a reusable single-action AlertSheet built on MessageSheet/BottomSheet, with a bottom OK button. OK applies the off change after the alert fully closes; closing/backdrop/swipe/Android Back keeps sharing on. Turning sharing on and initial/settings refresh do not show the warning. Preserve provider permissions, dispatch reporting, busy/unavailable guards and save-error guidance.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused Location/AlertSheet lint and diff checks pass. Mocked actual screen/component checks cover absent persistent warning, off-only prompt, acknowledgement, enabling, save guard, failure guidance and reusable single-OK configuration. Dashboard plan v2.94 and Figma scenario handoff aligned. Native dismissal/layout and real dispatch reporting remain unverified; no live sharing settings changed.

## 2026-10-09 | Version: shipment-sheet-touch-scroll-v1

- **Summary:** Fix competing gesture/scroll registrations in the Expo shipment receipt opened from timeline links.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the static BottomSheetView wrapper with a plain bounded View and use native receipt scrolling. Disable sheet content panning so buttons and the scroll area own touches; retain dragging via the handle, header close and backdrop dismissal. Apply to the shared dashboard/map/run/stop shipment sheet; preserve read-only scope, styling and upload/native-picker handoffs.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails ESLint, 13 existing sheet-handoff regressions and diff checks pass. Confirmed in the installed Gorhom source that BottomSheetView overwrites the active scrollable type with VIEW. Dashboard plan v2.93 and Figma scenario handoff aligned. Physical iOS/Android button, scroll, dismissal/reopen and nested-menu interaction remain unverified; the simulator session exposes a current run with no shipment links.

## 2026-10-09 | Version: message-reference-recents-v1

- **Summary:** Show the 10 most recent runs or shipments by default in message attachment selectors.
- **API Changes:** GET `/api/v1/conversations/{conversation_uuid}/references` accepts omitted/blank `search` and returns up to 10 authorized records ordered by creation date descending, then ID descending, with single-page metadata. Nonblank searches retain full scoped search and 20-result pagination.
- **Database Changes:** None.
- **Behavior Changes:** Load recent records on opening either selector. Submitted search replaces recents; Clear reloads recents. Label recent/search modes, avoid automatic keyboard opening, preserve loading/error/retry/empty states, search pagination, stale-response guards and selected preview/Attach confirmation.
- **Breaking Changes:** None. Deploy the API alongside the mobile update to support blank search.
- **Verification:** Fifteen conversation API tests pass (286 assertions), including default limit/date order, empty/omitted/whitespace search, completed assignments and searching older records. Six mocked picker tests pass for both types, replacement/Clear, paging and stale results, failure/retry/empty and Attach confirmation. Full mobile TypeScript, focused picker ESLint, PHP style and diff checks pass. Dashboard plan v2.92 and Figma handoff aligned. Deployed API and native iOS/Android interaction remain unverified.

## 2026-10-09 | Version: shipment-native-picker-layering-v1

- **Summary:** Prevent the Shipment bottom sheet from covering native File, Photo and Camera selection.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep shipment state and upload/source sheets outside the receipt portal. Await upload dismissal and full receipt portal/window-overlay removal before opening source/native UI; suppress temporary host close/refresh and restore receipt before upload. Preserve the file-type/expiry/selected-file draft through cancellation, permission denial and picker errors. Normal dismissal still closes the host; unmount prevents stale restoration.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails and StopDetailsSheet lint, 13 sheet-handoff regressions, mocked actual shipment host lifecycle and existing mocked File/Photo/Camera/dropdown/upload flow pass. Dashboard plan v2.91 and Figma shipment handoff aligned. Physical iOS picker layering/return and Android verification remain pending; no live upload performed.

## 2026-10-09 | Version: stop-sheet-remove-captions-v1

- **Summary:** Remove the two highlighted secondary labels from the Expo stop-details sheet.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Omit Stop location beneath valid stop maps and No shipments linked to this location in this run. Hide the empty shipment-section container to avoid extra spacing. Apply through the shared dashboard/run-details sheet; retain timing, map/missing-position feedback, populated shipment links and the speeding-event position caption.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused StopDetailsSheet ESLint and diff checks pass. Dashboard plan v2.90 and Figma stop references/scenario handoff aligned; updated Figma reference visually checked. Native iOS/Android layout verification remains pending.

## 2026-10-09 | Version: shipment-file-source-sheet-v1

- **Summary:** Let drivers choose shipment files from File, Photo or Camera.
- **API Changes:** None; reuse shipment upload contract and authorization.
- **Database Changes:** None.
- **Behavior Changes:** Choose file and Choose a different file open the shared closeable File/Photo/Camera action sheet. Present the upload form in a shared content-sized BottomSheet and use post-portal-removal dismissal before the source menu/native picker, restoring the retained file-type/file/expiry draft once afterward. File uses DocumentPicker, Photo uses the system image library, and Camera requests permission before capture. Normalize image assets for existing uploads. Preserve previous selection on cancellation/denial/error, show error guidance, block selection/upload while picking and ignore unmounted results. Retain dropdown/expiry/read-only rules.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Temporary mocked source/dropdown/upload flow verifies menu choices, dismissal-before-source, File cancellation/selection, source cancellation, Photo cancellation/selection, camera denial/capture, preserved selection, upload failure/retry and success refresh, form close, browser callback and completed-run scope. Eight existing sheet-handoff regressions pass using Node experimental type stripping. Figma source-sheet reference/upload shortcut/handoff and dashboard plan v2.89 aligned; design screenshot checked. Native picker layering/return, physical camera, Android/theme/large-text behavior and actual uploads remain unverified; no live upload performed.

## 2026-10-09 | Version: ios-development-build-config-v1

- **Summary:** Declare standard/exempt iOS encryption for development build setup.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Set `ios.infoPlist.ITSAppUsesNonExemptEncryption` to false. The mobile app uses HTTPS and random UUID generation; no custom encryption implementation was found in the mobile sources. Retain the existing physical-device development profile and notification/location plugins.
- **Internal Changes:** EAS development environment and CENTER CUBE signing are configured. Reuse the existing distribution certificate and push key; create an ad hoc profile for all three registered devices as authorized. Build `3efae758-610b-4e50-91fd-b133f55396a4` finished successfully and produced a signed physical-device development IPA. [Install/build details](https://expo.dev/accounts/leroyg/projects/spaces-digital/builds/3efae758-610b-4e50-91fd-b133f55396a4). The build contains the mobile source snapshot uploaded at creation; changes made afterward require Metro reload or another native build as appropriate.
- **Breaking Changes:** None.
- **Verification:** App configuration JSON parses and diff checks pass. EAS confirms active provisioning for the registered iPhone, iPhone 11 Pro and iPad Pro (10.5 inch), and the assigned Apple push key. EAS reports FINISHED with an IPA artifact; cloud compilation and artifact upload completed successfully. Device installation and real notification delivery remain unverified.

## 2026-10-09 | Version: run-dashboard-refresh-spacing-v1

- **Summary:** Prevent automatic Runs/dashboard refreshes from opening native pull-refresh spacing.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Separate actual pull-to-refresh feedback from focus/foreground, retry and post-action loads. Clear pull state on success, failure and blur; invalidate dashboard requests on blur so late results cannot alter the returning screen. Disable automatic content inset adjustment on both scroll containers; retain screen-owned safe-area spacing, initial loading, loaded content, error/retry and pagination.
- **Breaking Changes:** None.
- **Verification:** Six mocked screen lifecycle regressions pass for initial/background loads, pull success/failure/blur and superseded completion on both screens. Full mobile TypeScript, focused Runs/dashboard lint excluding existing dashboard effect-rule errors and diff checks pass. iOS simulator confirms normal Runs/dashboard content spacing on tab return. Dashboard plan v2.88 and Figma scenario handoff aligned. The reported intermittent physical-device gap, native pull animation and Android behavior remain unverified.

## 2026-10-09 | Version: shipment-file-type-dropdown-v1

- **Summary:** Replace the shipment upload file-type cards with a compact dropdown.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show the selected type or Select a file type with a chevron; expand a bounded scrollable list and collapse after selection. Show only the selected description below. Preserve file picker, expiry requirements and upload validation. Disable type selection while loading/uploading or when no configured types exist; reset expansion on form reset/close. Support themes, wrapping labels and accessible expanded/selected states.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused ShipmentDetails lint and diff checks pass. Temporary mocked flow verifies initially collapsed options, expansion, selection/value update and collapse, plus existing picker cancellation/selection, upload failure/retry, success refresh, browser callback, form close and completed-run scope. Dashboard plan v2.87 and Figma dropdown states/upload handoff aligned; design screenshot checked. Native dropdown scrolling, light/dark and large-text interaction remain unverified. No live upload performed.

## 2026-10-09 | Version: dashboard-dark-theme-v1

- **Summary:** Make the Expo dashboard follow the selected Light/Dark/Device theme.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove forced light appearance. Theme the persistent run sheet/handle, dashboard canvas, warnings, timeline links, map information/status/empty cards, truck popup and web map fallback. Use a brighter green route/link accent and readable amber text in dark mode; retain green filled actions and distinct marker colours. Pass dark appearance to Apple Maps and select the central dark custom style for Google Maps, including shared stop previews. Preserve run data, actions, routing and sheet snap points.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused changed-file lint excluding three pre-existing dashboard/map hook-rule errors, 13 existing map/provider regressions and diff checks pass. iOS simulator visually verifies dark Apple tiles, warning card, current-run sheet and expanded timeline, plus switching back to light map/sheet appearance. Dashboard plan v2.86 and active/empty Figma theme modes/handoff aligned and visually checked. Android/Google tiles, native no-run state, truck popup and large-text checks remain pending.

## 2026-10-09 | Version: web-messages-unread-nav-v1

- **Summary:** Show an unread-message count beside Messages in the website admin navigation.
- **API Changes:** Add authenticated GET `/api/v1/conversations/unread?merchant_id={uuid}` returning `data.unread_count`. Enforce merchant/account access, active group membership and dispatch permissions; use existing group read cursors and shared incoming-driver read receipts. Exclude own messages and deleted messages/conversations. Retain the driver unread endpoint.
- **Database Changes:** None.
- **Behavior Changes:** Show a red count badge only above zero, capped visually at 99+ with the full count in its accessible label. Scope to the selected workspace; refresh on mount, every 10 seconds while visible, browser focus/visibility return and successful inbox reads. Ignore late responses after scope changes/unmount, queue refreshes behind in-flight requests and retain confirmed counts on transient errors. Hide the badge in the collapsed icon sidebar.
- **Breaking Changes:** None. Deploy the API with the website update.
- **Verification:** All 14 conversation API tests pass (244 assertions), including unread scope, read-only access, outgoing/deleted exclusions, independent group cursors, read clearing and removed membership. Three mocked frontend regressions pass for refresh/read events, hidden polling, errors, scope changes, cleanup and in-flight read refreshes. Full website TypeScript, focused frontend ESLint, PHP style and diff checks pass. Live browser rendering and deployed API integration remain unverified.

## 2026-10-09 | Version: messages-compact-composer-v1

- **Summary:** Reduce padding and spacing around the Expo Messages composer.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reduce composer minimum height from 64 to 54 points, inner padding from 9 to 4, button gaps from 10 to 6, and input vertical padding from 10 to 6. Reduce shelf side padding to 12 and top/bottom padding to 8/6. Preserve 44-point button tap areas and multiline input.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript and focused Messages lint pass. Diff checks pass. Native iOS/Android layout, keyboard and large-text appearance remain unverified.

## 2026-10-09 | Version: notification-permission-switch-v1

- **Summary:** Show a message-notification switch in the driver Notifications screen.
- **API Changes:** None; reuse device push-token registration.
- **Database Changes:** None.
- **Behavior Changes:** Show an accessible switch beside Message notifications. Enabling requests native permission and immediately registers the device after consent; Android creates the Messages channel before the prompt. Denied permission stays off; blocked permission and disabling open device settings. Refresh permission state on focus/foreground, guard duplicate actions and ignore registration after leaving the screen or changing sessions. Expo Go/web previews show a disabled switch with availability guidance. Keep messages usable without notifications.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused Notifications/provider lint, six mocked settings regressions and three existing notification-navigation tests pass. Diff checks pass. Installed iOS/Android prompts, settings handoff, layout and real push delivery remain unverified.

## 2026-10-09 | Version: messages-preserve-refresh-v1

- **Summary:** Keep loaded driver conversations visible during refresh and show a small spinner at the top-right of the Messages header.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Retain messages, older-page cursor, scroll position and the editable draft when returning to Messages, polling, foregrounding or retrying a failed refresh. Show the full-body loader only before the first message response; confirmed empty conversations also use the header spinner on refresh. Stop loading feedback when requests finish and preserve existing error/retry handling. Depend on the auth token rather than the whole session object to avoid reloading on profile updates; retain user/conversation isolation and stale-response guards.
- **Breaking Changes:** None.
- **Verification:** Four mocked screen regressions pass for initial/poll loading, retained draft/messages/cursor on focus and Retry, confirmed empty foreground refresh, session metadata updates and ignored late blurred responses. Three existing notification-navigation tests, full mobile TypeScript, focused Messages lint and diff checks pass. iOS simulator Messages empty layout visually checked; the available conversation has no messages, so populated live refresh and Android interaction remain unverified. No live message was sent.

## 2026-10-09 | Version: required-uploads-inline-row-v1

- **Summary:** Align the Required uploads icon, count and label inline.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use a compact, full-width horizontal required-summary row with a trailing chevron. Keep 76-point minimum height, theme-aware amber styling, wrapping label and the existing required-document sheet action. Any expired summary follows below.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused Documents lint and diff checks pass. Dashboard plan v2.85 and Figma card/handoff aligned; card visually checked. Native narrow-screen, large-text, dark-mode and combined required/expired-summary checks remain unverified.

## 2026-10-09 | Version: driver-document-source-actions-v1

- **Summary:** Show File, Photo and Camera when choosing a driver document.
- **API Changes:** None; reuse the driver-file upload endpoint.
- **Database Changes:** None.
- **Behavior Changes:** Choose file and Choose a different file open the shared action sheet with File, Photo and Camera in that order. Dismiss the upload sheet, then dismiss the chooser before presenting the selected native source. Request camera permission only for Camera; adapt selected/captured images to the existing upload asset. Preserve type, expiry and previous file on chooser/picker cancellation, permission denial or source error. Restore the form with errors when needed; ignore late results and resolve pending chooser work on unmount. Selection does not upload automatically.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused Documents lint, eight existing shared sheet-handoff tests and diff checks pass. Dashboard plan v2.84 and editable Figma chooser/handoff aligned; chooser visually checked. Native iOS/Android File/Photo/Camera presentation, permission denial, camera capture and real image uploads remain unverified.

## 2026-10-09 | Version: driver-account-design-1-v1

- **Summary:** Implement selected Figma Design 1 for the mobile driver account, with profile photo/initials, name, assigned merchant and a grouped settings list without an Account heading.
- **API Changes:** Add authenticated, merchant/account-scoped GET/PATCH `/api/v1/driver/location-sharing` and POST `/api/v1/driver/phone-location`. Auth user resources include nullable `driver_merchant` with merchant UUID/name. Validate recent coordinates and throttle writes; reject reports while sharing is off and ignore older observations.
- **Database Changes:** No migration. Store opt-in and latest phone coordinates in existing driver metadata; preserve other metadata. Disabling removes coordinates and creates one dispatch-conversation message in the same transaction. Repeated disabled saves do not duplicate alerts; failed alerts roll back the preference change.
- **Behavior Changes:** Link to Edit profile, Vehicles, Notifications, Theme and Location. Use real profile data with initials when a photo is absent or fails. Persist Light/Dark/Device theme; Notifications reflects native permissions and opens device settings in installed builds. Phone location defaults off, requires foreground OS consent before enabling, and reports every 30 seconds only while the app is active. Pause in background/logout, ignore late coordinates/permission results, and disable sharing with a dispatch alert on detected permission revocation. Show dispatch-warning/confirmation, unavailable/retry and permission-remediation feedback. Keep vehicle tracking, driver presence and run geofencing separate. Align the selected original/review Figma Location screens with foreground-only phone sharing.
- **Breaking Changes:** None for existing API consumers. Deploy the API before releasing the mobile client; rebuild the native client for expo-location permissions and automatic device theme support.
- **Verification:** 30 Laravel feature tests pass (290 assertions), covering phone-location consent state, validation, scope, dispatch-inbox visibility, retry deduplication and rollback alongside merchant/conversation regressions. Seven mocked provider regressions pass for permission, opt-in, foreground/logout cancellation, failed disable and revocation. Full mobile TypeScript, focused account/theme/provider lint, PHP style and diff checks pass. iOS Expo Go visually verified profile light/dark, Theme and Location navigation/warning/unavailable feedback and Notifications fallback. Live API currently lacks these endpoints/merchant fields; no live coordinate report or dispatch alert was sent. Rebuilt iOS/Android permission flows, real phone GPS/reporting, installed notification settings and end-to-end deployed API checks remain release gates.

## 2026-10-09 | Version: driver-document-upload-sheet-v1

- **Summary:** Present driver document upload in a bottom sheet with a file-type dropdown.
- **API Changes:** None; retain existing file types and driver-file upload endpoints.
- **Database Changes:** None.
- **Behavior Changes:** Replace the native page-sheet modal and full file-type cards with the shared scrollable bottom sheet and collapsed dropdown. Show the selected type description and conditional expiry field; clear expiry when changing type. Preserve file/expiry validation, loading/retry/no-types feedback and successful upload refresh. Dismiss the sheet before opening the native file picker and restore its draft on selection/cancellation/error; ignore late picker results after unmount. Disable controls and dismissal during upload.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript, focused Documents lint, eight existing shared sheet-handoff regressions and diff checks pass. Dashboard plan v2.83 and editable Figma upload sheet/hand-off aligned; sheet visually checked. Native iOS/Android dropdown, date/file picker layering, large-text/dark-mode layout and live uploads remain unverified.

## 2026-10-09 | Version: required-documents-sheet-v1

- **Summary:** Show missing driver documents in a bottom sheet when Required uploads is tapped.
- **API Changes:** None; use existing dashboard `missing_required_names`, including dispatch-managed requirements.
- **Database Changes:** None.
- **Behavior Changes:** Open the shared scrollable Required documents sheet with wrapping names, loading, Retry and confirmed empty feedback. Refresh on every opening and ignore superseded/unmounted requests. Keep the header Upload document action and its existing form separate.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript and focused Documents lint pass; diff checks pass. Dashboard plan v2.82 and editable Figma sheet/hand-off aligned; Figma sheet visually checked. Native iOS/Android interaction, dark mode and large-text scrolling remain unverified.

## 2026-10-09 | Version: shipment-inline-files-v1

- **Summary:** Show shipment files directly below Parcels in the shared mobile shipment page and bottom sheet.
- **API Changes:** None; retain existing shipment file list/upload and authorized download endpoints.
- **Database Changes:** None.
- **Behavior Changes:** Replace the Delivery note & files receipt link with a rounded Files card, green header Upload, wrapping icon-led file rows with type/expiry/chevron, and centered No files uploaded yet with Upload a file. Both upload controls reuse the existing file-type/picker/expiry form; refresh files after upload. Share rendering with the existing menu shortcut. Show loading/retry instead of premature empty feedback, preserve known files on errors and ignore stale/unmounted list responses. Completed-run views retain scoped file access and omit upload controls.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript and focused ShipmentDetails lint pass. Seven temporary mocked rendering/action scenarios cover populated/empty/loading/error, both upload buttons, retry/open callbacks, disabled controls and dark/read-only states. Temporary mocked shipment flow verifies form entry, picker cancellation/selection, upload failure/retry, success refresh/close, authorized download/browser callback, form dismissal and completed-run list scope. Diff checks pass. Dashboard plan v2.81, selected Figma active/read-only layouts, visible Files state references and shipment handoff aligned; reference cards visually checked. Native scrolling/large text, OS picker/browser layering and real uploads remain unverified: simulator was at home with no Expo server running. No live upload, API or database mutation performed during verification.

## 2026-10-09 | Version: run-open-dashboard-green-v1

- **Summary:** Explicitly render the run detail Open dashboard button in green.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Set the button background to the approved `#15803D` primary green directly, retaining white text, run navigation and disabled gating; reduce opacity while disabled.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused run-detail lint and diff checks pass. This corrects implementation of the existing green-primary plan/Figma; native rendering on the supplied device remains unverified.

## 2026-10-09 | Version: run-actions-end-run-last-v1

- **Summary:** Move End Run to the bottom of the Expo run actions list.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Order actions as Edit Run, Update delivery order, Add additional cost, conditional Upload delivery note, then End Run. Retain red destructive styling, pending-request disabling and the existing reason/dispatch approval flow.
- **Breaking Changes:** None.
- **Verification:** Focused dashboard lint passes with the existing set-state-in-effect rule excluded; unmodified effects at lines 73/103 fail that rule. Diff checks pass. Dashboard plan v2.80 and both Figma run-action menus aligned; native interaction remains unverified.

## 2026-10-09 | Version: mobile-green-primary-v1

- **Summary:** Use green as the driver mobile app's primary color and reserve red for danger buttons.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use `#15803D` for primary buttons, tabs/badges, loading/progress, selection borders, route accents and bundled timeline assets. Use pale green selected surfaces and amber errors/warnings, expired-document and speeding feedback. Save/Upload loading and disabled states retain green with reduced opacity. Preserve Cancel shipment/End Run destructive buttons and existing confirmation, authorization and status logic.
- **Breaking Changes:** None.
- **Verification:** Full mobile TypeScript passes. Focused changed-screen/component lint passes except the existing `RunMap.tsx:177` render-time `Date.now()` purity error; full app/components lint passes with the existing purity, set-state-in-effect and preserve-manual-memoization rules excluded. Dashboard plan v2.79 and driver Figma screens/components/color variables aligned; no-run Figma screenshot confirms green upload/navigation. Native iOS/Android light/dark, large-text and interaction checks remain unverified.

## 2026-10-09 | Version: action-sheets-header-close-v1

- **Summary:** Show a top-right close button on all shared Expo action menus and remove the Cancel dismissal row.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** ActionSheet defaults to the shared accessible 44-point header close control, including menus without titles. Lists contain only configured actions; retain domain actions such as Cancel shipment. Preserve selection on dismissal, backdrop/swipe/Android Back and action execution after dismissal.
- **Internal Changes:** Remove obsolete showCancelButton configuration and its shipment-options override. Update shared sheet documentation, dashboard plan v2.78 and Figma shared action menu, timeline filter, run actions, document-source chooser and handoff guidance.
- **Breaking Changes:** None for runtime/API consumers; internal ActionSheet callers no longer configure a Cancel dismissal row.
- **Verification:** Full mobile TypeScript and focused ActionSheet/ShipmentDetails lint pass. Figma menu structure and source/run-menu screenshots verified; diff checks pass. Native iOS/Android close/reopen, picker handoff, dark mode and large-text interaction remain unverified.

## 2026-10-09 | Version: driver-message-notification-navigation-v1

- **Summary:** Route admin-to-driver message notification taps to the Messages section and the notified driver conversation.
- **API Changes:** No endpoint changes. Existing Expo push payload now explicitly includes high priority and Android `default` channel; retain sound and generic dispatch text with conversation/message UUIDs.
- **Database Changes:** None.
- **Behavior Changes:** Capture notification taps before login, wait for authentication hydration and mounted navigation, then open Messages without a preliminary network request. Load and authorize the notified driver thread in the screen; retain Retry for offline/inaccessible threads. Ignore duplicate response events and non-default actions. Refresh push-token registration after hydration and on foreground/token changes. Preserve after-commit notification dispatch, retry deduplication, receipt cleanup and suppression while the thread is visible.
- **Breaking Changes:** None. No deployment or native build performed; operational delivery requires a configured APNs/FCM build, registered device/permission and running queue worker.
- **Verification:** 3 mocked mobile notification tests pass, covering valid/invalid payloads, cold start, login/navigation readiness, offline navigation, duplicate events and running-app taps. 14 conversation API/push tests pass (220 assertions), including provider payload channel/priority, after-commit queueing and no self-notification on driver reply. Full mobile TypeScript and focused notification/messages lint pass; PHP style and diff checks pass. The optional-notification-data TypeScript issue recorded in concurrent entries below is resolved. Real iOS/Android delivery and OS tap behavior remain unverified.

## 2026-10-09 | Version: messages-attachment-sources-v1

- **Summary:** Add File, Photo, Camera, Run and Shipment options to the mobile Messages attachment button.
- **API Changes:** Add GET `/api/v1/conversations/{id}/references` with required `type` and `search`, optional `page`, and paginated assigned-record results. Message sends accept `references[][type/id]`; attachment responses include nullable reference metadata. Authorize by driver conversation, account, merchant and non-removed run assignments; completed records remain available. Reference downloads return 422; clients open authorized detail routes.
- **Database Changes:** None; persist typed references using existing attachment metadata.
- **Behavior Changes:** Run/Shipment selection uses location-style searchable bottom sheets with keyboard search, clear, results, preview/confirm, pagination and retry. Native file/photo/camera sources preserve cancellation/permission errors. Removable draft cards allow reference-only sends and retain failed drafts/retry IDs. Limit combined attachments to five and files to 20 MB. Dispatch inbox opens linked records; completed mobile shipment links use run-scoped read-only details.
- **Breaking Changes:** None for existing requests. Deploy the API additions with clients for record search/send support.
- **Verification:** 13 conversation API tests pass (212 assertions), covering reference search/sends, retry, dispatch visibility, unassigned/removed records, validation and rollback; Mobile and website TypeScript, focused mobile/website lint, PHP style and diff checks pass. Figma messaging handoff and dashboard plan v2.77 aligned. Simulator access timed out; native source/permission/keyboard/layout interactions and live integration remain unverified. No deployment performed.

## 2026-10-09 | Version: shipment-options-cancel-last-v1

- **Summary:** Place Cancel shipment last in Shipment options.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Order eligible actions as Update delivery status, Delivery note & files, Shipment history, then Cancel shipment. Preserve destructive styling, reason/confirmation, read-only guards and top-right close.
- **Breaking Changes:** None.
- **Verification:** Focused ShipmentDetails lint and diff checks pass. Full mobile TypeScript is blocked by an unrelated pending notification change in `message-notifications.tsx:50` (optional notification data passed to a required record parameter). Dashboard plan v2.76 and Figma cancellation-last handoff aligned; native menu interaction remains unverified.

## 2026-10-09 | Version: shipment-options-header-close-v1

- **Summary:** Move Shipment options dismissal to a top-right close button.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show the shared 44-point close control and remove the bottom Cancel dismissal row on shipment page/sheet options. Keep Cancel shipment, existing action handoff and read-only guards. Preserve backdrop, swipe and Android Back dismissal.
- **Internal Changes:** Add opt-in `showCancelButton` configuration to ActionSheet; other callers retain their existing defaults.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused ActionSheet/ShipmentDetails lint pass. Diff checks pass; dashboard plan v2.75 and Figma shared header/handoff aligned and visually checked. Native iOS/Android close interaction and theme/large-text layouts remain unverified.

## 2026-10-09 | Version: shipment-parcel-card-layout-v1

- **Summary:** Improve readability of the parcel card on the shared mobile shipment details page and sheet.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Separate the Parcels heading from the recorded scan count; use divided rows, small parcel-number labels, prominent monospaced tracking codes and secondary contents. Allow long codes/descriptions to wrap; retain missing-code fallback, read-only records and hidden scan/proof actions.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused ShipmentDetails lint pass; diff checks pass. Dashboard plan v2.74 and Figma selected parcel cards/handoff aligned. Native multi-parcel, dark-mode and large-text layout remain unverified.

## 2026-10-09 | Version: shipment-options-action-sheet-v1

- **Summary:** Use the shared action sheet for shipment options instead of a full-height panel.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Content-sized menu keeps the receipt underneath and opens status, cancellation, files or history after dismissal. Highlight Cancel shipment as destructive while retaining its reason/confirmation form. Preserve completed-run read-only gating and temporarily hidden scan/proof entries; include Cancel and shared backdrop/swipe/Android Back dismissal. Applies to standalone shipment pages and reusable run shipment sheets.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused shipment component lint and diff checks pass. Native iOS/Android stacking, sizing and selection/dismissal checks remain unverified. Dashboard plan v2.73 records this implementation correction to the existing Figma action-sheet intent.

## 2026-10-09 | Version: messages-hide-empty-conversations-v1

- **Summary:** Show only conversations containing messages in the admin inbox, with an exception for the conversation the admin has just started.
- **API Changes:** Add optional boolean `has_messages` to GET `/api/v1/conversations`; filter live messages inside the authorized query before pagination. Omitted/false retains existing behavior.
- **Database Changes:** None.
- **Behavior Changes:** Admin inbox requests message-containing conversations across search, tabs and polling. Keep the conversation opened through New conversation visible until the admin selects another thread or changes merchant/session; allow sending its first message and update its preview after sending. Exclude threads with only deleted messages; retain attachment-only messages.
- **Breaking Changes:** None.
- **Verification:** 13 conversation tests pass (191 assertions), including empty/deleted-message exclusions, pagination, search/type combinations, visibility, legacy behavior, validation and opening an empty driver thread. Website TypeScript, focused inbox lint and PHP style checks pass. New inbox exception reviewed in code; browser verification and deployment not performed.

## 2026-10-09 | Version: shipment-hide-scan-proof-actions-v1

- **Summary:** Temporarily hide Scan parcels and Add delivery proof in the mobile shipment actions menu.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Shared shipment page and bottom sheet omit both menu links. Update delivery status, Cancel shipment, Delivery note & files and Shipment history remain available. Preserve the scan route, proof form/contracts and recorded scan/proof details for later re-enablement.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused component lint pass; diff checks pass. Dashboard plan v2.72 and Figma shared action sheet/handoff aligned. Native menu interaction remains unverified.

## 2026-10-09 | Version: messages-clear-inbox-v1

- **Summary:** Implement selected Clear Inbox design in `/admin/messages`, preserving the main menu and shared admin shell.
- **API Changes:** Add optional `search` (up to 255 characters) and `type` (`driver` or `normal`) to GET `/api/v1/conversations`. Search authorized conversation titles/descriptions, active participant names and driver user names before pagination. Preserve response shape and unfiltered client behavior; consume existing optional `updated_at` on the website.
- **Database Changes:** None.
- **Behavior Changes:** Add debounced inbox search, All/Drivers/Groups filters, selected conversation rows, desktop split panes, mobile inbox/thread navigation, creation/details dialogs, labelled metadata forms and member management. Style message bubbles, file download cards and removable pending attachments; preserve polling, read marking, older messages, send retry IDs and closed-thread restrictions. Reset workspace state on merchant changes and ignore stale inbox results. Re-selecting the current thread preserves messages and drafts; responsive pane sizing keeps the composer accessible.
- **Internal Changes:** Retain a synthetic local verification fixture under website tests. Remove its temporary preview route from application routing.
- **Breaking Changes:** None. Deploy the API addition alongside the website for server search/filter support; no deployment performed in this task.
- **Verification:** 12 conversation API/push tests pass (173 assertions), including search/type combinations, pagination, validation, legacy requests and tenant/visibility isolation. Website TypeScript, focused lint and PHP style checks pass. Local synthetic desktop/mobile checks cover search pagination reset, group filtering, driver/group creation, metadata save, close/reopen, member add/remove, older-message loading, send failure/retry, current-thread reselection, oversized-file rejection, merchant reset, read-only controls and dialog focus trapping. Six-file rejection is covered by API tests; pending-file removal was inspected but not browser exercised. Live API integration, real signed-file downloads and physical-device keyboard behavior remain unverified.


## 2026-10-09 | Version: shipment-receipt-map-v1

- **Summary:** Present shipment details as a paper receipt with a location map at the top.
- **API Changes:** None; reuse saved delivery coordinates.
- **Database Changes:** None.
- **Behavior Changes:** Shared page/sheet shows a non-interactive delivery map, name/address underneath, warm paper surface, monospaced reference and perforated divider. Sheet extends to the screen bottom with flat lower corners and safe-area content padding. Missing/invalid coordinates show an explicit unavailable state. Header actions and completed-run read-only access remain.
- **Breaking Changes:** None.
- **Verification:** iOS live delivery map, address and bottom-anchored sheet visually reviewed. TypeScript and focused component lint pass. Android, dark/large-text and missing-coordinate native layouts remain unverified. Dashboard plan v2.71 and Figma handoff aligned.

## 2026-10-09 | Version: shipment-details-footer-removal-v1

- **Summary:** Remove the active-shipment bottom action section shown in the supplied screenshot.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Shared shipment page and bottom sheet omit Update delivery status, Add delivery proof and More actions at the bottom. Existing header action menu retains status/proof/scan/cancel access; completed-run history footer remains.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused component lint pass; Figma selected design and dashboard plan v2.70 aligned.

## 2026-10-09 | Version: run-shipment-details-sheet-v1

- **Summary:** Open shipment details in a reusable bottom sheet from run timelines and the run details page.
- **API Changes:** None; retain shipment and completed-run scoped file/detail APIs.
- **Database Changes:** None.
- **Behavior Changes:** Dashboard timeline/map shipment taps, run-detail shipment cards/recorded-timeline links and location-sheet delivery/collection cards open ShipmentDetailsSheet over the current screen. Location sheets dismiss before handoff. Completed runs pass run ID for read-only access; active shipments retain existing actions. Dismissal refreshes the parent run/dashboard. Keep standalone shipment routes available for direct navigation and accepted offers.
- **Internal Changes:** Add optional automatic presentation after conditional mounting, iOS FullWindowOverlay, shared floating-sheet theme/safe-area clearance and Android Back dismissal to the reusable wrapper. Clear dashboard shipment selection on session changes. Place AuthProvider above the sheet portal, remove portal dependence on screen focus context while preserving standalone-route focus refresh, bound the body height and render secondary panels inside the sheet.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused run-detail/shared-component lint pass without exclusions; dashboard lint passes with its pre-existing effect rule excluded. Dashboard plan v2.69 and Figma handoffs aligned. iOS live dashboard timeline and run-detail card taps open loaded shipment sheets with visible destination and persistent status footer; dismissal/reopening and embedded delivery-status/files panels verified without saving live changes. Native stop-sheet handoff, mutation-save refresh, completed-run files, scrolling/keyboard/theme and Android Back checks remain pending. Production iOS export passes with the shared shipment sheet and all eleven shipment SVGs.

## 2026-10-09 | Version: driver-run-delivery-order-v1

- **Summary:** Let drivers choose which remaining shipment gets delivered first from the run Actions menu.
- **API Changes:** Add GET/PATCH `/api/v1/driver/runs/{run_uuid}/delivery-order` for the assigned active run. GET returns remaining shipment reference/location rows; PATCH accepts `shipment_ids` and `expected_shipment_ids`, validates the complete unique remaining set and rejects stale membership/order with 409. Scoped transactional save audits order changes; successful retries do not duplicate audit entries.
- **Database Changes:** None; reuse `run_shipments.sequence`.
- **Behavior Changes:** Add Update delivery order after Edit Run. Open a themed bottom sheet with numbered shipment cards, drag handles, edge scrolling and accessible earlier/later actions. Save delivery order sits beneath the bounded scrolling list. Closing discards draft changes, errors preserve them and conflicts require Reload delivery order. Terminal deliveries stay in their full-run slots; preserve status/evidence and recorded chronology. Successful save refreshes dashboard timeline/planned routing; shared destinations retain grouped stops by first occurrence.
- **Breaking Changes:** None; additive endpoints. Backend deployment is required for the new option.
- **Verification:** 41 driver run/action/shipment API tests (342 assertions), including eight run-action tests (79 assertions), mobile TypeScript, focused lint (existing dashboard effect rule excluded), and diff checks pass. Both Figma action menus and scenario handoff aligned; editable SF Pro menu composition visually checked. Simulator screenshot was unavailable; native drag/drop, edge-scroll, screen-reader, large-text/short-screen and deployed save/reload checks remain pending.

## 2026-10-09 | Version: shipment-next-stop-reusable-v1

- **Summary:** Implement selected Figma 01 / Next stop shipment details as a reusable page and bottom-sheet component.
- **API Changes:** None; retain existing scoped shipment/files and driver status/scan/POD/cancel/upload contracts.
- **Database Changes:** None.
- **Behavior Changes:** Replace oversized shipment banner with compact reference/status, destination card, conditional Navigate/Call, instructions, collection and scan summary, files/history/dispatch links and a persistent Update delivery status footer. More actions retains scan and cancellation; secondary panels keep existing validation/error handling. Completed-run context hides mutation/contact tools and retains scoped files/history plus View run history. Long content wraps and scrolls separately from the footer. Export ShipmentDetails and ShipmentDetailsSheet; the existing route uses the shared component, and other entry points retain their current navigation. Proof entry retains the existing file-key metadata form; the proposed photo-upload-to-POD flow is not implemented.
- **Breaking Changes:** None.
- **Internal Changes:** Move shipment data/actions into the reusable component; bundle eleven exact Figma SVG assets with original dimensions. Use a single secondary panel for files/upload to avoid sibling native modals.
- **Verification:** Mobile TypeScript and focused component/route lint pass without exclusions; SVG downloads are nonempty with matching root/callsite dimensions. Dashboard plan v2.67 and Figma selection/handoff aligned. Native page/sheet/footer/action/keyboard, completed-run content, dark/large-text and Android verification remain pending; Simulator UI navigation did not expose an authenticated shipment. Production iOS export passes and includes all eleven shipment SVGs.

## 2026-10-09 | Version: stop-location-shipment-links-v1

- **Summary:** Show delivery and collection shipments in the location bottom sheet and link each whole card to actual shipment details.
- **API Changes:** Driver dashboard/run timeline stops add nullable `location_id` from authorized saved locations, including planned delivery/endpoints; speeding/unlocated/foreign stops return null. Existing status endpoints are unchanged.
- **Database Changes:** None.
- **Behavior Changes:** Group this run's matching shipments into Deliveries and Collections below existing map/timing details. Cards show reference, current status and chevron; tapping dismisses the sheet before opening shipment details. No Update status/Options button in the sheet. Existing active shipment status editing and completed-run scoped read-only access remain. Legacy APIs use only unambiguous exact normalized name/full-address matching; explicit null, speeding and unrelated locations never infer shipments. Keep completed deliveries and deduplicate within each section.
- **Breaking Changes:** None; additive API field with legacy fallback.
- **Verification:** Four mobile shipment grouping/status tests, 42 driver shipment/run API tests (368 assertions), TypeScript and focused lint pass (existing screen effect rule excluded). Figma delivery/collection screens and handoff aligned and delivery composition visually checked. Native card navigation/scroll/theme/device checks and API deployment remain pending; Simulator was at the home screen. Diff checks pass.

## 2026-10-09 | Version: shipment-review-hide-scroll-indicator-v1

- **Summary:** Hide the scrollbar on the Confirm shipments found sheet.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Step 4 hides the vertical scroll indicator while keeping scrolling and sheet controls available. Other steps retain their current indicators.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint and diff checks pass. Dashboard plan v2.65/Figma handoff aligned; native verification pending.

## 2026-10-09 | Version: driver-import-status-validation-v1

- **Summary:** Align delivery-note preview and confirmation status validation and replace raw line-item status errors with readable shipment guidance.
- **API Changes:** Share the existing `booked`, `delivered`, `in_transit`, `failed` contract across preview and confirmation. Preview now rejects unsupported included statuses with HTTP 422 in the mobile API envelope; confirmation uses the same message with a one-based shipment number.
- **Database Changes:** None.
- **Behavior Changes:** Explicit Booked remains valid, including overriding recorded delivery matches. Unsupported statuses fail during preview before final save; excluded invalid rows remain non-blocking. Preserve draft fields, matching and evidence requirements.
- **Breaking Changes:** Unsupported statuses previously accepted by preview now return 422; confirmation already rejected them.
- **Verification:** 74 driver import/shipment API tests (611 assertions) pass, including Booked matching override, unsupported status messages and excluded invalid rows. Diff checks pass. The mobile app targets `api.spaces.za.com`; API deployment and the reported physical-device save remain unverified. Intended dashboard flow and Figma visuals are unchanged.

## 2026-10-09 | Version: new-run-route-inside-radio-v1

- **Summary:** Show new-run endpoints inside the selected Create new run radio card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Selected existing/new-run cards both show Run start and Planned end below a divider. Remove the separate new-run route panel; retain the assigned-vehicle chooser and preview/confirmation behavior.
- **Breaking Changes:** None.
- **Verification:** Component lint and diff checks pass; Figma new-run state/handoff aligned and screenshot checked. Native layout pending.

## 2026-10-09 | Version: default-run-choice-preview-v1

- **Summary:** Prepare the default run choice automatically on entering Step 5.
- **API Changes:** None; use the existing scoped preview API.
- **Database Changes:** None.
- **Behavior Changes:** Preview the preselected upload-linked/in-progress/first eligible run on entry, without another radio tap. Preserve restored or explicitly selected new-run choices; no-run contexts retain new run. Enable confirmation after successful preview and required vehicle selection; final upload stays explicit.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused lint with the existing import effect rule excluded and diff checks pass; Figma handoff aligned. Native entry/choice/retry verification pending.

## 2026-10-09 | Version: remove-review-footer-back-v1

- **Summary:** Remove Back to locations below the shipment-review Continue button.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use the existing header Back to return from Step 4 to trip locations; keep Continue and draft preservation.
- **Breaking Changes:** None.
- **Verification:** Focused lint with the existing import effect rule excluded and diff checks pass. Figma review footer already aligned; scenario handoff updated.

## 2026-10-09 | Version: run-ticket-choice-ui-v1

- **Summary:** Implement selected Figma option 2, Run ticket, for delivery-note Step 5.
- **API Changes:** None; retain run-preview readiness and explicit confirmation APIs.
- **Database Changes:** None.
- **Behavior Changes:** Replace text actions with exclusive accessible radio choices. Selected existing-run ticket contains confirmed endpoints; new-run state shows assigned-vehicle chooser and route panel. Keep live compact shipment/status/matched-stop previews. Add optional persistent confirmation footer to the shared scrollable sheet and reserve scroll clearance; other sheets retain their existing layout. Use Choose run header, theme-aware cards and four bundled Figma SVGs. Vehicle selection and run selection do not submit.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint with the existing effect rule excluded, ten existing step-navigation/sheet-handoff regressions and diff checks pass. Figma current/new-run design contexts/screenshots and SVG root dimensions checked. Dashboard plan v2.61 records selection/local implementation. Native SVG/radio/footer/scroll, dark/large-text, multiple-run and preview/save interaction checks remain pending; Simulator opened at the iOS home screen without a Step 5 review available.

## 2026-10-09 | Version: circular-sheet-back-button-v1

- **Summary:** Match sheet Back buttons to the circular close-button appearance.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Shared sheet Back uses a 44-point circle with the same muted light/dark background as close; preserve disabled feedback and navigation.
- **Breaking Changes:** None.
- **Verification:** Component lint and diff checks pass; Figma review/run-choice headers and handoff aligned, screenshot reviewed. Native appearance pending.

## 2026-10-09 | Version: default-missing-collection-date-v1

- **Summary:** Use today when no collection date is available during delivery-note review.
- **API Changes:** None; reuse authenticated context today in the merchant timezone.
- **Database Changes:** None.
- **Behavior Changes:** Fill missing document/line dates in new and restored drafts, preserving explicit extracted/edited dates and document-date inheritance. Persist defaults for review, editor and confirmation.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused lint with the existing import effect rule excluded and diff checks pass; Figma handoff aligned. Native restoration/date-edit verification pending.

## 2026-10-09 | Version: run-choice-design-exploration-v1

- **Summary:** Create three Figma alternatives for Step 5 using radio choices for the current run and Create new run.
- **Internal Changes:** Add Radio cards (recommended), Run ticket and Review first, with six current/new-run screens and a reusable selected/unselected radio component. Update dashboard plan v2.58 and scenario handoff; awaiting design selection.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime. Proposals retain route/shipment previews and explicit confirmation; new-run examples show required assigned-vehicle selection.
- **Breaking Changes:** None.
- **Verification:** Six editable SF Pro/token-bound screens visually checked, with route/reference wrapping and visible confirmation controls; diff checks pass. Static prototypes are not wired. Native implementation, additional run/vehicle/error states and accessibility checks follow selection.

## 2026-10-09 | Version: import-header-back-navigation-v1

- **Summary:** Replace the close button with a leading back arrow on back-capable import steps.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Revisited Step 2 and Steps 3–5 return to the previous step from the header, retaining draft edits and resetting final readiness. Hide trailing close/handle when Back is present; keep Step 1/completion and locked active-reading behavior. Lock Back during preview/saving; preserve nested editor/selector Back.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused lint with the existing import effect rule excluded, two existing step-navigation regressions and diff checks pass. Figma review/run-choice headers and handoff aligned; screenshot reviewed. Native back/draft checks remain pending.

## 2026-10-09 | Version: driver-booked-status-v1

- **Summary:** Add Booked first in driver delivery-status lists for import review and shipment details.
- **API Changes:** Driver import and shipment status updates accept booked. Persist manual Booked overrides through delivery-visit matching and synchronize booking/shipment status with audit history.
- **Database Changes:** None.
- **Behavior Changes:** Booked requires no odometer readings or failure reason. Hide required pickup odometer for Booked in import review; clear the current delivery timestamp while retaining historical evidence and readings. Completed-run permissions and other status requirements remain.
- **Breaking Changes:** None; deploy API validation before selecting Booked in updated clients.
- **Verification:** 72 driver import/shipment API tests (600 assertions), mobile TypeScript, focused lint with the existing effect rule excluded and diff checks pass. Dashboard plan v2.56 and Figma status selector/handoff aligned; screenshot reviewed; native selector/save checks remain pending.

## 2026-10-09 | Version: location-selection-warning-copy-v1

- **Summary:** Show Choose a delivery location instead of Complete the delivery address.
- **API Changes:** None; current API already uses the selection wording.
- **Database Changes:** None.
- **Behavior Changes:** Translate legacy collection/delivery address-completion warnings into Choose a collection/delivery location in shipment review.
- **Breaking Changes:** None.
- **Verification:** Focused import-page lint (existing effect rule excluded) and diff checks pass. Existing Figma selection-warning copy remains aligned.

## 2026-10-09 | Version: require-shipment-location-selections-v1

- **Summary:** Require Collection and Deliver to location selections when extracted shipment values have no saved location ID.
- **API Changes:** Driver import preview warns to choose missing locations regardless of postal completeness. Confirmation returns 422 for new included lines missing either scoped saved ID, including grouped lines. Existing/excluded skip behavior and reviewed run-start inheritance remain.
- **Database Changes:** None.
- **Behavior Changes:** Show red Choose collection/delivery location controls with extracted text as context; count unresolved new rows as needing attention and disable Step 4 Continue until both IDs exist. Keep saved-location picker and draft persistence.
- **Breaking Changes:** Driver import clients can no longer confirm new raw-address-only lines; select scoped saved locations first. Deploy API/mobile changes together.
- **Verification:** 38 driver document-import API tests (335 assertions), mobile TypeScript and focused import-page lint with the existing effect rule excluded pass. Figma review example/scenario handoff aligned, screenshot reviewed and diff checks pass; native selection/return checks pending.

## 2026-10-09 | Version: compact-pdf-preview-button-v1

- **Summary:** Make the PDF preview button smaller and visually quieter.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use a white button with muted grey border/text, 13-point label, compact padding and 32-point minimum face height. Expand its touch area by 6 points; match the loading spinner to the muted text.
- **Breaking Changes:** None.
- **Verification:** Focused component lint and diff checks pass. Figma PDF state/scenario handoff aligned and screenshot checked; native appearance remains pending.

## 2026-10-09 | Version: pdf-preview-sheet-handoff-v1

- **Summary:** Prevent the upload bottom sheet from covering the PDF browser preview.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Wait for completed sheet dismissal before opening Expo WebBrowser; restore the same upload prompt after browser dismissal or an opening failure. Preserve the unfinished upload and prevent temporary dismissal from navigating away. Show opening failures on the restored screen.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and eight existing sheet-handoff regressions pass. Focused lint passes with the pre-existing upload effect rule excluded; full focused lint still reports that existing set-state-in-effect error. Diff checks pass. Native iOS/Android PDF layering and return verification remain pending; existing Figma browser/return flow remains applicable.

## 2026-10-09 | Version: cancel-inline-pdf-preview-v1

- **Summary:** Undo the cancelled inline PDF preview setup.
- **Internal Changes:** Remove the newly installed WebView dependency. Package manifest and lockfile match their pre-install versions; no PDF.js dependency or viewer code was added.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None; retain the existing Expo WebBrowser PDF preview.
- **Breaking Changes:** None.
- **Verification:** Offline uninstall succeeded; package manifest/lockfile have no pending diff and mobile source has no WebView/PDF.js references. Diff checks pass.

## 2026-10-09 | Version: unfinished-upload-pdf-browser-preview-v1

- **Summary:** Open unfinished-upload PDFs through Expo WebBrowser.
- **API Changes:** Add authenticated GET /driver/document-imports/{id}/pdf-preview-url and signed GET /driver/document-imports/{id}/pdf-preview under /api/v1. Issue five-minute file/uploader-specific links; recheck active driver/account/merchant/ownership when streaming. Missing/unsupported files return 404/415; invalid or expired signatures return 403. Stream inline PDF with private no-store and no-referrer headers. No bearer token in browser URLs.
- **Database Changes:** None.
- **Behavior Changes:** PDF tile offers Preview PDF, with opening/error/retry states. Close the browser to return to the unchanged continuation prompt. Images keep inline previews. Android rendering or download depends on its installed browser; no external document-viewer service.
- **Breaking Changes:** None. Deploy backend routes before mobile preview.
- **Verification:** Two PDF API regressions (17 assertions), mobile TypeScript, preview-component lint and diff checks pass. Dashboard plan v2.53 and editable Figma PDF state/scenario handoff aligned; prototype browser launch is not wired. Native PDF reading, browser dismissal/return and Android handling remain pending.

## 2026-10-09 | Version: measured-shipment-units-v1

- **Summary:** Add Liters, Kilograms, Tonnes and Cubic metres to the shipment unit picker and order all choices A–Z.
- **API Changes:** Driver import accepts liters/kilograms/tonnes/cubic_metres with required positive numeric quantity up to 1,000,000 (Tonnes up to 9,999.999 to fit existing kilogram storage). Keep existing packaging integer limits. Measured lines count as one parcel for the 500-parcel import limit and parcel creation; preserve quantity/unit metadata, including grouped imports. Kilograms/tonnes supply parcel weight in kilograms.
- **Database Changes:** None; reuse source-line metadata and existing parcel weights.
- **Behavior Changes:** Units remains default. Preserve decimal input text while typing and show readable review labels. Liters/Cubic metres show optional weight; Kilograms/Tonnes hide duplicate measurements. Existing packaging visibility and hidden-value retention remain.
- **Breaking Changes:** None. Deploy updated backend before using new units; AI extraction does not automatically detect measured units.
- **Verification:** 35 driver import API tests (294 assertions), mobile TypeScript, focused review lint with the existing effect rule excluded and diff checks pass. Dashboard plan v2.52 and Figma scenario handoff aligned. Native decimal entry, unit switching, long-label fit and scrolling remain pending.

## 2026-10-09 | Version: unfinished-upload-image-preview-v1

- **Summary:** Preview uploaded images in the unfinished delivery-note card.
- **API Changes:** Add authenticated GET /api/v1/driver/document-imports/{id}/file-preview, streaming owned JPG/PNG/WebP files with private no-store headers. Reuse driver/account/merchant/uploader scope; missing files return 404 and unsupported types 415.
- **Database Changes:** None.
- **Behavior Changes:** Show a 180-point contained image preview and loading indicator above the small filename. Unavailable images and PDFs use a document fallback without disabling continue/new-upload actions. Native PDF thumbnails are unsupported.
- **Breaking Changes:** None; deploy the endpoint before mobile preview to avoid fallback on older servers.
- **Verification:** Mobile TypeScript/focused lint with the existing upload effect-rule exclusion, scoped preview API test (eight assertions) and diff checks pass. Dashboard plan v2.51 and Figma prompt example/scenario handoff aligned; Figma preview content is illustrative. Native image loading, fallback, dark/large-text and short-screen layouts remain pending.

## 2026-10-09 | Version: saved-location-review-validation-v1

- **Summary:** Remove false address warnings for selected saved locations and clarify collection/run-start differences.
- **API Changes:** Preview validates scoped saved pickup/dropoff IDs independently of postal-field completeness and compares saved collection/start identities first. Confirmation accepts already-resolved saved IDs with partial postal fields; unselected raw-address validation and foreign/unknown-ID rejection remain. Recorded-delivery matching is unchanged.
- **Database Changes:** None.
- **Behavior Changes:** Same saved collection/start ID matches; different IDs mismatch. Confirmed differences explain that intentional differences may be ignored and offer correction. Unknown states ask drivers to check locations without claiming a difference. Include location names with addresses; colour only Address missing red.
- **Breaking Changes:** None. Deploy the API fix to remove warnings from live clients.
- **Verification:** 32 driver-import tests / 243 assertions, mobile TypeScript/focused lint, PHP syntax and diff checks pass. Dashboard plan v2.50/Figma warning/handoff aligned; native interaction and deployed API verification pending.

## 2026-10-09 | Version: unfinished-delivery-note-prompt-v1

- **Summary:** Offer to continue an unfinished delivery-note upload from Step 1.
- **API Changes:** None; reuse current-driver recent imports and device-local pending UUID.
- **Database Changes:** None.
- **Behavior Changes:** Show the unfinished-upload message, filename, Yes, continue and No, let’s start a new upload. Continue restores saved review edits at Step 3 or checks pending analysis without uploading again. Starting fresh opens the source chooser and preserves the old draft; cancellation leaves it intact. Explicit review replacement skips the prompt. Detection uses the existing five recent imports plus this device’s pending reference.
- **Breaking Changes:** None.
- **Verification:** Two unfinished-upload selection tests and ten existing polling regressions pass. TypeScript, focused lint with the existing effect rule excluded and diff checks pass. Dashboard plan v2.49 and editable Figma example/scenario handoff aligned; prototype navigation is not wired; native reopen, choices, picker cancellation, theme and accessibility checks pending.

## 2026-10-09 | Version: shipment-review-location-names-v1

- **Summary:** Show location names in Collection and Deliver to on shipment review cards.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Display the selected saved location name, then extracted name/company. Address-only rows show Location name unavailable; missing addresses retain red Address missing. Keep full addresses for validation/saving, underlined selection links and run-start collection fallback. Editor/picker details remain unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript/focused review lint and diff checks pass. Dashboard plan v2.48/Figma review component/guide aligned; native review checks pending.

## 2026-10-09 | Version: missing-collection-run-start-v1

- **Summary:** Use the reviewed run starting-point location when a shipment has no collection address.
- **API Changes:** Optional per-line pickup_from_run_start marks inherited collections. Driver preview/confirmation re-resolve the scoped origin and canonical address, overriding stale inherited row values. An existing selected run’s origin supplies the default when no reviewed origin is given.
- **Database Changes:** None; cached trip-start locations are saved in the existing confirmation transaction before shipment pickup assignment.
- **Behavior Changes:** Initial/restored drafts and reviewed-start changes populate missing collections from the run start. Inherited values follow later start changes; explicit saved selections disable inheritance and extracted partial addresses are preserved. Delivery remains independent. Missing/incomplete/expired/foreign start still requires correction. Existing duplicate shipments remain unchanged.
- **Breaking Changes:** None. Deploy the API change for authoritative inherited-source re-resolution; mobile drafts send explicit origin pickup IDs/addresses for existing saved starting points.
- **Verification:** 30 driver import API tests (235 assertions), five mobile address-draft tests, TypeScript, focused review/helper lint with the existing effect rule excluded and diff checks pass. Dashboard plan v2.47/Figma review component and guide aligned. Simulator is at upload Step 1, so native restored-review/source-switch/override checks remain pending.

## 2026-10-09 | Version: truck-popup-address-geofence-v1

- **Summary:** Show the truck’s last known address or containing geofence name/address in its popup.
- **API Changes:** Both driver position endpoints add nullable address and geofence_location (location_id/name/address), calculated from the latest valid coordinates and authorized saved polygons. Boundaries/invalid/foreign/deleted polygons are excluded; overlap uses stable location ID order.
- **Database Changes:** None.
- **Behavior Changes:** Preserve truck/plate and report time in a wrapping popup. A containing geofence replaces the reported road with its name and optional saved address. Coordinate-only payloads never become addresses. Older APIs use an authorized matching vehicle/report-time address lookup; lookup failure preserves the position. No geocoding or old-visit inference.
- **Breaking Changes:** None. Deploy the additive backend fields for geofence labels to appear against the live API.
- **Verification:** 32 driver API tests (253 assertions), three mobile label/address tests and TypeScript pass. Focused lint passes with the existing RunMap recorded-mode purity rule excluded. iOS simulator verifies a live reported road address; after a full reload, the custom popup shows separate truck/report-time rows and updates while open. The latest coordinate-only report correctly omits an address. Full long-address/custom-geofence wrapping remains unverified. Native geofence/Android/large-text and production spatial-engine checks remain pending. Dashboard plan v2.46/Figma handoff aligned.

## 2026-10-09 | Version: legacy-run-note-action-visibility-v1

- **Summary:** Show the run upload action with the live API’s existing upload-required signal.
- **API Changes:** None; use the existing delivery_note_required_run_id only when current_run.has_delivery_note is absent.
- **Database Changes:** None.
- **Behavior Changes:** An older API can show Upload delivery note for the selected run when its existing upload-required notice is present. Explicit has_delivery_note=true always hides it; a notice for another run never enables it.
- **Breaking Changes:** None. Legacy notices infer need from shipment absence; deploy the new dashboard field for exact stored-upload evidence independently of shipments.
- **Verification:** iOS simulator confirms the previously absent action now appears and opens Step 1 / Choose document; closed without uploading. Mobile TypeScript, focused dashboard lint with the existing effect rule excluded and diff checks pass. Dashboard plan v2.45/Figma handoff aligned. Uploaded-state/Android checks remain pending; backend deployment is required for exact upload-history evidence.

## 2026-10-09 | Version: run-actions-first-delivery-note-v1

- **Summary:** Add Upload delivery note to run Actions until a note has been uploaded for that run.
- **API Changes:** Driver dashboard adds `current_run.has_delivery_note`, based on run-linked imports matching account, merchant and environment. Any stored upload counts, independently of analysis status.
- **Database Changes:** None.
- **Behavior Changes:** Show the outlined upload option after Add additional cost only when the boolean is explicitly false; navigate to the existing upload screen with the selected run ID after dismissal. Shipment counts do not control visibility. Hide when evidence is missing from an older API. Existing import recovery and dashboard return refresh remain available.
- **Breaking Changes:** None; deploy the additive API field for the new option to appear.
- **Verification:** 31 driver-shipment API tests pass (228 assertions); mobile TypeScript, focused dashboard/API lint with the existing effect rule excluded, and diff checks pass. Dashboard plan v2.44 and both Figma action menus/scenario handoff aligned. Native visibility/navigation/return and deployment remain unverified.

## 2026-10-08 | Version: red-review-missing-address-v1

- **Summary:** Highlight missing shipment review addresses in red.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Collection and Deliver to show Address missing in the existing error red (#a32222). Available addresses retain their normal colour; preserve bold underlined text and saved-location selection.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.43/Figma component handoff aligned; native visual verification pending.

## 2026-10-08 | Version: shipment-options-sheet-layering-v1

- **Summary:** Keep the shipment review sheet visible beneath Options.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Add optional stackBehavior forwarding to shared BottomSheet/ActionSheet and select push for review Options and its status picker. Preserve review position underneath, top-menu dismissal and post-dismissal actions. Other callers retain switch behavior.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused review/shared-sheet lint and diff checks pass. Installed Gorhom source confirms push preserves the underlying modal. Dashboard plan v2.42/Figma interaction handoff aligned; native layering and dismissal checks pending.

## 2026-10-08 | Version: review-date-status-row-v1

- **Summary:** Place Delivery status beside Collection date on shipment review cards.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use equal-width columns with muted labels and bold 15-point values, matching Quantity / Shipment type. Remove the lower combined status row; preserve draft/review/Booked fallback, status editing and all visit/failure/odometer evidence.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.41/shared Figma row aligned; native long-status and large-text verification pending.

## 2026-10-08 | Version: bold-review-collection-date-v1

- **Summary:** Match the review Collection date value to Quantity typography.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show the date or Not found in bold 15-point body text, retaining its label, placement and fallback.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.40/shared Figma date values aligned; native visual verification pending.

## 2026-10-08 | Version: compact-review-address-spacing-v1

- **Summary:** Reduce the gap between review address labels and values.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Group each Collection / Deliver to label and bold value in one 44-point-minimum press target with a 2-point gap. Remove the previous 16-point gap and value-only vertical centering; preserve selection and busy guards.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.39/shared Figma gaps aligned; native wrapping and tap checks pending.

## 2026-10-08 | Version: shipment-review-address-value-style-v1

- **Summary:** Match Collection and Deliver to value typography to Quantity.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Render both address values and Address missing in the same bold 15-point body style as Quantity, retaining underlines, wrapping and saved-location selection. Labels remain unchanged.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.38/shared Figma address values aligned; native long-address and large-text checks pending.

## 2026-10-08 | Version: remove-import-diagnostics-v1

- **Summary:** Remove temporary delivery-note diagnostic cards.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove upload/status response text, HTTP details and import UUID from reading and recovery sheets, along with their temporary component state and capture callbacks. Preserve reading animation, polling, pending-import recovery and user-facing errors.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint with the existing set-state-in-effect rule excluded, all 10 existing mobile/website polling regressions and diff checks pass. Native layout verification pending. Dashboard plan v2.37 updated; existing Figma flow remains applicable because the temporary panel was never part of permanent designs.

## 2026-10-08 | Version: shipment-review-address-links-v1

- **Summary:** Make shipment collection and delivery addresses directly selectable from review cards.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Match Collection / Deliver to labels to Collection date, underline both values (including Address missing), and open saved-only location search on tap. Apply selections to the tapped shipment, persist the draft and refresh review. Back cancels; busy preview disables links. Editor selections retain Save/Cancel semantics.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.36 and shared Figma styles/interaction handoff aligned. Native picker, cancellation, draft restoration and accessibility verification pending.

## 2026-10-08 | Version: shipment-review-value-size-v1

- **Summary:** Match Quantity and Shipment type value sizes to the shipment number.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the two 22-point values with the same bold 15-point body style used by the shipment number; labels remain unchanged.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.35/shared Figma values aligned; native visual verification pending.

## 2026-10-08 | Version: inline-shipment-eligibility-v1

- **Summary:** Show shipment eligibility beside the shipment number.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Place New, Existing · skipped or Excluded next to the bold number under Shipment number, with a 6-point gap and wrapping when needed. Keep Options at the right.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.34/shared Figma headers aligned; native long-reference and large-text checks pending.

## 2026-10-08 | Version: shipment-review-number-label-v1

- **Summary:** Label the shipment number in review card headers.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show Shipment number above each bold reference with a 2-point gap, retaining the missing-reference fallback, badge and compact Options.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.33/shared Figma headers aligned; native long-reference and large-text verification pending.

## 2026-10-08 | Version: compact-shipment-options-v1

- **Summary:** Reduce the shipment review Options button size.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use a 30-point visible outline with smaller text/icon/padding; prevent header stretching and retain a 44-point-minimum press target and existing actions.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused review-screen lint and diff checks pass. Dashboard plan v2.32/Figma headers aligned; native visual verification pending.

## 2026-10-08 | Version: shipment-editor-keyboard-sheet-v1

- **Summary:** Make the shipment editor bottom sheet expand safely when the keyboard opens.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** The shared scrollable import sheet uses fill-parent keyboard behavior during shipment editing, including its location/date subviews, with safe top clearance, restore-on-blur and Android adjustResize. Keep sheet-aware form inputs. Save, Cancel and editor Back dismiss the keyboard; existing edit/save/cancel semantics remain.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused editor/shared-import UI lint with the existing effect rule excluded, and diff checks pass. Dashboard plan v2.31 and Figma handoff aligned. Native text/numeric focus, lower-field scrolling, picker/calendar return and keyboard dismissal verification pending.

## 2026-10-08 | Version: preserve-missing-shipment-addresses-v1

- **Summary:** Keep unidentified shipment collection/delivery addresses blank for driver selection.
- **API Changes:** Driver preview warns about missing collection and delivery addresses; confirmation validates per-line addresses or scoped saved IDs without document-address fallback. Analysis shape and success behavior are unchanged; no automatic location matching.
- **Database Changes:** None; no historical repair.
- **Behavior Changes:** Preserve partial/extracted addresses and driver draft selections. Remove mobile document-level fallback and show Choose saved collection location / Choose saved delivery location for empty selectors, with saved-only search and dispatch guidance. AI retains its existing explicit-row inheritance instructions.
- **Breaking Changes:** Driver clients that omit per-line addresses must provide each shipment address or select a saved location before confirmation. Admin confirmation is unchanged. Existing saved mobile drafts are retained because prior inferred values cannot be distinguished from deliberate edits.
- **Verification:** 31 Laravel import/OpenAI tests / 242 assertions and 2 mobile address-draft tests pass, along with TypeScript, focused lint and diff checks. Native selection/restoration and live AI verification pending. Dashboard plan v2.31 and Figma guidance aligned.

## 2026-10-08 | Version: unit-dependent-measurements-v1

- **Summary:** Show only relevant shipment-editor measurement fields for the selected quantity unit.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Units/default hides all measurements. Boxes, Pallets and Crates show Weight, Length, Width and Height; Drums, Bags and Rolls show Weight only. Unit changes update visibility immediately without clearing entered/extracted values. Existing kg/cm storage and quantity count are unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused shipment-editor lint with the existing effect rule excluded, and diff checks pass. Dashboard plan v2.30 and Figma handoff aligned. Native unit switching, value retention and keyboard/layout verification pending.

## 2026-10-08 | Version: remove-saved-delivery-placeholder-v1

- **Summary:** Remove “Choose saved delivery location” from the shipment editor.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide the delivery name row when no name exists; keep selected names/addresses, Change location, accessible selector label and saved-only selection. Collection placeholder is unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused shipment-editor lint pass with the existing effect rule excluded. Diff checks pass. Dashboard plan v2.29 and Figma scenario handoff aligned. Native visual verification pending.

## 2026-10-08 | Version: shipment-review-options-v1

- **Summary:** Consolidate shipment review actions under a top-right Options button.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Options opens Edit Shipment, Exclude shipment from run (Include shipment in run when excluded), and Change shipment status. Disable status changes for ineligible rows and Options during review requests. Remove separate card action buttons; retain the collection date below quantity/type, existing editor, three-status picker, failure reason and odometer requirements. Exclusion changes the import draft only. Use separate Options/status sheet instances so the status picker opens after dismissal.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused review-screen lint with the existing effect-rule exclusion, and diff checks pass. Dashboard plan v2.28 and shared Figma card headers/handoff aligned. Native action-sheet/editor/status/cancellation verification pending; Figma Options navigation is not wired.

## 2026-10-08 | Version: shipment-review-date-order-v1

- **Summary:** Move the shipment review collection date directly after quantity information.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Collection date and its Edit button appear below Quantity / Shipment type, before addresses and warnings. Preserve date fallback and editing.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint and diff checks pass. Dashboard plan v2.27 and shared Figma review card variants aligned; native visual verification pending.

## 2026-10-08 | Version: collection-date-sheet-v1

- **Summary:** Select shipment collection dates in a compact bottom-sheet calendar.
- **API Changes:** None; YYYY-MM-DD values retained.
- **Database Changes:** None.
- **Behavior Changes:** Date field opens a calendar sheet view with Back. Selection applies only through Use date; Back preserves the editor date and other pending edits. Day/weekday/month text uses 14/12/16 points with accessible day targets and month/year navigation. Other expiry-date pickers are unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint and diff checks pass. Dashboard plan v2.27 and Figma handoff aligned. Native interaction and accessibility scaling remain pending.

## 2026-10-08 | Version: saved-delivery-location-button-v1

- **Summary:** Make Deliver to match the saved Collection location selector.
- **API Changes:** Driver preview/confirmation accepts scoped per-line dropoff_location_id and resolves its canonical database address. Reject unknown/foreign IDs; retain legacy address-only compatibility.
- **Database Changes:** None. Persist the existing selected dropoff_location_id.
- **Behavior Changes:** Show current delivery name/address in a button opening saved-only search, with dispatch guidance when missing. Search Back preserves editor changes; saving edits requires saved collection and delivery selections.
- **Breaking Changes:** None. Deploy backend before updated mobile clients.
- **Verification:** Focused Laravel import regressions, mobile TypeScript/lint, PHP syntax and diff checks pass. Figma editor/handoff aligned; native picker/back/cancellation verification pending.

## 2026-10-08 | Version: shipment-editor-address-alignment-v1

- **Summary:** Align Collection and Deliver to sections with the shipment editor form.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove the sections' extra 18-point card padding, retaining 16-point internal gaps and collection-button padding. Shared cards elsewhere are unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint and diff checks pass. Dashboard plan v2.25/Figma handoff aligned; native visual verification pending.

## 2026-10-08 | Version: shipment-collection-date-picker-v1

- **Summary:** Use a date picker for collection date in the mobile shipment editor.
- **API Changes:** None; collection_date remains YYYY-MM-DD.
- **Database Changes:** None.
- **Behavior Changes:** Reuse shared DateInput with Android date dialog, iOS inline calendar/Done/Cancel and browser date input. Preserve extracted dates, local calendar-day formatting and existing editor Save/Back behavior.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint, date-only behavior checks and diff checks pass. Figma editor/handoff aligned. Native picker interaction/scrolling inside the sheet remains unverified.

## 2026-10-08 | Version: standard-delivery-note-shipments-v1

- **Summary:** Hide mobile shipment type input and default imported shipments to Standard.
- **API Changes:** Driver/admin confirmation now forces newly created import parcels to type standard, ignoring extracted/client type. Endpoint shapes unchanged.
- **Database Changes:** None; existing shipments/parcels are unchanged.
- **Behavior Changes:** Normalize new/restored mobile draft types, show Standard in review and remove missing-type warnings. Quantity unit remains independent.
- **Breaking Changes:** New imported parcels no longer retain extracted/custom type values.
- **Verification:** Focused Laravel import regressions, mobile TypeScript/lint and diff checks pass. Figma editor/handoff aligned; native visual verification pending.

## 2026-10-08 | Version: shipment-editor-units-saved-collection-v1

- **Summary:** Add quantity units, editor Back navigation and saved collection selection to mobile import review.
- **API Changes:** Driver location search accepts optional saved_only to skip geocoding. Driver preview/confirmation accept scoped per-line pickup_location_id; confirmation validates quantity_unit against units/boxes/pallets/drums/bags/crates/rolls. Resolve selected collection from the database, rejecting foreign/unknown IDs and ignoring client address overrides. Existing clients retain address compatibility.
- **Database Changes:** No schema change. Persist quantity/unit/reference per source line in existing shipment metadata.delivery_note_items; quantity remains parcel count and weight remains separate.
- **Behavior Changes:** Trailing unit dropdown in Quantity defaults to Units; review displays unit. Back cancels editor changes and returns to the original review step; search Back returns to the editor. Collection button shows name/address and opens saved-only location search. Save requires a saved collection selection; missing locations direct drivers to dispatch. Delivery-address and trip-endpoint flows remain unchanged.
- **Breaking Changes:** None. Deploy backend support before updated mobile clients.
- **Verification:** 28 Laravel import tests / 207 assertions cover persistence, saved collection resolution, invalid/foreign selections and no geocoding on missing saved locations. Mobile TypeScript, focused lint with existing effect-rule exclusion, PHP syntax and diff checks pass. Figma editor/handoff aligned. Native dropdown/back/keyboard/cancellation and accessibility layouts remain unverified.

## 2026-10-08 | Version: default-queue-delivery-note-analysis-v1

- **Summary:** Process new delivery-note analysis jobs through the Laravel default queue.
- **API Changes:** Endpoint contracts unchanged.
- **Database Changes:** No schema or existing-job changes.
- **Behavior Changes:** Inherit the configured default connection and queue, dispatch after commit, and use ordinary queue workers. Keep an asynchronous default; sync runs inside the request. Raise database/Redis/Beanstalkd reservation minimums to 330 seconds above the 300-second analysis timeout; this also affects retries of other jobs on those connections. Retain the legacy connection to drain existing dedicated jobs before retiring its worker.
- **Breaking Changes:** No API break. Deploy queue configuration and restart workers; SQS requires visibility above 300 seconds. Existing dedicated jobs are not moved automatically.
- **Verification:** Focused Laravel import regressions, PHP syntax and diff checks pass. Production deployment/default worker processing remain unverified. Update queue rollout guide, dashboard plan v2.21 and Figma handoff.

## 2026-10-08 | Version: failed-delivery-note-replacement-v1

- **Summary:** Guide drivers to upload another file after terminal analysis failure.
- **API Changes:** None; use existing failed status and failure_message.
- **Database Changes:** None.
- **Behavior Changes:** End polling, clear the failed file and pending reference, display the server failure reason with a fallback, and ask the driver to upload another file. Label the upload card Upload another file and suppress failed-import retry/status actions. Preserve guidance if replacement is cancelled and retain temporary diagnostics.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused upload-page lint with the existing effect-rule exclusion, 10 polling regressions and diff checks pass. Figma failure-state example and handoff aligned and visually checked. Native replacement/cancellation remains pending.

## 2026-10-08 | Version: compact-upload-header-spacing-v1

- **Summary:** Bring upload step indicators closer to the main title.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reduce the gap after the choose-file/recovery header from 16 to 4 points. Preserve indicator touch targets and other content spacing; busy reading and other sheets retain default spacing.
- **Internal Changes:** Add an optional shared BottomSheet headerBottomSpacing setting. Align dashboard plan v2.19 and Figma U01/U02/handoff.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused sheet/upload lint with the existing effect-rule exclusion and diff checks pass. Figma composition visually checked; native layout and large-text checks remain pending.

## 2026-10-08 | Version: delivery-note-server-diagnostics-v1

- **Summary:** Temporarily expose mobile delivery-note server replies to diagnose stalled analysis.
- **API Changes:** No endpoint contract changes; optional client response observer captures status/body before parsing, including non-JSON gateway errors.
- **Database Changes:** None.
- **Behavior Changes:** Show selectable latest upload and processing-status replies, timestamps, HTTP status and pending UUID during processing and after timeout. Show no-response transport failures explicitly; cap each response at 4,000 characters. Keep replies in memory, reset on replacement, and preserve checking without reuploading.
- **Internal Changes:** Dashboard plan v2.18 documents temporary diagnostics; permanent Figma flow unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused ESLint with the existing upload-page effect-rule exclusion, existing polling regressions and diff checks pass. Live device/server response and production queue-worker operation remain unverified.

## 2026-10-08 | Version: compact-delivery-note-reading-copy-v1

- **Summary:** Remove keep-this-screen-open text from mobile upload/reading.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Remove both the upload instruction and reading reassurance row, including its reserved space. Preserve separate shipment-saving feedback, the leading loading indicator and message fades.
- **Internal Changes:** Align dashboard plan v2.17 and Figma upload/reading states and handoff.
- **Breaking Changes:** None.
- **Verification:** Progress-component ESLint and diff checks pass. Figma compact layout visually checked; native layout verification remains pending.

## 2026-10-08 | Version: delivery-note-message-fades-v1

- **Summary:** Fade between mobile delivery-note reading messages.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Fade the current reading text out over 160 ms, swap the message and fade in over 220 ms, including Wrapping up. Reduced Motion changes text instantly. Keep the spinner/layout steady, existing 3.2-second schedule and immediate navigation on real completion.
- **Internal Changes:** Use native-driver opacity and stop animations on stage changes/unmount; preserve timer cleanup. Align dashboard plan v2.16 and Figma motion handoff.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, unmodified-rule progress-component ESLint, 13 existing reading/polling regressions and diff checks pass. These regressions verify scheduling and polling, not rendered animation. Native fade timing, early completion and Reduced Motion preference changes remain unverified.

## 2026-10-08 | Version: locked-delivery-note-reading-v1

- **Summary:** Keep the mobile delivery-note reading sheet open while processing and simplify loading feedback.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide close and drag handle while busy; retain blocked backdrop, swipe-down and Android Back dismissal. Remove Check later and the working-through-your-document paragraph. Show a small coral spinner before upload/reading status text, with a static loader icon for Reduced Motion. Preserve immediate advance on real results, persisted pending imports and bounded timeout/failure recovery. Website behavior is unchanged.
- **Internal Changes:** Align dashboard plan v2.15 and Figma loading states/handoff.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint (with the existing upload-page effect-rule exclusion), 13 reading-stage/polling regressions and diff checks pass. Figma visual check completed. Native busy-state, Reduced Motion and accessibility interaction remain unverified; the simulator had no saved pending job to resume.

## 2026-10-08 | Version: shared-async-delivery-note-analysis-v1

- **Summary:** Avoid holding AI extraction inside new uploads; let drivers and admins recover processing through a shared status API.
- **API Changes:** Add authenticated `POST /api/v1/delivery-note-imports/analyze` (file, client UUID import_id, optional run/environment and admin merchant context) returning 202, plus `GET /api/v1/delivery-note-imports/{id}/status` with queued/processing/analyzed/confirmed/failed, failure reason and 3200 ms polling guidance. Driver routes retain legacy behavior with optional async mode; run confirmation/download remain separate. Driver ownership and admin resource permissions/merchant/environment scope are enforced.
- **Database Changes:** No new schema or historical repair. Reuse the unique import UUID, existing string status column, private file metadata and jobs/failed_jobs tables; add queued/processing values.
- **Behavior Changes:** Mobile and admin drawer persist an import ID before upload, recover lost acknowledgements/504s without reupload, poll every 3.2 seconds, bound requests/check sessions and offer Check later / Check processing status. Start reading animation/messages after accepted upload even when native byte events are absent. Reopening restores pending IDs; replacement uses a new ID. Terminal failures show their reason; stale queued/processing records expire after 15 minutes. Analysis never creates shipments/runs or bypasses explicit confirmation.
- **Internal Changes:** Shared AnalyzeDeliveryNote background job claims once, reads private stored files using temporary streams, cleans up and records failures without overwriting success. Dedicated database queue connection has 330-second reservation and 300-second job timeout. Update dashboard plan v2.14, Figma handoff and docs/delivery-note-analysis.md with API and worker rollout contract.
- **Breaking Changes:** None for legacy routes. Deploy backend and a supervised document-imports worker before asynchronous clients; default/sync workers do not consume this dedicated queue. Production infrastructure has not been changed.
- **Verification:** 25 focused Laravel tests / 189 assertions; 56 client regressions covering both polling implementations; both frontend TypeScript checks, PHP syntax, focused lint and diff checks pass. Mobile upload-page lint retains the documented pre-existing effect-rule exclusion. Production worker operation, real gateway/live-AI recovery and native/browser visual/reopen checks remain unverified.

## 2026-10-08 | Version: delivery-note-upload-event-listeners-v1

- **Summary:** Clarify the upload-first message and register event listeners for the transition to rotating analysis feedback.
- **API Changes:** None; use existing XHR upload/response events via addEventListener.
- **Database Changes:** None.
- **Behavior Changes:** First show Uploading your file for analysis…; once transfer completion is observed, show the 15 analysis messages every 3.2 seconds and hold Wrapping up after the final message if still waiting. Real results still advance immediately; no timer pretends the upload has finished.
- **Internal Changes:** Replace progress/load/readystatechange handler-property assignments with event listeners. Update regressions to dispatch EventTarget events instead of directly invoking callbacks, covering the path the earlier tests did not exercise. Dashboard plan v2.13 and Figma initial copy/handoff aligned.
- **Breaking Changes:** None.
- **Verification:** All 46 mobile regressions, mobile TypeScript, focused upload-observer/progress-component lint and diff checks pass. Real-device upload-to-analysis transition remains unverified; previous local tests did not establish native success.

## 2026-10-08 | Version: delivery-note-endpoint-errors-v1

- **Summary:** Show the API’s delivery-note failure reason instead of discarding Laravel error responses.
- **API Changes:** No endpoint changes; client accepts envelope error.message/error.details and Laravel message/errors, plus string error and top-level details formats.
- **Database Changes:** None.
- **Behavior Changes:** Display the endpoint’s reason and deduplicated validation details as wrapping lines in the existing error box. Preserve the selected document and Retry reading document / Change document. Empty/unusable errors and unreadable response bodies include HTTP status in fallback copy. Exclude unrelated debug metadata and raw HTML.
- **Internal Changes:** Extract an error formatter with focused regressions; align dashboard plan v2.12 and Figma error implementation guidance without changing the layout.
- **Breaking Changes:** None.
- **Verification:** Four formatter regressions cover envelope/Laravel responses, details with generic or absent summaries, deduplication, string errors, malformed fields and debug-metadata exclusion. All 46 mobile regressions, mobile TypeScript, focused API/helper lint and diff checks pass. Actual endpoint-failure rendering, long errors and native retry/replacement recheck remain pending.

## 2026-10-08 | Version: native-delivery-note-upload-progress-v1

- **Summary:** Fix delivery-note reading remaining on Uploading file instead of rotating extraction messages in React Native.
- **API Changes:** None; correct client XHR completion observation for the existing upload endpoint.
- **Database Changes:** None.
- **Behavior Changes:** React Native sends upload progress without upload.load. Start scanning/messages once computable sent bytes reach a positive total; use received response headers/body as a fallback and preserve browser upload.load support. Notify only once; DONE alone never confirms transfer because errors/timeouts also reach it. Keep real result/error handling and immediate advance unchanged.
- **Internal Changes:** Add a shared upload observer and regressions matching native event behavior; update dashboard plan v2.11 and Figma implementation handoff without changing the visual layout.
- **Breaking Changes:** None.
- **Verification:** Four upload-progress regressions cover native progress triggering actual rotation without load, duplicate events, header fallback, unknown/zero totals, network-error DONE exclusion and browser load. All 42 mobile tests, TypeScript and focused API/helper lint pass. Native upload/scan transition recheck remains pending.

## 2026-10-08 | Version: delivery-note-scanning-feedback-v1

- **Summary:** Add animated scanning and clearer waiting feedback while reading a delivery note.
- **API Changes:** None; retain real XHR upload completion and extraction response handling.
- **Database Changes:** None.
- **Behavior Changes:** Show Uploading file until transfer completes, then a theme-aware scanning illustration and 15 illustrative extraction messages at 3.2-second intervals. Hold Wrapping up after 48 seconds if still processing. Advance immediately on the real result; cancel timers on failure/unmount and reset on retry. Keep completed-draft and shipment-creation feedback separate; respect reduced motion and announce updates politely.
- **Internal Changes:** Add a cancellable reading-message scheduler with timer regressions; align dashboard plan v2.10 and static Figma loading examples/handoff. Messages describe attempted work rather than confirmed backend stages.
- **Breaking Changes:** None.
- **Verification:** All 38 mobile regressions pass, including three scheduler tests covering all messages/wrapping hold, early result cancellation and failure/unmount/retry cleanup. Mobile TypeScript and focused component/helper lint pass. Native animation, actual fast/slow extraction, reduced motion, screen-reader, dark-mode and large-text checks remain pending.

## 2026-10-08 | Version: stop-details-no-handle-v1

- **Summary:** Remove the top drag handle from the stop-details bottom sheet.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Hide the handle on the shared dashboard/run stop-details sheet; preserve close, backdrop, swipe and Android Back dismissal.
- **Internal Changes:** Set the existing `showHandle` option to false; align dashboard plan v2.09 and Figma handoff.
- **Breaking Changes:** None.
- **Verification:** Focused StopDetailsSheet ESLint passes; native visual verification pending.

## 2026-10-08 | Version: compact-stop-timing-v1

- **Summary:** Reduce padding and gaps in the stop-details Time at location card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use 12-point card padding, 8-point vertical gaps and divider top padding, 10-point icon-to-text gaps and 1-point label-to-value gaps. Keep existing typography, wrapping and recorded time values.
- **Internal Changes:** Apply the tighter label/value stack only to timing rows; align dashboard plan v2.08 and the Figma timing handoff.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused StopDetailsSheet ESLint pass. Native compact-layout visual verification remains pending.

## 2026-10-08 | Version: auto-shipment-arrival-status-v1

- **Summary:** Show auto-created shipments as At delivery location during a confirmed destination visit and automatically deliver them on recorded departure.
- **API Changes:** Shipment/booking responses and driver status history can return `at_delivery_location`. Active mapped-booking reports include it; dashboard statistics add `at_delivery_location_bookings`. Driver mutation/import choices remain `delivered`, `in_transit`, `failed`.
- **Database Changes:** Add migration `2026_10_08_000001_add_at_delivery_location_status` to expand both enums. Rollback maps arrival values to `in_transit` before removing them. Applied and verified on local MAMP MySQL; no historical backfill or shipment-record repair.
- **Behavior Changes:** Keep arrival shipments outstanding and assignments active. Synchronize shipment/booking delivery, exit timestamp, valid odometer and completed assignment on departure. Restrict matching to the recorded vehicle/run/account/merchant/destination and nonremoved assignments; preserve terminal states and driver corrections. Keep combined delivery/collection visits linked to their delivery run. Reject stale departures; prevent duplicate delivery events and booking synchronization downgrades. Support existing auto-created assignments in driver-workflow runs without enabling auto-creation there. Add website status badges/filters and separate arrival counters plus correct mobile detail/import labels; shipment completion alone does not close the run.
- **Internal Changes:** Audit automatic entry/exit status changes with source, old/new values and linked visit. Align dashboard plan v2.07 and Figma scenario handoff with illustrative arrival/departure states.
- **Breaking Changes:** API consumers with exhaustive status enums must accept `at_delivery_location`; deploy the database migration before code begins writing it. Existing status values and driver-selectable choices remain supported.
- **Verification:** 147 focused Laravel tests (1,607 assertions), including lifecycle/overlap, explicit/GPS exits, booking recovery/synchronization, corrections/terminal states, wrong-run/removed assignments, stale departures, active reports and SQLite migration rollback/reapply; 35 mobile regressions; both frontend TypeScript checks; PHP syntax and focused frontend lint pass. Website settings has three existing unused-import warnings; mobile lint excludes the existing react-hooks/set-state-in-effect rule. Local MySQL enums and migration ledger verified; Figma handoff visually checked. Production migration/deployment, live truck departure and native status rendering remain unverified.

## 2026-10-08 | Version: automatic-delivery-note-reading-v1

- **Summary:** Advance directly to reading after choosing a valid delivery-note file or confirming a camera photo.
- **API Changes:** None; use existing context/upload endpoints.
- **Database Changes:** None.
- **Behavior Changes:** Restore the upload sheet directly into Step 2 after completed native selection, then upload/read the exact selected asset once the handoff unlocks. Remove normal selected-file confirmation/Continue. Cancel, invalid selection and picker errors remain at Step 1 without processing an old asset. Reading/context failures retain the file for Retry reading document or Change document. Keep already-read draft navigation controls.
- **Internal Changes:** Return assets from pickers rather than relying on asynchronously updated React state; load missing context before upload. Dashboard plan v2.06 and Figma selection-to-reading transitions/handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused upload-screen lint excluding the pre-existing react-hooks/set-state-in-effect rule, and ten handoff/navigation tests pass. Native successful auto-reading, failed upload/replacement, Android and dark/large-text checks remain pending.

## 2026-10-08 | Version: dashed-upload-card-target-v1

- **Summary:** Restore the visible Choose document action and allow tapping anywhere in the dashed upload panel.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** One accessible pressable wraps the icon, heading, file requirements, padding and visible Choose/Change document face. Every area opens the existing source chooser; preserve file selection, handoff locking, cancellation and gated Continue.
- **Internal Changes:** Replace the nested Pressable style callback with a statically styled inner View so the coral action renders reliably. Align dashboard plan v2.05 and canonical Figma card hit area/handoff.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused upload ESLint excluding the pre-existing react-hooks/set-state-in-effect rule, and eight sheet-handoff regressions pass. iOS simulator confirms the coral Choose document control is visible, activating the card opens Photo / File / Camera, and Cancel returns to Step 1 without selection/upload. Android, dark/large-text and selected-file interaction checks remain pending.

## 2026-10-08 | Version: timeline-stop-five-designs-v1

- **Summary:** Create five editable Figma alternatives for Expo timeline stop information.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None; the five designs await selection and are not implemented.
- **Internal Changes:** Add Minimal row, Soft stop card (recommended), Time first, Connected timeline and Clear detail action; five component variants and ten light/dark instances use existing theme tokens and SF Pro. Dashboard plan v2.04 records proposals, status and acceptance checks.
- **Breaking Changes:** None.
- **Verification:** Figma composition visually checked after auto-layout sizing correction. Confirmed editable text/vector structure, SF Pro typography and no image-filled UI layers. No runtime checks required for this design-only addition.

## 2026-10-08 | Version: dashed-document-selection-v1

- **Summary:** Implement selected Figma option 3, Dashed panel, for delivery-note file selection.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the fully tappable card with a dashed neutral panel, coral upload icon, centered title/file requirements and explicit full-width dark-coral Choose document button. Selected files show their wrapping filename and Change document; preserve selection-gated Continue, existing source handoff, validation, cancellation/errors and draft return.
- **Internal Changes:** Mark option 3 selected on the four-direction Figma board; align canonical Step 1/scenario handoff and dashboard plan v2.03. Other options remain references.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused upload-screen ESLint (pre-existing react-hooks/set-state-in-effect rule excluded) and git diff --check pass. Figma composition and SF Pro checked. Native iOS/Android layout, picker interaction, dark-mode and large-text checks remain pending.

## 2026-10-08 | Version: upload-section-four-designs-v1

- **Summary:** Add four editable Figma concepts for the delivery-note upload section.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None; no design selected or implemented.
- **Internal Changes:** Add Calm centered, Compact row, Dashed panel and Bold coral components and a comparison board; record proposals and selection gate in dashboard plan v2.02.
- **Breaking Changes:** None.
- **Verification:** Figma composition visually reviewed, SF Pro asserted, editable component instances/text/vector layers confirmed without UI raster images; five-step progress and file requirements retained. Native behavior is outside this design-only task.

## 2026-10-08 | Version: expo-timeline-stop-tap-area-v1

- **Summary:** Open stop details by tapping anywhere in an Expo timeline stop information block.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Expand the shared dashboard/run-detail stop button to include the event label, name, address, timestamp, speeding metadata and intervening space. Keep shipment links as independent navigation controls.
- **Internal Changes:** Record the implementation correction in the dashboard handoff; retain existing layout and Figma design.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused RunTimeline ESLint pass. Native tap/scroll verification remains pending.

## 2026-10-08 | Version: structured-stop-visit-times-v1

- **Summary:** Make stop entry, exit and time spent easier to scan in the location details sheet.
- **API Changes:** None; use existing occurred_at/exited_at fields.
- **Database Changes:** None.
- **Behavior Changes:** Add labelled Entered at, Exited at and Total time at location rows with icons, dividers, local timestamps and a prominent duration. Missing exit shows Exit not recorded; unavailable duration remains explicit. Calculate only from valid ordered recorded timestamps, including zero-length, timezone and multi-day visits. Preserve planned endpoint and speeding event semantics.
- **Internal Changes:** Dashboard plan v2.01 and Figma scenario handoff aligned; add focused elapsed-time regressions.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused sheet/helper lint, three elapsed-time regressions and diff checks pass. iOS simulator visually verifies separate entered/exited rows, readable local timestamps, map context and an accurate 1 min 48 sec total for a recorded stop, plus Exit not recorded/Not available for a stop without exit evidence. Native dark/large-text/short-screen and Android verification remain gates. No API or production mutation.

## 2026-10-08 | Version: centered-map-delivery-note-warning-v1

- **Summary:** Float the delivery-note warning in the center of the dashboard map.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the reserved top banner with a centered white card over the map, rounded corners and a soft shadow. Keep the warning triangle, existing message and run-scoped upload action. Map gestures pass through outside the card; the expanded run sheet may cover the map/card.
- **Internal Changes:** Restore full map/sheet space and normal top safe-area handling; bound the card width to 420 points with side clearance. Dashboard plan v2.00 and Figma scenario handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused dashboard lint excluding the existing effect rule and diff checks pass. Native positioning, shadow, map gestures, upload tap, large text and short screens remain unverified.

## 2026-10-08 | Version: minimal-document-selection-v1

- **Summary:** Simplify delivery-note file selection around one clear action.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the explanatory paragraph and duplicated heading/button with one centered tappable card containing an upload icon, Choose document and supported formats/20 MB limit. Show the filename and Change document after selection; retain Continue, errors, source picker and saved-draft return.
- **Internal Changes:** Dashboard plan v1.99 and Figma Step 1 copy/scenario handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and diff checks pass. Focused upload-screen lint passes with the pre-existing react-hooks/set-state-in-effect violation excluded. Native iOS/Android visual, dark-mode and large-text checks remain unverified.

## 2026-10-08 | Version: fixed-delivery-note-warning-v1

- **Summary:** Make the required delivery-note message prominent and visible above the dashboard map.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the cloud-upload icon with an outlined warning triangle. Move the existing tappable red/pink message to a fixed banner below the top safe area, outside the run panel, so scrolling and expanding the panel cannot cover it. Retain the server-controlled requirement and upload for that run; remove the duplicate sheet message.
- **Internal Changes:** Measure map/sheet space beneath the banner and avoid duplicate top insets. Dashboard plan v1.98 and Figma scenario handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused dashboard lint excluding the pre-existing effect rule, and diff checks pass. Native iOS/Android sheet positions, warning tap, large text and short-screen layout remain unverified.

## 2026-10-08 | Version: direct-trip-location-selection-v1

- **Summary:** Remove the extra confirmation screen from delivery-note trip-location selection.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Tapping a starting-point or planned-end result immediately updates the draft endpoint and returns to trip review. Reopen search through Change location. Final upload still requires review and confirmation.
- **Internal Changes:** Add opt-in direct selection to LocationSearchPicker, retaining explicit confirmation for Edit Run and Final Destination. Reuse submission/error guards. Dashboard plan v1.97 and Figma handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint excluding the pre-existing import-page effect rule, and diff checks pass. Native direct-selection interaction remains unverified.

## 2026-10-08 | Version: navigable-delivery-note-steps-v1

- **Summary:** Use the segmented step UI throughout delivery-note upload and let drivers return to completed steps.
- **API Changes:** None; reuse existing import filename, extraction, preview and confirmation APIs.
- **Database Changes:** None.
- **Behavior Changes:** Show five coral/grey rounded segments and a step label, with accessible 44-point completed-step buttons. Preserve draft locations, shipment edits and run choice on return; clear final confirmation readiness and retain normal forward validation. Current/future steps are inactive and network work locks navigation. Revisited Step 1 shows the original filename and document replacement; cancellation/failure offers return to the existing draft. Revisited Step 2 shows successful reading without replaying upload/AI.
- **Internal Changes:** Shared ImportStepIndicator and step navigation policy; dashboard plan v1.96 and Figma step references/handoff updated.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, all 32 regression tests, focused lint with the existing import-page effect rule excluded and diff checks pass. iOS simulator visually verifies Step 1 and inactive current/future segments without uploading. Native completed-step navigation/draft retention, replacement round trips, VoiceOver, Android, dark mode and large text remain unverified. No upload, commit or push performed.

## 2026-10-08 | Version: automatic-expo-go-apple-maps-v1

- **Summary:** Automatically use Apple Maps in iOS Expo Go without requiring the recovery button.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Shared dashboard/stop-preview provider selection excludes unsupported Google in iOS Expo Go even when Fabric/legacy Google views appear registered. Use Expo’s native host check, keeping native development/release Google builds and Android behavior intact. Preserve coordinates, pins, routes, refitting, themes, missing-coordinate states and existing render-error recovery. No timeout-based tile-failure inference.
- **Internal Changes:** Dashboard plan v1.95 and existing Figma provider handoff updated. Existing maps config plugin installs/initializes native iOS Google only with its build key; no key or manifest change required for this fix.
- **Breaking Changes:** None. Silent Google key/billing/network failures in configured native builds still lack a general SDK tile-error callback; manual recovery remains available there. React boundaries cannot catch native SDK crashes.
- **Verification:** All 30 mobile regression tests, TypeScript and focused provider lint pass. Tests cover misleading iOS Expo Go registrations, native development/release Google, Android Expo Go and failed-Apple exclusion. Fresh launch of Expo Go 57.0.9 on iPhone 17 Pro Max / iOS 26.1 verifies automatic Apple dashboard tiles, truck/starting-point markers and Engen Isando Depot1 stop preview tiles/coral pin/metadata, without pressing recovery. Native Google-equipped iOS, Android and dark-mode checks remain pending. Existing main Expo server remains on port 8081 with its API environment; no commit, push or deployment.

## 2026-10-08 | Version: trip-location-selector-back-v1

- **Summary:** Simplify navigation in delivery-note starting-point and planned-end location selectors.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Add a neutral 44-point back arrow before the title, returning to trip-location review and preserving prior endpoint choices. Remove the trailing close button, red content Back button and handle from these selectors.
- **Internal Changes:** Add an optional shared BottomSheet header back action and forward it through ImportSheetPage. Update dashboard plan v1.94 and both Figma selector headers/handoff.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, all 28 mobile regression tests, diff checks and focused lint pass with the pre-existing import-page effect rule excluded. Both Figma selector headers visually verified. Native keyboard/back navigation, dark mode and large text remain unverified.

## 2026-10-08 | Version: trip-location-review-ui-v1

- **Summary:** Make delivery-note Step 3 easier to scan and reuse the shared location chooser.
- **API Changes:** None; use the existing paginated authorised location search.
- **Database Changes:** None.
- **Behavior Changes:** Add compact themed route endpoint cards, distinct names/full addresses, pin/flag rail, step progress and Change location hints. Review shipments requires both endpoint map positions and shows checking feedback. Both endpoint selectors use LocationSearchPicker with keyboard search, pagination, retry and explicit selection confirmation. Preserve prior choices on Back and persist full confirmed location details with the draft; individual shipment addresses remain unchanged.
- **Internal Changes:** ImportSheetPage forwards native-scroll and scroll-event options for shared picker keyboard/pagination support. Dashboard plan v1.93, Figma reference copy/actions and implementation handoff updated.
- **Breaking Changes:** None.
- **Verification:** All 28 mobile regression tests pass using Node type stripping; mobile TypeScript, diff checks and focused lint pass with the pre-existing import-page react-hooks/set-state-in-effect rule excluded. Figma reference visually checked; exact route-panel styling is specified in the handoff. Native Step 3, keyboard/pagination, long addresses, large text, short screens and dark-mode interaction remain unverified. No delivery-note submission, commit or push performed.

## 2026-10-08 | Version: delivery-note-picker-handoff-v1

- **Summary:** Keep native delivery-note Photo/File/Camera pickers above the app by serializing the upload sheet, source chooser and native UI.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Fully dismiss Step 1 before the source chooser, then dismiss the chooser before opening a native picker. Shared dismissal notifications occur after portal removal commits, without timeout guesses. Preserve selected run/context/file during cancellation, denial, invalid selection and source failure; restore Step 1 once without reopening the chooser or starting an upload. Block duplicate handoffs/Continue and ignore stale native results after unmount. Camera confirmation/retake stays suspended; Photo uses system chosen-asset access without requesting full-library permission.
- **Internal Changes:** Add a reusable sheet handoff coordinator and optional ActionSheet/MessageSheet dismissal results, preserving existing action callbacks. Dashboard plan v1.92 and Figma handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, all 28 mobile tests (eight handoff regressions), diff checks and focused lint pass with the pre-existing import effect rule excluded. iOS simulator verifies chooser replacement, native Files navigation and cancellation, Photos presentation/cancellation, Camera presentation/cancellation, successful local selection of a stock simulator photo, retention after Change document cancellation, and closing without upload. Native screenshots show pickers unobscured by app sheets. No personal document selected and no upload/production mutation, commit or push performed for this fix. Physical capture/retake, denied camera permission/settings return, Android, native error injection, dark mode, large text and short-screen checks remain acceptance gates. Existing main Expo preview continues on port 8081.

## 2026-10-08 | Version: consolidated-main-run-workflows-v1

- **Summary:** Consolidate the stop-details/map improvements and consecutive-shipment guard into the saved main checkout alongside existing run-card, timeline, location-search and admin shipment work.
- **API Changes:** Includes scoped nullable stop coordinates, driver run-card location evidence and authorized admin run-shipment creation/attachment described below.
- **Database Changes:** None; no migration.
- **Behavior Changes:** Preserve all existing main edits; include real stop-location maps with iOS Apple recovery, exact legacy-coordinate resolution and automatic shipment deduplication. Retain bold run cards, continuous run timelines, location-search autofocus and admin Add shipment. Mobile environment defaults use `https://api.spaces.za.com/api/v1`, matching the existing local preview configuration.
- **Internal Changes:** Merge documentation into dashboard plan v1.91 without replacing newer v1.90 work. Original user-created commits remain preserved in their worktrees; consolidated content is committed on main only at the user's explicit request. The main Expo preview is served on port 8081; the separate worktree preview is stopped.
- **Breaking Changes:** None. Unlinked legacy stops need the nullable timeline-coordinate API deployment for maps; no deployment or production data edits performed.
- **Verification:** Combined saved-main verification passes 145 Laravel tests (1,457 assertions), 20 mobile provider/coordinate/map/filter/run-card tests, mobile and website TypeScript, focused mobile lint excluding existing dashboard effect/recorded-map purity rules, and diff checks. iOS Apple dashboard/stop tiles, selected-location pin, metadata and close were visually verified before transfer; source parity and main Expo manifest verified after transfer. Cross-provider iOS, Android, dark mode, large text, short screens and live admin interactions remain acceptance gates.

## 2026-10-08 | Version: native-map-fallback-and-legacy-stop-coordinates-v1

- **Summary:** Restore native maps when the iOS Google provider is absent and map existing stops whose older timeline payload omits coordinates.
- **API Changes:** None in this follow-up. Reuse the existing authorized shipment/endpoint location coordinates; retain the earlier nullable timeline-coordinate API addition.
- **Database Changes:** None.
- **Behavior Changes:** Dashboard and stop preview share registered-native-view capability checks. Keep Google where supported; select Apple on iOS when Google is absent or a catchable React map-render error occurs. Share recovery choice across mounted maps; Google-equipped iOS offers Use Apple Maps for silent tile failures. Android retains Google or shows Map unavailable. Apply Google JSON styles only to Google and mutedStandard to Apple; retain markers, routes, native theme and refitting. No timer guesses provider failure. Older timeline stops may use an exact, unambiguous name/address match from linked authorized shipment locations or authorized endpoints. Never replace speeding positions, explicit null/invalid coordinates or unrelated locations. Distinguish missing coordinate payload from unavailable map provider; no fabricated coordinates/geocoding.
- **Breaking Changes:** None. Unlinked legacy stops still require deployment of the previously added timeline coordinates to display a pin. React boundaries cannot catch native SDK crashes; silent tile failures have no SDK error callback and require explicit recovery.
- **Verification:** 17 mobile map/provider/coordinate/filter tests, TypeScript, focused lint excluding pre-existing dashboard effect and recorded-map purity rules, and diff checks pass. iOS simulator confirms automatic Apple readiness, dashboard tiles/markers, and actual William Nicol Convenience Cntr stop tiles/coral pin/metadata/close. Runtime diagnostics confirm the live stop payload omits timeline coordinates and resolves an exact linked saved-location match. Google-equipped iOS, Android, native fault injection, dark mode, large text and short-screen scrolling remain acceptance gates. Dashboard plan v1.91 and Figma handoff aligned. Expo now runs from the saved main checkout on port 8081 using the existing API environment. No deployment or production data edits performed.

## 2026-10-08 | Version: timeline-location-details-v1

- **Summary:** Replace generic timeline stop messages with a dedicated location details sheet on Dashboard and run history.
- **API Changes:** Driver dashboard and run-detail timeline stops include nullable numeric `latitude`/`longitude`. Visits and planned stops use scoped saved locations; speeding and unlocated physical stops use recorded event positions. Invalid pairs return null; foreign planned endpoints are excluded. Older APIs remain readable with the unavailable-map state.
- **Database Changes:** None.
- **Behavior Changes:** Separate event kind, wrapping location name, full address and labelled local date/time; retain departure, planned and speeding metadata. Frame a native Google map with a coral location pin, reusing the run basemap. Missing/invalid coordinates show Location unavailable. Use shared scrolling, safe areas, theme surfaces and close/backdrop/swipe/Back dismissal; remove the oversized OK button. Clear open details on session changes. Web shows mobile-map guidance.
- **Breaking Changes:** None. Deploy the API addition to populate real stop maps; no new dependency or migration.
- **Verification:** 37 Laravel tests pass (267 assertions), including valid/zero/missing/invalid coordinates, recorded speeding position and foreign location/endpoint exclusion. Mobile TypeScript, five existing map/filter tests, focused lint with the existing dashboard effect rule excluded, PHP syntax and diff checks pass. Dashboard plan v1.91 and Figma scenario handoff aligned. Native map/sheet, Android, dark mode, long text and short-screen scrolling remain unverified: the worktree Metro server started and the simulator began bundling, but computer control became unavailable before inspection. No final native screenshot is claimed.

## 2026-10-08 | Version: consecutive-geofence-shipment-guard-v1

- **Summary:** Prevent consecutive automatic shipment creation at the same delivery geofence when mutable shipment records no longer satisfy existing reuse checks.
- **API Changes:** None.
- **Database Changes:** None; use existing `vehicle_activity` creation history.
- **Behavior Changes:** Before creating a shipment, compare the location ID with the latest automatic creation activity by insertion ID scoped to account, merchant, vehicle and run. Block another consecutive creation there after destination/reference edits, assignment removal or soft deletion. Preserve physical visits, existing destination reuse/reference restoration and audited-cleanup protections. Different destinations sharing the run pickup and the same destination on a later run remain eligible. Manual/imported shipments and driver-planned workflow are unchanged. Dashboard plan v1.91 updated; no Figma screen/control changes.
- **Breaking Changes:** None.
- **Verification:** 61 Laravel lifecycle, geofence-cleanup and location-update tests pass (399 assertions). Three new regression cases fail against the original code and pass with the fix; coverage also checks different destinations, later runs and nonconsecutive creation. PHP syntax, test-file Pint and diff checks pass. Service-file Pint reports the same pre-existing formatting rules as the HEAD baseline; unrelated formatting was preserved. The supplied production run redirects to sign-in and has not been verified or modified; no deployment performed. “Same place” is interpreted as the automatic creation/delivery geofence, because pickups intentionally share the run origin.

## 2026-10-08 | Version: admin-run-add-shipment-v1

- **Summary:** Add a top-right Add shipment action to the admin run-detail Shipments card, supporting existing selection and new shipment creation.
- **API Changes:** `POST /api/v1/runs/{run_uuid}/shipments` accepts in-progress attachments; new `POST /api/v1/runs/{run_uuid}/shipments/create` atomically creates and attaches a shipment using the existing shipment payload. Run detail adds `can_add_shipments` based on status/update permission.
- **Database Changes:** None; existing shipment/parcel/run-assignment records and transactions, no migration.
- **Behavior Changes:** Authorised users can add to draft/dispatched/in-progress runs; closed runs and viewers have no action. Existing reference search filters attached/terminal/other-active-run/different-environment matches. New creation inherits run environment, disables carrier auto-assignment and rolls back on attachment failure. Duplicate references direct users to existing selection. Preserve shipment statuses, recorded visits and closure behaviour; refresh run table/counts after success and retain errors for retry.
- **Internal Changes:** Lock/recheck run before attaching; ignore stale shipment-search responses. Dashboard plan v1.90 records implementation and acceptance gates; mobile Figma unaffected.
- **Breaking Changes:** None; attachment status remains planned for draft/dispatched and active for in-progress runs.
- **Verification:** 61 Laravel tests pass (866 assertions) across run API, delivery-note import, automatic lifecycle and driver run actions, including active attachment/idempotency, scope/conflict rejection, atomic creation/rollback, closed-run rejection and viewer denial. Website TypeScript, focused ESLint and diff checks pass. Authenticated browser interaction not performed.

## 2026-10-08 | Version: bold-run-route-card-v1

- **Summary:** Implement selected Figma option 2, Bold route spine, for shared Runs list/detail cards.
- **API Changes:** Driver run list/detail add nullable `current_location` (name/address/report time) and `recorded_end` (location ID/name/address). Current location requires recent in-progress-run vehicle evidence within 15 minutes; recorded end requires a scoped run-ended event at completion on the run's vehicle. Fields are optional in Expo for older-response compatibility.
- **Database Changes:** None; add a bounded read relation, no migration.
- **Behavior Changes:** Coral connected start/end markers, tinted current location, dashed unknown planned end, three shipment-count columns, rounded grey/white themed surfaces and merchant-timezone date. Incomplete runs without a destination show Starting point / Current location / Planned end—Unknown. Completed history uses recorded end evidence, preserves a solely planned label and never shows the truck's present location. Missing data shows Unknown; lifecycle, navigation and read-only history remain unchanged. Bundle eight exact Figma SVGs in light/dark themes.
- **Breaking Changes:** None; deploying the updated API enables location evidence, while older APIs display Unknown where needed.
- **Verification:** 63 focused Laravel tests pass (474 assertions), including recent/stale/future/pre-run/current-driver/tenant isolation and recorded-end evidence. Eight mobile route/map/filter tests, mobile TypeScript, focused card/API lint, Pint, iOS production bundle export (including all eight route SVGs) and diff checks pass. Figma selected family and affected Runs screens aligned and visually checked. Native iOS/Android light/dark, large-text/long-address, navigation and SVG rendering checks remain pending; simulator UI access timed out.

## 2026-10-08 | Version: shipment-detail-designs-v1

- **Summary:** Create five editable Figma shipment-detail directions for driver review and selection.
- **API Changes:** None; navigation/call shortcuts and friendlier POD capture are proposals requiring integration checks.
- **Database Changes:** None.
- **Behavior Changes:** None in the app. Proposals prioritise destination/instructions, scanning, explicit delivery outcomes, proof/files and dispatch contact; completed-run examples stay read-only without changing the current shipment status.
- **Internal Changes:** Dashboard plan v1.88 documents website/mobile findings, action safeguards, acceptance criteria and selection-pending status. Add ten active/completed screen concepts and five shared action/validation concepts in a separate Figma page; preserve existing implemented designs.
- **Breaking Changes:** None.
- **Verification:** Native editable layers, existing Spaces header/button instances, SF Pro, token bindings and horizontal layout checks verified. Five active directions and completed Next stop visually reviewed. Runtime unchanged; native/dark/accessibility validation and prototype/action integration await selection. Website review used local source, not a live authenticated session.

## 2026-10-08 | Version: run-card-route-designs-v1

- **Summary:** Add five Figma run-card directions for user selection, each with completed and active/unknown-planned-end examples.
- **API Changes:** None; current-location and recorded-finish data remain an implementation handoff.
- **Database Changes:** None.
- **Behavior Changes:** None in the app. Proposed connected-route cards distinguish Starting point, Current location and Planned end / Unknown; no design selected or implemented.
- **Internal Changes:** Dashboard plan v1.87 records proposal status, acceptance criteria and Figma comparison link. Preserve existing app cards and implemented screen designs.
- **Breaking Changes:** None.
- **Verification:** Five component families/two states each, ten review instances, SF Pro typography, token bindings, editable vector/text structure and visual comparison verified. Native/runtime tests are not applicable to this design-only change.

## 2026-10-08 | Version: shared-run-timeline-spacing-v1

- **Summary:** Match run detail timeline spacing to the dashboard through the existing shared `RunTimeline` component.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Contain timeline rows in one View so run detail section spacing applies around the timeline instead of between stops, preserving the continuous rail and dashboard row spacing. Retain markers, shipment branches, stop details, dashboard filtering and completed-run shipment navigation.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused timeline/run-detail ESLint and diff checks pass. Native visual verification blocked by the locked Mac. Dashboard plan v1.86 and Figma Runs handoff aligned.

## 2026-10-08 | Version: location-search-autofocus-v1

- **Summary:** Focus the shared location search input automatically when it appears.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Final destination and Edit Run planned start/end search use native TextInput autofocus, including returning through Choose another location. Keep existing keyboard avoidance, search submission and pagination.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused location-picker lint and diff checks pass. Physical iOS/Android keyboard verification pending. Dashboard plan v1.85 updated; existing keyboard-visible search design remains the visual target.

## 2026-10-08 | Version: admin-driver-password-merchant-context-v1

- **Summary:** Fix website admin driver password updates returning `NOT_FOUND` when the driver belongs to a selected secondary merchant.
- **API Changes:** `PATCH /api/v1/drivers/{driver_uuid}/password` accepts optional UUID `merchant_id` (also the existing `merchant_uuid` input alias). Merchant users resolve that accessible merchant and scope the driver lookup to it; invalid or inaccessible context cannot fall back to the first merchant. Omitting context preserves the existing first-merchant behavior; super-admin access is unchanged.
- **Database Changes:** None.
- **Behavior Changes:** Website password dialogs send the driver detail's selected merchant, falling back to the driver resource's merchant. Password-update audit logs use the resolved merchant, including legacy carrier-scoped drivers, without storing password values.
- **Breaking Changes:** None.
- **Verification:** 10 focused Laravel tests pass (42 assertions), including secondary-merchant updates, scope denial, unknown/inaccessible merchant denial, legacy carrier scope, super-admin access and input validation. Website TypeScript, focused driver-component/API lint and diff checks pass. Live password submission was not performed.

## 2026-10-08 | Version: compact-documents-details-v1

- **Summary:** Implement selected refined Figma Documents design and separate document details.
- **API Changes:** None; reuse authenticated driver file listing and authorized download URL.
- **Database Changes:** None.
- **Behavior Changes:** Top-right coral Upload document action, conditional required/expired tiles, compact tappable type/filename/status rows. Nested `/documents/[file_id]` shows full metadata, expiry, uploader and Download with loading/error feedback, keeping Documents selected. Add back icon beside details title. Preserve upload form, refresh, badges and dashboard styling. Bundle six Figma SVGs and extend shared header with optional leading/action slots.
- **Breaking Changes:** None; `/documents` remains the list route.
- **Verification:** Mobile TypeScript, focused Documents/header lint and diff checks pass. iOS list/details/back/header-upload entry verified without upload; upload submission, download, dark mode and Android require device verification. Dashboard plan v1.84 and mobile documentation updated.

## 2026-10-08 | Version: driver-runs-tab-v1

- **Summary:** Replace Expo Shipments with Runs, showing active assignments and dispatch-completed history with run details.
- **API Changes:** Add paginated driver-role `GET /api/v1/driver/runs` (active/completed filters) and `GET /api/v1/driver/runs/{run_uuid}`. Optional `run_id` on shipment GET, driver shipment-file list and file download permits scoped completed-run reads after reassignment without granting mutation access.
- **Database Changes:** None; no migration.
- **Behavior Changes:** Default Active includes ready-to-start draft/dispatched and in-progress runs; Completed excludes cancelled runs and sorts latest closure first. Cards show reference, status, vehicle, endpoints, progress and dates. Add detail summary/shipments/shared recorded timeline, Open dashboard for active actions, read-only completed shipment views, pagination/refresh/retry and stale-response/session guards. Redirect legacy /bookings to Runs; preserve shipment/scan/import routes and existing run lifecycle.
- **Internal Changes:** Extract shared driver run-data assembly and RunTimeline presentation; use lightweight summary counts without loading GPS/activity or shipment detail on list requests.
- **Breaking Changes:** None; new mobile screens require the updated API deployment before use.
- **Verification:** 61 focused Laravel tests (430 assertions), mobile TypeScript, five map/filter tests and new-screen focused lint pass. Legacy dashboard/shipment-detail lint passes with existing set-state-in-effect errors excluded. iOS active/pending list, Completed empty state, run details, shipment entry and Open dashboard verified without mutations. Android, native dark mode, completed-content, long-list pagination and network/session race checks remain pending; existing Account theme control did not respond in the simulator. Dashboard plan v1.83 and Figma static list/detail/dark examples plus 69 existing navigation labels/icons aligned. Figma rejected new prototype-link reactions; static design handoff records this limitation.

## 2026-10-08 | Version: white-tab-surfaces-v1

- **Summary:** Use white page backgrounds with contrasting cards on Shipments, Documents and Account.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** White light-mode canvas, soft grey cards/loading/empty panels, white nested address/document metadata panels and selected shipment filter. Preserve dark-mode surfaces, semantic status/required/expired colours and actions. Messages is already white. Dashboard and document-upload modal styling remain unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, diff checks and focused lint excluding the existing Shipments memoization warning pass. Native light/dark visual verification remains pending. Dashboard plan v1.82 and Figma surface handoff aligned.

## 2026-10-08 | Version: shared-tab-page-header-v1

- **Summary:** Standardise Messages, Shipments, Documents and Account with a reusable clean fixed header.
- **API Changes:** None; internal `PageHeader({ title, status? })` component added.
- **Database Changes:** None.
- **Behavior Changes:** Use consistent 28-point accessible page titles, spacing and theme-aware dividers above scrolling bodies. Each screen owns one safe-area inset. Replace introductory cards/subtitles; keep Upload document below the divider, account name in profile details and conditional Messages Closed status. Preserve page actions, filters, refresh and badges.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript passes; focused lint passes with the pre-existing Shipments memoization rule warning excluded (hook unchanged). iOS light-mode Shipments/Documents/Account layout and upload-form entry verified; no document uploaded. Simulator interruption prevented completing all-tab scrolling/refresh, latest Messages keyboard, dark-mode and Android checks. Figma shared component/examples and Messages/Documents instances aligned; dashboard plan v1.81 updated.

## 2026-10-08 | Version: messages-header-title-only-v1

- **Summary:** Remove the user-name subtitle beneath Messages.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Show only the Messages heading for active chats; retain Closed status for closed chats and sender labels within history.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused Messages lint and diff checks pass. Selected Figma and dashboard plan v1.80 aligned.

## 2026-10-08 | Version: messages-calm-conversation-v1

- **Summary:** Implement selected Figma Messages option 1 (Calm conversation) in Expo.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Theme-aware white chat canvas, centred illustrated empty state, soft message bubbles, rounded multiline input and integrated 44-point attachment/send controls. Omit the Dispatch avatar/title/subtitle and default “Send a message or attach a file” helper text. Empty sends are disabled; preserve drafts/retries, selected-file removal, attachment downloads, older history, polling and unread badges. Show loading/error and read-only closed-chat guidance. Bundle selected Figma SVG icons locally.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused Messages ESLint pass. iOS simulator verifies empty state/icons, typing, clearing, send gating and composer above the software keyboard; no test message sent. Android, dark mode and attachment/send/retry/closed interactions remain pending. Dashboard plan v1.79, mobile/messaging documentation and selected Figma status aligned.

## 2026-10-08 | Version: location-search-native-scroll-v1

- **Summary:** Simplify shared location search to a regular native ScrollView and TextInput.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Title, search input and results scroll together in final destination and planned start/end pickers. Remove sticky/fixed headers, header-size measurements and picker render callbacks. Use a bounded sheet, iOS KeyboardAvoidingView and Android resize; disable sheet content-pan gestures for native scrolling. Preserve keyboard search, pagination, clear/retry, previews and endpoint confirmation. Other sheets retain their existing scroll implementation.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint for BottomSheet, LocationSearchPicker and both consumers, and diff checks pass. Dashboard plan v1.78 and Figma handoff aligned. iOS simulator confirms typed text is visible in the native search input. Search submission, keyboard avoidance, long-list scrolling/pagination and Android interaction remain pending; no endpoint save submitted.

## 2026-10-08 | Version: location-search-fixed-input-v1

- **Summary:** Repair the shared pinned location input that failed to display entered text.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the animated ScrollView sticky-header wrapper with a fixed sibling header. Keep the controlled BottomSheetTextInput and keyboard integration; scroll only results and feedback. Measure header/result content to size the sheet within its safe-area maximum. Applies to final destination and Edit Run planned start/end. Preserve pagination, clear/retry and confirmation.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused lint for the shared sheet/picker and both consumers, and diff checks pass. Dashboard plan v1.77 and Figma handoff aligned. Native typing/backspace, clear/submission, keyboard and long-list scrolling remain pending; simulator interaction could not confirm typing. No endpoint mutation submitted.

## 2026-10-08 | Version: location-search-sticky-header-v1

- **Summary:** Keep the shared location-search input visible while results scroll.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Final destination and Edit Run planned start/end pin the title/close controls and search field above scrolling cards, errors and pagination. The header uses an opaque light/dark sheet background. Preserve keyboard search, pagination, retry and selection confirmation. Shared BottomSheet supports an optional sticky header; other sheets retain their scrolling behavior.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused ESLint pass for BottomSheet, LocationSearchPicker and both consumers; diff checks pass. Dashboard plan v1.76 and Figma handoff aligned. Native long-list scrolling/keyboard checks remain pending; no endpoint changes saved.

## 2026-10-08 | Version: shared-run-location-picker-v1

- **Summary:** Centralize final-destination and Edit Run planned start/end location search.
- **API Changes:** None; reuse the existing paginated driver location-search endpoint.
- **Database Changes:** None.
- **Behavior Changes:** All three flows use LocationSearchPicker with an initially empty rounded input, keyboard Enter/Search for any nonblank query, themed location cards, pagination/deduplication, clear/reset and loading/empty/retry states. Start/end include a selected-location preview and Use starting point/Use planned end location confirmation; Back to endpoints discards an unconfirmed choice. Enable the same keyboard avoidance. Endpoint choices update the edit draft; Save endpoints retains atomic persistence and conflict protection. Final destination keeps its explicit save action.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused lint pass for the shared picker and both consumers. Dashboard plan v1.75 and Figma run-action handoff aligned. Native iOS/Android search, scrolling, keyboard, dark-theme and save interaction remain pending; no endpoint mutation submitted.

## 2026-10-08 | Version: additional-cost-remove-cancel-v1

- **Summary:** Remove the bottom Cancel button from the mobile additional-cost form.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** The form ends with Add cost. Header close, backdrop and swipe dismissal remain available when not saving; other run forms retain their Cancel actions.
- **Breaking Changes:** None.
- **Verification:** Focused RunActionForm lint and diff checks pass; dashboard plan v1.74 and Figma cost-sheet examples aligned. Native visual check remains pending.

## 2026-10-08 | Version: additional-cost-form-design-v1

- **Summary:** Improve the mobile additional-cost form's field hierarchy and styling.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Add a concise expense notice, rounded theme-aware fields, an expense placeholder, prominent rand amount with R prefix and cents guidance, and visible focus borders. Use a rounded Add cost action with plus/saving indicator and neutral Cancel. Limit description input to the existing 255-character contract and lock fields during saving. Preserve exact amount validation, drafts on errors and retry deduplication.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused RunActionForm ESLint pass. Updated Figma cost-sheet examples visually inspected; dashboard plan v1.73 and handoff aligned. Native layout/keyboard, accessibility text sizes and dark-theme visual checks remain pending; no cost submitted.

## 2026-10-08 | Version: edit-run-sheet-design-v1

- **Summary:** Improve the Expo Edit Run sheet with compact endpoint cards and clearer actions.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use themed bordered start/end cards with colored map/flag icons, inline Change/Choose buttons, distinct location/address typography and helpful empty states. Show a compact context notice, rounded primary Save endpoints and neutral Cancel. Retain existing endpoint validation, conflict protection and selection flow; other run forms are unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused RunActionForm lint pass. iOS simulator layout reviewed without saving; dashboard plan/Figma handoff aligned. Android/dark-theme verification pending.

## 2026-10-08 | Version: destination-preview-copy-removal-v1

- **Summary:** Remove the Your run’s planned end… explanation from the selected destination preview.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep the selected-location card, Save final destination and Choose another location actions.
- **Breaking Changes:** None.
- **Verification:** Inspected the targeted copy removal; diff check passes.

## 2026-10-08 | Version: destination-pagination-footer-space-v1

- **Summary:** Keep the destination Loading more… indicator in view at the list end.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reserve a 120-point footer with 16-point bottom padding whenever results exist, before loading starts. Render loading/retry inside that reserved space so it does not appear below the previous scroll boundary.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused picker lint and diff checks pass; dashboard plan/Figma handoff aligned.

## 2026-10-08 | Version: destination-search-pagination-v1

- **Summary:** Automatically load and append paginated destination search results.
- **API Changes:** Driver trip-location search accepts optional positive `page` and returns `meta.next_page` (nullable). Saved matches use stable ID order and 20 results/page. Geocoding fallback remains a terminal set of up to five results, only on the first page.
- **Database Changes:** None.
- **Behavior Changes:** Near the list end, append the next page, deduplicate UUIDs and show Loading more…. Preserve results after page failures with retry; prevent duplicate requests and discard stale responses after a new/cleared search or dismissal.
- **Breaking Changes:** None; existing array clients keep receiving their first page.
- **Verification:** 3 focused location-search tests pass (23 assertions), covering single-character/merchant isolation, multi-page order/no duplicates/end-of-list, page validation and geocoding fallback. Mobile TypeScript and focused sheet/picker lint pass; OpenAPI YAML and diff checks pass. Dashboard plan/Figma handoff aligned. Physical Android scroll/keyboard verification pending.

## 2026-10-08 | Version: destination-keyboard-avoidance-v1

- **Summary:** Keep the destination search input visible while the keyboard is open.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Destination picker opts into Gorhom fill-parent keyboard avoidance with top safe-area clearance, Android resize mode and restore-on-blur. Keep the integrated BottomSheetTextInput and scrollable results. Other sheets retain their keyboard behavior.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused sheet/picker lint and diff checks pass. Physical Android keyboard verification pending.

## 2026-10-08 | Version: android-action-sheet-bottom-gap-v1

- **Summary:** Separate Android floating action sheets from the system navigation bar.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Shared floating BottomSheet (including ActionSheet) adds 16 points beyond the Android bottom safe-area inset, instead of using the inset as the entire margin. Bound dynamic height to the resulting space. iOS/web bottom spacing remains unchanged.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused shared-sheet lint pass; diff checks pass. Physical Android gesture/three-button navigation verification pending.

## 2026-10-07 | Version: destination-search-results-only-v1

- **Summary:** Show destination locations only after an explicit search.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Open the picker with an empty list and no heading. Show Search results only when matches exist. Clear/empty submission removes results instead of loading saved locations. Show no-match feedback only after a search; discard stale search responses.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused picker lint and diff checks pass. iOS simulator confirms the initial empty picker with no results heading. Dashboard plan and Figma handoff aligned.

## 2026-10-07 | Version: destination-card-padding-v1

- **Summary:** Reduce final-destination location-card padding.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use 10-point card padding/gaps and a 70-point minimum height, retaining readable address wrapping and selection behavior.
- **Breaking Changes:** None.
- **Verification:** Inspected the card spacing change; diff check passes.

## 2026-10-07 | Version: destination-search-any-length-v1

- **Summary:** Remove the minimum-length hint and allow destination searches of any non-empty length.
- **API Changes:** Driver trip-location search accepts 1–255 characters instead of 3–255.
- **Database Changes:** None.
- **Behavior Changes:** Enter/Search submits even single-character queries; empty input restores saved locations. Retry preserves short queries. Remove the Enter at least… hint.
- **Breaking Changes:** None.
- **Verification:** Single-character/merchant-scope regression passes (1 test, 4 assertions); mobile TypeScript and focused picker lint pass. Diff check passes; dashboard plan and Figma handoff aligned.

## 2026-10-07 | Version: destination-search-pill-v1

- **Summary:** Make the final-destination search input fully rounded.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use pill-shaped input corners; search behavior is unchanged.
- **Breaking Changes:** None.
- **Verification:** Inspected the search-only radius change; diff check passes.

## 2026-10-07 | Version: destination-list-hint-removal-v1

- **Summary:** Remove Select one to continue from the destination list heading.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep Available locations and the selectable cards; remove the extra instruction.
- **Breaking Changes:** None.
- **Verification:** Inspected the text removal and retained selection actions; diff check passes.

## 2026-10-07 | Version: destination-search-label-removal-v1

- **Summary:** Remove the redundant Find a location label above the destination search field.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** The search field retains its placeholder and accessibility label; Enter/Search submission is unchanged.
- **Breaking Changes:** None.
- **Verification:** Inspected the targeted label removal and retained accessible input; diff check passes.

## 2026-10-07 | Version: destination-keyboard-search-v1

- **Summary:** Remove the separate Search locations button from the final-destination picker.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Submit using keyboard Enter/Search, retaining the three-character minimum. Add a short input hint; keep clear, loading and retry actions.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused picker lint and diff checks pass; dashboard plan and Figma handoff aligned.

## 2026-10-07 | Version: mobile-planned-map-only-v1

- **Summary:** Temporarily hide the mobile dashboard Planned / Recorded map buttons.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep the mobile map on Planned while `SHOW_MAP_MODE_SWITCH` is false. Preserve the buttons, mode state and all Recorded GPS rendering/fetching/refresh/paging code for later re-enabling. Move the unavailable-truck notice up to use the freed space. GPS recording and admin maps are unchanged. Dashboard plan v1.59 and Figma switch/handoff aligned.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript passes. Focused RunMap lint reports the existing `react-hooks/purity` error for `Date.now()` in the retained Recorded status rendering; no new lint errors. Native visual verification remains pending.

## 2026-10-07 | Version: final-destination-picker-design-v1

- **Summary:** Improve the Expo final-destination picker’s search, location list and selection preview.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use compact location cards with pin icons and separate name/address text, a keyboard-aware search field with clear/search actions, a highlighted selected destination and prominent save button. Add themed loading, empty and retry states. Keep existing authorized location search and explicit save behavior.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused picker lint pass. iOS simulator list and selected-destination layouts reviewed; selection/return verified without saving a destination. Dashboard plan and Figma handoff aligned. Android, dark-theme and physical keyboard checks pending.

## 2026-10-07 | Version: dashboard-secondary-actions-removal-v1

- **Summary:** Remove the secondary Upload delivery note and Contact dispatch dashboard rows.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Retain the no-run primary upload action and required-delivery-note notice. Drivers can contact dispatch through Messages. Remove unused contact handler and row styles.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript passes. Dashboard lint reports the same two existing effect-state errors at lines 62/92, with no new errors. Diff checks pass; dashboard plan and affected Figma scenarios/handoff updated.

## 2026-10-07 | Version: driver-timeline-filter-placement-v1

- **Summary:** Move Filter timeline beside the timeline-entry count on the Expo current-run card.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Actions stays beside Current run. Filter choices and timeline counts are unchanged; the count/filter row wraps on narrow screens.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript passes. Dashboard lint reports two pre-existing set-state-in-effect errors at lines 62/92; no new errors from this layout change. Dashboard plan and Figma handoff updated.

## 2026-10-07 | Version: driver-actions-button-style-v1

- **Summary:** Soften the dashboard Actions button with rounded corners and a neutral border.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use 10-point corners and a 1-point `#dedee1` border matching dashboard separators.
- **Breaking Changes:** None.
- **Verification:** iOS simulator appearance verified; Figma header aligned. Focused dashboard lint reports two existing `react-hooks/set-state-in-effect` errors at lines 62 and 92, outside this style change. Android visual verification pending.

## 2026-10-07 | Version: driver-message-unread-badge-v1

- **Summary:** Show received unread messages on the Expo Messages tab.
- **API Changes:** Add authenticated driver-only `GET /api/v1/conversations/driver/unread`, returning `unread_count` without creating a conversation.
- **Database Changes:** None.
- **Behavior Changes:** Show a red count badge (99+ above 99), hide it at zero, refresh every ten seconds while foregrounded and on navigation/foreground, and refresh immediately after read acknowledgement. Reset state between sessions; exclude outgoing, deleted and other drivers' messages.
- **Breaking Changes:** None.
- **Verification:** 9 conversation tests pass (132 assertions), including unread count/read clearing, tenant isolation, outgoing/deleted exclusions and driver-only access. Mobile TypeScript and focused navigation/chat/provider lint pass; PHP formatting and diff checks pass. Figma navigation guide updated. Physical-device notification checks remain pending.

## 2026-10-07 | Version: driver-messaging-v1

- **Summary:** Add driver/dispatch messaging and a website conversation inbox; move assigned vehicles into Expo Account.
- **API Changes:** Add authenticated `/api/v1/conversations` list/create/detail/update, driver get-or-create, participants, members, messages, read and private attachment-download endpoints. Existing feedback remains separate. Stable `temporary_id` deduplicates retries; sends are limited to 30/minute.
- **Database Changes:** Add conversations, conversation_members, messages and message_attachments with UUIDs, soft deletes, account/merchant scope, driver-chat/message retry uniqueness and private storage metadata. Use `merchant_id` throughout. Deduplicate legacy push tokens and add nullable token uniqueness. New migrations applied to local MAMP only.
- **Behavior Changes:** Messages replaces Vehicles as the third mobile tab. Account → Vehicles assigned to me opens the assigned fleet. Driver chat permits the specific driver and merchant account holders/members/modifiers or super admins. Normal conversations require explicit active members. Text/private attachments, owner membership controls, closed chats, ten-second foreground polling, failed-draft retry and queued generic driver notifications are implemented. Register SDK-compatible Expo tokens, authorize notification taps, suppress active-chat banners, invalidate bad tokens and clear tokens on logout. Add optional Android `GOOGLE_SERVICES_JSON` build configuration. Figma/dashboard handoff updated to revision 1.53.
- **Breaking Changes:** Mobile vehicle-list route moves from `/(tabs)/vehicles` to `/account/vehicles`; vehicle details and existing vehicle APIs remain unchanged. Notifications require rebuilt development clients plus FCM/APNs credentials. The token migration clears stale duplicate tokens; clients register again.
- **Verification:** 48 focused conversation/auth/device/run-action/shipment tests pass (376 assertions); mobile/website TypeScript and focused lint pass. Tested tenant/member isolation, closed/deleted chats, pagination/read tracking, retry deduplication, attachment validation/private downloads/upload cleanup, migration rollback/uniqueness, post-commit/rollback push behavior, recipient payloads, invalid receipts and token ownership/logout. Two overlapping local MySQL opens return one driver chat, including nested REPEATABLE READ transactions. Local simulator saves a test message; navigation/layout checks and Figma screenshots reviewed. Credentials, signed device builds/live push, authenticated website visual review and production-engine concurrency remain pending. Full-repository SQLite rollback has a pre-existing unrelated geofence-index error; messaging migrations are verified independently. See [messaging rollout](messaging.md).


## 2026-10-07 | Version: driver-run-actions-v1

- **Summary:** Add active-run Actions beside All stops with dispatch-reviewed End Run requests, planned endpoint editing and Manual ZAR additional costs.
- **API Changes:** Add driver end-request, endpoint PATCH and cost POST routes plus authorised CRM end-request review. Dashboard/run resources expose latest request status/reason/actors; driver current run includes planned origin UUID. Endpoint saves compare original UUIDs; costs use a persisted client retry UUID. Existing ordinary completion requirements are retained.
- **Database Changes:** Add `run_end_requests` with request/reviewer state, reason, timestamps and run index; add nullable unique `run_costs.client_request_id`. Migration applied to the local development MySQL database; test schema passes SQLite migrations. Production migration is pending.
- **Behavior Changes:** End Run keeps the run active pending dispatch approval. CRM list badges/detail review support confirmation of empty/unfinished closure or rejection with reason. Approval preserves shipment statuses, bookings, assignments and visits. Other supported closures resolve outstanding requests. Edit changes planned endpoints atomically with conflict/expiry handling. Description becomes CRM title; costs are positive exact ZAR Manual entries with retry deduplication. Dashboard refreshes on focus/foreground and after saves. Figma active header, component-based flow and guide synchronized.
- **Breaking Changes:** None; new routes/resources are additive. Native development clients need rebuilding for the newly added Expo crypto dependency.
- **Verification:** 90 targeted Laravel tests / 1,050 assertions pass across driver actions/dashboard, run API, costs and automatic lifecycle; refreshed driver-action coverage passes 7 tests / 57 assertions, including self-approval denial. Mobile and website TypeScript passed for the Actions implementation; focused new-form/CRM lint passes. A later full mobile check is blocked by concurrent messaging work (missing expo-device/expo-notifications dependencies and ungenerated messages/vehicles route types); no Actions-file errors were reported. iOS simulator verifies Actions placement/options, Edit Run saved-location picker/selected address, End Run reason gating, Manual ZAR fields, blank-cost validation and Cancel without saving. Figma structural validation confirms reusable instances, SF Pro and no raster UI; flow composition reviewed. Android native interaction, authenticated CRM visual review (local preview redirects to sign-in), production row-lock concurrency and live approval foreground refresh remain pending. `git diff --check` passes.

Use this document to track every shipped backend/frontend change.
Add new entries at the top (newest first).

## Update Rules

1. Create a new release section for every merged feature/fix batch.
2. Always include:
   - `Date` (YYYY-MM-DD)
   - `Version` (or sprint tag)
   - `Summary`
   - `API Changes`
   - `Database Changes`
   - `Behavior Changes`
   - `Breaking Changes` (or `None`)
   - `Verification`
3. Keep entries concise and production-focused.
4. Link important files/endpoints changed.

---

## 2026-10-07 | Version: mobile-position-connection-recovery-v1

- **Summary:** Restore the simulator's local API connection and prevent recoverable truck-position polling failures from opening Expo's red error overlay.
- **API Changes:** None; restart the local Laravel development server on port 8001.
- **Database Changes:** None.
- **Behavior Changes:** Keep the existing unavailable state, last confirmed position and automatic 30-second/foreground retries. Log one informational diagnostic per failed polling episode instead of repeated `console.error` calls; reset the diagnostic guard after a successful response.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript passes. The configured API address responds (401 for an unauthenticated position request), and simulator dashboard retry restores the current run, shipment counts and timeline. Focused RunMap lint passes with its existing `react-hooks/purity` violation disabled; normal lint still flags the pre-existing render-time `Date.now()` expression. A controlled outage/recovery cycle and physical-device network switching remain unverified.

## 2026-10-07 | Version: mobile-eas-development-environment-v1

- **Summary:** Fix the missing Maps-key environment configuration and retry the Android development build.
- **API Changes:** No endpoint changes; configure the existing development API URL in EAS.
- **Database Changes:** None.
- **Behavior Changes:** With explicit user approval, add `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` as Sensitive project variables, and `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_APP_ENV` as Plaintext variables, in the EAS development environment. Retry Android `development` using the existing remote keystore. Keep actual Maps keys out of source control and log output; update setup/implementation status.
- **Breaking Changes:** None.
- **Verification:** Confirmed the previous Android build used the development profile/environment and failed because no variables were configured. EAS listing confirms all four variables and expected visibility; build submission loaded them, uploaded the app-only archive and completed fingerprinting. [Android retry](https://expo.dev/accounts/leroyg/projects/spaces-digital/builds/1fb1ff0a-dd1d-4929-98d8-1f1d3ae3c433) submitted; build completion, installation and Google rendering remain pending. Documentation diff checks pass.

## 2026-10-07 | Version: mobile-floating-action-sheet-v1

- **Summary:** Restore the requested floating bottom action sheet for dashboard and shared action options.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replace the native-modal workaround with Gorhom's dynamically sized detached bottom sheet. Use outlined rounded actions, selected indicators and optional handle/close controls; retain Cancel, swipe/backdrop dismissal and callbacks after dismissal. Present after options commit. Fix Gorhom's container/background/backdrop layout on React Native 0.86 with a dependency-scoped Babel rewrite from removed `StyleSheet.absoluteFillObject` to `StyleSheet.absoluteFill`; preserve the iOS full-window overlay and app NativeWind styling. No installed dependency files are edited.
- **Breaking Changes:** None. Restart Metro with `--clear` after pulling the Babel change.
- **Verification:** TypeScript, focused ESLint and scoped source/module Babel transform checks pass. iOS Expo Go simulator verifies visible floating card/dimmed backdrop, reopening/selection, Speeding events (2 entries), Shipment deliveries (3 entries) and Cancel preserving the filter. Android/web, long menus and document-source picker handoff remain unverified. Dashboard plan 1.51 retains the existing Figma bottom-sheet flow.

## 2026-10-07 | Version: mobile-eas-development-client-v1

- **Summary:** Configure Spaces Digital for native Expo development clients and EAS Build.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Install Expo SDK 57-compatible `expo-dev-client` 57.0.19 and register its launcher plugin. Link `@leroyg/spaces-digital` to EAS project `497d04a7-b1e5-48b9-a4fa-84c67c26f325`. Add development APK/device, unsigned iOS simulator, preview and production profiles. Default npm start to the development client, retain an explicit Expo Go command and add build scripts. Preserve both `com.spaces.logistics` identifiers and current platform-specific Maps plugin options; fail remote builds when their platform key is missing. Limit EAS archives to mobile app sources and exclude environment/native/generated files, backend and website. Document profiles, environment variables, signing and rebuild steps.
- **Breaking Changes:** `npm start` now targets a custom development client; install its build first or use `npm run start:go` for Expo Go.
- **Verification:** Dependency installation, Expo account/project linkage, TypeScript, config ESLint and resolved dev-client/name/identifier configuration pass. EAS profile schema/inheritance and missing-key validation pass. Generated and inspected the local EAS archive: mobile sources/config/assets are present; backend, website, logs, dependencies and `.env.local` are excluded. Cloud environment upload was rejected by automatic approval review pending explicit user approval for sending existing Maps keys and API URL to Expo EAS. No cloud build was submitted and native Google map verification remains pending.

## 2026-10-07 | Version: mobile-action-sheet-visible-v1

- **Summary:** Restore the dashboard All stops filter menu and shared action-menu presentation.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Present ActionSheet in a native transparent modal with a bottom-aligned, safe-area-aware card instead of the invisible animated portal. Keep All stops, Speeding events, Shipment deliveries, current-selection indicators, disabled/destructive actions, Cancel/close/backdrop dismissal and scrollable long menus. Run selected callbacks after dismissal; iOS waits for native onDismiss, while Android/web finish after the hidden modal commits. Shared document-source and map action menus use the same component.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused ActionSheet ESLint and diff checks pass. iOS simulator verifies visible options, reopening/current selection, Speeding events (2 entries), Shipment deliveries (3 entries), cancellation without changing the filter and returning to All stops. Android/web, long menus and document-source picker handoff remain unverified. Existing Figma filter design remains applicable.

## 2026-10-07 | Version: mobile-google-map-diagnostics-v1

- **Summary:** Diagnose the blank Google map and add focused development logging.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Emit `[RunMap]` logs for native provider/host registration, layout, ready/loaded events, truck coordinate availability, directions status and request failures. Warn after 15 seconds if native ready/loaded events are missing, explicitly identifying this as a diagnostic rather than an SDK error. Logs omit credentials, API keys, identifiers and GPS coordinates. Preserve Google as the provider and existing unavailable states; a temporary Apple Maps comparison was reverted. Update dashboard implementation notes without changing the design plan.
- **Breaking Changes:** None.
- **Verification:** TypeScript passes. Focused lint reports only the pre-existing `Date.now()` render-purity error; new diagnostic code passes with that existing rule disabled. Simulator logs confirm a 440 × 495.7 view, registered native Google component, valid truck coordinates and ready directions (967 points), but no Google ready/loaded events. Apple Maps rendered the same route/markers immediately in a controlled comparison. Expo configuration confirms both Maps keys are present without printing their values. No Google Maps authorization/SDK error was captured; Google initialization in Expo Go 57.0.9 remains unresolved and requires native-build verification. Diff checks pass.

## 2026-10-07 | Version: mobile-document-summaries-location-v1

- **Summary:** Move required and expired document summaries from the dashboard to Documents.
- **API Changes:** None; reuse the existing scoped dashboard document counts.
- **Database Changes:** None.
- **Behavior Changes:** Show both notices below the Documents header and above uploaded files, with singular/plural wording and zero/unknown hiding. Required notice opens Upload document; expired guidance directs drivers to the files below. Retain the required Documents tab badge. Share both counts with existing return/refresh/upload/foreground refresh, session reset and stale-response guards. Update dashboard plan 1.49 and matching Figma examples/guide.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript and focused Documents/provider ESLint pass. Dashboard lint reports only the pre-existing synchronous state-reset error. Diff checks pass; Figma Documents composition visually reviewed with SF Pro fonts. Native layout and upload-refresh verification remain pending.

## 2026-10-07 | Version: mobile-expiry-date-picker-v1

- **Summary:** Replace typed expiry dates with a shared date picker for driver-document and shipment-file uploads.
- **API Changes:** None; keep the `expires_at` YYYY-MM-DD payload and existing required-expiry validation.
- **Database Changes:** None.
- **Behavior Changes:** Tap the expiry field/calendar icon to open Android's native date dialog or expand an iOS calendar with Cancel/Done. Keep the previous date on cancellation and reopen at the selected date. Web uses the browser date input. Format calendar dates locally to avoid timezone day shifts; disable the field during upload. Install Expo SDK 57-compatible datetimepicker 9.1.0 and register its config plugin.
- **Breaking Changes:** None. Existing development/standalone binaries need rebuilding to include the new native module; Expo Go supplies it.
- **Verification:** Mobile TypeScript, focused DateInput/date-helper/Documents/config ESLint and diff checks pass. Valid/leap-year dates round-trip and malformed/impossible dates are rejected in Johannesburg, Los Angeles and Kiritimati timezones; plugin registration verified. Shipment screen retains existing memoization/state-effect lint errors. Native picker interaction, web visual appearance and new native builds remain unverified.

## 2026-10-07 | Version: mobile-spaces-digital-branding-v1

- **Summary:** Adopt the selected Figma logo 08 “Destination” and name the mobile app Spaces Digital.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Use the exact green Destination vector on login, its outlined Spaces Digital lockup on the splash and shared authentication loading screen, and matching iOS/general, Android adaptive/themed and web icons. Update the approved Figma login branding. Set the iOS bundle identifier and Android package to `com.spaces.logistics`; rename the Expo slug/npm package to `spaces-digital` and update photo/camera permission copy. Preserve the existing deep-link scheme.
- **Breaking Changes:** Native application identity changes to `com.spaces.logistics`; installed builds must be rebuilt, and builds with a different previous identifier are separate applications.
- **Verification:** Mobile TypeScript and focused login/root/loading-screen ESLint pass. Resolved Expo configuration confirms the display name, both platform identifiers and all branding assets. Reviewed the rasterized Figma lockup and verified the new login logo on the iOS simulator after reloading Expo Go. Icon dimensions and opaque iOS artwork verified; Android foreground/themed assets retain transparency. Native installation/icon/splash verification requires new iOS and Android builds; Expo Go cannot verify those native properties.

## 2026-10-07 | Version: mobile-document-upload-permission-v1

- **Summary:** Fix Documents and shipment attachment uploads failing with `FileSystemFile.bytes` missing read permission.
- **API Changes:** None; retain the existing multipart endpoints, fields and error handling.
- **Database Changes:** None.
- **Behavior Changes:** Send picked cached file URIs through native XMLHttpRequest multipart upload instead of reading Expo File bytes. Preserve original filename and MIME type, use an octet-stream fallback, and retain expiry/type metadata and authentication. Web uploads use a browser Blob. Surface connection, timeout and cancellation errors.
- **Breaking Changes:** None.
- **Verification:** Mocked transport regression checks pass for iOS/Android URI multipart, shipment files, metadata/authentication, automatic multipart boundary, API validation details, network/timeout/abort failures and web Blob uploads. Mobile TypeScript, focused API ESLint and diff checks pass. Live device file selection/upload remains unverified.

## 2026-10-07 | Version: mobile-required-document-badge-v1

- **Summary:** Show required-document reminders only for confirmed missing uploads and add a matching Documents tab badge.
- **API Changes:** None; reuse the existing driver-scoped dashboard document summary.
- **Database Changes:** None.
- **Behavior Changes:** Dashboard notice and red numeric Documents badge share a count; both hide at zero or before the count is known. Refresh on dashboard return/refresh, document-list refresh and successful upload, and app foreground. Session changes reset the count, superseded requests are ignored, and failures preserve confirmed requirements. Keep expired reminders separate. Update dashboard plan 1.48 and Figma examples/guide.
- **Breaking Changes:** None.
- **Verification:** Existing missing/uploaded/no-configured-document API regressions pass (2 tests, 10 assertions). Mobile TypeScript and focused tab-layout/Documents/provider ESLint pass; dashboard lint reports only its pre-existing synchronous state-reset error. Diff checks pass. Native badge and upload-refresh visual verification remains pending.

## 2026-10-07 | Version: mobile-login-scroll-actions-v1

- **Summary:** Move login actions into the scrolling content for keyboard layouts.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Place the Log in button and “Need access? Contact your dispatcher.” text inside the login ScrollView. Keep bottom placement when space permits using an automatic top margin; with the keyboard open, both scroll with the form instead of consuming fixed footer space. Retain keyboard avoidance and handled keyboard taps.
- **Breaking Changes:** None.
- **Verification:** Mobile TypeScript, focused login ESLint and git diff checks pass. Confirmed both actions are inside the ScrollView. Device keyboard interaction not rechecked in this task.

## 2026-10-07 | Version: mobile-login-road-alignment-v1

- **Summary:** Align the On the move login illustration route and current-location marker with its roads.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Follow the existing white road centre lines, turn at their calculated intersections and centre the blue location dot and halo on the route's upper intersection. Retain the dashed blue route, palette and SVG dimensions; use rounded route joins. This updates the local decorative login SVG only.
- **Breaking Changes:** None.
- **Verification:** SVG XML parses; every route segment aligns with a road centre line within 0.002 SVG units and the marker shares an intersection coordinate. Rendered and visually reviewed the SVG against the login background; diff checks pass. Native device appearance not rechecked for this asset adjustment.

## 2026-10-07 | Version: mobile-nativewind-safe-area-v1

- **Summary:** Remove NativeWind's startup access to React Native's deprecated SafeAreaView export.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Apply a targeted Babel transform to react-native-css-interop 0.2.1's compiled component registry, removing only its core SafeAreaView registration. Preserve all other component registrations, including react-native-safe-area-context; login already uses the supported component. Restart Metro with `npx expo start --clear` to apply the Babel change.
- **Breaking Changes:** None.
- **Verification:** Execute the installed dependency after transforming it with the app's Babel configuration: a guarded React Native export confirms no deprecated SafeAreaView access and all 17 supported registrations remain. Confirm unrelated files are unchanged. TypeScript, focused Babel/plugin lint and diff checks pass. Live device warning disappearance remains unverified.

## 2026-10-07 | Version: mobile-login-on-the-move-v1

- **Summary:** Implement selected Figma login concept 03, “On the move”.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Add the exact local Figma map and blue brand SVGs, “Ready for your next move?” heading, labelled blank rounded inputs, blue login button and dispatcher-access guidance. Extend the map behind the status bar with dark status icons and inset the brand chip below the notch. Retain authentication, errors, password visibility, safe-area-context and Android/iOS keyboard avoidance. Keep the login button in a fixed footer while the form scrolls.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused login lint and diff checks pass. iOS simulator visually verifies both SVGs, the map behind the status bar, form layout, blank inputs, visible button with the software keyboard and password-toggle state. Android and dark-theme appearance not visually verified; authentication request handling retained.

## 2026-10-07 | Version: mobile-native-maps-key-plugin-v1

- **Summary:** Pass native Google Maps keys through the current react-native-maps config plugin.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Native builds read GOOGLE_MAPS_ANDROID_API_KEY and GOOGLE_MAPS_IOS_API_KEY into the plugin's androidGoogleMapsApiKey and iosGoogleMapsApiKey options instead of legacy config fields. Keys stay in the build environment. Existing binaries must be rebuilt; Expo Go retains its own native Maps configuration.
- **Breaking Changes:** None.
- **Verification:** Expo configuration resolves both plugin key options from the local environment without printing key values. Missing-key behavior and preservation of existing config verified; focused config lint and diff checks pass. No native build or live tile verification performed.

## 2026-10-07 | Version: mobile-auth-stack-routes-v1

- **Summary:** Correct root stack authentication screen names to remove the post-login route warning.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Register `(auth)/login` and `(auth)/register` as the root stack's actual child routes. The auth folder has no nested layout, so `(auth)` alone is not a registered screen. Existing authentication redirects and hidden headers are retained.
- **Breaking Changes:** None.
- **Verification:** Focused root-layout lint, TypeScript and diff checks pass. Route declarations match the registered children reported by Expo. Connected Android app reloaded and bundle rebuilt; repeat post-login warning verification remains pending.

## 2026-10-07 | Version: mobile-login-password-visibility-v1

- **Summary:** Add a password visibility toggle to the Expo login field.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Passwords start hidden. Tap the eye on the right of the password input to reveal the value, then tap the crossed-out eye to hide it. Reserve space for the icon and provide accessible Show password/Hide password labels with theme-aware colour.
- **Breaking Changes:** None.
- **Verification:** Focused login lint, TypeScript and diff checks pass. Source inspection confirms hidden-by-default masking, both toggle states and icon spacing. Live device toggle interaction remains unverified (simulator is signed in).

## 2026-10-07 | Version: mobile-login-android-keyboard-v1

- **Summary:** Keep the login submit button above the Android keyboard.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Enable height avoidance on Android and account for the top safe-area inset. Keep the Log in button in a fixed footer within keyboard avoidance, with the form scrolling independently when keyboard space is limited. Retain padding avoidance on iOS.
- **Breaking Changes:** None.
- **Verification:** Focused login lint, TypeScript and diff checks pass. Source inspection confirms Android height avoidance and a non-shrinking footer outside the form scroll view. Android SDK/emulator unavailable locally; live Android keyboard and iOS regression appearance remain unverified.

## 2026-10-07 | Version: mobile-input-radius-half-v1

- **Summary:** Halve Expo text input corner radii, including the login email and password fields.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Login radius changes from 22 to 11 points; profile, document, shipment, scanning, delivery notes and import-review input radii are halved from their existing values.
- **Breaking Changes:** None.
- **Verification:** TypeScript and diff checks pass. Login, profile, delivery-notes and import-field lint pass; seven lint errors in documents/shipment/scan screens also reproduce against HEAD. Live device appearance not visually verified.

## 2026-10-07 | Version: mobile-login-native-layout-v1

- **Summary:** Restore login text, input sizing and button placement inside the safe-area layout.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep `SafeAreaView` from `react-native-safe-area-context`; use explicit native styles for login layout and theme colours. Add scrollable content within keyboard avoidance so the form and submit button remain reachable. Preserve blank inputs and add accessible input labels.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused login lint and diff checks pass. Signed-out iOS simulator visually verifies heading, labels, full-sized blank inputs and bottom login button; software-keyboard verification confirms the button remains above the keyboard. Dark theme and Android appearance not visually verified.

## 2026-10-07 | Version: mobile-login-no-placeholders-v1

- **Summary:** Remove placeholder text from the login inputs.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Empty email and password inputs display no placeholder; their visible labels remain.
- **Breaking Changes:** None.
- **Verification:** Focused login lint and diff checks pass; source inspection confirms both placeholder props are removed.

## 2026-10-07 | Version: local-laravel-migrations-v1

- **Summary:** Apply pending migrations to restore the local driver dashboard.
- **API Changes:** None.
- **Database Changes:** Apply existing vehicle-location-history, geofence-cleanup-tables and geofence-cleanup-lookup-index migrations to the configured local database.
- **Behavior Changes:** Dashboard queries can use the previously missing `vehicle_activity.geofence_cleanup_batch_uuid` column.
- **Breaking Changes:** None.
- **Verification:** All three migrations completed; no pending migrations remain. Schema check confirms the column exists. Simulator dashboard retry loads the current run and five-required-documents notice successfully. Live no-run acceptance still requires a driver without an active run.

## 2026-10-07 | Version: mobile-logbox-contrast-v1

- **Summary:** Restore readable developer error popup text in the Expo app.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Keep React Native internals on React's JSX runtime so NativeWind does not strip LogBox's callback-based background styles. Application JSX retains NativeWind styling. Error messages, inspection and dismissal remain enabled.
- **Breaking Changes:** None.
- **Verification:** iOS simulator displays white error text on a dark popup after a clean Expo restart. Babel checks confirm the separate JSX runtimes and filename-free Metro config loading; TypeScript and Babel-config lint pass. The dashboard API still returns its existing HTTP 500 for missing `vehicle_activity.geofence_cleanup_batch_uuid`.

## 2026-10-07 | Version: mobile-login-safe-area-v1

- **Summary:** Respect device safe areas on the mobile login page.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Wrap login and hydration layouts in `react-native-safe-area-context` SafeAreaView, replacing fixed top clearance with safe-area insets plus normal content spacing. Retain keyboard avoidance.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused login lint and diff checks pass; live signed-out simulator appearance not verified.

## 2026-10-07 | Version: mobile-local-api-network-v1

- **Summary:** Point the local Expo app at Laravel on the Mac's current network address.
- **API Changes:** None; local base URL is `http://192.168.10.151:8001/api/v1` in ignored `mobile_app/.env.local`.
- **Database Changes:** None.
- **Behavior Changes:** Local mobile requests use the reachable development server instead of `172.20.10.4:8001`.
- **Breaking Changes:** None; local configuration only.
- **Verification:** Laravel listens on port 8001 and returns HTTP 401 for an unauthenticated driver-position request. Expo restarted with its bundle cache cleared. Simulator confirms requests reach the new URL; dashboard returns HTTP 500 because the local database lacks `vehicle_activity.geofence_cleanup_batch_uuid`.

## 2026-10-07 | Version: driver-no-run-dashboard-v1

- **Summary:** Implement the existing no-current-run dashboard with its truck map, persistent sheet and primary delivery-note upload action.
- **API Changes:** Add authenticated, throttled `GET /api/v1/driver/position`, returning the assigned truck's ID, plate, validated coordinate and observation time without requiring a run. Existing run-position contract retained.
- **Database Changes:** None; use existing truck login, assignment and GPS fields.
- **Behavior Changes:** Show only the truck on the no-run map; keep no-run guidance, document reminders, dispatch contact and all five tabs. Use native persistent-panel layout with a draggable/tappable 25/50/92% handle to prevent an invisible initial sheet; retain scrolling and pull-to-refresh. Poll truck position only while focused and foregrounded. Align the existing Figma no-run screen and dashboard plan.
- **Breaking Changes:** None.
- **Verification:** 30 driver API tests pass (191 assertions), including no-run GPS, missing/invalid coordinates, assignment/merchant isolation and inactive profiles. TypeScript and persistent-sheet/API-client lint pass. Focused dashboard/map lint reports three existing React Compiler errors in unchanged lines. Simulator verifies visible initial loading/error sheet, five tabs, 25/50/92% resizing and handle drag. Initial live verification was blocked by the old API address. After updating the local URL, the dashboard responds with HTTP 500 for the missing `vehicle_activity.geofence_cleanup_batch_uuid` column; live no-run GPS/notification/upload acceptance remains pending. Existing Figma screen visually verified.

## 2026-10-04 | Version: crm-feedback-bottom-center-v1

- **Summary:** Move the CRM Give feedback button to the bottom center of the page.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Center the fixed feedback button horizontally on all screen sizes, keeping the existing bottom spacing.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff checks passed; live browser appearance not verified.

## 2026-10-02 | Version: mobile-light-default-v1

- **Summary:** Start the mobile app in light mode regardless of the device theme.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Set the native appearance default and initialise NativeWind to light before rendering. Keep the existing manual theme toggle; a fresh app launch defaults to light.
- **Breaking Changes:** None. Native appearance configuration takes effect in rebuilt clients.
- **Verification:** TypeScript and focused root-layout lint checked locally; physical-device appearance not verified.

## 2026-10-02 | Version: mobile-expo-57-v1

- **Summary:** Upgrade the driver app from Expo SDK 54 to SDK 57 (57.0.26), React Native 0.86.3 and React 19.2.3.
- **API Changes:** Server contracts unchanged. Multipart fetch uploads now use Expo File blobs instead of unsupported URI objects.
- **Database Changes:** None.
- **Behavior Changes:** Align native modules and development tools, register required config plugins, remove obsolete config flags, and migrate navigation imports to Expo Router's shared contexts. Correct map POI prop and provide Material icon mappings for all tabs.
- **Breaking Changes:** Requires SDK 57-compatible Expo Go or rebuilt native clients. iOS minimum is 16.4; local native iOS builds require Xcode 26.4 or newer. Existing SDK 54 binaries cannot use this JavaScript update.
- **Verification:** Expo Doctor passed 21/21 checks; TypeScript and focused migration lint passed. Android and iOS bundles passed; web export generated all 24 static routes. Full lint exposes 16 existing-code React Compiler errors under the newer rules; native/device interaction and upload smoke tests remain unverified. npm reports 31 dependency advisories; no forced unrelated dependency upgrades applied.

## 2026-09-23 | Version: run-header-location-names-v1

- **Summary:** Include origin and destination location names alongside addresses in the run detail header.
- **API Changes:** None; use existing location fields.
- **Database Changes:** None.
- **Behavior Changes:** Display name (or company fallback) followed by address for each endpoint; retain unknown-location fallbacks.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and TypeScript checks passed; live visual verification not performed.

## 2026-09-23 | Version: run-map-coincident-pins-v1

- **Summary:** Show one pin per exact GPS coordinate instead of stacked unreadable event markers.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Preserve all recorded events in popup details and replay. Select a visible representative after marker filtering, preferring latest-stop car, speeding and stop events over GPS-only observations. Pin counts use distinct coordinates; nearby coordinates remain separate.
- **Breaking Changes:** None.
- **Verification:** Nine marker tests passed, including duplicate coordinates, filters, nearby positions and replay/latest-stop selection. Focused ESLint, TypeScript and diff checks passed. Live visual verification pending.

## 2026-09-22 | Version: independent-geofence-visits-v1

- **Summary:** Trigger configured automation for every containing geofence, including nested and overlapping locations.
- **API Changes:** No response-shape changes. Admin simulator prefers the requested location when it has an open visit, instead of an arbitrary concurrent visit.
- **Database Changes:** None.
- **Behavior Changes:** Maintain independent visits per polygon, execute entry once per new visit and exit only polygons the truck leaves. Preserve vehicle locking, per-run/location shipment reuse, merchant settings and driver-run safeguards. Simultaneous entries use existing type priority, then centre distance and ID; exits run before entries. Raw motion/speeding is processed once per sample. Existing open visits reconcile on the next update; history is not replayed.
- **Breaking Changes:** Multiple containing locations can now execute automation on the same update; the former single-location winner behavior is replaced. Each location's configured actions still affect shared run state in execution order.
- **Verification:** 91 lifecycle, tracking, simulator, cleanup and run API tests passed (970 assertions), including three nested polygons, independent exit/re-entry, repeat-sample duplicate prevention and collection-before-delivery ordering. PHP syntax and diff checks passed. Live production verification remains pending.

## 2026-09-22 | Version: vehicle-activities-run-link-v1

- **Summary:** Link the vehicle activities Run ID column to the corresponding run details page.
- **API Changes:** None; use the existing run UUID.
- **Database Changes:** None.
- **Behavior Changes:** Run IDs open run details instead of activity details. Activities without a run have no run link.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and TypeScript checks; live browser verification not performed.

## 2026-09-22 | Version: geofence-cleanup-audit-performance-v1

- **Summary:** Reduce repeated trip processing in geofence cleanup audits and print progress counts.
- **API Changes:** None. CLI audit prints its batch UUID at startup and processed counts after the first shipment, every 25 shipments and at completion.
- **Database Changes:** Add four composite lookup indexes for automatic shipment selection, shipment creation events, run activities and entity logs. Deploy the new migration to enable the database improvements; allow for index-build time on large production tables.
- **Behavior Changes:** Audit reuses derived run/location/polygon evidence in a bounded cache (eight entries, each at most 1 MiB serialized). Shipment checks remain individual; cache clears between audits and after failure. Apply/restore always reread evidence under locks and reject stale fingerprints. No eligibility-rule or historical-data changes.
- **Breaking Changes:** None.
- **Verification:** 69 cleanup/lifecycle/run API tests passed (860 assertions). Ten shipments sharing a run/location use one GPS-history query instead of ten, with evidence matching uncached inspection. Tests cover late GPS rejection, cache reset and index rollback/reapply. PHP formatting and diff checks passed. Production query plans, index build time and CPU improvement remain unverified; no production cleanup run.

## 2026-09-22 | Version: geofence-cleanup-all-candidates-v1

- **Summary:** Add `--all-candidates` to apply every eligible candidate in a reviewed geofence cleanup audit.
- **API Changes:** None. CLI apply accepts either `--all-candidates` or repeated `--shipment` options.
- **Database Changes:** None.
- **Behavior Changes:** Select only cleanup candidates from the specified completed audit, read in chunks of 100 and retain transaction locks, eligibility checks and fingerprint revalidation for each shipment. Reject conflicting flags, use in other modes and audits without candidates. Protected and insufficient-evidence records remain excluded; stale candidates are skipped.
- **Breaking Changes:** None. Explicit shipment selection remains supported; selection is still required.
- **Verification:** All 23 cleanup tests passed (115 assertions), including bulk selection, stale records, merchant isolation, restoration and invalid options. PHP formatting and diff checks passed. No production cleanup executed.

## 2026-09-22 | Version: geofence-shipment-cleanup-command-v1

- **Summary:** Add `shipments:cleanup-geofence audit|apply|restore` for reviewed cleanup of false automatic geofence shipments.
- **API Changes:** Response shapes unchanged. Normal vehicle activity queries omit cleanup-invalidated shipment markers; physical visits remain visible.
- **Database Changes:** Add durable `geofence_cleanup_batches` / `geofence_cleanup_items` ledgers and nullable indexed `vehicle_activity.geofence_cleanup_batch_uuid`. Apply this migration before deploying code that queries activity records. Migration rollback is refused while applied cleanup items remain unrestored.
- **Behavior Changes:** Audit requires merchant/time scope, uses original creation events and current polygons, and retains later genuine-entry shipments. Incomplete GPS and protected operational/billing/manual records cannot be applied. Apply requires explicit reviewed shipment UUIDs, revalidates fingerprints under locks, soft-deletes shipments/internal bookings, removes run assignments and hides automatic shipment markers atomically per shipment. Restore verifies ownership and refuses intervening edits. Lifecycle cannot silently resurrect cleanup-deleted shipments. No raw GPS, physical visit, run lifecycle or odometer rewriting, carrier calls or notifications.
- **Breaking Changes:** No cleanup runs automatically. Database migration is required before this code is activated.
- **Verification:** 100 cleanup/lifecycle/simulator/tracking/run/report/activity tests passed (1,276 assertions). Includes command exports, rollback, repeat execution, JSON storage ordering, protection cases, restoration conflicts and API visibility. PHP syntax and diff whitespace checks passed. Production execution, spatial-engine locking and live UI review remain pending.
- **Usage:** See [audit, apply and restore instructions](geofence-shipment-cleanup.md), including conservative coverage limits and private report locations.

## 2026-09-22 | Version: polygon-only-geofence-detection-v1

- **Summary:** Require the truck to be strictly inside a valid drawn geofence for automatic location detection; remove radius circles from run maps.
- **API Changes:** Response shapes unchanged. Admin simulated arrival now rejects missing/invalid polygons and uses a verified interior point when the centre is outside or absent.
- **Database Changes:** None. Existing radius metadata remains stored but is ignored; historical visits/shipments are not rewritten.
- **Behavior Changes:** Fix WKT longitude/latitude ordering and support SQLite polygon fixtures. Polygon edges, vertices and outside points do not match. Retain visits only while inside their polygon, including overlaps. Existing open visits follow the normal exit workflow on the next non-matching sample. Raw GPS/motion/speeding capture continues outside fences. Maps retain polygon colours, toggling and nested-name tooltips.
- **Breaking Changes:** Locations with only centre/radius data no longer trigger automatic location visits or associated entry actions; a valid drawn polygon is required.
- **Verification:** 50 geometry/lifecycle/simulator/tracking tests passed (302 assertions), plus three geofence-loader tests, focused ESLint, TypeScript and diff whitespace checks. Two additional RouteServiceTest checks fail in unchanged fixtures because users.uuid is missing. Production spatial-engine and live map visual checks remain pending.

## 2026-09-22 | Version: run-replay-progressive-route-v1

- **Summary:** Draw the blue run route progressively as the timeline knob moves.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Replay shows recorded GPS history up to the selected time, growing forward and retracting backward with an interpolated endpoint. Future segments stay hidden and GPS gaps remain disconnected. Latest view and clearing the time range restore the full route. Existing polylines update without resetting the viewport or markers.
- **Breaking Changes:** None.
- **Verification:** Eleven replay/time-range tests, focused ESLint, website TypeScript and diff whitespace checks passed. Live visual verification pending.

## 2026-09-22 | Version: shipments-report-run-link-v1

- **Summary:** Add Run ID as the last column in the shipments report.
- **API Changes:** None; use the existing run UUID returned by the report endpoint.
- **Database Changes:** None.
- **Behavior Changes:** Each available Run ID links to its admin run detail page. Shipments without a run have no run link.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed. Live browser verification pending.

## 2026-09-22 | Version: run-geofences-default-on-v1

- **Summary:** Show geofences by default on admin run maps.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** The Geofences switch starts on and automatically loads stop-linked boundaries when the map is mounted. Users can still hide them; opening another run starts with geofences enabled.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed. Live browser verification pending.

## 2026-09-22 | Version: github-desktop-commit-draft-v1

- **Summary:** Maintain the commit draft directly in GitHub Desktop instead of a repository text file.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime.
- **Internal Changes:** Updated AGENTS.md to require editing and verifying GitHub Desktop's Commit summary and Commit description after changes. Removed COMMIT_MESSAGE.txt. Draft updates do not authorize committing, amending or pushing.
- **Breaking Changes:** None.
- **Verification:** Documentation reviewed and diff whitespace check passed. No runtime tests needed.

## 2026-09-22 | Version: run-shipment-location-names-v1

- **Summary:** Include location names in the run detail shipment Pickup and Drop-off columns.
- **API Changes:** None; use existing location fields.
- **Database Changes:** None.
- **Behavior Changes:** Show the location name (or company fallback) above the address. Preserve address-only display when unnamed and show a dash if neither is available.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed.

## 2026-09-22 | Version: run-map-manual-refresh-v1

- **Summary:** Replace automatic admin run-map refresh with a Refresh button beside Geofences.
- **API Changes:** None; reuse existing run-detail, track and location endpoints.
- **Database Changes:** None.
- **Behavior Changes:** Remove one-minute polling, tab-focus refresh and repeat loads on viewport re-entry. Initial history loads when first visible; Refresh updates GPS history, server-rendered run details and enabled geofences. Preserve existing map/replay/filter state, disable repeated clicks while history/details load, and offer Refresh when the map is empty. Mobile polling is unchanged.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript, focused ESLint, replay/geofence loader tests and diff whitespace checks passed. Live browser verification remains pending.

## 2026-09-22 | Version: commit-message-draft-policy-v1

- **Summary:** Require a ready-to-use commit title and body after every change.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** None at runtime.
- **Internal Changes:** AGENTS.md requires agents to refresh root COMMIT_MESSAGE.txt from the full pending diff, record accurate verification, and replace stale drafts without automatically committing or amending history.
- **Breaking Changes:** None.
- **Verification:** Reviewed the instructions and initial draft; diff whitespace check passed. No runtime tests needed for this documentation-only change.

## 2026-09-22 | Version: run-geofence-nested-hover-v1

- **Summary:** Show nested and overlapping geofence names even when another overlay captures the hover.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Tooltip hit-tests every displayed polygon/circle using Google geometry and lists each matching location once. A location's polygon and radius do not duplicate its name. Geometry loads only when geofences are enabled; load failures retain retry handling.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed. Live nested-geofence visual verification remains pending.

## 2026-09-22 | Version: run-map-follow-replay-car-v1

- **Summary:** Bring an off-screen replay car back into view while using the timeline.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** When a replay position falls outside the current map bounds, pan to the car while preserving zoom. Leave the map still when the car is already in view; do not pan when GPS position is unavailable.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed. Live drag verification remains pending.

## 2026-09-22 | Version: run-map-replay-badge-removal-v1

- **Summary:** Removed the replay-position badge from the run map.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** The map no longer overlays Replay position or Replay · Position unavailable. Timeline context and GPS-gap behavior remain available.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed.

## 2026-09-22 | Version: run-timeline-clear-filter-v1

- **Summary:** Add Clear filter beside Time range when a trip time range is applied.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Clear filter removes the selected range, restores the whole-trip timeline and latest view, then hides itself.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed.

## 2026-09-22 | Version: run-timeline-hint-removal-v1

- **Summary:** Removed “Drag through the trip” from the replay timeline.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** The replay footer no longer shows this instruction.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed.

## 2026-09-22 | Version: run-trip-time-range-v1

- **Summary:** Replace Back to latest with a Time range dialog in admin run replay.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Separate From/To date and time inputs restrict selection to the run start/end, with recorded-time fallback and latest recorded time for active runs. Apply narrows the slider, ticks, events and gap bands and selects the range start. Whole trip restores the full timeline/latest view. Dates use local time; invalid, reversed and outside-trip ranges cannot be applied. Run/auth changes reset selection; the complete map route remains visible for context.
- **Breaking Changes:** None.
- **Verification:** Nine range/replay tests passed, covering overnight ranges, exact limits, out-of-bounds, invalid and reversed times, interpolation and GPS gaps. Focused ESLint, website TypeScript and diff whitespace checks passed. Live browser verification pending.

## 2026-09-22 | Version: run-geofence-colours-v1

- **Summary:** Use different colours for run-map geofences.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Assign a 12-colour palette using the complete sorted run location-ID list, preserving colours through partial loads, retries and toggles. A location's polygon and radius share the same outline and translucent fill. Colours repeat after 12 locations.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed. Live visual verification remains pending.

## 2026-09-22 | Version: run-geofence-name-tooltip-v1

- **Summary:** Show geofence names when hovering over run-map geofences.
- **API Changes:** None; uses already loaded location data.
- **Database Changes:** None.
- **Behavior Changes:** Polygon and circle overlays show a plain-text name tooltip beside the pointer, falling back to company/code or Unnamed geofence. Tooltips do not intercept pointer events and disappear on exit, map dragging/zooming, toggle-off or cleanup.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed. Live browser verification remains pending.

## 2026-09-22 | Version: run-shipment-created-at-column-v1

- **Summary:** Add Created at immediately after Reference in the run detail Shipments table.
- **API Changes:** RunResource shipment entries now include the shipment's stored `created_at`, formatted with the merchant timezone.
- **Database Changes:** None.
- **Behavior Changes:** Show the shipment creation date/time using the page's existing date formatter, or a dash when unavailable. This uses the stored shipment timestamp, including any backdating applied by automation.
- **Breaking Changes:** None.
- **Verification:** Run API regression suite, focused ESLint, website TypeScript and diff whitespace checks passed.

## 2026-09-22 | Version: admin-run-map-label-contrast-v1

- **Summary:** Improve street-name contrast on the admin run map at close zoom.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Map labels now use darker slate text and an explicit thin white outline instead of relying on the default outline styling.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint, website TypeScript and diff whitespace checks passed. Live zoomed-map visual verification remains pending.

## 2026-09-22 | Version: admin-run-geofence-toggle-v1

- **Summary:** Added a top-left Geofences toggle to the shared admin run map, off by default.
- **API Changes:** None; uses existing `GET /api/v1/locations/{location_uuid}` only when enabled, for distinct locations linked to recorded run stops/activities.
- **Database Changes:** None.
- **Behavior Changes:** Show current saved polygons and lifecycle radius boundaries in purple without changing the viewport, markers or replay. Limit concurrent requests to four, cache successful results within the run/auth context, expose loading/error/retry and remove overlays on toggle-off. Ignore late responses and stop queued loads. On narrow screens the marker filter moves below the geofence toggle.
- **Breaking Changes:** None.
- **Verification:** Three loader regression tests passed (deduplication/cache, partial failure/retry, cancellation/concurrency). Focused ESLint, website TypeScript and diff whitespace checks passed. Live authenticated browser verification and deployment are pending.

## 2026-09-21 | Version: admin-runs-list-summary-v1

- **Summary:** Reduce Runs table loading work by requesting only the row summary instead of complete run details.
- **API Changes:** Opt-in `GET /api/v1/runs?summary=true` returns run ID/status, start dates, duration/distance, additional-cost totals, shipment count, origin/destination labels, driver name and vehicle plate/reference with the existing pagination metadata. Default list and detail responses remain unchanged.
- **Database Changes:** None.
- **Behavior Changes:** Admin Runs uses the summary response. It avoids activity-detail relationships, route stops, parcels, bookings and delivery-note imports; runs with odometer distance skip activity coordinates too. GPS fallback, endpoint fallback, timestamps, authorization, filters and sorting retain existing semantics.
- **Breaking Changes:** None; reduced fields are opt-in only. Deploy API support before or alongside the frontend for the performance benefit.
- **Verification:** All 17 Run API tests passed (533 assertions), including both summary distance sources, row-value parity, omitted detail relationships, payload below half the full fixture size and both response modes across every sort column/direction/page with merchant isolation. Website TypeScript and focused ESLint passed. Production latency has not been measured; changes are local.

## 2026-09-21 | Version: sign-in-email-placeholder-removal-v1

- **Summary:** Removed the example email placeholder from the sign-in form.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Empty sign-in email fields show no placeholder; the Email label and autocomplete remain available.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed.

## 2026-09-21 | Version: admin-submenu-visibility-v1

- **Summary:** Keep admin sidebar submenus visible when any of their child routes is active.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** All sidebar groups use parent-or-child route matching for submenu visibility, including nested detail routes. Shipments stays expanded on Runs, Tracking, 3D Monitor and Invoiced; the same rule covers every other group. Role filtering and mobile drawer dismissal are unchanged.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and website TypeScript checks passed. 104 render checks using the real navigation configuration and AdminNav with routing/sidebar stubs passed across submenu and nested paths for user and super-admin roles. Diff whitespace check passed.

## 2026-09-21 | Version: auto-run-continuous-geofence-visit-v1

- **Summary:** Preserve the active location visit while the truck remains inside its geofence, preventing overlapping locations from triggering another shipment prematurely.
- **API Changes:** No schema changes. Position processing retains the active matching geofence before considering other locations.
- **Database Changes:** None; existing production records are not modified.
- **Behavior Changes:** Repeated positions retain the current visit and shipment even if an overlapping location becomes closer or has higher priority. Normal exit/delivery and next-location automation run after leaving the active fence. Existing per-run/location shipment reuse is retained.
- **Breaking Changes:** None.
- **Verification:** Overlap regression failed before the fix (two shipments instead of one). All 25 run-lifecycle tests and 18 tracking/autorun-controller tests passed (255 assertions); PHP syntax checks passed. Production cause and historical cleanup remain unverified; not deployed by this task.

## 2026-09-21 | Version: admin-run-map-card-removal-v1

- **Summary:** Removed the outer card and Recorded GPS heading from admin run maps.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Map and timeline now use the available page width without outer card padding or title. Marker filters, replay and contextual history states remain available.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript, focused ESLint and diff whitespace checks passed.

## 2026-09-21 | Version: admin-run-map-copy-cleanup-v1

- **Summary:** Removed the explanatory route paragraph and general incomplete-coverage notice above the admin run map.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Cleaner map header; timeline gap labels, unavailable-position details and loading/error states remain available.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed.

## 2026-09-21 | Version: admin-run-timeline-spacing-v1

- **Summary:** Tightened spacing beneath the Trip timeline heading row.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Reduced the margin above the slider from 32px to 8px; preserved slider size, labels and replay behavior.
- **Breaking Changes:** None.
- **Verification:** Focused ESLint and diff whitespace checks passed; checked the updated development preview.

## 2026-09-21 | Version: admin-run-map-trip-replay-v1

- **Summary:** Implemented selected timeline design 3 with interactive trip replay in admin run and shared Run KM maps.
- **API Changes:** No contract changes. Admin consumers fetch available bounded track pages to cover the trip instead of switching individual windows.
- **Database Changes:** None.
- **Behavior Changes:** Bottom timeline includes stop-duration bands, event dots, selected date/time/time zone and GPS gaps. Dragging or keyboard input moves a compact 32px car and updates activity/location/duration; recorded stop intervals hold the car stationary. Unavailable positions hide it without crossing GPS/segment gaps. Back to latest restores the latest-stop view. Preserve viewport/filter state and prior data after refresh failure; foreground-only refresh and cursor guards remain. Removed the separate colour key per user feedback, retained filter swatches and applied the muted basemap. Disabled map-only fullscreen to keep timeline controls accessible.
- **Internal Changes:** Added replay/history helpers, a responsive timeline component, regression tests and a labelled development-only preview (404 outside development). Dashboard plan 1.25 and design verification record updated; mobile Figma unchanged.
- **Breaking Changes:** None.
- **Verification:** Fifteen marker/replay tests, website TypeScript and focused ESLint passed. In-app browser fixture verified dragging, keyboard navigation, stop context, car movement, GPS-gap hiding, reset, filtering and desktop/390px layouts with no console errors. Real run data remains unverified because browser sign-in is required.

## 2026-09-21 | Version: admin-run-map-marker-styling-v1

- **Summary:** Added colour-coded run-map markers and a car icon at the latest dated mapped stop.
- **API Changes:** None; includes existing speeding activity data in the map.
- **Database Changes:** None.
- **Behavior Changes:** Blue collection, green delivery, slate other-stop, red speeding and purple isolated-position markers have a text legend and matching filter swatches. Stop numbering and details remain available. A separately filterable car icon marks the latest dated stop with coordinates in the available history, explicitly distinguished from live location; missing timestamps do not produce a fabricated latest stop.
- **Internal Changes:** Dashboard plan revision 1.24 and three illustrative trip-slider UI proposals saved under `docs/design/run-map`. The slider is not implemented and awaits user selection; mobile Figma screens are unchanged.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript, focused ESLint and eight marker tests passed, including chronology selection, speeding exclusion/deduplication and distinct colours. Live Google Maps/browser interaction remains unverified.

## 2026-09-21 | Version: admin-run-map-context-v1

- **Summary:** Added useful activity details and marker-type filtering to admin run maps and shared Run KM maps.
- **API Changes:** None; consumes existing run activities and GPS history.
- **Database Changes:** None.
- **Behavior Changes:** Click pins for event, location/address/category, arrival/departure, stop duration and available shipment/driver/vehicle/speed information. Durations distinguish complete visits, estimated stopped-to-moving intervals and GPS stationary observations; unavailable values remain explicit. Overlapping pins expose all visible events at that coordinate. Top-right checkboxes toggle activity types with counts and Show all / Hide all while preserving route lines, viewport and numbering.
- **Internal Changes:** Dashboard plan revision 1.23 documents the admin behavior; existing mobile Figma screens are unaffected.
- **Breaking Changes:** None.
- **Verification:** Six marker regression tests passed, including interval provenance, invalid/missing times and coordinates, vehicle/run isolation and safe popup text. Website TypeScript and focused ESLint passed. Live browser interaction on the requested run was not verified; no local website server was listening on port 3000.

## 2026-09-18 | Version: admin-run-map-bounds-v1

- **Summary:** Fixed admin recorded run maps cropping stops outside the latest GPS coverage.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Default map bounds include all located run stops, stationary observations and displayed GPS segments. Stop pins remain visible while GPS history loads or is empty, disabled or unavailable. A legend identifies blue recorded-route lines and numbered stops; missing history stays unconnected with an explicit unavailable state. Shared behavior also applies to Run KM details.
- **Internal Changes:** Dashboard plan revision 1.22 documents the admin correction; mobile Figma screens are unaffected.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript and focused ESLint passed. Temporary map API fixture verified full bounds, separate GPS polylines, missing-coordinate handling and stop visibility with loading/empty/disabled history. Live run history could not be checked because local MySQL authentication was rejected; no history was changed or fabricated.

## 2026-09-18 | Version: shipment-report-load-performance-v1

- **Summary:** Reduced database work and request waiting on the admin Shipments Report.
- **API Changes:** No contract changes. Report queries join run/vehicle/driver/location tables only when filtering, searching or sorting requires them; parcel aggregation runs only for delivered-volume sorting.
- **Database Changes:** None.
- **Behavior Changes:** Filter tags and report data load concurrently. Report location types and selected visit shipment details are batch-loaded, preserving existing output, filters and pagination.
- **Breaking Changes:** None.
- **Verification:** Local SQLite regression fixture reduced 20-row report queries from 143 to 27; both 5-row and 20-row pages now use 27 queries (previously 53 and 143). Regression tests cover bounded query growth and omission of unnecessary aggregate joins. Report tests, website TypeScript and focused ESLint passed. Production latency has not been measured; computed visit/run/location sorts still evaluate all matching shipments.

## 2026-09-18 | Version: recorded-run-gps-v1

- **Summary:** Added permanent vehicle GPS history with merged stationary observations and recorded routes on admin run details, Run KM details and the mobile dashboard.
- **API Changes:** Added scoped `GET /api/v1/runs/{run_uuid}/track` and assigned-driver `GET /api/v1/driver/runs/{run_uuid}/track`, with earlier-window cursors, capture freshness, coverage, stops and at most 2,000 displayed coordinates. No history is added to lists, reports or the general dashboard payload.
- **Database Changes:** Additive migration creates `vehicle_location_history`, compact permanent `vehicle_location_receipts` for retry deduplication, indexed vehicle/run queries and the runs actual-interval index. No automatic deletion or provider payload storage.
- **Behavior Changes:** One-minute tracking now optionally records observations under a vehicle lock. Stops merge within configurable 3 km/h / 25m limits and five-minute gaps. Delayed observations retain source times without rewinding live coordinates or lifecycle; actual run intervals determine association. Separate `VEHICLE_HISTORY_RECORDING_ENABLED` and `VEHICLE_HISTORY_DISPLAY_ENABLED` flags default off. Mobile defaults to Planned; Recorded fetches lazily and refreshes active routes only while visible/foregrounded. Recorded maps break missing tracking segments and label activity-only fallback Limited historical data. Odometer/billing/distance-allocation logic is unchanged. Completed maps are cached and invalidated after affected ingestion commits; monitoring counters and payload-size logs are available.
- **Internal Changes:** Dashboard plan revision 1.21, Figma map toggle/scenario notes and [rollout/monitoring documentation](vehicle-location-history.md) updated.
- **Breaking Changes:** None. Apply the additive migration before enabling either flag; deploy and verify capture before enabling display. Existing missing GPS history cannot be recreated.
- **Verification:** 56 targeted backend tests passed (568 assertions), covering capture, authorization, lifecycle regression, automatic-start ingestion ordering, list-query isolation, a 12,000-row multi-day history, bounded payloads, SQLite query plans, four concurrent processes and committed late-sample cache invalidation. Website/mobile TypeScript and focused ESLint passed. Browser fixture verified separated route segments and stale/empty/failure/Retry states; fixture removed. Native device/background interaction and production-engine load/lock checks remain rollout gates; this task does not deploy or enable the flags.

## 2026-09-18 | Version: shipment-report-status-views-v1

- **Summary:** Added All, Ready for Pickup, In Transit and Delivered view buttons to the Shipments Report using the existing table view controls.
- **API Changes:** None; uses the report's existing `shipment_status` filter.
- **Database Changes:** None.
- **Behavior Changes:** Switching views filters the report and returns to page one while preserving search, other filters, sorting and page size. All clears only the status filter. The active view is highlighted. Ready for Pickup is also available in the status dropdown.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript, focused ESLint and diff whitespace checks passed. View links and active-view matching reviewed against the shared table implementation.

## 2026-09-18 | Version: shared-new-shipment-button-v1

- **Summary:** Added New shipment to the Shipments Report using a shared component also used by the Shipments page.
- **API Changes:** None; retains the existing shipment creation endpoint and payload.
- **Database Changes:** None.
- **Behavior Changes:** Both buttons open the same creation form with the selected merchant, validation and error handling. The button remains disabled without a selected merchant. Successful creation revalidates both the shipments list and shipment report, preserving the current page's filters.
- **Internal Changes:** Moved dialog configuration, address conversion and the authenticated creation server action into `website/src/components/shipments/new-shipment-button.tsx` to avoid duplication.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript and focused ESLint passed; diff whitespace check passed. Creation payload and form configuration compared with the original implementation. No live shipment was created during verification.

## 2026-09-18 | Version: run-km-timeline-layout-v1

- **Summary:** Replaced the Run KM details modal's wide stops table with the approved responsive timeline design.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Fixed compact distance summary, readable location/address rows, grouped arrival/departure times, aligned leg/cumulative distances, numbered timeline and expandable shipment links. First checkpoint's links open initially when present. Route map remains available in a collapsible section and loads on expansion. Existing run details table and distance calculations remain unchanged.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript and focused ESLint passed. Local component preview with synthetic run data inspected at 1396×1127 and 390×844; shipment expansion/collapse verified, mobile dialog width matched scroll width (358px), and no browser console errors observed. Live authenticated API integration and map-provider loading were not re-tested. Temporary preview route removed.

## 2026-09-17 | Version: shipment-report-column-sorting-v1

- **Summary:** Expanded shipment-report sorting from 8 to 21 visible columns.
- **API Changes:** `GET /api/v1/reports/shipments_full_report` additionally supports `sort_by` values `invoice_number`, `shipment_type`, `from_location`, `to_location`, `from_time_in`, `from_time_out`, `from_total_time`, `to_time_in`, `to_time_out`, `to_total_time`, `total_km_from_collection`, `run_duration_seconds`, and `run_odometer_distance_km`, using the existing `sort_direction` parameter.
- **Database Changes:** None.
- **Behavior Changes:** New header sorts apply before pagination and preserve filters. Durations and kilometres sort numerically; location sorting follows displayed labels. Visit sorting uses the report's existing run/legacy visit matching, with ongoing dwell calculated at request time and missing derived values last in either direction. Attention remains unsortable because it combines different alert categories without a defined priority order.
- **Internal Changes:** Derived keys are computed in batches; full report rows are loaded for the selected page. Derived sorting scans all matching shipments and may cost more on broad reports than direct database sorts.
- **Breaking Changes:** None.
- **Verification:** Shipment report API suite passed (9 tests, 276 assertions), covering all 13 new columns in both directions across pages, merchant scope, search, ongoing visits and missing exit times. Website TypeScript, focused ESLint and diff whitespace checks passed.

## 2026-09-17 | Version: admin-run-column-sorting-v1

- **Summary:** Enabled ascending/descending sorting on every column of the admin Runs table.
- **API Changes:** `GET /api/v1/runs` accepts `sort_by` (`run_id`, `status`, `start`, `duration`, `distance`, `additional_costs`, `shipment_count`, `origin`, `destination`, `driver`, `vehicle`) and `sort_dir` (`asc`, `desc`). Unknown sort keys retain newest-first ordering.
- **Database Changes:** None.
- **Behavior Changes:** Sorts the full filtered result before pagination, with stable UUID tie-breaking. Header clicks reset pagination; search and filters retain sorting. Distance includes the existing GPS fallback; locations include shipment endpoint fallbacks. Additional costs compare currency codes then numeric totals, without currency conversion. Missing derived values sort last in both directions.
- **Internal Changes:** Reused the GPS distance calculation. Derived sort keys are computed in batches with only relevant relationships; full response relationships load for the selected page. Derived sorting still scans all matching runs, so broad searches cost more than direct database sorts.
- **Breaking Changes:** None.
- **Verification:** All 16 Run API tests passed (291 assertions), including every column in both directions across pages, merchant scoping, filtering, GPS and location fallbacks, mixed currencies, missing values and invalid sort parameters. Website TypeScript and focused ESLint passed.

## 2026-09-17 | Version: vehicle-last-known-driver-v1

- **Summary:** Added the last known driver to the admin vehicle details page, immediately after Status.
- **API Changes:** None; uses the existing vehicle last-driver response fields.
- **Database Changes:** None.
- **Behavior Changes:** The driver name links to their details page, with email or “View driver” as a fallback. Shows “Unknown” when no last driver is recorded.
- **Breaking Changes:** None.
- **Verification:** Website TypeScript check and focused ESLint passed.

## 2026-09-17 | Version: dashboard-remove-daily-summary-v1

- **Summary:** Removed the separate Today’s deliveries section from the dashboard.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Removed daily counts, progress bar and View shipments shortcut. Current-run counts, timeline links and the Shipments tab remain available.
- **Breaking Changes:** None.
- **Verification:** TypeScript and focused ESLint; removed unused progress calculation and styles.

## 2026-09-17 | Version: mobile-message-sheets-v1

- **Summary:** Replaced app-owned native alerts with reusable message bottom sheets.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Timeline details, dispatch contact, permission guidance, camera confirmation and action errors use `MessageSheet`/`BottomSheet`. Existing Settings, Retake, Use photo and dismissal actions are preserved; callbacks run after dismissal, with duplicate taps guarded. OS permission prompts remain native.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused ESLint, source scan confirming no remaining app-owned alert calls, and simulator verification of the timeline detail bottom sheet.

## 2026-09-17 | Version: dashboard-compact-shipment-links-v1

- **Summary:** Reduced spacing between timeline shipment links.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Grouped shipment links with no extra inter-row gap, reduced minimum row height to 36 points and realigned curved grey joins. Text can still wrap and expand each row.
- **Breaking Changes:** None.
- **Verification:** TypeScript and focused ESLint checks.

## 2026-09-16 | Version: dashboard-shipment-branches-v1

- **Summary:** Connected shipment links to the main timeline using curved grey branches.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Each shipment link has a rounded grey join; the rail extends beside shipments on the final stop. Links retain navigation and a minimum 44-point touch target. Decorative connectors do not intercept touches.
- **Breaking Changes:** None.
- **Verification:** TypeScript, focused ESLint and simulator visual inspection of curved shipment branches.

## 2026-09-16 | Version: dashboard-grey-map-v1

- **Summary:** Applied an Uber-inspired grey dashboard basemap.
- **API Changes:** None.
- **Database Changes:** None.
- **Behavior Changes:** Grey terrain, parks and water; white roads; subdued labels; hidden POI/transit clutter. Route and vehicle/stop marker colours remain distinct. Styling is centralised in `run-map-style.ts`.
- **Breaking Changes:** None.
- **Verification:** TypeScript and focused ESLint checks.

## 2026-09-16 | Version: dashboard-final-destination-v1

- **Summary:** Added a missing-final-destination entry to the run timeline.
- **API Changes:** Added `PATCH /driver/runs/{run_uuid}/final-destination`; dashboard current-run data now includes `destination_location_id`.
- **Database Changes:** None; uses the existing run destination field.
- **Behavior Changes:** All stops shows **Choose final destination** when missing. A shared bottom sheet supports saved-location/address search, selection preview and explicit save. Saving refreshes the map and timeline; run lifecycle and historical visits remain unchanged. Ownership, active-run state, coordinates, environment and concurrent updates are validated. Same-destination retries are idempotent.
- **Breaking Changes:** None.
- **Verification:** Driver import/destination suite: 15 tests, 102 assertions; TypeScript and focused ESLint. Tests cover dashboard empty/set state, repeat save, concurrent destination, foreign driver/location, missing coordinates and closed runs.

## 2026-09-16 | Version: driver-dashboard-mobile-v2

- **Summary:** Implemented the approved dashboard and five-step delivery-note workflow in Expo and Laravel.
- **API Changes:** Added driver-scoped import preview/review tokens, saved-address/Google geocoding search, manual run start, explicit current/new-run confirmation and selected-run dashboard refresh. Directions include the planned start and end. Shipment responses expose status history.
- **Database Changes:** Added `runs.driver_workflow` (default false); applied the migration locally. Existing run endpoints and tracking-event audit storage are reused.
- **Behavior Changes:** Initial checking/ready/stale states; Photo/File/Camera source sheet; persisted editable draft; location mismatch warnings within cards; direct restricted status editing and required failure reasons; safe recorded-stop delivery matches; all-date assignment; duplicate/excluded-row handling; atomic idempotent final save; automatic departure start and dispatch-only closure for driver-planned runs. Trip endpoint markers, planned-end timeline entry and route retry are available.
- **Breaking Changes:** Driver status selection is limited to `delivered`, `in_transit`, `failed`; failed updates require a nonblank reason. Import assignment now includes all reviewed dates. Legacy confirmation without the new-run flag remains supported.
- **Verification:** 66 Laravel feature tests (419 assertions), five map/filter tests (`node --experimental-strip-types --test tests/*.test.mjs`), TypeScript, focused ESLint and simulator inspection. Local MySQL upload context verified. Live AI reading is blocked by missing `OPENAI_API_KEY`; camera capture still needs a physical-device pass. Google Geocoding requires an enabled server key (`GOOGLE_MAPS_GEOCODING_API_KEY`, falling back to the routes key).

## 2026-09-16 | Version: dashboard-plan-v1.13

### Summary
Improved Figma shipment review and trip-location clarity.

### API Changes
None.

### Database Changes
None.

### Behavior Changes
Design only: mismatch warnings appear inside their shipment cards, the review header summarises attention counts, and eligible cards have a direct Change delivery status button. Step 3 shows Run starting point and Planned end location with full example addresses.

### Internal Changes
Added optional warning to the shared shipment card; updated location selection examples and dashboard plan v1.13.

### Breaking Changes
None.

### Verification
Visually checked Step 3 and the full affected shipment card. Status actions preserve per-shipment context; Failed Delivery retains the reason flow. Documentation diff checked. Runtime implementation remains pending.

## 2026-09-16 | Version: dashboard-plan-v1.12

### Summary
Moved trip-location confirmation before shipment review in the planned import journey.

### API Changes
None.

### Database Changes
None.

### Behavior Changes
Design only: Step 3 confirms collection/end locations; Step 4 reviews shipments and warns when collection points differ from the confirmed run start. Added Change run start correction path; Step 5 remains final run selection/submission.

### Internal Changes
Updated Figma labels, progression, overview and mismatch fixture; dashboard plan updated to v1.12.

### Breaking Changes
None.

### Verification
Inspected prototype reactions and visually checked review warning; documentation diff checked. Runtime location matching remains pending implementation.

## 2026-09-16 | Version: dashboard-plan-v1.11

### Summary
Fixed inconsistent Figma upload, processing and reading loading layouts.

### API Changes
None.

### Database Changes
None.

### Behavior Changes
Design only: aligned loading indicators, matched sheet heights and text spacing, and allowed the reading heading two lines.

### Internal Changes
Replaced separately positioned loading content with consistent vertical auto-layout. Dashboard plan updated to v1.11.

### Breaking Changes
None.

### Verification
Checked loading sheet geometry and screenshot rendering; retained frame-level progress transitions. Documentation diff checked. No runtime code changed.

## 2026-09-16 | Version: dashboard-plan-v1.10

### Summary
Added Photo, File and Camera document-source choices to the Figma upload flow.

### API Changes
None.

### Database Changes
None.

### Behavior Changes
Design only: Choose document and Change document open a shared action sheet. Cancel preserves selection; each source previews a simulated selected file before Continue.

### Internal Changes
Dashboard plan v1.10 documents native picker/camera, permissions, capture confirmation and file validation requirements.

### Breaking Changes
None.

### Verification
Visually checked action sheet; verified source actions target the selected-file screen and Cancel closes the overlay. Documentation diff checked. Native functionality remains pending implementation.

## 2026-09-16 | Version: dashboard-plan-v1.9

### Summary
Restricted planned driver delivery-status choices and added mandatory failure reasons.

### API Changes
None implemented. Plan requires server enforcement of three driver statuses and nonblank failure reasons.

### Database Changes
None implemented. Failure-reason persistence and status audit requirements documented.

### Behavior Changes
Design only: Delivered, In transit and Failed Delivery are the only driver choices. Failed Delivery opens a required reason field; Save is disabled until entered and Cancel preserves status.

### Internal Changes
Updated dashboard plan v1.9 and Figma status picker with empty/entered failure-reason states. Example text entry is simulated.

### Breaking Changes
None.

### Verification
Visually checked the three-option picker and both failure-reason states. Documentation diff checked; no runtime code changed.

## 2026-09-16 | Version: dashboard-plan-v1.8

### Summary
Label shipment review dates as Collection date in Figma and the dashboard plan.

### API Changes
None.

### Database Changes
None.

### Behavior Changes
Design only: explicit Collection date labels on shared shipment cards and the edit form; date values preserved.

### Internal Changes
Renamed the editable Figma date property to Collection date; updated dashboard plan to v1.8.

### Breaking Changes
None.

### Verification
Visually checked a linked shipment card; shared variants updated. Documentation diff checked. No runtime code changes.

## 2026-09-16 | Version: dashboard-plan-v1.7

### Summary
Updated dashboard Figma and plan for importing shipments whose delivery destinations have already been visited on the selected run.

### API Changes
None; matching and status correction contracts are planned.

### Database Changes
None; stop linkage and status audit requirements documented for implementation.

### Behavior Changes
Design only: propose Delivered for reliable recorded delivery-visit matches, link existing stops, allow driver status corrections, and reconcile matches against the final run choice.

### Internal Changes
Updated `docs/design/dashboard/README.md` to v1.7; extended shared Figma shipment cards, edit status picker and run-choice explanation.

### Breaking Changes
None.

### Verification
Inspected existing driver status labels; visually checked Figma shipment review, edit form and run-choice spacing. Mobile/backend implementation remains pending; no runtime tests apply to these documentation/design changes.

## 2026-09-16 | Version: dashboard-plan-v1.6

### Summary
- Show explicit collection and delivery addresses on the Figma shipment review card.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Design only: labelled Collection and Deliver to address rows, independently editable location properties and a separate delivery date. All eight instances retain their specific destination.
- No runtime changes.

### Internal Changes
- Update dashboard plan v1.6 to distinguish shipment addresses from run-level trip boundaries.

### Breaking Changes
- None.

### Verification
- Visually reviewed the updated card and checked shipment addresses, component links and Edit actions.
- Documentation whitespace checks pass.

## 2026-09-16 | Version: dashboard-plan-v1.5

### Summary
- Convert shipment cards into a reusable Figma component with separate quantity and shipment type fields.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Design only: eight linked card instances expose reference, quantity, shipment type, date/destination and status variants while preserving Edit actions.
- No runtime changes.

### Internal Changes
- Document component location, editable properties and reuse rules in dashboard plan v1.5.

### Breaking Changes
- None.

### Verification
- Checked component variants, instance field values and preserved Edit interactions; visually reviewed the updated card.
- Documentation whitespace checks pass.

## 2026-09-16 | Version: dashboard-plan-v1.4

### Summary
- Redesign Figma shipment review cards with clear information hierarchy and a separate Edit button.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Design only: prominent quantity/type, labelled status badge, muted date/destination, and scrolling shipment cards with Continue outside the scroll region.
- No mobile/backend runtime changes.

### Internal Changes
- Update the canonical dashboard plan to v1.4 with the shipment-card presentation rules.

### Breaking Changes
- None.

### Verification
- Visually reviewed card and screen layouts and checked preserved per-shipment edit actions.
- Documentation whitespace checks pass.

## 2026-09-16 | Version: dashboard-plan-v1.3

### Summary
- Redesign the Figma delivery-note upload into five steps: upload, reading, shipment confirmation/editing, location confirmation, and current/new run selection.

### API Changes
- None implemented. The plan specifies draft quantity/type editing and final-step submission for future implementation.

### Database Changes
- None.

### Behavior Changes
- Design only: list every extracted shipment with quantity, type and its own edit action before confirming trip locations.
- Current/new run choice submits the confirmed draft; completion shows a success icon and Continue button.
- No mobile/backend runtime changes.

### Internal Changes
- Update the canonical plan to v1.3, including step ordering, endpoint preservation, final submission and completion acceptance criteria.

### Breaking Changes
- None.

### Verification
- Inspected the revised shipment, location, run-choice and completion designs; checked prototype navigation and per-shipment edit values.
- Checked documentation whitespace and five-step section ordering.

## 2026-09-16 | Version: dashboard-plan-v1.2

### Summary
- Fix overlapping Step 3 controls and duplicate Continue buttons in the Figma upload flow.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Design only: run information, location selectors, helper text and one primary action flow vertically. Apply the same correction to final review.
- No mobile/backend runtime changes.

### Internal Changes
- Update the canonical dashboard plan to v1.2 with layout order and duplicate-action acceptance criteria.

### Breaking Changes
- None.

### Verification
- Visually inspected all three Step 3 variants; checked all five affected screens for one Continue label, no overlapping stack children, preserved location bindings and linked primary actions.
- Documentation whitespace checks pass.

## 2026-09-16 | Version: dashboard-plan-v1.1

### Summary
- Document the dashboard implementation plan and update Figma Step 3 with collection and planned end location selection.

### API Changes
- None implemented. The plan records endpoint validation, persistence and full-trip routing requirements for future work.

### Database Changes
- None.

### Behavior Changes
- Design only: location choices carry from run confirmation into review; the planned trip includes collection, shipment stops and the chosen end location.
- No mobile or backend runtime behaviour changed in this task.

### Internal Changes
- Add `docs/design/dashboard/README.md` as the canonical dashboard plan, link it from the mobile README, and require updates when the plan changes in `AGENTS.md`.

### Breaking Changes
- None.

### Verification
- Reviewed Step 3 and review screen layouts and prototype location-selection links in Figma.
- Checked documentation links, required sections and whitespace.

## 2026-09-16 | Version: timeline-event-circle-colors

### Summary
- Apply event colors to timeline icon circle backgrounds.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Collections use blue, speeding uses red, and deliveries (including planned and combined collection/delivery visits) use green. Other stops remain gray; icons remain white.

### Breaking Changes
- None.

### Verification
- Expo lint and whitespace checks pass.

## 2026-09-16 | Version: demo-run-speeding-events

### Summary
- Add two example speeding events to the simulator driver's run.

### API Changes
- None.

### Database Changes
- Local demo data only: two speeding activities, marked as illustrative telemetry with stable demo keys, scoped to the test driver's active run.

### Behavior Changes
- Example timeline includes 82 km/h in a 60 km/h zone and 98 km/h in an 80 km/h zone, positioned between existing visits. Both appear in the Speeding events filter.

### Breaking Changes
- None.

### Verification
- Confirmed both events and speed limits in the dashboard response. Guarded the update against non-demo shipments.

## 2026-09-16 | Version: run-speeding-event-timeline

### Summary
- Include speeding events in the run timeline and add a Speeding events action-sheet filter.

### API Changes
- Dashboard timeline includes run/account/merchant-scoped speeding activity with recorded speed and speed limit in km/h. Speeding events remain separate from location visits.

### Database Changes
- None.

### Behavior Changes
- All stops interleaves speeding events chronologically with visited stops, before planned deliveries. Speeding entries use a red warning icon and show recorded speed/limit when available.
- Speeding events filter displays only those events; Shipment deliveries excludes them. Empty and missing-speed states are explicit.

### Breaking Changes
- None.

### Verification
- Driver shipment API and timeline filter tests pass, including speeding details/order and filter isolation. Expo lint and whitespace checks pass.

## 2026-09-16 | Version: shipment-deliveries-stop-filter

### Summary
- Rename the stop filter to Shipment deliveries and include visited and planned delivery stops.

### API Changes
- Dashboard adds `planned_delivery_stops` for open shipments whose delivery visit has not been recorded, grouped by destination in run order.

### Database Changes
- None.

### Behavior Changes
- Shipment deliveries filters out collection-only and non-shipment stops. Planned deliveries are labeled explicitly and appended after chronological visited stops; they are never presented as visited.
- All stops includes recorded visits and planned deliveries. Closed shipments do not produce planned visits.

### Breaking Changes
- None.

### Verification
- Driver shipment API suite, delivery-filter test, Expo lint, and whitespace checks pass. Tests cover collection exclusion and planned delivery inclusion.

## 2026-09-16 | Version: complete-demo-run-stop-history

### Summary
- Populate the simulator driver's missing example run-stop history.

### API Changes
- None.

### Database Changes
- Local demo data only: added five collection activity records, three completed-delivery activity records, and rest/fuel stops with two illustrative locations. Shared arrival times group collection and delivery activities into visits. Records carry demo metadata and stable demo keys for repeatable updates.

### Behavior Changes
- All stops shows four chronological visits: depot collection, Rosebank delivery, rest, and fuel. Shipments only shows the collection and delivery visits with five and three linked shipments respectively. The two in-transit shipments have no fabricated delivery visit.

### Breaking Changes
- None.

### Verification
- Verified the dashboard response contains four total stops and two shipment-linked stops, with correct locations, arrival times, and shipment counts. Updates were scoped to the simulator driver's active run and guarded against non-demo shipments.

## 2026-09-16 | Version: shipment-linked-run-stop-filter

### Summary
- Make both Current run filters operate on the same stop timeline.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- All stops is the default and displays all recorded run stops. Shipments only filters that list to stops with associated shipments, including collection and delivery visits, preserving chronological order.
- Removed the separate shipment-list rendering from this selector. Counts and empty states reflect the selected stop filter.

### Breaking Changes
- None.

### Verification
- Stop-filter test covers collection/delivery inclusion, stops with no shipments, stable order, multiple shipments at a stop, and empty lists. Expo lint and whitespace checks pass.

## 2026-09-16 | Version: visited-run-stop-timeline

### Summary
- Show all recorded visits, including collection and delivery stops, in one chronological All stops timeline.

### API Changes
- Dashboard recorded stops now include arrival, collection and delivery activity, stop kind, and associated shipment links. Events sharing a location and recorded arrival time are combined.

### Database Changes
- None.

### Behavior Changes
- All stops shows the places the run has visited in arrival order, including collection stops and other truck stops. It no longer appends a separate shipment timeline. Shipments only retains the shipment view.
- Visits include location, arrival/departure times and links to associated shipments where available. Missing history is shown explicitly; planned shipment addresses alone do not create visited stops.

### Breaking Changes
- None.

### Verification
- Driver shipment API tests and Expo lint; checked inclusion of collection activity and associated shipments, exclusion of movement and other runs, and chronological ordering.

## 2026-09-16 | Version: current-run-view-filter

### Summary
- Add an action-sheet selector beside Current run for All stops or Shipments only.

### API Changes
- Driver dashboard includes `recorded_stops`: current-run stopped vehicle events without shipment associations, scoped by account and merchant.

### Database Changes
- None.

### Behavior Changes
- Shipments only preserves the shipment timeline. All stops adds a chronological recorded-truck-stops section above shipments, with names, addresses and timestamps where available, and an explicit empty state.
- Selected view appears in the header and is marked in the reusable ActionSheet. Route map and shipment numbering remain unchanged.

### Breaking Changes
- None.

### Verification
- Driver shipment API tests cover run-scoped truck stops, excluded movement/shipment events, and other-driver isolation. Expo lint and whitespace checks pass.

## 2026-09-16 | Version: dashboard-map-minimum-half-height

### Summary
- Keep the dashboard map at least half height.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Expanding the dashboard sheet beyond 50% overlays the map without shrinking it further. Collapsing the sheet to 25% still enlarges the map. Safe-area and rounded-corner overlap remain accounted for.

### Breaking Changes
- None.

### Verification
- Expo lint and whitespace checks pass; checked the map-height clamp against the three sheet positions.

## 2026-09-16 | Version: dashboard-quarter-sheet-map-resize

### Summary
- Add a 25% dashboard sheet position and resize the map with the sheet.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Dashboard sheet supports 25%, 50%, and 92% heights, starting at 50%. Tapping the handle cycles through all three positions; dragging also supports them.
- Map height follows the sheet's animated position, growing when collapsed and shrinking when expanded. Existing map layout handling refits truck and shipment geometry to the available space.

### Breaking Changes
- None.

### Verification
- Expo lint and whitespace checks; simulator verification of sheet positions and map resizing.

## 2026-09-16 | Version: stronger-dashboard-sheet-shadow

### Summary
- Make the dashboard bottom sheet shadow more visible against the map.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Give the shadow container an opaque white rounded surface and increase the shadow opacity, upward offset, blur, and Android elevation.

### Breaking Changes
- None.

### Verification
- Expo lint and whitespace checks pass.

## 2026-09-16 | Version: dashboard-route-info-toggle

### Summary
- Add a bottom-right map info button that shows or hides route information.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Route distance/time is hidden by default. Tap the accessible info button to reveal the summary beside it; tap again to hide it.

### Breaking Changes
- None.

### Verification
- Expo lint and whitespace checks pass.

## 2026-09-16 | Version: hide-known-truck-location-banner

### Summary
- Hide the map's truck location banner when coordinates are available.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Known truck locations show the truck marker without the timestamp/locate banner. Last-reported time remains available in the marker callout. Loading and unavailable-location messages remain when no position is known.

### Breaking Changes
- None.

### Verification
- Expo lint and diff whitespace checks pass.

## 2026-09-16 | Version: subtle-dashboard-sheet-shadow

### Summary
- Add a very subtle shadow to the dashboard bottom sheet.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The white dashboard sheet has a soft, low-opacity shadow above the map, with a small Android elevation.

### Breaking Changes
- None.

### Verification
- Checked the sheet styling and ran Expo lint.

## 2026-09-16 | Version: local-demo-truck-position

### Summary
- Add an example truck position for simulator dashboard preview.

### API Changes
- None.

### Database Changes
- Updated only the local simulator driver's active-run vehicle `SIM-DEMO-01` with example coordinates (-26.157, 28.044), a location timestamp, and metadata identifying the position as an illustrative fixture rather than live telemetry. No schema changes.

### Behavior Changes
- The existing truck-position endpoint now returns a location for the demo truck, enabling its map marker and locate control.

### Breaking Changes
- None.

### Verification
- Scoped the update through simulator.driver@example.com's active run and account-owned vehicle; confirmed the saved example coordinates.

## 2026-09-16 | Version: local-phone-api-connection

### Summary
- Persist the local Expo API address for physical-phone testing.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Local Expo configuration uses the Mac's LAN API at `http://172.20.10.4:8001/api/v1` instead of device loopback. Update the local IP if the Mac changes networks.

### Breaking Changes
- None; local development configuration only.

### Verification
- API listens on all interfaces on port 8001. Localhost and LAN requests both return the expected unauthenticated HTTP 401 response. Phone network access still depends on its connection and permissions.

## 2026-09-16 | Version: unreleased-dashboard-truck-position

### Summary
- Show the assigned truck's last reported GPS position alongside run shipment stops.

### API Changes
- Added authenticated `GET /api/v1/driver/runs/{run_uuid}/position`, restricted to the driver's active run and account-owned vehicle (matching merchant or shared account vehicle). Returns validated coordinates, plate, vehicle ID, and original location update time.

### Database Changes
- None. Uses existing vehicle `last_location_address` and `location_updated_at` values.

### Behavior Changes
- Blue truck marker, timestamp banner, and tap-to-center control. Map bounds include the truck and shipment route.
- Refresh every 30 seconds while the dashboard is focused and the app is active; refresh again on foreground. No phone-location permissions or background tracking added.
- Missing GPS coordinates show “Truck location not reported yet”; request failures are identified and any previous point retains its last-reported timestamp. No simulated truck position is created.

### Breaking Changes
- None.

### Verification
- Driver shipment API tests cover assigned vehicle position, timestamp, other-driver denial, missing coordinates, valid zero coordinates, and closed-run denial.
- Expo lint passes; TypeScript retains existing unrelated shipment-action/request-body errors.
- Simulator verified the missing-location state: the local demo truck has no reported GPS fix, so a real-position marker cannot yet be visually verified.

## 2026-09-16 | Version: unreleased-google-run-directions

### Summary
- Draw Google driving routes between current-run shipment stops on the dashboard Google map.

### API Changes
- Added authenticated `GET /api/v1/driver/runs/{run_uuid}/directions`, scoped to the driver's active assigned run and account/merchant. Returns road coordinates, distance in meters, estimated driving seconds, or an explicit unavailable status.
- Google Routes API requests run on Laravel using `GOOGLE_MAPS_ROUTES_API_KEY`. No routing credentials or persisted Google route cache are sent to the mobile app.

### Database Changes
- None.

### Behavior Changes
- Replaced straight stop-order lines with Google road geometry; preserve shipment order, completed stops, and return visits. Consecutive co-located stops are collapsed for routing only.
- Route loading is independent of dashboard loading. Missing coordinates, configuration, service errors, or more than 27 distinct consecutive stops leave markers visible without a fabricated route.
- Show route distance and approximate driving time (traffic-unaware, excluding delivery service time). Fit road geometry and pins above the white dashboard sheet.
- Google map provider is used on iOS and Android, with bottom padding preserving Google attribution. Expo Go works directly; standalone builds accept `GOOGLE_MAPS_IOS_API_KEY` and `GOOGLE_MAPS_ANDROID_API_KEY` through `app.config.js` and require their respective Google Maps SDKs enabled.

### Breaking Changes
- None. Deployed road routing requires a Google Routes API key; standalone Google maps require native SDK keys and a rebuild.

### Verification
- 28 backend tests pass (154 assertions), including Google waypoint order, return visits, missing coordinates/key, provider failures, and driver/run authorization.
- Expo lint passes. TypeScript still reports only the four pre-existing shipment-action/request-body errors.
- Verified Google map and road-following geometry in the iOS simulator, including all five shipment numbers and the local demo route of 16.2 km / approximately 38 minutes. Demo coordinates remain illustrative.

## 2026-09-16 | Version: unreleased-visible-shipment-stops

### Summary
- Make every mapped shipment number visible, including shared destination stops.

### API Changes
- None.

### Database Changes
- No schema changes. Added clearly marked illustrative coordinates to the four local simulator demo locations that had none; existing coordinates are preserved.

### Behavior Changes
- Shipments with identical coordinates share a numbered marker rather than hiding behind each other. Tap a shared marker to choose a shipment in the reusable ActionSheet.
- A single distinct location receives an appropriate map zoom even when several shipments use it.

### Breaking Changes
- None.

### Verification
- Four map data tests and Expo lint pass, including shared-location grouping and preserved timeline numbering.
- Verified all five shipment numbers on the iOS map and the shared-stop chooser for shipments 1, 4, and 5. TypeScript retains only the four pre-existing errors.

## 2026-09-15 | Version: unreleased-map-dashboard-sheet

### Summary
- Implement the Figma half-map dashboard with a persistent white bottom sheet.

### API Changes
- None. Mobile location types now include the coordinates already returned by the API.

### Database Changes
- None.

### Behavior Changes
- Native map shows saved drop-off locations with numbered shipment markers and green delivered markers. Callouts open shipment details.
- Connect mapped stops in run order only when all locations are available; the connection is an overview, not road directions. Missing coordinates show an explicit empty/partial-map state.
- White dashboard sheet opens halfway, expands to 92% by tapping or dragging its handle, and scrolls above the existing tab bar. Modal and persistent sheets share corner/handle tokens. The date is centered and the separate Dashboard heading is removed to match the latest Figma frame.
- Web retains dashboard information with a mobile-map fallback.

### Breaking Changes
- None. Added Expo-compatible react-native-maps 1.20.1; standalone Android maps require a configured Google Maps key.

### Verification
- Map data tests: 3 passed (valid decimal coordinates, missing/invalid locations, stable timeline numbering and completed shipments).
- Expo lint and production web export passed. TypeScript has only the four previously identified shipment-action/API-body errors.
- iOS simulator verified white sheet, rounded map overlap, tap-to-expand, live shipment counts, and shipment navigation. Existing demo locations have no coordinates, so their map shows the explicit empty state.

## 2026-09-15 | Version: unreleased-driver-run-timeline

### Summary
- Replace the next-delivery card with the current run's shipment timeline.

### API Changes
- Dashboard adds `current_run` and sequence-ordered `run_shipments`, including completed attachments and excluding removed shipments. Prefer in-progress, then dispatched, then draft runs belonging to the authenticated driver, account, and merchant.

### Database Changes
- None.

### Behavior Changes
- Show connected numbered stops, green completion checks, shipment status, addresses, parcel counts, and individual Open shipment actions.
- Show only the required-document reminder title; tapping it still opens Documents.
- Keep daily delivery progress separate from the current run summary.

### Breaking Changes
- None; existing dashboard response fields remain available.

### Verification
- DriverShipmentApiTest: 24 tests passed, 137 assertions, including sequence, completed attachments, removed shipments, other runs/drivers, and no-run cases.
- Expo lint passed. TypeScript still reports four pre-existing errors in shipment action state and the API request body.
- Verified the rebuilt iOS simulator dashboard shows five real run shipments, three delivered/two remaining, connected markers, and the title-only document reminder.

## 2026-09-15 | Version: unreleased-upload-continue-visibility

### Summary
- Show Continue in the upload sheet only after a file is selected.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Continue is hidden until a valid file is selected and hides again when the selection is removed.

### Breaking Changes
- None.

### Verification
- Verified conditional rendering uses the selected-file state; diff whitespace check passed.

## 2026-09-15 | Version: unreleased-content-sized-sheets

### Summary
- Shared bottom sheets now fit their content, removing the empty space below short upload forms.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Enabled dynamic sizing for scrollable sheets as well as static sheets. Longer content remains limited to the existing safe-area-aware maximum height and can scroll.

### Breaking Changes
- None.

### Verification
- Shared BottomSheet ESLint and diff whitespace checks passed. Simulator screenshot verified the upload sheet fits the content with normal padding below Continue.

## 2026-09-15 | Version: unreleased-upload-helper-copy

### Summary
- Removed the “Next: AI reads your document…” message from the upload sheet.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Removed the explanatory footer from file selection.

### Breaking Changes
- None.

### Verification
- Confirmed the requested text was removed; diff whitespace check passed.

## 2026-09-15 | Version: unreleased-hide-recent-uploads

### Summary
- Removed recent uploads from the delivery-note upload sheet.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The upload step shows file selection and Continue without recent import or resume links.

### Breaking Changes
- None.

### Verification
- Upload screen ESLint and diff whitespace checks passed.

## 2026-09-15 | Version: unreleased-guided-delivery-note-upload

### Summary
- Converted delivery-note import into a guided bottom-sheet flow: choose file, processing animation, confirm note/run, editable review, final creation, and completion.

### API Changes
- Driver import confirmation accepts an optional run UUID selected after extraction. Ownership and active-run validation remain enforced in the creation transaction; omitted run preserves existing clients' behavior.

### Database Changes
- None.

### Behavior Changes
- Continue uploads and analyzes the selected file. Actual upload completion switches to indeterminate AI processing; no timed/fabricated completion or percentage is shown.
- The confirmation step shows the extracted note/order reference, destination, and item count, with a run choice. Continue opens the review, where Continue upload creates shipments.
- The final screen reports Delivery note upload completed and processed with created/attached/skipped/unassigned counts. Duplicate skipping and today's-only run assignment are preserved.
- All steps use the shared bottom sheet; processing blocks dismissal and duplicate submissions. Animation respects reduced motion. Existing imports can resume at confirmation.

### Breaking Changes
- None.

### Verification
- Added API tests for assigning a run after extraction and rejecting another driver's run.
- 31 backend tests passed (175 assertions); targeted mobile ESLint passed. Whole-app TypeScript reports only the previously documented unrelated errors.
- Simulator verified file/Continue, confirmation, long-form review scrolling, Continue upload, and successful completion with duplicate skipping and no new demo shipments. Fixed shared-sheet scrolling and backdrop ordering when busy state changes.
- Live AI upload/processing remains unverified locally because no AI key is configured; progress uses real request events.

## 2026-09-15 | Version: unreleased-shared-bottom-sheets

### Summary
- Added reusable BottomSheet and ActionSheet UI components, styled centrally for Spaces and inspired by the supplied floating-sheet references.
- Shipment/delivery-note upload now opens as a floating bottom sheet over the dashboard.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shared sheets handle light/dark appearance, rounded floating layout, safe areas, height limits, scrollable content, backdrop/close/drag dismissal, and keyboard behavior.
- ActionSheet supports configurable actions, destructive/disabled states, async error handling, and action execution after dismissal; the upload flow uses it for run selection and replacing/removing a selected document.
- Upload keeps run preselection and review navigation. Dismissal is disabled during document analysis. The full review editor remains a separate page.

### Breaking Changes
- None.

### Verification
- Targeted ESLint passed. TypeScript reports only the previously documented shipment-action union and request-body narrowing errors.
- Simulator verified floating upload presentation, accessible controls, nested run ActionSheet presentation, action selection updating the restored parent sheet, and dismissal before opening the existing review screen. Android/dark mode and document replacement were not exercised in the simulator.
- Added usage guidance in `mobile_app/docs/bottom-sheets.md`.

## 2026-09-15 | Version: unreleased-empty-run-delivery-note

### Summary
- Added an on-road dashboard reminder to upload a delivery note when an in-progress run has no attached shipments.

### API Changes
- Added nullable `delivery_note_required_run_id` to the driver dashboard, scoped to the driver's account, merchant, and assigned in-progress runs.

### Database Changes
- None.

### Behavior Changes
- Tapping the reminder opens Upload a delivery note with the matching run selected, including when the driver has multiple runs.
- Planned, dispatched, completed, and cancelled runs do not trigger the notice. Existing non-removed shipments, including future-dated/completed/failed shipments, prevent the notice; removed/deleted shipments do not.
- The notice refreshes with the dashboard. A run that becomes unavailable before upload is not silently replaced with another run.
- Existing document extraction, review-before-create, duplicate skipping, and today's-run assignment rules remain unchanged.

### Breaking Changes
- None.

### Verification
- Added API coverage for run lifecycle, other-driver isolation, future-dated shipments, attachment statuses, deleted shipments, and deleted runs.
- Driver shipment/import API suites: 29 tests passed (167 assertions). Dashboard/upload ESLint passed. Whole-app TypeScript still reports only the previously documented shipment-action union and request-body narrowing errors.
- Simulator verified reminder visibility and navigation with the correct empty run preselected among two runs. Temporary verification run cancelled afterward.

## 2026-09-15 | Version: unreleased-dashboard-document-notices

### Summary
- Added dashboard notices for missing required driver uploads and expired documents, linking to Documents.

### API Changes
- Extended driver dashboard with missing required document count/names, dispatch-managed missing count, and expired file count.

### Database Changes
- None.

### Behavior Changes
- Required uploads follow existing coverage rules: active driver document types for the driver's merchant. Soft-deleted uploads do not satisfy requirements; inactive/deleted and vehicle/shipment types are excluded.
- Expired files are counted separately using their expiry timestamp, including historical expired files still present in Documents. An expired upload is not also counted as missing.
- Notices hide when their count is zero and refresh on dashboard focus/pull-to-refresh. Dispatch-managed requirements include guidance to contact dispatch.

### Breaking Changes
- None; dashboard response additions are additive.

### Verification
- Added API tests for missing/expired counts, other-driver isolation, deleted files/types, inactive and non-driver types, successful uploads, and the empty state.
- Driver shipment API suite: 22 tests passed (102 assertions). Dashboard ESLint and diff whitespace checks passed. Simulator showed five missing requirements and tapping the notice opened Documents. Expired and empty states verified through API tests.

## 2026-09-15 | Version: unreleased-driver-document-import

### Summary
- Added dashboard Load shipment, document upload, editable AI review, import results, and recent imports for resuming reviews in the Expo driver app.

### API Changes
- Added driver-only document import context, upload, show, and confirm endpoints under `/api/v1/driver/document-imports`.
- Reuses the existing AI extraction service; extraction now includes an optional collection date per item.
- Enforces account, merchant, uploader, active driver, and assigned-run ownership. Confirmation is transactional and repeatable without creating duplicates.

### Database Changes
- Makes delivery note import run optional and adds reviewed data and confirmation result audit fields.
- Applied the scoped migration to the local development database.

### Behavior Changes
- Uploading creates no shipments. Drivers edit the extracted references, dates, shared pickup/drop-off addresses, grouping, quantities, and parcel details before confirming.
- Existing merchant shipment references (including soft-deleted shipments) are skipped; existing shipments are never reassigned.
- Only new shipments with today's collection date in the merchant time zone join the selected active run. Other dates, or imports without a run, remain draft and unassigned for dispatch.
- PDF/JPG/PNG/WebP uploads up to 20 MB; 100 items and 500 parcels per confirmation. The current extraction uses shared addresses across an import.

### Breaking Changes
- None. Existing web import behavior is preserved. Rollback requires assigning or retaining standalone imports before restoring a required run.

### Verification
- 30 focused backend tests pass (161 assertions), covering review-before-create, mixed dates/time zones, duplicate and repeat confirmation, ownership, reassigned runs, validation, single-shipment grouping, and AI failure.
- Existing web import and AI extraction tests pass. Mobile lint passes; whole-app TypeScript still reports the previously existing shipment-action union and request-body narrowing errors.
- Simulator upload and review screens verified, including the existing-reference warning, using a clearly labelled local review fixture; no fixture shipments were created. Live AI extraction could not be exercised because the local server has no AI key configured.

## 2026-09-15 | Version: unreleased-driver-dashboard

### Summary
- Rebuilt the Expo dashboard around the selected “Your next stop” design with live delivery details, daily progress, and dispatch contact.

### API Changes
- Added authenticated, driver-only `GET /api/v1/driver/dashboard` with the next due shipment, daily delivered/remaining counts, merchant date/timezone, and configured support email.
- Due work includes overdue assignments; future pickups are excluded. Delivered counts use the merchant's day and include bookings from completed runs.

### Database Changes
- None.

### Behavior Changes
- Removed the dashboard's online/offline controls, availability mutations, and automatic location heartbeats as requested.
- Removed the top-right avatar, driver name, and role from the dashboard header as requested; account access remains in the Account tab.
- Open delivery and View shipments navigate to existing screens. Incoming offers remain actionable when present.
- Contact dispatch opens the merchant's support email, with an explanatory fallback when no contact or mail app is available.
- Added a generated SPACES wordmark and retained the existing bottom navigation and theme support.

### Breaking Changes
- Drivers can no longer set their availability from this dashboard. Existing availability API endpoints remain unchanged.
- The redesigned app requires the new dashboard endpoint on its configured backend.

### Verification
- Driver shipment API suite passed: 20 tests, 92 assertions, including daily timezone boundaries, driver isolation, future pickups, completed runs, empty state, and role access.
- Local dashboard returned 2 delivered, 3 remaining, and the expected next shipment.
- Targeted mobile ESLint and PHP syntax checks passed.
- Verified the rendered simulator dashboard, Open delivery, and View shipments navigation; no online control is present.
- Visual QA: `mobile_app/design-qa.md`. Full TypeScript checking remains blocked by pre-existing shipment action union and request body typing errors.

## 2026-09-15 | Version: unreleased-local-simulator

### Summary
- Enabled the Expo simulator to use the local Laravel API through local environment overrides.

### API Changes
- None.

### Database Changes
- Created an active local simulator test driver using the existing driver service; no schema changes.
- Loaded fictional local demo data for that driver: one assigned Toyota Hiace, one active run, three deliveries, four parcels, pickup/drop-off locations, and supporting booking/quote records.
- Added two delivered shipment examples to the assigned run, with scanned parcels, delivery timestamps, and odometer readings.

### Behavior Changes
- The mobile environment resolver now accepts `development` explicitly.
- This workspace uses a git-ignored `.env.local` override for the API at `http://127.0.0.1:8000/api/v1`.

### Breaking Changes
- None.

### Verification
- Driver login against the local API returned HTTP 200 with the driver role.
- Expo loaded the local environment overrides and compiled the iOS bundle.
- Targeted ESLint passed for the environment configuration.
- Signed in through the simulator UI and verified the dashboard welcomes Simulator Test Driver.
- Verified all three demo deliveries and the assigned van in the simulator's Shipments and Vehicles tabs.
- Verified two delivered examples appear in the simulator's Completed shipment filter.

## 2026-09-15 | Version: unreleased

### Summary
- Moved Additional costs directly after the Shipments card on run details.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Run details display cost management below the shipment list.

### Breaking Changes
- None.

### Verification
- Targeted ESLint passed.
- Visually verified the card order and cost controls on the completed preview run.

## 2026-09-15 | Version: unreleased

### Summary
- Fixed the Additional costs column layout on the runs list.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Reserved sufficient table and column width to prevent costs from overlapping Shipments.
- Display each currency total on a separate line, keeping its currency and amount together.

### Breaking Changes
- None.

### Verification
- Targeted ESLint and TypeScript checks passed.
- Visually verified single-currency totals, mixed-currency totals, and the no-cost state in the local runs list.

## 2026-09-15 | Version: unreleased

### Summary
- Added an Additional costs card directly after Tags on location details.

### API Changes
- None; reuses the existing location cost endpoints.

### Database Changes
- None.

### Behavior Changes
- Location details show itemized costs and totals, with permission-aware controls to add, edit, and remove costs.

### Breaking Changes
- None.

### Verification
- Targeted ESLint and TypeScript checks passed.
- Verified the card appears between Tags and Truck activity using the local preview account.

## 2026-09-15 | Version: unreleased

### Summary
- Added configurable geofence costs and separate, editable run additional costs.
- Added merchant currency selection in organization settings and merchant setup, defaulting to ZAR.

### API Changes
- Added `GET`/`POST /api/v1/locations/{location_uuid}/additional-costs` and `PATCH`/`DELETE /api/v1/locations/{location_uuid}/additional-costs/{cost_uuid}`.
- Added equivalent endpoints under `/api/v1/runs/{run_uuid}/additional-costs`.
- Manual run creation accepts `{ "source": "manual", "title": "Parking", "amount": "25.00" }`; configured geofence selection accepts `{ "source": "geofence", "location_cost_id": "<cost UUID>" }` with optional title/amount overrides. Location cost creation accepts title and amount. Amounts are decimal strings; currencies are assigned from the merchant default or selected cost and cannot be relabelled on existing records.
- Cost responses include individual costs, totals grouped by currency, current default currency, and edit/delete permissions. Run/location list resources include `additional_cost_totals`; detail resources also include `additional_costs`.
- Merchant resources and `PATCH /api/v1/merchants/{merchant_uuid}/settings` now support `currency` (supported codes are defined in `CostMoney::CURRENCIES`).

### Database Changes
- Added `merchants.currency` with default ZAR, `location_costs`, and `run_costs` with decimal amounts, currency and source snapshots, visit references, actor IDs, and soft deletion.
- A unique run/visit/configured-cost key survives soft deletion to prevent duplicate automatic charges.

### Behavior Changes
- Each new geofence entry charges the in-progress run once per configured cost. Staying inside produces no new charges; exiting and re-entering does. Charging also works with shipment automation disabled and at intermediate locations without an automation type.
- When an entry ends one run and starts another, the arriving run receives the charge. If no run arrives, a run created by that entry receives it.
- Automatic charges start with new visits only; existing visits and historical journeys are not backfilled.
- Run details allow authorized users to add manual or selected geofence costs, override titles/amounts, and remove costs even after completion, with an activity log. Normal run edit restrictions remain unchanged.
- Geofence and run lists show costs. Changes to configured prices or merchant currency preserve recorded values, with separate totals per currency and no exchange-rate conversion.
- Quotes, invoices, shipment pages, and the mobile app are unchanged.

### Breaking Changes
- None. Apply the migration before running the updated application or tracking workers.

### Verification
- `php artisan test --compact --filter='AdditionalCostsTest|AutoRunLifecycleServiceTest|RunApiTest|LocationGeofenceUpdateTest|LocationResourceTest'`: 47 passed, 326 assertions. Includes repeat visits, replay after deletion, database uniqueness enforcement, run boundaries, snapshots, currency precision, permissions, and tenant/environment isolation.
- Browser-verified manual and multiple selected geofence cost creation, overrides, editing/removal on a completed run, geofence configuration and totals, saved merchant currency, and ZAR defaults in setup using a disposable SQLite preview.
- Frontend targeted ESLint, TypeScript checking, production build, and `git diff --check` passed. The build reports existing unrelated unused-variable and multiple-lockfile warnings.
- Migration applied successfully to disposable SQLite databases and the local MySQL database. A local Cost Preview account includes three geofences, completed/in-progress/draft runs, repeated-visit charges, and separate ZAR/USD totals. Simultaneous concurrent processing was not exercised against MySQL.

## 2026-09-03 | Version: unreleased

### Summary
- Fixed missing stops in the **Run KM details** dialog.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The dialog now reads stop events from `actual_stops` and falls back to the run's full activity collection when necessary.
- When neither activity collection contains stops, shipment pickup and drop-off records provide a clearly labelled fallback instead of an empty stop list.
- The stop count and stop table are shown before the map, and cooperative map gestures prevent the map from trapping normal dialog scrolling.

### Breaking Changes
- None.

### Verification
- Inspected a live completed run containing 39 recorded stop events.
- `cd website && npm run lint -- src/components/runs/run-stop-journey.tsx src/components/reports/run-distance-cell.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-09-03 | Version: unreleased

### Summary
- Reworked **Run KM details** into a complete stop-by-stop journey that reconciles each leg with the run's total KM.

### API Changes
- `GET /api/v1/runs/{run_uuid}` now includes same-vehicle activity recorded inside the run window even when the individual activity was not explicitly assigned a `run_id`.

### Database Changes
- None.

### Behavior Changes
- The map and table now show the run start, every known or unmapped stop, and the run end in chronological order.
- Duplicate stop events from the same physical visit are consolidated into one stop.
- Shipment pickup and drop-off stops are highlighted in amber and link to the shipments they created or served.
- Each row shows location type, arrival/departure time, KM from the previous stop, and cumulative KM.
- Complete stop odometer readings are used when available. Otherwise, the run total is transparently allocated across legs using the recorded GPS route so the final cumulative value matches the run total.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/RunApiTest.php`
- `vendor/bin/pint --test app/Http/Resources/RunResource.php app/Services/RunService.php tests/Feature/RunApiTest.php`
- `cd website && npm run lint -- src/components/reports/run-distance-cell.tsx src/components/runs/run-stop-journey.tsx src/components/runs/run-actual-map.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-09-03 | Version: unreleased

### Summary
- Added a trip map to the shipments report's **Run KM details** dialog.

### API Changes
- None. The dialog uses the run track points and actual stops already returned by `GET /api/v1/runs/{run_uuid}`.

### Database Changes
- None.

### Behavior Changes
- Opening **Run KM details** now shows the run's actual GPS route, start and end markers, and numbered stop markers above the shipment breakdown.
- Run maps now initialize reliably when mounted inside a dialog portal and continue to show the existing no-GPS state when route coordinates are unavailable.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/reports/run-distance-cell.tsx src/components/runs/run-actual-map.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-09-03 | Version: unreleased

### Summary
- Corrected the shipments report's overdue-delivery attention tooltip to use destination visit evidence.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- A completed destination visit (`To Time Out`) now suppresses the “not delivered” warning when booking delivery metadata has not yet caught up.
- Shipments that have reached the destination but have not completed delivery now say they arrived at the drop-off; shipments without an arrival say they have not yet reached it.
- A configured **To Location** alone does not count as delivery because it identifies the destination rather than proving the vehicle arrived there.

### Breaking Changes
- None.

### Verification
- `cd website && node --test tests/dwell-time.test.mjs`
- `cd website && npm run lint -- src/lib/shipment-attention.ts tests/dwell-time.test.mjs`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-09-03 | Version: unreleased

### Summary
- Added a Run KM shipment breakdown to the shipments report and corrected completed-run duration values.

### API Changes
- `GET /api/v1/runs/{run_uuid}` now includes each attached shipment's collection/delivery timestamps, collection/delivery odometers, and `total_km_from_collection` value.
- `GET /api/v1/reports/shipments_full_report` now returns a positive `run_duration_seconds` value for completed runs.

### Database Changes
- None.

### Behavior Changes
- Clicking **Run KM** in the shipments report now loads the selected run and opens a dialog listing every shipment, its from/to locations and times, individual recorded KM, and the recorded total.
- The dialog also compares the summed shipment KM with the run's start/end odometer distance and identifies shipments with missing KM.
- **Run Time** no longer displays `0 min` because of reversed signed timestamp subtraction.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/ShipmentsFullReportTest.php tests/Feature/RunApiTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/ReportController.php app/Http/Resources/RunResource.php app/Services/RunService.php tests/Feature/ShipmentsFullReportTest.php tests/Feature/RunApiTest.php`
- `cd website && npm run lint -- src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/components/common/data-table.tsx src/components/reports/run-distance-cell.tsx src/lib/types.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-09-03 | Version: unreleased

### Summary
- Added page context and requester actions to the **My feedback** list.

### API Changes
- Added requester-owned `PATCH /api/v1/feedback/{feedback_uuid}` updates for the feedback category and original message.

### Database Changes
- None. Existing feedback soft deletion remains unchanged.

### Behavior Changes
- Each **My feedback** card now shows the captured admin page path.
- A three-dot action menu now provides **View info**, **Edit**, and **Delete** actions.
- Editing changes only the category and original feedback message; the recorded page path, workflow status, and conversation replies are preserved.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/FeedbackTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/FeedbackController.php app/Http/Requests/UpdateOwnFeedbackRequest.php app/Services/FeedbackService.php routes/api.php tests/Feature/FeedbackTest.php`
- `cd website && npm run lint -- src/components/feedback/feedback-widget.tsx src/lib/api/feedback.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-31 | Version: unreleased

### Summary
- Added shipment speeding-alert map and detail dialogs to the shipments report.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now includes a `speeding_alerts` array for each row, containing the matching transit-window activity ID, timestamp, coordinates, speed, speed limit, and amount over the limit.

### Database Changes
- None.

### Behavior Changes
- Clicking the speeding icon in the shipment report Attention column now opens a dialog with every speeding alert attributed to that shipment.
- Alerts with coordinates appear as numbered markers on a Google map; selecting a marker or table row keeps the map and table selection synchronized.
- A scrollable table below the map lists time, speed, limit, overage, coordinates, and a Google Maps link for every alert.
- The dialog uses constrained flex sizing so its map and table remain vertically scrollable on smaller viewports.
- Map initialization now starts when the portaled dialog container is mounted, then refits when that container resizes, preventing blank or incorrectly sized maps.

### Breaking Changes
- None. Existing speeding summary fields remain unchanged.

### Verification
- `php artisan test tests/Feature/ShipmentsFullReportTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/ReportController.php tests/Feature/ShipmentsFullReportTest.php`
- `cd website && npm run lint -- src/components/reports/shipment-attention-cell.tsx src/components/reports/shipment-speeding-alerts-dialog.tsx src/components/common/data-table.tsx src/lib/api/reports.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-31 | Version: unreleased

### Summary
- Added requester-controlled soft deletion for submitted feedback.

### API Changes
- Added `DELETE /api/v1/feedback/{feedback_uuid}` for deleting feedback owned by the authenticated submitter.

### Database Changes
- Added nullable `deleted_at` to `feedback`; related messages and read receipts remain stored when a feedback thread is soft deleted.

### Behavior Changes
- The **My feedback** conversation view now includes a confirmed Delete action.
- Deleted feedback disappears from requester and reviewer lists and can no longer be viewed or replied to through normal endpoints.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/FeedbackTest.php`
- `cd website && npm run lint -- src/components/feedback/feedback-widget.tsx src/lib/api/feedback.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-31 | Version: unreleased

### Summary
- Updated shipment waiting-time tooltip terminology.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Pickup and drop-off waiting-time alerts now say `total time` instead of `dwell` in UI tooltips and readable CSV attention text.

### Breaking Changes
- None. Internal alert identifiers and dwell-time calculation names are unchanged.

### Verification
- `cd website && node --test tests/dwell-time.test.mjs`
- `cd website && npm run lint -- src/lib/shipment-attention.ts tests/dwell-time.test.mjs`
- `cd website && npx tsc --noEmit`
- `git diff --check`

## 2026-08-30 | Version: unreleased

### Summary
- Increased the reliable hover and focus area for shipment Attention tooltips.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Each Attention icon now uses a 32-by-32-pixel interactive target with a shorter tooltip delay, while retaining its compact visual icon size.
- The sticky Attention column is wider so up to four alert targets remain separated and easy to hover.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/reports/shipment-attention-cell.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-30 | Version: unreleased

### Summary
- Fixed the admin feedback inbox failing to render in production.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/tools/feedback` now passes only serializable column definitions and precomputed display values from its server component into the client-side DataTable.
- Unread and category columns continue to render without crossing the Next.js server/client function boundary.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/app/admin/tools/feedback/page.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-30 | Version: unreleased

### Summary
- Added a consolidated Attention column to the shipment report for delivery delays, speeding, and excessive pickup/drop-off dwell.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now returns actual `collected_at` and `delivered_at` timestamps plus speeding count, highest speed, maximum amount over the limit, and latest speeding time for each shipment's transit window.

### Database Changes
- None.

### Behavior Changes
- The sticky Attention column shows accessible, tooltip-backed icons when an active collected shipment remains undelivered for more than six hours, its report vehicle speeds during transit, or its pickup/drop-off dwell exceeds the location's expected waiting time.
- Open delivery and dwell timing alerts refresh every minute, while completed dwell and speeding exceptions remain visible historically.
- Shipment report CSV exports include readable attention summaries and their underlying delivery/speeding values.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/ShipmentsFullReportTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/ReportController.php tests/Feature/ShipmentsFullReportTest.php`
- `cd website && node --test tests/dwell-time.test.mjs`
- `cd website && npm run lint -- src/components/common/data-table.tsx src/components/reports/shipment-attention-cell.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/lib/api/reports.ts src/lib/csv-export.ts src/lib/shipment-attention.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-30 | Version: unreleased

### Summary
- Added an admin-wide feedback widget and a permission-scoped feedback conversation tool.

### API Changes
- Added authenticated requester endpoints for submitting, listing, reading, replying to, and counting unread feedback under `/api/v1/feedback`.
- Added reviewer endpoints for manageable-merchant inboxes, status/assignment updates, replies, read receipts, and unread counts under `/api/v1/admin/feedback`.

### Database Changes
- Added `feedback`, `feedback_messages`, and `feedback_read_receipts` tables for workflow state, public conversations, assignment, page context, and per-user unread tracking.

### Behavior Changes
- Every `/admin` page now shows a black, fully rounded **Give feedback** button with categorized submission and **My feedback** conversation views.
- Super admins and merchant account holders/member-level admins can review authorized feedback at `/admin/tools/feedback`, reply publicly, self-assign threads, and use Open, In progress, Needs info, Resolved, or Closed statuses.
- Submitter replies move Needs info to In progress and reopen Closed feedback as Open; reply emails are queued to the submitter or assigned reviewer and failures do not roll back messages.
- Multi-role API middleware now evaluates every declared role parameter, so `role:user,super_admin` correctly permits both roles.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/FeedbackTest.php`
- `cd website && npm run lint -- src/components/feedback/feedback-widget.tsx src/components/feedback/feedback-review-panel.tsx src/components/layout/admin-shell.tsx src/components/layout/admin-nav.tsx src/components/common/status-badge.tsx src/app/admin/tools/page.tsx src/app/admin/tools/feedback/page.tsx 'src/app/admin/tools/feedback/[feedbackId]/page.tsx' src/lib/api/feedback.ts src/lib/auth.ts src/lib/navigation.ts src/lib/routes/admin.ts src/lib/types.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Corrected invoice data and search behavior in the shipment report.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now returns `invoice_number` for every report row.
- The endpoint now accepts `search` and applies it before pagination across shipment references, delivery and invoice numbers, status, service type, vehicle plate, driver identity, and pickup/drop-off location details.

### Database Changes
- None.

### Behavior Changes
- Invoice Number cells and CSV exports now receive the stored invoice value instead of appearing empty.
- Shipment report search is debounced, stored in the URL, and reloads matching results from the endpoint instead of filtering only the current page.
- Selecting all filtered rows for CSV export preserves the server-side search term.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/ShipmentsFullReportTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/ReportController.php tests/Feature/ShipmentsFullReportTest.php`
- `cd website && npm run lint -- src/components/common/data-table.tsx src/components/common/csv-export-action.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/lib/api/reports.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Improved shipment report date and status filters.

### API Changes
- None. The created-date range continues to use the existing `created_from` and `created_to` report parameters.

### Database Changes
- None.

### Behavior Changes
- The shipment report now presents one two-month created-date range picker instead of separate exact-date, start-date, and end-date controls.
- Applying or clearing the range updates both URL parameters together and resets pagination.
- Shipment status is now an exact dropdown containing every status supported by the shipment database enum.

### Breaking Changes
- None. The report endpoint still supports its existing date and status query parameters.

### Verification
- `cd website && npm run lint -- src/components/common/date-range-picker.tsx src/components/common/data-table.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Added a bulk action for updating location expected waiting times.

### API Changes
- None. The action uses the existing location update endpoint.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations` now lets admins select visible locations or all filtered results and apply one expected waiting time in whole minutes to the full selection.
- The bulk dialog accepts zero, can explicitly clear the value, and enforces the same unsigned integer range as the location API.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/locations/locations-table.tsx`
- `cd website && npx tsc --noEmit`
- `php artisan test tests/Feature/LocationExpectedWaitingTimeTest.php`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Added reusable endpoint-backed combobox filters to DataTables.

### API Changes
- None. The new filters use the existing location and driver list, search, and detail endpoints.

### Database Changes
- None.

### Behavior Changes
- The shipment report driver, from-location, and to-location filters now load readable options when opened and search the selected merchant's records after a 250 ms debounce.
- Combobox selections remain UUID-backed URL filters, support keyboard selection and clearing, and restore readable labels after a refresh.
- Driver results include both active and inactive drivers so historical shipments remain filterable.

### Breaking Changes
- None. Existing DataTable select, date, and text filters are unchanged.

### Verification
- `cd website && npm run lint -- src/components/common/data-table-combobox-filter.tsx src/components/common/data-table.tsx src/components/common/exportable-data-table.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/lib/api/drivers.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `php artisan test tests/Feature/LocationIndexFiltersTest.php tests/Feature/DriverIndexTest.php tests/Feature/ShipmentsFullReportTest.php`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Improved the shipment dwell-time alert presentation.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment dwell-time alerts now use a narrower tooltip so wrapped messages do not leave excessive empty space.
- The alert indicator now uses a solid red triangle with a contrasting white exclamation mark.
- Durations that exceed the expected waiting time now display in red alongside the alert indicator.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/reports/shipment-dwell-time-cell.tsx`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Fixed the select-all checkbox being clipped by the first frozen DataTable column.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Selectable DataTables now reserve a consistent frozen selection-column width, and the select-all header stays above adjacent frozen headers.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/common/data-table.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Fixed shipment-report total-time cells rendering `[object Object]` instead of their duration and over-wait alert.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shared DataTable now renders dwell-time columns from serializable row fields on the client, preserving live timers, shipment links, red over-wait alerts, search, and CSV values.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/common/data-table.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/components/reports/shipment-dwell-time-cell.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Renamed location waiting targets to expected waiting time and added live over-wait alerts to the shipment report.

### API Changes
- Location create, update, list, and detail responses now use the nullable integer `expected_waiting_time` field exclusively.
- Location lists can be sorted by `expected_waiting_time`.
- Shipment report pickup/drop-off locations expose their expected waiting times through the existing nested location resources.

### Database Changes
- Added a reversible migration that renames `locations.estimated_waiting_time` to `locations.expected_waiting_time` without changing stored null, zero, or positive values.

### Behavior Changes
- Location create/edit forms, details, DataTable sorting, and CSV exports now consistently use `Expected Waiting Time` terminology.
- Shipment report pickup and drop-off totals show a keyboard-accessible red alert when exact elapsed dwell exceeds the location's expected waiting time.
- Open visits use the current time and update once per minute; null thresholds do not alert, zero remains active, and equality does not alert.
- Duration formatting is shared across completed/live report cells and CSV output, preventing malformed 60-minute remainders.

### Breaking Changes
- The location API request, response, sort, TypeScript, and CSV field changed from `estimated_waiting_time` to `expected_waiting_time` with no compatibility alias.

### Verification
- `php artisan test tests/Feature/LocationExpectedWaitingTimeTest.php tests/Feature/LocationWaitingTimeMigrationTest.php tests/Feature/ShipmentsFullReportTest.php tests/Feature/LocationGeofenceUpdateTest.php tests/Feature/LocationIndexFiltersTest.php`
- `vendor/bin/pint --test app/Http/Requests/ListLocationsRequest.php app/Http/Requests/StoreLocationRequest.php app/Http/Requests/UpdateLocationRequest.php database/migrations/2026_08_29_000002_rename_estimated_waiting_time_to_expected_waiting_time_on_locations_table.php tests/Feature/LocationExpectedWaitingTimeTest.php tests/Feature/LocationWaitingTimeMigrationTest.php tests/Feature/ShipmentsFullReportTest.php`
- `cd website && node --test tests/dwell-time.test.mjs`
- `cd website && npm run lint -- src/app/admin/logistics/locations/page.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/components/locations/location-detail-content.tsx src/components/locations/location-dialog.tsx src/components/locations/locations-table.tsx src/components/reports/shipment-dwell-time-cell.tsx src/lib/api/locations.ts src/lib/csv-export.ts src/lib/dwell-time.ts src/lib/types.ts tests/dwell-time.test.mjs`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- Source searches confirming the old identifier remains only in the historical/rename migrations, breaking-contract tests, and release-note explanation.
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Added pickup and dropoff location dwell times to the shipment Details tab.

### API Changes
- `GET /api/v1/shipments/{shipment_uuid}` now includes optional `location_visit_intervals.pickup` and `location_visit_intervals.dropoff` values with `entered_at`, `exited_at`, `duration_seconds`, and `source_event_type`.
- Shipment details and the full shipment report now share the same resolver that prefers real `entered_location` activities matched by shipment/location or run/location, with shipment-stage activities retained as a legacy fallback.

### Database Changes
- None.

### Behavior Changes
- Every shipment Details tab now displays `Total Time at Pickup Location` and `Total Time at Dropoff Location`.
- Hovering or focusing either total shows its entry and exit timestamps; an open visit displays `In progress`, and unavailable visit data displays `-` with unavailable timestamps.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/ShipmentQuoteTest.php tests/Feature/ShipmentsFullReportTest.php`
- `vendor/bin/pint --test app/Services/ShipmentVisitIntervalService.php app/Http/Controllers/Api/V1/ShipmentController.php app/Http/Controllers/Api/V1/ReportController.php app/Http/Resources/ShipmentResource.php tests/Feature/ShipmentQuoteTest.php tests/Feature/ShipmentsFullReportTest.php`
- `cd website && npm run lint -- src/components/shipments/shipment-detail-view.tsx src/lib/types.ts`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Added reusable frozen leading columns to the shared website data table and enabled them for the shipments report.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/reports/shipments_report` now keeps its first two data columns visible while scrolling horizontally.
- Shared `DataTable` and `ExportableDataTable` usages can opt in with `stickyColumns={{ leading: number }}`; selection checkboxes are frozen automatically and do not count toward the requested data-column total.
- Frozen body cells use fully opaque default, hover, and selected backgrounds so horizontally scrolling content cannot show through them.
- The last frozen column uses a stronger directional edge shadow so scrolling columns clearly appear to pass underneath it in default, hover, and selected states.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/common/data-table.tsx src/components/common/exportable-data-table.tsx src/components/ui/table.tsx src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
- `cd website && npx tsc --noEmit`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-29 | Version: unreleased

### Summary
- Fixed shipment report pickup and drop-off dwell intervals showing identical timestamps and zero-minute durations.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now prefers recorded `entered_location` visit intervals matched by shipment/location or run/location, with shipment stage activities retained as a fallback for legacy records.
- The legacy `from_time_to` response alias remains available and continues to mirror the canonical `from_time_out` value.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/reports/shipments_report` now displays and calculates pickup and drop-off dwell times from the real geofence entry/exit interval when one was recorded.
- The pickup `From Time Out` column now reads the canonical `from_time_out` API field used by the duration calculation.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/ShipmentsFullReportTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/ReportController.php tests/Feature/ShipmentsFullReportTest.php`
- `cd website && npm run lint -- src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/lib/api/reports.ts src/lib/csv-export.ts`
- `git diff --check`

## 2026-08-04 | Version: unreleased

### Summary
- Fixed the bookings page status query filter being ignored.
- Updated the dashboard's in-transit KPI to open the filtered shipment list.

### API Changes
- Booking list requests from the website now forward the `status` query parameter to the existing bookings API.

### Database Changes
- None.

### Behavior Changes
- Visiting `/admin/logistics/shipments/bookings?status=in_transit` now lists only in-transit bookings.
- Selecting the dashboard's In-transit bookings KPI now opens `/admin/logistics/shipments?status=in_transit`.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/app/admin/page.tsx src/app/admin/logistics/shipments/bookings/page.tsx src/lib/api/bookings.ts`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-04 | Version: unreleased

### Summary
- Added password-confirmed permanent merchant deletion from the admin settings area.

### API Changes
- `DELETE /api/v1/merchants/{merchant_uuid}` now requires a `password` body field and returns the deleted merchant UUID plus the next accessible merchant.
- The endpoint returns `INVALID_PASSWORD` for incorrect credentials and `LAST_MERCHANT_REQUIRED` when no replacement merchant is available.

### Database Changes
- None.

### Behavior Changes
- Account holders can delete the selected merchant from `/admin/settings/delete-merchant` after confirming their password.
- Merchant deletion now runs every merchant data-purge category, permanently removes remaining merchant-owned records and uploaded files, preserves resources still referenced by another merchant, updates the last-accessed merchant, and refreshes the website merchant menu.
- The user's final merchant cannot be deleted, and successful deletion continues to the first remaining merchant dashboard.

### Breaking Changes
- Existing callers of `DELETE /api/v1/merchants/{merchant_uuid}` must now provide the authenticated user's password.

### Verification
- `php artisan test tests/Feature/MerchantDeletionTest.php tests/Feature/DataPurgeControllerTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/MerchantController.php app/Http/Requests/DeleteMerchantRequest.php app/Jobs/DeleteMerchantFilesJob.php app/Services/DataPurgeService.php app/Services/MerchantService.php tests/Feature/MerchantDeletionTest.php`
- `cd website && npm run lint -- src/app/admin/settings/delete-merchant/page.tsx src/components/settings/delete-merchant-manager.tsx src/components/layout/admin-shell.tsx src/components/layout/admin-nav.tsx src/lib/api/merchants.ts src/lib/auth.ts src/lib/navigation.ts src/lib/routes/admin.ts`
- `cd website && npm run build`
- `git diff --check`

## 2026-08-04 | Version: unreleased

### Summary
- Added an idempotent seeder for the standard vehicle, driver, and shipment file types used by every merchant.

### API Changes
- None.

### Database Changes
- Added `MerchantFileTypeSeeder` to insert 16 default merchant-scoped file types without changing existing merchant configurations.

### Behavior Changes
- Running `MerchantFileTypeSeeder`, directly or through `DatabaseSeeder`, adds any missing standard file types to every non-deleted merchant.
- Existing file types, including soft-deleted records, are treated as existing and are not duplicated, restored, or overwritten.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/MerchantFileTypeSeederTest.php`
- `vendor/bin/pint --test database/seeders/MerchantFileTypeSeeder.php tests/Feature/MerchantFileTypeSeederTest.php`
- `php -l database/seeders/DatabaseSeeder.php`
- `git diff --check`

## 2026-08-03 | Version: unreleased

### Summary
- Added bulk deletion for selected vehicles in the admin logistics vehicle list.

### API Changes
- Added `DELETE /api/v1/vehicles/bulk` to atomically delete a merchant-scoped list of vehicle UUIDs.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/vehicles` now shows a destructive `Delete selected` action after one or more vehicles are selected.
- Bulk deletion requires confirmation, supports all filtered-result selection, records the existing vehicle deletion activity for every vehicle, and leaves all vehicles untouched if any submitted vehicle is outside the authorized merchant scope.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/VehicleBulkDeleteTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/VehicleController.php app/Http/Requests/BulkDeleteVehiclesRequest.php app/Services/VehicleService.php tests/Feature/VehicleBulkDeleteTest.php`
- `cd website && npm run lint -- src/components/vehicles/vehicles-table.tsx src/lib/api/vehicles.ts`
- `cd website && npm run build` (passes with pre-existing unused-variable warnings in unrelated files)
- `git diff --check`

## 2026-08-03 | Version: unreleased

### Summary
- Fixed merchant data purges failing to remove unassigned vehicles.

### API Changes
- `POST /api/v1/merchants/{merchant_uuid}/purge-data` now discovers vehicles from their direct merchant ownership in addition to run, merchant-driver, and carrier-driver associations.

### Database Changes
- None.

### Behavior Changes
- Purging the `vehicles` data type now permanently deletes vehicles whose `merchant_id` matches the selected merchant, even when they have no run or driver assignment.
- Vehicles owned by other merchants remain protected.

### Breaking Changes
- None.

### Verification
- `/opt/homebrew/bin/php artisan test tests/Feature/DataPurgeControllerTest.php`
- `/opt/homebrew/bin/php vendor/bin/pint --test app/Services/DataPurgeService.php tests/Feature/DataPurgeControllerTest.php`
- `git diff --check`

## 2026-07-27 | Version: unreleased

### Summary
- Standardized data-table overflow scrolling with the shadcn Scroll Area component.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shared data tables now use styled shadcn horizontal scrollbars instead of native overflow containers.
- Fixed-height integration import tables and the Vehicles Daily KPI report now use shadcn Scroll Areas for vertical and horizontal scrolling.
- API documentation parameter tables use the same styled horizontal scrollbar behavior.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/ui/table.tsx src/components/ui/scroll-area.tsx src/components/common/data-table.tsx src/components/integrations/tracking-provider-vehicle-import-table.tsx src/components/integrations/tracking-provider-location-import-table.tsx src/components/integrations/tracking-provider-driver-import-table.tsx src/components/docs/params-table.tsx src/app/admin/logistics/analytics/vehicles-daily-kpi/vehicles-daily-kpi-report.tsx src/app/admin/logistics/shipments/runs/[runId]/page.tsx`
- `cd website && npm run build`
- `git diff --check`

## 2026-07-27 | Version: unreleased

### Summary
- Reduced vehicle-location tracking failures caused by concurrent geofence lifecycle updates.

### API Changes
- None.

### Database Changes
- Added a composite `vehicle_activity` index for open location-visit lookups by merchant, vehicle, event type, exit state, and entry time.

### Behavior Changes
- Geofence lifecycle transactions now retry MySQL deadlock victims up to five times before failing the tracking job.
- Open-visit row locks use a narrower indexed lookup to reduce lock contention.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php tests/Feature/TrackVehicleLocationsJobTest.php`
- `vendor/bin/pint --test app/Services/AutoRunLifecycleService.php database/migrations/2026_07_27_000001_add_open_visit_lookup_index_to_vehicle_activity_table.php`
- `git diff --check`

## 2026-07-27 | Version: unreleased

### Summary
- Improved the visibility of vehicle markers on the dashboard's Vehicles in transit map.
- Added richer vehicle marker details and moved shipment detail viewing into a drawer.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Vehicles in transit map now uses a greyscale basemap with larger orange markers and a darker outline for stronger contrast.
- Vehicle marker popups now show the vehicle, shipment status, driver, route, speed, and last update when available.
- The popup's View shipment action opens shipment details in a right-side drawer without leaving the dashboard.

### Breaking Changes
- None.

### Verification
- `cd website && npm run lint -- src/components/dashboard/mapped-bookings-map-card.tsx src/components/dashboard/shipment-map-dialog.tsx`
- `cd website && npm run build`
- `git diff --check`

## 2026-07-27 | Version: unreleased

### Summary
- Fixed admin sessions being signed out when access-token refresh requests overlapped after a period of inactivity.

### API Changes
- Login and refresh responses now include `expires_in: 3600`, and newly issued admin access tokens expire after the matching one-hour lifetime.

### Database Changes
- None.

### Behavior Changes
- Concurrent NextAuth session checks now share and briefly cache one rotated-token result instead of consuming the same single-use refresh token multiple times.
- Browser retries use a token already refreshed by NextAuth instead of retrying with the revoked browser copy.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AuthTest.php`
- `vendor/bin/pint --test app/Services/AuthService.php app/Http/Controllers/Api/V1/AuthController.php tests/Feature/AuthTest.php`
- `cd website && npm run lint -- src/lib/nextauth.ts src/lib/api/client.ts`
- `cd website && npm run build`
- `git diff --check`

## 2026-07-27 | Version: unreleased

### Summary
- Added searchable Runs index and read-only run detail pages for operational, route, shipment, driver, vehicle, and safety review.

### API Changes
- Extended `GET /api/v1/runs` with additive `status`, `from`, and `to` filters.
- Enriched run responses with GPS/odometer distance and source, detailed driver and vehicle fields, shipment locations, actual track points and stops, operational stats, and speeding safety metrics.

### Database Changes
- None.

### Behavior Changes
- Admins can open `/admin/logistics/shipments/runs` from the Shipments menu and review all run statuses by default.
- Run details plot the recorded GPS trail and actual stop events, distinguish odometer and GPS-derived distance, and show missing telemetry as unavailable rather than zero.
- Run origin and destination fall back to the first attached shipment pickup and last attached shipment drop-off when explicit run endpoints are absent.
- Completed run duration now uses the absolute elapsed time between start and completion timestamps.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/RunApiTest.php`
- `vendor/bin/pint --test app/Services/RunService.php app/Http/Resources/RunResource.php tests/Feature/RunApiTest.php`
- `npm run lint -- src/app/admin/logistics/shipments/runs/page.tsx src/app/admin/logistics/shipments/runs/[runId]/page.tsx src/components/runs/run-actual-map.tsx src/lib/api/runs.ts src/lib/routes/admin.ts src/lib/navigation.ts src/lib/types.ts`
- `npm run build`
- `git diff --check`

## 2026-07-27 | Version: unreleased

### Summary
- Added daily distance and operating-time totals to the Vehicles Daily KPI report.

### API Changes
- `GET /api/v1/reports/vehicles-daily-kpi` now includes `total_km_travelled` and `total_operating_hours` for each vehicle/day.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/vehicles-daily-kpi` now displays total kilometres travelled and total operating hours, calculated from completed runs with the required odometer or timestamp readings.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/VehiclesDailyKpiReportTest.php`
- `vendor/bin/pint --test app/Services/VehiclesDailyKpiReportService.php tests/Feature/VehiclesDailyKpiReportTest.php`
- `cd website && npm run lint -- src/app/admin/logistics/analytics/vehicles-daily-kpi/vehicles-daily-kpi-report.tsx src/lib/api/reports.ts`
- `git diff --check`

## 2026-07-24 | Version: unreleased

### Summary
- Added the Vehicles Daily KPI analytics report with per-vehicle, per-day operational metrics.

### API Changes
- Added `GET /api/v1/reports/vehicles-daily-kpi` with merchant, year, month, and data-only filters.
- Added `GET /api/v1/reports/vehicles-daily-kpi/entries` for paginated vehicle/day KPI drill-down records.
- The response includes daily speeding, run, shipment, known-location stop, unknown-location stop, and invoiced-shipment counts plus month metadata and available years.

### Database Changes
- None.

### Behavior Changes
- Admins can open `/admin/logistics/analytics/vehicles-daily-kpi` from the Analytics menu, select any non-future month, and optionally hide vehicles with no data.
- The report includes all non-deleted vehicles and leaves zero-value table cells blank.
- The data-only filter accepts boolean query values serialized as either `1`/`0` or `true`/`false`.
- The frozen vehicle and KPI columns gain an edge shadow while the daily columns are horizontally scrolled.
- Non-zero KPI values open an on-demand modal showing the exact activities, runs, or shipments behind the count.
- Replaced `total_stops` with `known_location_stops`, displayed as “Stops at known Locations” and counting saved-location arrivals from linked `entered_location` activities while unknown stops remain unlinked stopped telemetry events.
- KPI drill-down entries now show location names in a dedicated column, including names from soft-deleted historical locations.
- Known-location stops now require the activity's `location_id` to resolve to an existing location record, including soft-deleted historical records.
- Unknown-location stop drill-down entries now show latitude and longitude as links that open the position in Google Maps in a new tab.
- Known-location names in the KPI drill-down now open the existing location information dialog without leaving the report.
- The shipment tracking map and stop activity timeline are capped at 480px high, with long activity timelines using the shadcn Scroll Area component.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/VehiclesDailyKpiReportTest.php`
- `vendor/bin/pint --test app/Http/Controllers/Api/V1/ReportController.php app/Http/Requests/VehiclesDailyKpiReportRequest.php app/Services/VehiclesDailyKpiReportService.php tests/Feature/VehiclesDailyKpiReportTest.php`
- `npm run lint -- src/app/admin/logistics/analytics/vehicles-daily-kpi/page.tsx src/app/admin/logistics/analytics/vehicles-daily-kpi/vehicles-daily-kpi-report.tsx src/lib/api/reports.ts src/lib/routes/admin.ts src/lib/navigation.ts`
- `npm run build`
- `git diff --check`

## 2026-07-24 | Version: unreleased

### Summary
- Replaced the dashboard Live bookings map with a Vehicles in transit map.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The dashboard map now loads vehicles from `GET /api/v1/vehicles/latest-activity-check` and only displays vehicles whose monitoring status is `in_transit`.
- The map reports both total in-transit vehicles and how many have coordinates, and shipment-linked markers continue to open shipment details.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/dashboard/mapped-bookings-map-card.tsx src/components/dashboard/live-bookings-map-section.tsx src/lib/api/vehicle-activities.ts`
- `npm run build`
- `git diff --check`

## 2026-07-24 | Version: unreleased

### Summary
- Aligned the fleet-status report and dashboard chart with location-transition monitoring states.

### API Changes
- `GET /api/v1/reports/fleet_status` now returns `at_location`, `in_transit`, `standby`, and `unknown` counts using the same 48-hour transition rules as shipment monitoring.
- `active` remains available as a compatibility alias for `in_transit`; `maintenance` remains an operational count and may overlap physical monitoring states.

### Database Changes
- None.

### Behavior Changes
- The Fleet status chart now displays the four mutually exclusive physical monitoring states instead of run-derived active and standby counts.

### Breaking Changes
- The meaning of `standby` now reflects a continuous location dwell of at least 48 hours.

### Verification
- `php artisan test tests/Feature/VehicleServiceTest.php tests/Feature/VehicleLatestActivityCheckTest.php`
- `vendor/bin/pint --test app/Services/VehicleService.php tests/Feature/VehicleServiceTest.php`
- `npm run lint -- src/components/reports/fleet-status-chart.tsx src/lib/api/reports.ts`
- `npm run build`
- `git diff --check`

## 2026-07-24 | Version: unreleased

### Summary
- Replaced shipment-monitoring vehicle placement with time-based location-transition classification.

### API Changes
- Added an additive `monitoring` object to `GET /api/v1/vehicles/latest-activity-check` with the resolved status, state timestamp, current or last location, and source transition details.
- Existing latest activity and `vehicle.fleet_status` fields remain available for compatibility.

### Database Changes
- None.

### Behavior Changes
- Vehicles remain at their entered location for less than 48 hours and move to Standby vehicles at 48 hours.
- Vehicles remain in transit after exiting a location until a later location entry, regardless of run status or transit age.
- Vehicles without location-transition history appear under Unknown location vehicles.
- Unrelated activity events no longer override the vehicle's physical monitoring placement.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/VehicleLatestActivityCheckTest.php`
- `vendor/bin/pint --test app/Services/VehicleActivityService.php app/Http/Resources/VehicleLatestActivityCheckResource.php tests/Feature/VehicleLatestActivityCheckTest.php`
- `npm run lint -- src/app/admin/logistics/shipments/monitoring/page.tsx src/app/admin/logistics/shipments/monitoring/types.ts src/app/admin/logistics/shipments/monitoring/components/activity-scene.tsx src/components/vehicles/vehicle-location-map.tsx src/lib/types.ts`
- `npm run build`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Expanded the shipment information shown in truck details on shipment monitoring.
- Added the vehicle's last known position map to truck details.
- Fixed active-run vehicles missing from the Vehicles in transit section.
- Hid empty vehicle-status sections from shipment monitoring.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Truck details now show the shipment's pickup location, destination, creation time, and delivery time when delivered.
- Shipment pickup and destination names open their corresponding location details when location IDs are available.
- Truck details now show a compact Google map when the latest vehicle activity has coordinates, or an unavailable message when it does not.
- Vehicles with an active run are now shown in Vehicles in transit whenever their latest state does not place them inside a location, including when the separate activity feed omits them or has sparse location data.
- Vehicles in transit, Unknown location vehicles, and Standby vehicles sections now appear only while their respective section contains at least one vehicle.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/app/admin/logistics/shipments/monitoring/page.tsx src/app/admin/logistics/shipments/monitoring/types.ts src/app/admin/logistics/shipments/monitoring/components/activity-scene.tsx src/components/vehicles/vehicle-location-map.tsx`
- `npm run build`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Fixed shipment monitoring placement for standby-classified vehicles that are currently inside a location.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- A vehicle whose latest activity places it inside a location is now shown at that location even when its fleet status is `standby`.
- Standby placement continues to apply when the latest activity does not identify the vehicle as being inside a location.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/app/admin/logistics/shipments/monitoring/page.tsx`
- `npm run build`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Fixed Autorun delivery when location automation replaces the active run before exit.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Exit delivery now follows the shipment's actual run assignment for the exiting truck, even when that run was completed and the visit was subsequently linked to a newly started run.
- Shipment Delivery and Shipment Ended activities retain the shipment's actual run ID, and unrelated vehicle shipments remain untouched.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Corrected Autorun shipment-delivery activity timing.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment creation and collection remain entry events, while `Shipment Delivery` is now created only on a qualifying location exit and timestamped at that exit.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Restored first-exit delivery for qualifying Autorun shipments.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- A shipment may now be delivered on the exit from the visit in which it was created, provided the exit matches its drop-off, pickup differs from drop-off, and it belongs to the truck's exact run.
- Delivery attempt activity is recorded when the shipment is created and closed by the qualifying exit.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Added shipment creation and delivery timestamps to truck activity cards.

### API Changes
- Vehicle activity shipment summaries now include `created_at` and the associated booking's `delivered_at` timestamp.

### Database Changes
- None.

### Behavior Changes
- Truck activity shipment details show second-level creation and delivery times, with explicit fallbacks for missing timestamps and undelivered shipments.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Unit/VehicleActivityResourceTest.php`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Added manual location exit processing to the Autorun lifecycle test tool.

### API Changes
- `POST /api/v1/admin/tools/autorun-test` now requires an `action` of `enter` or `exit`.
- Exit responses omit simulated coordinates and reject trucks without an active visit at the selected location.

### Database Changes
- None.

### Behavior Changes
- Admins can choose Enter location or Exit location; exits deterministically close the selected active visit and run the same exit automation, shipment, and activity behavior as tracked geofence exits.

### Breaking Changes
- Clients of the Autorun test endpoint must provide the new `action` field.

### Verification
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Prevented auto-created shipments from being delivered during the same location visit in which they were created.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Autorun now records collection at shipment creation but defers the delivery attempt until a later visit to the drop-off on the same vehicle run.
- Exiting the creation visit leaves shipment, booking, and run-shipment state unchanged; a later qualifying exit completes them without affecting shipments assigned to another vehicle run.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Changed the Autorun test tool's third column to show merchant-wide truck activity.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The `All truck activity` timeline is no longer filtered by the selected location; its View All link retains the selected merchant filter.
- Location detail usages of the shared timeline remain location-scoped.

### Breaking Changes
- None.

### Verification
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Prevented Autorun from creating or completing same-location runs and shipments.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Autorun no longer creates a shipment when its pickup and drop-off would be the same location, and existing invalid same-location shipments are not marked delivered or otherwise updated on exit.
- Returning to the origin of an active run now reuses that run even when it has shipments; it is not ended and replaced with a run whose origin and destination match.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Added shipment origin and destination details to location truck activity cards.

### API Changes
- Vehicle activity shipment summaries now include pickup and drop-off location identifiers and labels.

### Database Changes
- None.

### Behavior Changes
- Shipment activity shown in the Autorun tool now displays linked `From` and `To` locations beneath the shipment reference.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Unit/VehicleActivityResourceTest.php`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Added effective location-type automatic actions to the Autorun lifecycle test form.

### API Changes
- None; the tool uses the existing merchant location-automation endpoint.

### Database Changes
- None.

### Behavior Changes
- Selecting a typed location now shows its entry and exit actions, condition counts, configured-versus-fallback source, and whether merchant automation is disabled.

### Breaking Changes
- None.

### Verification
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Added the selected location type to the Autorun lifecycle test form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Selecting a location now displays its assigned location type directly below the dropdown, with a `Not assigned` fallback.

### Breaking Changes
- None.

### Verification
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Extended the Autorun lifecycle test tool to normal merchant admins.

### API Changes
- `POST /api/v1/admin/tools/autorun-test` now accepts both `user` and `super_admin` roles while enforcing account-level merchant access.

### Database Changes
- None.

### Behavior Changes
- Normal admins can now see and use `/admin/tools/autoruntest` for their selected merchant; cross-account execution remains forbidden.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-23 | Version: unreleased

### Summary
- Added a super-admin Autorun lifecycle test tool for manually processing a truck at a selected merchant location.

### API Changes
- Added `POST /api/v1/admin/tools/autorun-test` with merchant, vehicle, and location UUID validation and post-run diagnostics.

### Database Changes
- None.

### Behavior Changes
- Super admins can confirm and run the real Autorun lifecycle from `/admin/tools/autoruntest`, then inspect refreshed truck and location activity timelines.
- Point coordinates or a polygon center are passed through the normal geofence resolver; overlapping-location mismatches are reported rather than bypassed.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/AdminAutorunTestControllerTest.php`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-22 | Version: unreleased

### Summary
- Added merchant-scoped pickup/drop-off location selection and parcel-type presets to AI delivery-note review.

### API Changes
- Delivery-note confirmation now accepts `pickup_location_id` and `dropoff_location_id` while retaining address payload compatibility for existing clients.
- Selected locations are validated through the existing shipment merchant/environment location rules.

### Database Changes
- None.

### Behavior Changes
- Delivery-note review loads searchable run-merchant locations, exactly matches AI-extracted addresses when unambiguous, and requires both locations before confirmation.
- Unmatched AI addresses prefill the existing Create Location drawer; a created location is immediately selected without clearing review data.
- Line-item types now use Box, Pallet, Envelope, Bag, Crate, Drum, or Other; unknown AI values remain editable under Other.

### Breaking Changes
- None.

### Verification
- `php artisan test tests/Feature/DeliveryNoteImportTest.php`
- `npx tsc --noEmit` in `website`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-21 | Version: unreleased

### Summary
- Added selected-row CSV exports to vehicles, locations, shipments, drivers, shipment reports, routes, and vehicle activities.

### API Changes
- Driver list resources now include `vehicle_type_id` so driver CSV files match the existing import contract.
- No export endpoint was added; exports use the existing scoped and paginated list/report APIs.

### Database Changes
- None.

### Behavior Changes
- Logistics tables now support checkbox selection and direct CSV downloads for visible selections and all filtered records across pagination.
- Shipment parcels and route stops export as individual rows with repeated parent data; parents without children still produce one row.
- Driver CSV columns are import-compatible and leave `password` blank, preventing credential data from being exposed or existing passwords from being overwritten.
- Exporting preserves the current selection and reports loading, success, and API errors in the interface.

### Breaking Changes
- None.

### Verification
- `npm run build` in `website`
- `php artisan test tests/Feature/DriverIndexTest.php` (passes)
- `tests/Feature/DriverCsvImportTest.php` attempted; existing test setup fails before import execution because its user factory omits the database-required UUID.
- `php -l app/Http/Resources/DriverResource.php`
- `git diff --check`

## 2026-07-21 | Version: unreleased

### Summary
- Enabled delivery-note uploads and shipment creation for runs that are already in progress.

### API Changes
- Delivery-note analyze and confirm endpoints now accept in-progress runs.

### Database Changes
- None.

### Behavior Changes
- The tracking-page Upload Delivery Note action remains enabled for draft, dispatched, and in-progress runs.
- Shipments created from a delivery note on an in-progress run are attached with an active run-shipment status.

### Breaking Changes
- None.

### Verification
- php artisan test tests/Feature/DeliveryNoteImportTest.php
- npm run build in website
- git diff --check

## 2026-07-20 | Version: unreleased

### Summary
- Added AI-assisted delivery-note imports to run tracking with editable shipment and parcel review.

### API Changes
- Added `POST /api/v1/runs/{run_id}/delivery-note-imports` for PDF/image extraction.
- Added `POST /api/v1/runs/{run_id}/delivery-note-imports/{import_id}/confirm` for atomic shipment creation and run attachment.
- Added `GET /api/v1/runs/{run_id}/delivery-note-imports/{import_id}/download`.
- Run and shipment resources now expose their linked delivery-note imports.

### Database Changes
- Added `delivery_note_imports` and `delivery_note_import_shipments` for one-file run storage and shipment associations.

### Behavior Changes
- Run actions now open a delivery-note drawer supporting separate-shipment and single-shipment parcel grouping modes.
- AI results remain editable drafts until confirmation; confirmed imports disable automatic delivery offers and attach shipments to the selected mutable run.

### Breaking Changes
- None.

### Verification
- `php -l` for the delivery-note import service, controller, requests, models, resources, and migration.
- `php artisan test tests/Unit/OpenAIServiceTest.php`
- `php artisan test tests/Feature/DeliveryNoteImportTest.php`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-20 | Version: unreleased

### Summary
- Corrected boolean filtering for the merchant location-types API.
- Fixed the location-type dropdown when creating a location for a merchant still using fallback defaults.

### API Changes
- `GET /api/v1/location-types` now interprets `collection_point=false` and `default=false` as false instead of treating the non-empty query strings as true.

### Database Changes
- None.

### Behavior Changes
- Location-type list filters now return records matching the requested boolean value.
- Fallback API coverage now verifies the configured pickup, dropoff, and service delivery flags.
- Opening the create/edit location drawer now persists API fallback location types before populating the dropdown, ensuring every option has a valid `location_type_id`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/LocationTypeService.php`
- `php -l tests/Feature/LocationTypeFallbackTest.php`
- `php artisan test --filter=LocationTypeFallbackTest`
- `npm run build` in `website`
- `git diff --check`

## 2026-07-17 | Version: unreleased

### Summary
- Added a dedicated standby-vehicle section to the admin shipment monitoring scene.

### API Changes
- `GET /api/v1/vehicles/latest-activity-check` now returns `vehicle.fleet_status` as `active`, `maintenance`, or `standby`.

### Database Changes
- None.

### Behavior Changes
- Standby uses the fleet-summary definition: the vehicle has no qualifying active run and is not in maintenance.
- Standby vehicles are shown only in their dedicated parking section and participate in search, selection, camera framing, and vehicle totals.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/VehicleActivityService.php`
- `php -l app/Http/Resources/VehicleLatestActivityCheckResource.php`
- `php -l tests/Feature/VehicleLatestActivityCheckTest.php`
- `git diff --check`
- `php artisan test tests/Feature/VehicleLatestActivityCheckTest.php` (blocked by the existing SQLite test schema requiring `users.uuid` while the user factory does not populate it)
- `npm run build` in `website` (passes with existing unrelated lint warnings)

## 2026-07-17 | Version: unreleased

### Summary
- Updated the admin shipments table to show pickup and dropoff location names instead of formatted street addresses.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The `From` and `To` columns on `/admin/logistics/shipments` now display the location name, or `-` when no name is available.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/app/admin/logistics/shipments/page.tsx` (could not run: website dependencies are not installed and `eslint` is unavailable)

## 2026-07-07 | Version: unreleased

### Summary
- Enabled native Google Maps layer controls on the admin location geofence editor.
- Enabled native Google Maps layer controls on individual admin location detail geofence maps.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations/geofence` now shows Google's built-in `Map` and `Satellite` buttons while editing geofences.
- `/admin/logistics/locations/{location_id}` geofence maps now show Google's built-in `Map` and `Satellite` buttons.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/locations/locations-geofence-page-content.tsx src/components/locations/location-geofence.tsx` (passes with existing unused-code warnings in `location-geofence.tsx`)

## 2026-06-23 | Version: unreleased

### Summary
- Fixed internal booking odometer backfills so `Shipment KM` can calculate when delivery odometers arrive later.

### API Changes
- `GET /api/v1/shipments` and `GET /api/v1/bookings` can now surface `booking.total_km_from_collection` for backfilled internal bookings that previously missed the collection odometer.

### Database Changes
- None.

### Behavior Changes
- Auto/internal booking creation now stores the collection odometer when it is known, even if the related run is no longer in progress.
- Existing internal bookings with a missing collection odometer are updated when the lifecycle service is called with a known collection odometer.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/InternalBookingLifecycleService.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php --filter=internal_booking_backfill_keeps_collection_odometer_for_shipment_km`

## 2026-06-22 | Version: unreleased

### Summary
- Replaced shipment pickup/dropoff address entry with merchant-scoped system location comboboxes.
- Added inline location creation from shipment location pickers and auto-selects the saved location.
- Added shipment API support for selecting existing pickup/dropoff locations by UUID.
- Fixed location combobox result lists so they scroll inside shipment dialogs.
- Replaced the shipment quote/create/edit modal dialog with a bottom drawer.
- Updated the shipment drawer to open from the right, using half-screen width on large displays and full-screen width on small displays.
- Replaced the location create/edit modal dialog with the same responsive right-side drawer layout.
- Added desktop spacing and rounded corners to right-side drawers while keeping mobile drawers full-screen.
- Removed the border from right-side drawers for a flatter panel style.
- Added run odometer tracking for start and completion readings.
- Added driver pickup and delivery odometer capture for shipment bookings.
- Added monotonic vehicle odometer sync from accepted run and shipment readings.
- Added shipment kilometre totals to admin shipment and booking data tables.
- Fixed website production build type errors in route stop location selection and shipment edit address fallbacks.
- Added booking odometer updates for auto-created/auto-updated shipments from vehicle location geofence events.
- Fixed admin shipment list truck registration values for shipments whose vehicle is available from the latest activity instead of an active current run.
- Fixed admin shipment list driver values for shipments whose driver is available from the latest activity instead of an active current run.

### API Changes
- `POST /api/v1/shipments` now accepts optional `pickup_location_id` and `dropoff_location_id` fields instead of requiring address objects.
- `PATCH /api/v1/shipments/{shipment_id}` now accepts optional `pickup_location_id` and `dropoff_location_id` fields.
- Existing `pickup_address` and `dropoff_address` payloads remain supported.
- Shipment and quote parcel payloads support the existing optional `parcels.*.type` field.
- `POST /api/v1/runs/{run_id}/start` now accepts optional `odometer_start_km`.
- `POST /api/v1/runs/{run_id}/complete` now accepts optional `odometer_end_km` and rejects values lower than the run start odometer.
- `GET /api/v1/runs` and `GET /api/v1/runs/{run_id}` responses now include `duration_seconds`, `odometer_start_km`, `odometer_end_km`, and `odometer_distance_km`.
- Shipment resources now include compact booking odometer fields when booking data is loaded.
- `PATCH /api/v1/driver/shipments/{shipment_id}/status` now accepts `odometer_at_collection` and `odometer_at_delivery`; driver pickup/delivery completion requires the relevant odometer reading.
- `POST /api/v1/driver/shipments/{shipment_id}/scan` now accepts `odometer_at_collection` for final pickup scan completion.
- `POST /api/v1/driver/shipments/{shipment_id}/pod` now accepts optional `odometer_at_delivery` for delivery odometer backfill.
- `GET /api/v1/reports/shipments_full_report` rows now include shipment pickup/delivery odometers, shipment kilometres from collection, and latest run odometer/duration fields.
- `GET /api/v1/shipments` shipment resources now fall back to the latest vehicle activity vehicle when no current run vehicle is available.
- `GET /api/v1/shipments` shipment resources now fall back to the latest vehicle activity run driver, then the activity vehicle's last driver, when no current run driver is available.

### Database Changes
- Added nullable `odometer_start_km` and `odometer_end_km` columns to `runs`.
- Existing booking odometer columns are now populated by driver pickup, delivery, scan, and POD flows.
- Auto-created internal bookings now fill `odometer_at_request` and `odometer_at_collection` from the run start reading, and `odometer_at_delivery` from the delivery geofence exit reading when provided.
- Fresh shipment and shipment parcel migrations now match current runtime behavior for `in_transit`/`offer_failed` shipment statuses and nullable auto-created parcel measurements.

### Behavior Changes
- Creating or editing shipments from the admin UI now searches existing merchant locations instead of Google Places addresses.
- Adding a location from a shipment picker selects the new location immediately after save.
- Shipment create/update now reuses selected location records rather than duplicating address-only locations.
- Shipment and quote parcel creation now tolerates either `weight` or legacy `weight_kg` parcel columns and keeps optional parcel `type` values.
- Location combobox result lists now keep wheel/touch scrolling inside the popover instead of bubbling to the surrounding dialog.
- Shipment quote/create/edit forms now open in a drawer with an internal scroll area and fixed footer actions.
- Shipment quote/create/edit drawers now use a responsive right-side layout.
- Location create/edit forms now open in a responsive right-side drawer.
- Right-side drawers now have top, bottom, and right margins on non-mobile viewports.
- Right-side drawers no longer render a panel border.
- Drivers must provide pickup odometer readings when completing pickup through status updates or final parcel scans.
- Drivers must provide delivery odometer readings when marking shipments delivered.
- Shipment booking `total_km_from_collection` is calculated when pickup and delivery odometer readings are available.
- Vehicle odometer values are updated only when a submitted run or shipment odometer is higher than the current vehicle odometer.
- Automated run lifecycle events use provider odometer readings for run start/end when available.
- Automated vehicle-location shipment lifecycle events use provider odometer readings for booking request, collection, delivery, shipment distance, and vehicle odometer sync when available.
- Admin run tracking and shipment reports now surface odometer and distance fields.
- Admin shipments, invoiced shipments, and bookings tables now show `Shipment KM` from booking collection-to-delivery totals.
- `/admin/logistics/shipments` now shows the truck registration from the latest shipment vehicle activity when a shipment no longer has an active current run assignment.
- `/admin/logistics/shipments` now shows the driver from the latest shipment vehicle activity when a shipment no longer has an active current run assignment.
- Route stop selection and shipment edit dialogs now normalize existing location values to the current location picker contract.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l app/Services/ShipmentService.php`
- `php -l app/Services/ShipmentParcelService.php`
- `php -l app/Services/QuoteService.php`
- `php -l app/Models/ShipmentParcel.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`
- `php artisan test tests/Feature/ShipmentQuoteTest.php`
- `npm run lint -- src/components/locations/location-combobox.tsx src/components/locations/location-dialog.tsx src/components/shipments/shipment-quote-dialog.tsx src/app/admin/logistics/shipments/page.tsx src/app/admin/logistics/shipments/quotes/page.tsx src/components/shipments/shipment-detail-content.tsx src/components/dashboard/shipment-dialog-content.tsx src/lib/api/locations.ts src/lib/api/shipments.ts src/lib/types.ts`
- `npm run lint -- src/components/locations/location-combobox.tsx`
- `npm run lint -- src/components/ui/drawer.tsx src/components/shipments/shipment-quote-dialog.tsx`
- `npm run lint -- src/components/locations/location-dialog.tsx`
- `npm run lint -- src/components/ui/drawer.tsx`
- `php -l database/migrations/2026_06_22_000001_add_odometer_fields_to_runs_table.php`
- `php -l app/Services/VehicleOdometerService.php`
- `php -l app/Services/RunService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/InternalBookingLifecycleService.php`
- `php -l database/migrations/2025_01_01_000040_create_shipments_table.php`
- `php -l database/migrations/2025_01_01_000050_create_shipment_parcels_table.php`
- `php -l app/Http/Controllers/Api/V1/RunController.php`
- `php -l app/Http/Controllers/Api/V1/DriverShipmentController.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l app/Http/Resources/RunResource.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`
- `php artisan test tests/Feature/ShipmentQuoteTest.php --filter=latest_activity_vehicle_and_driver`
- `php artisan test tests/Feature/ShipmentQuoteTest.php`
- `php -l app/Http/Requests/DriverStatusUpdateRequest.php`
- `php -l app/Http/Requests/DriverScanRequest.php`
- `php -l app/Http/Requests/DriverPodRequest.php`
- `php -l tests/Feature/RunApiTest.php`
- `php -l tests/Feature/DriverShipmentApiTest.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php -l app/Services/ShipmentService.php`
- `php artisan test tests/Feature/RunApiTest.php tests/Feature/DriverShipmentApiTest.php`
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/RunApiTest.php tests/Feature/DriverShipmentApiTest.php tests/Feature/AutoRunLifecycleServiceTest.php`
- `npm run lint -- src/app/admin/logistics/shipments/reports/shipments_report/page.tsx src/components/tracking/runs-tracking-view.tsx src/lib/api/reports.ts src/lib/types.ts`
- `npm run lint -- src/app/admin/logistics/shipments/page.tsx src/app/admin/logistics/shipments/invoiced/page.tsx src/app/admin/logistics/shipments/bookings/page.tsx src/lib/types.ts`
- `npm run build` (website; passes with existing unused-variable warnings)
- `npm run lint -- 'app/shipments/[shipment_id].tsx' 'app/shipments/[shipment_id]/scan.tsx' src/lib/api.ts` (blocked locally: legacy Expo CLI does not accept forwarded file args and attempted to write `/Users/leroygwirize/.expo/state.json.*`)
- `npx eslint 'app/shipments/[shipment_id].tsx' 'app/shipments/[shipment_id]/scan.tsx' src/lib/api.ts` (blocked locally: mobile dependencies are not installed and `npx` could not reach `registry.npmjs.org`)

## 2026-06-22 | Version: unreleased

### Summary
- Reverted the manual run completion change from commit `3b1f4700a5e024c116dd27bc53680eeda2337234`.

### API Changes
- Existing `GET /api/v1/shipments/{shipment_id}` and `GET /api/v1/runs/{run_id}` responses no longer include automatically generated `run_ended` vehicle activity stops from manual run completion.

### Database Changes
- None.

### Behavior Changes
- Completing a run manually no longer creates `run_ended` vehicle activity rows for active run shipments.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RunService.php`
- `php -l tests/Feature/RunApiTest.php`
- `php artisan test tests/Feature/RunApiTest.php --filter=run` (blocked locally: PHP 8.1.34 installed, dependencies require PHP >= 8.4.0)

## 2026-06-19 | Version: unreleased

### Summary
- Added location type visibility and filtering to the admin vehicle activities table.
- Fixed vehicle activity location links to open the linked location record.
- Removed the Activity ID and Merchant columns from the admin vehicle activities table.

### API Changes
- Extended `GET /api/v1/vehicle-activities` with an optional `location_type_id` query filter.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/vehicles/activities` now shows each activity location's type when available.
- `/admin/logistics/vehicles/activities` no longer shows Activity ID or Merchant columns.
- Admins can filter vehicle activities by location type; merchant-scoped views use location type dropdown options, while views without a selected merchant can filter by location type ID.
- Clicking a location on the admin vehicle activities table now navigates to that location's detail page.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ListVehicleActivitiesRequest.php`
- `php -l app/Services/VehicleActivityService.php`
- `npm run lint -- src/app/admin/logistics/vehicles/activities/page.tsx src/lib/api/vehicle-activities.ts`

## 2026-06-10 | Version: unreleased

### Summary
- Added exception details to the generic vehicle location tracking failure activity log.
- Added a provider response-body fallback for empty tracking exception messages.
- Added provider response-body logging for Powerfleet organisation lookup failures.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Vehicle location tracking jobs now include `exception_message` on the final `failed` activity log entry when an exception aborts the job.
- HTTP provider failures on that same entry also include response status, headers, and body metadata.
- HTTP provider failures with empty provider `Message` payloads now show the raw response body in `exception_message`.
- Powerfleet organisation, subgroup, and organisation detail failures now log and return the raw HTTP response body when the provider sends an empty `Message` payload.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Jobs/TrackVehicleLocationsJob.php`
- `php -l tests/Feature/PowerfleetOrganisationToolsTest.php`
- `php -l tests/Feature/TrackVehicleLocationsJobTest.php`
- `php artisan test tests/Feature/PowerfleetOrganisationToolsTest.php --filter=powerfleet_organisation_failures_show_empty_provider_message_response_body`
- `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php --filter=logs_full_http_response_body_when_tracking_provider_request_fails`
- `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php --filter=uses_response_body_as_exception_message_when_provider_message_is_empty`

## 2026-06-05 | Version: unreleased

### Summary
- Fixed tracked vehicle last-location payloads so latitude and longitude are retained with formatted addresses.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Vehicle location sync now stores provider coordinates inside `last_location_address` even when the provider also sends a formatted address.
- Vehicle detail and map views can use the latest tracked coordinates without falling back to metadata.

### Breaking Changes
- None.

### Verification
- `php -l app/Jobs/TrackVehicleLocationsJob.php`
- `php -l tests/Feature/TrackVehicleLocationsJobTest.php`
- `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php`

## 2026-06-05 | Version: unreleased

### Summary
- Fixed vehicle location polling so MiX/Powerfleet token caching is used during scheduled sync jobs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Vehicle location tracking now passes the merchant integration UUID into provider calls, allowing the existing MiX Redis token cache to reuse access tokens per integration.
- Scheduled location polling should make fewer MiX authentication requests and reduce repeated fresh-token requests during normal sync runs.

### Breaking Changes
- None.

### Verification
- `php -l app/Jobs/TrackVehicleLocationsJob.php`
- `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php`

## 2026-06-05 | Version: unreleased

### Summary
- Added a total drivers KPI to the admin dashboard.

### API Changes
- Extended `GET /api/v1/reports/dashboard_stats` to include `drivers_count`.

### Database Changes
- None.

### Behavior Changes
- `/admin` now shows a `Total drivers` KPI card linked to `/admin/logistics/drivers`.
- Dashboard driver counts respect the selected merchant, report access scope, and legacy carrier-linked drivers.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `npm run lint -- src/app/admin/page.tsx src/app/admin/logistics/analytics/page.tsx src/lib/api/reports.ts`

## 2026-06-05 | Version: unreleased

### Summary
- Added a locations count KPI to the admin dashboard.

### API Changes
- Extended `GET /api/v1/reports/dashboard_stats` to include `locations_count`.

### Database Changes
- None.

### Behavior Changes
- `/admin` now shows a `Locations` KPI card linked to `/admin/logistics/locations`.
- Dashboard location counts respect the selected merchant and existing report access scope.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `npm run lint -- src/app/admin/page.tsx src/lib/api/reports.ts`

## 2026-06-05 | Version: unreleased

### Summary
- Fixed MiX/Powerfleet vehicle location sync so `401` responses retry twice before surfacing a tracking-job failure.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Latest-position sync now retries up to twice with freshly requested MiX tokens when position requests receive `401 Unauthorized`.
- MiX token acquisition now retries failed token requests up to twice before throwing.
- Vehicle location tracking failure activity logs now include the HTTP response status, headers, and full untruncated response body when provider requests fail through Laravel's HTTP client.
- MiX token failure logs now include the raw auth username, client ID, client secret, password, grant type, and scope to help diagnose persistent `401` responses.

### Breaking Changes
- None.

### Verification
- `php -l app/Jobs/TrackVehicleLocationsJob.php`
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- `php -l tests/Feature/TrackVehicleLocationsJobTest.php`
- `php -l tests/Unit/MixIntegrateServiceTest.php`
- `php artisan test tests/Unit/MixIntegrateServiceTest.php`
- `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php`

## 2026-06-04 | Version: unreleased

### Summary
- Fixed website admin session refresh after an expired API token returns 401.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Browser API calls now retry once with a refreshed access token without immediately logging the user out when the refresh token is still available.
- Refreshed access token expiry is persisted back into the NextAuth session so the newly refreshed token is not treated as already expired.
- Missing refresh-token cache state or transient refresh request failures no longer force an immediate client logout; invalid refresh tokens still log the user out.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/lib/api/client.ts src/lib/nextauth.ts src/lib/auth-session-manager.ts src/components/providers.tsx src/types/next-auth.d.ts`
- `npm run build`

## 2026-06-04 | Version: unreleased

### Summary
- Added selective tracking-provider location imports with a preview table, filters, selected count, and filtered select-all behavior.

### API Changes
- Added `GET /api/v1/tracking-providers/{provider_id}/locations` to preview importable provider locations for a selected merchant.
- Extended `POST /api/v1/tracking-providers/{provider_id}/import_locations` to accept selected `locations` payload rows.

### Database Changes
- None.

### Behavior Changes
- Admin users can choose exactly which provider locations to import from the integrations page.
- Location imports now import only selected provider locations when a selected location payload is provided.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ImportTrackingProviderLocationsRequest.php`
- `php -l app/Http/Requests/ListTrackingProviderLocationsRequest.php`
- `php -l app/Http/Resources/TrackingProviderLocationResource.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l tests/Feature/TrackingProviderImportLocationsTest.php`
- `php artisan test tests/Feature/TrackingProviderImportLocationsTest.php`
- `php artisan test tests/Feature/TrackingProviderOptionsTest.php`
- `npm run lint -- src/components/integrations/tracking-providers.tsx src/components/integrations/tracking-provider-location-import-table.tsx src/lib/api/tracking-providers.ts src/lib/types.ts`

## 2026-06-03 | Version: unreleased

### Summary
- Added comma-separated vehicle search support to the tracking provider vehicle import table.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The vehicle import search field now treats comma-separated values like `504HJSGP,502HJSGP` as separate vehicle search terms and shows vehicles matching any listed term.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/integrations/tracking-provider-vehicle-import-table.tsx`

## 2026-06-03 | Version: unreleased

### Summary
- Added the admin tools index, renamed the MiX token checker to Powerfleet Authentication Check, and added a Powerfleet organization explorer.

### API Changes
- Added merchant-scoped Powerfleet organization endpoints:
  - `GET /api/v1/tracking-providers/{provider_id}/powerfleet/organisations`
  - `GET /api/v1/tracking-providers/{provider_id}/powerfleet/organisations/{group_id}/subgroups`
  - `GET /api/v1/tracking-providers/{provider_id}/powerfleet/organisations/{group_id}/details`

### Database Changes
- None.

### Behavior Changes
- `/admin/tools` now lists the available admin tools.
- `/admin/tools/powerfleet-authentication-check` replaces the old visible MiX check page.
- `/admin/tools/mix-check` redirects to the renamed Powerfleet authentication check.
- `/admin/tools/powerfleet-organizations` lets users browse available Powerfleet organizations, expand subgroups, and inspect group details for the selected merchant.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ListPowerfleetOrganisationRequest.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- `php artisan test tests/Unit/MixIntegrateServiceTest.php tests/Feature/PowerfleetOrganisationToolsTest.php`
- `npm run lint -- src/lib/api/tracking-providers.ts src/lib/types.ts src/lib/navigation.ts src/lib/routes/admin.ts src/components/integrations/mix-token-checker.tsx src/components/integrations/powerfleet-organizations-explorer.tsx src/app/admin/tools/page.tsx src/app/admin/tools/mix-check/page.tsx src/app/admin/tools/powerfleet-authentication-check/page.tsx src/app/admin/tools/powerfleet-organizations/page.tsx`
- `npm run build`

## 2026-04-16 | Version: unreleased

### Summary
- Fixed production build type errors in the new bulk location and bulk vehicle type update flows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Bulk location-type and vehicle-type updates now use explicit settled-result error extraction, preserving the existing UI behavior while satisfying production type checks.

### Internal Changes
- Added a shared-style settled promise error helper inside the locations and vehicles bulk action components to safely narrow API error responses before reading their messages.

### Breaking Changes
- None.

### Verification
- `npm run build`

## 2026-04-16 | Version: unreleased

### Summary
- Added bulk vehicle-type updates to the admin vehicles table using row multi-select and a modal picker.

### API Changes
- No public API contract changes.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/vehicles` now supports selecting multiple rows and applying a new vehicle type from a dialog populated with available vehicle types.
- Bulk vehicle-type updates work for either visible selected rows or all filtered results selected from the shared table footer.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/app/admin/logistics/vehicles/page.tsx src/components/vehicles/vehicles-table.tsx`

## 2026-04-16 | Version: unreleased

### Summary
- Highlighted selected rows in the shared admin data table.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shared tables that use row selection now apply the selected-row background state immediately after a row checkbox is checked.
- Sticky row action cells now keep the same selected background so the highlight remains continuous across the full row.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/common/data-table.tsx`

## 2026-04-14 | Version: unreleased

### Summary
- Added bulk location-type updates to the admin locations table using row multi-select and a modal picker.

### API Changes
- No public API contract changes.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations` now supports selecting multiple rows and applying a new location type from a dialog populated with all available merchant location types.
- Bulk updates work for either visible selected rows or all filtered results selected from the shared table footer.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/app/admin/logistics/locations/page.tsx src/components/locations/locations-table.tsx`

## 2026-04-14 | Version: unreleased

### Summary
- Added total pickup and dropoff time columns to the admin shipments report.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/reports/shipments_report` now shows `From Total Time` and `To Total Time` based on the elapsed time between each location's check-in and check-out timestamps.
- Duration values render in a compact hours/minutes format and fall back to `-` when either timestamp is missing or invalid.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`

## 2026-04-11 | Version: unreleased

### Summary
- Added VIN, integration ID, last known location, last location update time, and active-run visibility to the admin vehicles list.

### API Changes
- `GET /api/v1/vehicles`
- `GET /api/v1/vehicles/{vehicle_uuid}`
- Vehicle resources now include `is_on_a_run` as a computed boolean based on active run assignment.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/vehicles` now shows each vehicle's VIN, integration ID, formatted last known location, last location update timestamp, and whether the vehicle is currently on an active run.
- Vehicle search on the listing now also matches VIN, integration ID, and the formatted last known location text.

### Internal Changes
- Reworked the new vehicle list run-status column to use serialized row data instead of passing a render callback from the server page into the client data table.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/VehicleService.php`
- `php -l app/Http/Resources/VehicleResource.php`
- `npm run lint -- src/app/admin/logistics/vehicles/page.tsx src/lib/address.ts src/lib/types.ts`

## 2026-04-10 | Version: unreleased

### Summary
- Added optional row selection and bulk-action support to the shared data table.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shared data tables can now opt into row checkboxes, visible-row selection, all-filtered-results selection, and footer bulk actions.
- Bulk actions can be passed as simple action definitions or rendered with a custom selected-rows component.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/common/data-table.tsx`

## 2026-04-10 | Version: unreleased

### Summary
- Added a bottom toolbar to shared data tables with result counts, rows-per-page controls, and pagination in one footer.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Data tables now show a bottom-left results count, including the visible range and total when server pagination metadata is available.
- Rows-per-page selection now lives in the bottom toolbar and updates the `per_page` URL query parameter while resetting to the first page.
- Pagination now uses compact first, previous, next, and last navigation buttons instead of numbered page links.
- Top filter bars no longer render duplicate `per_page` filters.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/common/data-table.tsx`

## 2026-04-10 | Version: unreleased

### Summary
- Added geofence-status filtering to the locations geofence page while keeping the default view on all locations.

### API Changes
- `GET /api/v1/locations` now accepts an optional `geofence_status` query parameter with `all`, `with`, or `without`.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations/geofence` now defaults to showing all locations and includes a dropdown for all locations, locations with geofences, and locations with no geofences.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ListLocationsRequest.php`
- `php -l app/Services/LocationService.php`
- `php -l tests/Feature/LocationIndexFiltersTest.php`
- `php artisan test tests/Feature/LocationIndexFiltersTest.php`
- `npm run lint -- src/components/locations/locations-geofence-page-content.tsx src/lib/api/locations.ts`

## 2026-04-10 | Version: unreleased

### Summary
- Added company-name editing to the locations geofence editor and flagged locations without valid geofence polygons in the side list.

### API Changes
- No public API contract changes; the existing location update payload now includes `company` when saved from the geofence editor.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations/geofence` now lets admins edit the selected location's company name alongside its name, address, and geofence.
- Locations whose `polygon_bounds` do not form a valid geofence now display a `No geofence` label in the aside.

### Breaking Changes
- None.

### Verification
- `npm run lint -- src/components/locations/locations-geofence-page-content.tsx`

## 2026-04-10 | Version: unreleased

### Summary
- Fixed location CSV imports so tag creation and location attachment are committed atomically per imported row.

### API Changes
- `POST /api/v1/locations/import` behavior is unchanged, but failed tag attachment can no longer leave newly created tags without the imported location update.

### Database Changes
- None.

### Behavior Changes
- Re-importing a location CSV with a `tags` column now reliably attaches existing merchant tags to the imported location.
- If a row fails during tag synchronization, the row's location and tag writes are rolled back together instead of leaving a tag record unattached.

### Breaking Changes
- None.

### Internal Changes
- Wrapped each location CSV row persistence and tag synchronization step in a database transaction.
- Added explicit regression coverage for `taggables` pivot rows created by location CSV tag imports.

### Verification
- `php -l app/Services/LocationService.php`
- `php -l tests/Feature/LocationCsvImportTest.php`
- `php artisan test tests/Feature/LocationCsvImportTest.php`

## 2026-04-10 | Version: unreleased

### Summary
- Added tag assignment support to location CSV imports and updated the downloadable sample file with a `tags` column.

### API Changes
- `POST /api/v1/locations/import` now accepts an optional CSV `tags` column with comma-separated tag titles.

### Database Changes
- None.

### Behavior Changes
- Location CSV imports now create missing merchant tags and sync them to imported locations when the `tags` column is present.
- A blank `tags` cell clears existing tags for that imported location, while omitting the column leaves existing tags unchanged.

### Breaking Changes
- None.

### Internal Changes
- Reused the existing shared tag synchronization service for CSV imports so tag normalization and deduplication match the manual tag update flow.

### Verification
- Updated files:
  - `app/Services/LocationService.php`
  - `tests/Feature/LocationCsvImportTest.php`
  - `website/public/samples/locations-import-sample.csv`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/LocationService.php`
  - `php -l tests/Feature/LocationCsvImportTest.php`
  - `php artisan test tests/Feature/LocationCsvImportTest.php`

## 2026-04-10 | Version: unreleased

### Summary
- Added a dedicated integration ID filter to the tracking-provider driver import dialog.

### API Changes
- No public API contract changes.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/integrations` driver import selection now includes a specific filter field for provider integration IDs, making it easier to locate drivers by their source-system identifier.

### Breaking Changes
- None.

### Internal Changes
- Extended the driver import table filter state and matching logic to support exact search narrowing by `provider_driver_id`.

### Verification
- Updated files:
  - `website/src/components/integrations/tracking-provider-driver-import-table.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npm run lint -- src/components/integrations/tracking-provider-driver-import-table.tsx`

## 2026-04-09 | Version: unreleased

### Summary
- Added selectable tracking-provider driver imports in admin integrations, including searchable/filterable driver previews before queueing the import.

### API Changes
- Added `GET /api/v1/tracking-providers/{provider_id}/drivers` to return previewable import rows for provider drivers.
- Updated `POST /api/v1/tracking-providers/{provider_id}/import_drivers` to accept an optional `drivers` array of `{ provider_driver_id }` selections.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/integrations` now loads provider driver previews and lets admins filter by search text, name, email, telephone, employee number, and status before importing.
- Driver imports now queue only the checked provider driver IDs instead of always importing the full provider driver list.
- MiX driver previews now expose employee numbers when available so admins can search and confirm the right drivers before import.

### Breaking Changes
- None.

### Internal Changes
- Added dedicated driver preview request/resource plumbing and queued selected driver IDs through the provider import job/service path.
- Added feature coverage for the new driver preview endpoint and selected-driver queue payload.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `app/Http/Requests/ImportTrackingProviderDriversRequest.php`
  - `app/Http/Requests/ListTrackingProviderDriversRequest.php`
  - `app/Http/Resources/TrackingProviderDriverResource.php`
  - `app/Jobs/ImportProviderDriversJob.php`
  - `app/Services/MerchantIntegrationService.php`
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `routes/api.php`
  - `website/src/components/integrations/tracking-provider-driver-import-table.tsx`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/lib/api/tracking-providers.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/TrackingProviderImportDriversTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `php -l app/Http/Requests/ListTrackingProviderDriversRequest.php`
  - `php -l app/Http/Requests/ImportTrackingProviderDriversRequest.php`
  - `php -l app/Http/Resources/TrackingProviderDriverResource.php`
  - `php -l app/Jobs/ImportProviderDriversJob.php`
  - `php -l app/Services/MerchantIntegrationService.php`
  - `php -l app/Services/Mixtelematics/MixIntegrateService.php`
  - `php -l tests/Feature/TrackingProviderImportDriversTest.php`
  - `php artisan test tests/Feature/TrackingProviderImportDriversTest.php`
  - `npm run lint -- src/components/integrations/tracking-providers.tsx src/components/integrations/tracking-provider-driver-import-table.tsx src/lib/api/tracking-providers.ts src/lib/types.ts`

## 2026-04-09 | Version: unreleased

### Summary
- Updated MiX token login so a failed `/connect/token` request is retried once before the service throws an error.

### API Changes
- No public API contract changes.

### Database Changes
- None.

### Behavior Changes
- MiX authentication now makes a second `/connect/token` attempt when the first request fails.
- If the second attempt also fails, the original HTTP exception is still thrown and the request fails as before.

### Breaking Changes
- None.

### Internal Changes
- Extracted MiX token request execution into reusable helper methods so the fresh-login path can retry once before logging and throwing.
- Added focused unit coverage for success-on-retry and fail-after-second-attempt behavior.

### Verification
- Updated files:
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `tests/Unit/MixIntegrateServiceTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/Mixtelematics/MixIntegrateService.php`
  - `php -l tests/Unit/MixIntegrateServiceTest.php`
  - `php artisan test tests/Unit/MixIntegrateServiceTest.php`

## 2026-04-09 | Version: unreleased

### Summary
- Updated location CSV import so `is_loading_location=true` maps imported rows to the first collection-point location type for the merchant.

### API Changes
- No public API contract changes.

### Database Changes
- None.

### Behavior Changes
- CSV location imports now treat a truthy `is_loading_location` column as a collection-location hint when no explicit `location_type_id` is supplied.
- For those rows, the importer now assigns the first merchant `location_types` record where `collection_point = true`.
- Rows with `is_loading_location=false` or without the column keep the existing fallback to the merchant waypoint type when no explicit `location_type_id` is present.

### Breaking Changes
- None.

### Internal Changes
- `LocationService::mapImportRow()` now parses `is_loading_location` from CSV input.
- `LocationService::resolveImportedLocationTypeId()` now accepts the loading-location signal and resolves the first collection-point type before falling back to waypoint.
- Added focused CSV import coverage for both loading-location and non-loading fallback behavior.

### Verification
- Updated files:
  - `app/Services/LocationService.php`
  - `tests/Feature/LocationCsvImportTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/LocationService.php`
  - `php -l tests/Feature/LocationCsvImportTest.php`
  - `php artisan test tests/Feature/LocationCsvImportTest.php`

## 2026-04-09 | Version: unreleased

### Summary
- Updated tracking-provider location import dedupe so it falls back to provider `code` when `integration_id` is missing.

### API Changes
- No public API contract changes.

### Database Changes
- None.

### Behavior Changes
- Location imports no longer skip provider records that are missing `integration_id` when a provider location `code` is available.
- During location import, the app now reuses and updates an existing merchant location by `code` when no `integration_id` was provided, preventing duplicate imports for code-based providers.

### Breaking Changes
- None.

### Internal Changes
- `MerchantIntegrationService::importProviderLocations()` now normalizes provider location identifiers and uses `code` as the fallback import identity when `integration_id` is absent.
- Added feature coverage for code-based location dedupe during provider imports.

### Verification
- Updated files:
  - `app/Services/MerchantIntegrationService.php`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/MerchantIntegrationService.php`
  - `php -l tests/Feature/TrackingProviderOptionsTest.php`
  - `php artisan test tests/Feature/TrackingProviderOptionsTest.php`

## 2026-04-09 | Version: unreleased

### Summary
- Added Redis-backed MiX access-token reuse for runtime provider requests so the app reuses a valid MiX token until it nears expiry instead of logging in on every call.
- Kept `/admin/tools/mix-check` as a fresh-login diagnostic tool and surfaced the auth mode in the UI.

### API Changes
- No public runtime endpoint changed shape for provider imports or MiX-backed requests.
- `POST /api/v1/tracking-providers/{provider_id}/mix-token-analysis` now includes `auth_mode`, which is currently `fresh_login` for the diagnostic flow.

### Database Changes
- None.

### Behavior Changes
- MiX runtime auth now checks Redis for a cached token scoped to the merchant integration and only fetches a new token when the cached one is missing or within the 60-second safety buffer before expiry.
- MiX runtime requests now fall back to a fresh login if Redis read/write operations fail, so tracking/import flows continue working during cache issues.
- `/admin/tools/mix-check` now explicitly shows whether the displayed token data came from a fresh login or another auth mode.

### Breaking Changes
- None.

### Internal Changes
- `MerchantIntegrationService` now includes `integration_uuid` in the MiX provider integration payload so cache keys are isolated per activated merchant integration.
- `MixIntegrateService` now separates cache-aware runtime token retrieval from the fresh-login inspection path and stores compact token bundles in `Cache::store('redis')`.
- Added focused unit coverage for Redis cache hits, expiry-buffer refresh, Redis read fallback, Redis write fallback, and forced fresh inspection.

### Verification
- Updated files:
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `app/Services/MerchantIntegrationService.php`
  - `tests/Unit/MixIntegrateServiceTest.php`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `website/src/lib/types.ts`
  - `website/src/components/integrations/mix-token-checker.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/Mixtelematics/MixIntegrateService.php`
  - `php -l app/Services/MerchantIntegrationService.php`
  - `php -l tests/Unit/MixIntegrateServiceTest.php`
  - `php -l tests/Feature/TrackingProviderOptionsTest.php`
  - `php artisan test tests/Unit/MixIntegrateServiceTest.php`
  - `php artisan test tests/Feature/TrackingProviderOptionsTest.php`
  - `npm run lint -- src/lib/types.ts src/components/integrations/mix-token-checker.tsx`

## 2026-04-09 | Version: unreleased

### Summary
- Added a MiX token inspection endpoint that authenticates with the merchant’s saved MiX integration credentials and returns the full MiX auth payload plus decoded token details.
- Added an admin tool page at `/admin/tools/mix-check` to run the MiX token inspection and view token expiry analysis in the website UI.

### API Changes
- Added `POST /api/v1/tracking-providers/{provider_id}/mix-token-analysis`.
- The endpoint requires `merchant_id` and uses the stored activated tracking-provider integration for that merchant.
- The response now includes `credential_source`, `raw_response`, raw and masked token values, decoded access/refresh token objects, `timing`, and `summary`.
- The endpoint returns a validation error when the provider is not backed by the MiX integration service or when the merchant has not activated that provider.

### Database Changes
- None.

### Behavior Changes
- MiX authentication analysis now captures the full token payload returned by `POST {identity_url}/connect/token` instead of only extracting `access_token`.
- MiX token inspection now reports decoded JWT claims when possible and explicitly shows `issued_at`, `expires_at`, `expires_in_seconds`, `seconds_until_expiry`, and `is_expired`.
- `/admin/tools/mix-check` now lets admins inspect the saved MiX integration token response for the currently selected merchant without using Postman or logs.
- `/admin/tools/mix-check` now also renders the complete analysis response object in the UI alongside the token-specific sections.

### Breaking Changes
- None.

### Internal Changes
- Refactored the MiX bearer-token retrieval flow so existing import/location/vehicle calls continue using the same login request through the new inspection-aware auth method.
- Added focused unit coverage for JWT decoding, opaque token handling, and bearer-token compatibility, plus feature coverage for the new MiX inspection endpoint.

### Verification
- Updated files:
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `app/Services/MerchantIntegrationService.php`
  - `app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `app/Http/Requests/InspectTrackingProviderMixTokenRequest.php`
  - `routes/api.php`
  - `tests/Unit/MixIntegrateServiceTest.php`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `website/src/lib/types.ts`
  - `website/src/lib/api/tracking-providers.ts`
  - `website/src/components/integrations/mix-token-checker.tsx`
  - `website/src/app/admin/tools/mix-check/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/Mixtelematics/MixIntegrateService.php`
  - `php -l app/Services/MerchantIntegrationService.php`
  - `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `php -l app/Http/Requests/InspectTrackingProviderMixTokenRequest.php`
  - `php -l routes/api.php`
  - `php -l tests/Unit/MixIntegrateServiceTest.php`
  - `php -l tests/Feature/TrackingProviderOptionsTest.php`
  - `php artisan test tests/Unit/MixIntegrateServiceTest.php`
  - `php artisan test tests/Feature/TrackingProviderOptionsTest.php`
  - `npm run lint -- src/lib/api/tracking-providers.ts src/lib/types.ts src/components/integrations/mix-token-checker.tsx src/app/admin/tools/mix-check/page.tsx`

## 2026-04-08 | Version: unreleased

### Summary
- Added an editable delivery note number column type to the admin shipments table.
- Added a dedicated shipment delivery note update endpoint that allows updates after draft while the shipment is not invoiced.
- Added an editable invoice number column type to the admin shipments table.
- Added a dedicated shipment invoice number update endpoint that requires a delivery note number before invoicing.

### API Changes
- Added `PATCH /api/v1/shipments/{shipment_uuid}/delivery-note-number` for updating only `delivery_note_number`.
- The delivery note update endpoint returns `409 SHIPMENT_INVOICED` when `invoiced_at` is already set.
- Added `PATCH /api/v1/shipments/{shipment_uuid}/invoice-number` for updating only `invoice_number`.
- The invoice number update endpoint returns `422 SHIPMENT_DELIVERY_NOTE_REQUIRED` when the shipment has no delivery note number.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments` now shows delivery note numbers with an edit icon that opens the existing update delivery note dialog from the table cell.
- Delivery note numbers can now be updated from the shipment table for non-draft shipments until the shipment is invoiced.
- `/admin/logistics/shipments` now shows an Invoice Number column after Delivery Note with an edit icon that opens the existing update invoice number dialog.
- Invoice numbers can now be updated for non-draft and already invoiced shipments when a delivery note number exists.
- Attempting to update an invoice number without a delivery note number shows that the delivery note number is required first.

### Breaking Changes
- None.

### Internal Changes
- Added a shared `delivery_note_number` data table column type that reuses `UpdateDeliveryNoteDialog` for shipment rows.
- Added a shared `invoice_number` data table column type that reuses `UpdateInvoiceNumberDialog` for shipment rows.
- Updated the delivery note dialog to use the dedicated endpoint instead of the full shipment update endpoint.
- Updated the invoice number dialog to use the dedicated endpoint instead of the full shipment update endpoint.
- Added focused API regression coverage for allowed non-draft updates and blocked invoiced updates.
- Added focused API regression coverage for invoice updates, invoice timestamp preservation, and delivery note prerequisite validation.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/ShipmentController.php`
  - `app/Http/Requests/UpdateShipmentDeliveryNoteRequest.php`
  - `app/Http/Requests/UpdateShipmentInvoiceNumberRequest.php`
  - `app/Services/ShipmentService.php`
  - `routes/api.php`
  - `tests/Feature/ShipmentDeliveryNoteUpdateTest.php`
  - `tests/Feature/ShipmentInvoiceNumberUpdateTest.php`
  - `website/src/components/common/data-table.tsx`
  - `website/src/components/shipments/update-delivery-note-dialog.tsx`
  - `website/src/components/shipments/update-invoice-number-dialog.tsx`
  - `website/src/components/shipments/shipment-detail-actions.tsx`
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `website/src/lib/api/shipments.ts`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Http/Controllers/Api/V1/ShipmentController.php && php -l app/Http/Requests/UpdateShipmentDeliveryNoteRequest.php && php -l app/Http/Requests/UpdateShipmentInvoiceNumberRequest.php && php -l app/Services/ShipmentService.php && php -l routes/api.php && php -l tests/Feature/ShipmentDeliveryNoteUpdateTest.php && php -l tests/Feature/ShipmentInvoiceNumberUpdateTest.php`
  - `php artisan test tests/Feature/ShipmentDeliveryNoteUpdateTest.php tests/Feature/ShipmentInvoiceNumberUpdateTest.php`
  - `npm run lint -- src/lib/api/shipments.ts src/components/shipments/update-invoice-number-dialog.tsx src/components/common/data-table.tsx src/app/admin/logistics/shipments/page.tsx src/components/shipments/shipment-detail-actions.tsx`

## 2026-04-08 | Version: unreleased

### Summary
- Added an admin location geofence map page for searching locations, editing address details, and updating geofence polygons.
- Fixed API-submitted location polygon coordinate persistence so `[latitude, longitude]` arrays round-trip correctly.
- Fixed the admin location geofence map so markers and polygons render after the Google Maps loader finishes instead of waiting for another state change.

### API Changes
- `PATCH /api/v1/locations/{location_uuid}` now persists `polygon_bounds` arrays using the correct longitude/latitude WKT storage order while keeping the public API shape as `[latitude, longitude]`.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations/geofence` now shows a searchable paginated location list beside a Google map with location markers, geofence polygons, and a bottom-right editor panel.
- Users can update a selected location's name, address via Google Places search, and polygon bounds, with all edits saved only when the user clicks Save.
- Reset Polygon now creates a default rectangle around the selected location's coordinates without persisting it until Save.
- Geofence-only location updates now create a location activity-log entry.
- The geofence map now waits for the Maps instance to be ready before drawing overlays and uses Google Advanced Markers when a Map ID enables them.
- Selecting a location on the geofence map now updates the existing overlays instead of rebuilding every marker and polygon.
- The geofence page now ignores synthetic sidebar and map overlay clicks when selecting locations.
- The geofence location list now loads additional locations only when the user clicks Load more locations.
- The geofence map now skips Advanced Marker loading unless `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` is configured.
- Prefilled Places address fields now wait for the user to type before showing Google Places suggestions.
- Reset Polygon now uses the selected location's saved latitude and longitude, not the edited address draft coordinates.
- The geofence location list now shows each location's type in the aside.

### Breaking Changes
- None.

### Internal Changes
- Added a locations geofence page component that reuses the existing Google Maps loader, marker clustering, Places address search, and locations API client.
- Added explicit map-readiness state to avoid dropping the initial marker and polygon render after async Google Maps loading.
- Split geofence overlay creation from selection styling to reduce repeated Google Maps work during location selection.
- Added idempotent selection handling and trusted-event guards around geofence location selection.
- Replaced geofence list infinite-scroll observation with explicit button-driven pagination.
- Gated the Google Maps marker library and Advanced Marker construction behind the configured Map ID.
- Added explicit user-typing state to Places suggestions so `initialQuery` changes do not trigger autocomplete searches.
- Updated the geofence reset handler to derive its square center from the selected location record.
- Added a helper for rendering the best available location type label in geofence list rows.
- Added backend regression coverage for location geofence coordinate order and activity logging.

### Verification
- Updated files:
  - `app/Services/LocationService.php`
  - `tests/Feature/LocationGeofenceUpdateTest.php`
  - `website/src/app/admin/logistics/locations/geofence/page.tsx`
  - `website/src/components/locations/places-suggestions.tsx`
  - `website/src/components/locations/locations-geofence-page-content.tsx`
  - `website/src/lib/api/locations.ts`
  - `website/src/lib/routes/admin.ts`
  - `website/src/lib/navigation.ts`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/LocationService.php && php -l tests/Feature/LocationGeofenceUpdateTest.php`
  - `php artisan test tests/Feature/LocationIndexFiltersTest.php tests/Unit/LocationResourceTest.php tests/Feature/LocationGeofenceUpdateTest.php`
  - `npm run lint -- 'src/app/admin/logistics/locations/geofence/page.tsx' src/components/locations/locations-geofence-page-content.tsx src/lib/api/locations.ts src/lib/routes/admin.ts src/lib/navigation.ts`
  - `npm run lint -- 'src/app/admin/logistics/locations/geofence/page.tsx' src/components/locations src/lib/api/locations.ts src/lib/routes/admin.ts src/lib/navigation.ts` (passes with existing unused-variable warnings in broader linted files)
  - `npm run lint -- src/components/locations/locations-geofence-page-content.tsx`
  - `npm run lint -- src/components/locations/places-suggestions.tsx src/components/locations/locations-geofence-page-content.tsx`
  - `npx tsc --noEmit --pretty false`

## 2026-04-08 | Version: unreleased

### Summary
- Fixed the admin shell content area so wide content scrolls horizontally instead of stretching the main layout.
- Removed the `Invoiced at` field from the admin new shipment form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin pages now keep the sidebar content area constrained and expose a horizontal scrollbar when child content is wider than the viewport.
- Creating a shipment from `/admin/logistics/shipments` no longer asks for or submits an invoice timestamp.

### Breaking Changes
- None.

### Internal Changes
- Restored the admin shell child render path after layout overflow testing and added shrink constraints to the sidebar inset/main content area.
- Added a shared shipment dialog option for hiding the invoice timestamp while leaving existing edit and quote flows unchanged by default.

### Verification
- Updated files:
  - `website/src/components/layout/admin-shell.tsx`
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `website/src/components/shipments/shipment-quote-dialog.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npm run lint -- src/components/layout/admin-shell.tsx`
  - `npm run lint -- src/app/admin/logistics/shipments/page.tsx src/components/shipments/shipment-quote-dialog.tsx` (passes with existing `react-hooks/exhaustive-deps` warning in `shipment-quote-dialog.tsx`)

## 2026-04-07 | Version: unreleased

### Summary
- Added shared merchant-scoped tags for fleet vehicles and locations, with admin tag management and list filtering.
- Added shipment list and shipment report filtering by pickup or dropoff location tag.
- Added shipment list and shipment report filtering by assigned vehicle tag.
- Fixed `shipments_full_report` failures when nested location resources are serialized without loaded tag relations.

### API Changes
- Added `GET /api/v1/tags` for merchant-scoped tag lookup.
- Added `PATCH /api/v1/vehicles/{vehicle_uuid}/tags` to replace a vehicle's assigned tags from a list of tag names.
- Added `PATCH /api/v1/locations/{location_uuid}/tags` to replace a location's assigned tags from a list of tag names.
- Vehicle and location API resources now include `tags: [{ tag_id, name, slug }]` when tags are loaded.
- `GET /api/v1/vehicles` and `GET /api/v1/locations` now accept `tag_id` to filter entries by assigned tag.
- `GET /api/v1/shipments` now accepts `location_tag_id` to filter shipments whose pickup or dropoff location has the selected tag.
- `GET /api/v1/reports/shipments_full_report` now accepts `location_tag_id` to filter report rows by pickup or dropoff location tag.
- `GET /api/v1/shipments` now accepts `vehicle_tag_id` to filter shipments by the current assigned vehicle's selected tag.
- `GET /api/v1/reports/shipments_full_report` now accepts `vehicle_tag_id` to filter report rows by the report vehicle's selected tag.

### Database Changes
- Added `tags` for per-merchant shared tag catalog records.
- Added `taggables` as a polymorphic pivot for assigning tags to vehicles and locations.

### Behavior Changes
- Vehicle and location detail pages now include a shared tag manager that can search existing tags, create new tags inline, and autosave when tags are added or removed.
- `/admin/logistics/vehicles` and `/admin/logistics/locations` now show assigned tags in the table and include a tag filter.
- `/admin/logistics/shipments` now includes a `Location tag` filter that matches tags assigned to either the pickup or dropoff location.
- `/admin/logistics/shipments/reports/shipments_report` now includes the same `Location tag` filter for report rows.
- `/admin/logistics/shipments` now includes a `Vehicle tag` filter that matches tags assigned to the shipment's current vehicle.
- `/admin/logistics/shipments/reports/shipments_report` now includes a `Vehicle tag` filter that matches tags assigned to the report vehicle.
- `/api/v1/reports/shipments_full_report` no longer fails when shipment pickup or dropoff locations are serialized without loaded tags or run shipments.
- Tag assignments are shared between fleet and location entries within the same merchant.
- Tag assignment updates are recorded in the activity log.

### Breaking Changes
- None.

### Internal Changes
- Added shared tag synchronization logic, tag resources, request validation, and regression coverage for tag assignment and resource serialization.
- Added a shared `tags` column type to the admin data table so server-rendered pages can show tag badges without passing render functions to the client table.
- Made vehicle and location tag resources conditional on loaded tag relations so other report serializers can reuse those resources safely.
- Added exception file and line context to `shipments_full_report` error logs.
- Updated existing location and vehicle test fixtures to use normal model events so UUIDs are generated during test setup.

### Verification
- Updated files include:
  - `app/Services/TagService.php`
  - `app/Http/Controllers/Api/V1/TagController.php`
  - `app/Http/Controllers/Api/V1/VehicleController.php`
  - `app/Http/Controllers/Api/V1/LocationController.php`
  - `app/Http/Controllers/Api/V1/ReportController.php`
  - `app/Http/Resources/VehicleResource.php`
  - `app/Http/Resources/LocationResource.php`
  - `app/Services/ShipmentService.php`
  - `database/migrations/2026_04_07_000001_create_tags_tables.php`
  - `website/src/components/common/entry-tags-manager.tsx`
  - `website/src/components/common/data-table.tsx`
  - `website/src/app/admin/logistics/vehicles/page.tsx`
  - `website/src/app/admin/logistics/locations/page.tsx`
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `website/src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
  - `website/src/lib/api/tags.ts`
  - `website/src/lib/api/vehicles.ts`
  - `website/src/lib/api/locations.ts`
  - `website/src/lib/api/shipments.ts`
  - `website/src/lib/api/reports.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/EntryTagsTest.php`
  - `tests/Feature/ShipmentsFullReportTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/EntryTagsTest.php`
  - `php artisan test tests/Feature/EntryTagsTest.php tests/Unit/LocationResourceTest.php tests/Feature/LocationIndexFiltersTest.php tests/Feature/VehicleServiceTest.php`
  - `npx eslint src/components/common/entry-tags-manager.tsx 'src/app/admin/logistics/vehicles/[vehicleId]/page.tsx' src/components/locations/location-detail-content.tsx src/lib/api/tags.ts src/lib/types.ts`
  - `npx eslint src/components/common/entry-tags-manager.tsx`
  - `npx eslint 'src/app/admin/logistics/vehicles/page.tsx' 'src/app/admin/logistics/locations/page.tsx' src/components/common/data-table.tsx src/lib/api/vehicles.ts src/lib/api/locations.ts`
  - `php artisan test tests/Feature/EntryTagsTest.php tests/Feature/ShipmentsFullReportTest.php tests/Unit/LocationResourceTest.php`
  - `php artisan test tests/Feature/EntryTagsTest.php --filter=filters_shipments`
  - `npx eslint 'src/app/admin/logistics/shipments/page.tsx' src/lib/api/shipments.ts`
  - `php artisan test tests/Feature/ShipmentsFullReportTest.php`
  - `npx eslint 'src/app/admin/logistics/shipments/reports/shipments_report/page.tsx' src/lib/api/reports.ts`
  - `php artisan test tests/Feature/EntryTagsTest.php tests/Feature/ShipmentsFullReportTest.php`
  - `npx eslint 'src/app/admin/logistics/shipments/page.tsx' 'src/app/admin/logistics/shipments/reports/shipments_report/page.tsx' src/lib/api/shipments.ts src/lib/api/reports.ts`

## 2026-04-05 | Version: unreleased

### Summary
- Added the assigned truck registration number to the admin shipments table.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments` now shows a `Truck Reg Number` column immediately after `Created`, using the assigned vehicle plate number when available.
- Shipments without an assigned vehicle display `Unassigned` in the new column.

### Breaking Changes
- None.

### Internal Changes
- Extended the shared frontend `Shipment` type with the optional vehicle payload used by the shipments listing.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `website/src/lib/types.ts`
  - `docs/release-notes.md`
- Verification run:
  - Not run.

## 2026-04-04 | Version: unreleased

### Summary
- Updated the admin activity log flow to send the current session merchant ID to the activity log endpoints and enforce merchant context from the request.

### API Changes
- `GET /api/v1/activity-logs` and `GET /api/v1/activity-logs/{log_id}` now run behind `merchant.context` for merchant users and expect the active `merchant_id` to be supplied by the client request.

### Database Changes
- None.

### Behavior Changes
- The website admin activity log list and detail pages now send the selected session `merchant_id` with each activity log request.
- Merchant users now see only activity log records for the merchant passed from the current session context on `/admin/activity-log`.
- Activity log requests without `merchant_id` now fail validation for merchant users, matching other merchant-scoped endpoints.
- Merchant-scoped website pages that use the shared auth helper now fall back to the first session merchant when `selected_merchant` is temporarily unset, preventing missing `merchant_id` requests during SSR.

### Breaking Changes
- None.

### Internal Changes
- Switched backend activity log scoping to use resolved request merchant context and added regression coverage for required request merchant scoping.
- Updated the shared website merchant-scoping helper to resolve a fallback merchant ID from `session.merchants`.

### Verification
- Updated files:
  - `app/Services/ActivityLogService.php`
  - `routes/api.php`
  - `website/src/app/admin/activity-log/page.tsx`
  - `website/src/app/admin/activity-log/[logId]/page.tsx`
  - `website/src/lib/api/activity-logs.ts`
  - `website/src/lib/auth.ts`
  - `tests/Feature/ActivityLogTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/ActivityLogTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed admin vehicle edits to submit only the fields present on the vehicle form, and made vehicle and driver form validation identify the exact missing required field.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The vehicle edit dialog now sends only the editable vehicle fields shown in the form when saving changes.
- Vehicle update requests no longer include hidden location data or create-only merchant assignment data from the admin vehicle dialog.
- Vehicle form validation now shows the specific missing required field, such as `Plate number is required.`, instead of a generic message.
- Driver creation and driver vehicle edit dialogs now show the specific missing required field instead of the generic required-fields error.

### Breaking Changes
- None.

### Internal Changes
- Removed unused hidden vehicle location form state, split create vs update payload construction, and centralized required field labels across related vehicle and driver dialogs for clearer validation errors.

### Verification
- Updated files:
  - `website/src/components/vehicles/vehicle-dialog.tsx`
  - `website/src/components/drivers/vehicle-dialog.tsx`
  - `website/src/components/drivers/create-driver-dialog.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npx eslint src/components/vehicles/vehicle-dialog.tsx src/components/drivers/vehicle-dialog.tsx src/components/drivers/create-driver-dialog.tsx`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed driver detail lookups to honor the requested `merchant_id`, preventing false 404s when a user belongs to multiple merchants.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/api/v1/drivers/{driver_uuid}` now resolves merchant-scoped access using the supplied `merchant_id` for merchant users before loading the driver.
- Driver detail pages and links from merchant-scoped reports now load correctly even when the selected merchant is not the first merchant attached to the user.

### Breaking Changes
- None.

### Internal Changes
- Added regression coverage for fetching a driver under a non-default merchant membership.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/DriverController.php`
  - `app/Services/DriverService.php`
  - `tests/Feature/DriverIndexTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/DriverIndexTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed a frontend build failure by aligning the shared `Shipment` type with the driver data already used by the shipments list page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None.

### Breaking Changes
- None.

### Internal Changes
- Added the optional `driver` field to the shared frontend `Shipment` type so TypeScript matches the shipments list usage.

### Verification
- Updated files:
  - `website/src/lib/types.ts`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed the shipments report page to reuse the admin shell’s active-merchant fallback so merchant-scoped report requests still include `merchant_id` when the session has merchants but no explicit `selected_merchant`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shipments report page now falls back to the first available merchant in the session when `selected_merchant` is empty.
- This prevents `The merchant_id field is required.` errors on the report page when the UI already shows an implicit active merchant.

### Breaking Changes
- None.

### Internal Changes
- Aligned the server-rendered report page’s merchant resolution with the existing admin shell merchant selection behavior.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npx eslint src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed unscoped shipments report calls in location detail views so merchant-specific report endpoints always receive the selected `merchant_id`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Location detail shipment counters now pass `merchant_id` when loading outbound and inbound shipment report totals.
- The dashboard location dialog now passes `merchant_id` for the same shipment report lookups, avoiding `The merchant_id field is required.` validation errors.

### Breaking Changes
- None.

### Internal Changes
- Aligned all remaining `getShipmentsFullReport` location-detail call sites with the stricter backend merchant scoping requirement.

### Verification
- Updated files:
  - `website/src/components/locations/location-detail-content.tsx`
  - `website/src/components/dashboard/location-dialog-content.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npx eslint src/components/locations/location-detail-content.tsx src/components/dashboard/location-dialog-content.tsx`

## 2026-04-02 | Version: unreleased

### Summary
- Improved admin validation error messaging so report screens show the first concrete field error instead of the generic `Validation failed.` message.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Frontend API error handling now promotes the first field-level validation message from backend responses.
- The shipments report now shows actionable validation feedback such as a missing `merchant_id` instead of only the generic validation wrapper text.

### Breaking Changes
- None.

### Internal Changes
- Centralized validation-detail extraction in the shared frontend API client used across admin pages.

### Verification
- Updated files:
  - `website/src/lib/api/client.ts`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-04-02 | Version: unreleased

### Summary
- Added the assigned driver column to the logistics shipments list so dispatch teams can see shipment ownership without opening each shipment.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The `admin/logistics/shipments` table now shows the current shipment driver name.
- Driver names in the shipments list link directly to the driver details page when a driver is assigned.
- Shipments without an assigned driver now show `Unassigned` in the new column.

### Breaking Changes
- None.

### Internal Changes
- Reused the existing `ShipmentResource.driver` payload already returned by the shipments API instead of introducing a new field.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-04-02 | Version: unreleased

### Summary
- Scoped the admin shipments report page to the selected merchant so report results no longer span multiple merchants unexpectedly.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `admin/logistics/shipments/reports/shipments_report` now sends the active `merchant_id` with the shipments full report request.
- Super admins without a selected merchant now see a prompt to choose a merchant instead of loading an unscoped shipments report.
- The `/api/v1/reports/shipments_full_report` endpoint now requires `merchant_id` when no merchant environment is present and returns only shipments for the requested merchant.

### Breaking Changes
- None.

### Internal Changes
- Added backend enforcement so direct API calls cannot load an unscoped shipments full report outside a merchant context.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/ReportController.php`
  - `tests/Feature/ShipmentsFullReportTest.php`
  - `website/src/app/admin/logistics/shipments/reports/shipments_report/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/ShipmentsFullReportTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Added automatic driver creation during vehicle tracking sync when a provider position includes a driver integration id that does not yet exist locally.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `tracking:sync-vehicle-locations` now fetches and upserts missing drivers from the tracking provider before assigning them to vehicles and using them in auto-run lifecycle updates.
- Tracking sync now prefers a provider-specific single-driver fetch when available and falls back to bulk driver import filtering when it is not.
- If provider driver fetch/import fails, vehicle position sync continues and records the failure without blocking the rest of the job.

### Breaking Changes
- None.

### Internal Changes
- Centralized provider-driver import/upsert logic in `DriverService` and reused it from both tracking sync and the existing provider driver import flow.
- Added tracking-job regression coverage for single-fetch imports, bulk fallback imports, merchant-scoped collisions, and provider fetch failures.

### Verification
- Updated files:
  - `app/Jobs/TrackVehicleLocationsJob.php`
  - `app/Services/DriverService.php`
  - `app/Services/MerchantIntegrationService.php`
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `tests/Feature/TrackVehicleLocationsJobTest.php`
  - `tests/Feature/TrackingProviderImportDriversTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Jobs/TrackVehicleLocationsJob.php`
  - `php -l app/Services/DriverService.php`
  - `php -l app/Services/MerchantIntegrationService.php`
  - `php -l app/Services/Mixtelematics/MixIntegrateService.php`
  - `php artisan test tests/Feature/TrackVehicleLocationsJobTest.php`
  - `php artisan test tests/Feature/TrackingProviderImportDriversTest.php`

## 2026-04-02 | Version: unreleased

### Summary
- Fixed tracking sync driver resolution so vehicle activity and auto-created runs match drivers by integration ID within the correct merchant.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `tracking:sync-vehicle-locations` downstream lifecycle processing now prefers driver records whose `merchant_id` matches the current merchant when resolving a `driver_intergration_id`.
- Same-account drivers from other merchants no longer get attached to vehicle last-known-driver updates or auto-created runs when integration IDs collide.

### Breaking Changes
- None.

### Internal Changes
- Added a shared merchant-aware driver integration resolver in the auto-run lifecycle service, with a legacy fallback for null-merchant driver records on the same account.

### Verification
- Updated files:
  - `app/Services/AutoRunLifecycleService.php`
  - `tests/Feature/AutoRunLifecycleServiceTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php`

## 2026-04-01 | Version: unreleased

### Summary
- Highlighted the active merchant in the admin merchant switcher so users can see which merchant is currently selected before switching.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The merchant dropdown in the admin shell now gives the selected merchant a highlighted row style.
- The active merchant entry now shows a checkmark indicator and removes avatar grayscale for quicker visual recognition.

### Breaking Changes
- None.

### Internal Changes
- Kept the merchant switching logic unchanged while adding selected-state styling inside the existing dropdown button rendering.

### Verification
- Updated files:
  - `website/src/components/layout/admin-shell.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-04-01 | Version: unreleased

### Summary
- Upgraded the existing vehicles CSV flow into a fleet-oriented import experience with a friendlier sample template and vehicle type matching by code or name.

### API Changes
- `POST /api/v1/vehicles/import` now accepts vehicle type values from the CSV by UUID, `code`, or `name`.

### Database Changes
- None.

### Behavior Changes
- The logistics vehicles import dialog now uses fleet-oriented copy for the title, action button, success toast, and sample file download label.
- The fleet sample CSV now publishes `vehicle_type` values like `car`, `trailer`, and `motorcycle` instead of requiring UUIDs.
- Vehicle CSV imports continue to upsert using `intergration_id`, then `plate_number`, then `ref_code`.
- Invalid vehicle types now fail only the affected row and return a row-level error in the import summary.

### Breaking Changes
- None.

### Internal Changes
- Kept backward compatibility for legacy CSV files by continuing to accept the `vehicle_type_id` header and UUID values during import.

### Verification
- Updated files:
  - `app/Services/VehicleService.php`
  - `website/src/components/vehicles/import-vehicles-dialog.tsx`
  - `website/public/samples/vehicles-import-sample.csv`
  - `tests/Feature/VehicleCsvImportTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test tests/Feature/VehicleCsvImportTest.php`

## 2026-04-01 | Version: unreleased

### Summary
- Updated the admin landing page title to show the selected merchant name instead of the generic `Admin dashboard` label.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin users viewing the main dashboard now see `{merchant_name} dashboard` when a merchant is selected.
- The page falls back to `Admin dashboard` only when no selected merchant name is available in session data.

### Breaking Changes
- None.

### Internal Changes
- Wired the dashboard header title to the authenticated session's `selected_merchant.name`.

### Verification
- Updated files:
  - `website/src/app/admin/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-30 | Version: unreleased

### Summary
- Added a new `Shipments by Location` logistics analytics report with pickup/dropoff grouping, selectable date ranges, a bar chart, and a location totals table.

### API Changes
- Added `GET /api/v1/reports/shipments-by-location` with query params `merchant_id`, `date_range`, `location_type`, `start_date`, and `end_date`.

### Database Changes
- None.

### Behavior Changes
- Logistics users can now open a dedicated `Shipments by Location` analytics page from the navigation or analytics overview.
- The report can switch between pickup and dropoff location totals and updates results for the selected date range.
- The date range control now includes `Today`, `Yesterday`, `This week`, and `Custom`, with custom ranges selected through a ShadCN-style calendar range picker.
- Custom range selection now stays stable while the user is choosing both dates instead of jumping after the first click.
- Applying a custom range now preserves the exact selected local dates instead of shifting them back by one day in some timezones.
- The custom range picker no longer allows future dates to be selected.
- Each month panel in the custom range picker now only allows selecting dates from that displayed month, without outside-month overflow days.
- Clicking a location in the report now opens the shipments report with the same date range and the matching pickup or dropoff location filter applied.

### Breaking Changes
- None.

### Internal Changes
- Added a dedicated backend aggregation endpoint and frontend report components instead of deriving location totals from the paginated shipments full report.
- Replaced the custom report's two single-date inputs with a single range-picker control built on the shared calendar and popover UI primitives.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/ReportController.php`
  - `app/Http/Requests/ShipmentsByLocationReportRequest.php`
  - `routes/api.php`
  - `tests/Feature/ShipmentsByLocationReportTest.php`
  - `website/src/app/admin/logistics/analytics/page.tsx`
  - `website/src/app/admin/logistics/analytics/shipments-by-location/page.tsx`
  - `website/src/components/reports/shipments-by-location-chart.tsx`
  - `website/src/components/reports/shipments-by-location-controls.tsx`
  - `website/src/lib/api/reports.ts`
  - `website/src/lib/navigation.ts`
  - `website/src/lib/routes/admin.ts`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-30 | Version: unreleased

### Summary
- Fixed the website production build after the tracking providers integrations screen lost a required UI import during the main-location-provider rollback.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The tracking provider import dialog once again renders the locations import toggle correctly during production builds.

### Breaking Changes
- None.

### Internal Changes
- Restored the `Switch` component import in the tracking providers integrations UI so Next.js lint/type validation passes in `npm run build`.

### Verification
- Updated files:
  - `website/src/components/integrations/tracking-providers.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build`

## 2026-03-29 | Version: unreleased

### Summary
- Removed the merchant-level main location provider feature and restored tracking sync to rely on each vehicle's provider-specific `intergration_id`.

### API Changes
- `PATCH /api/v1/merchants/{merchant_uuid}/settings` no longer accepts `main_location_provider_id`.
- Merchant API responses no longer include `main_location_provider_id` or `main_location_provider`.

### Database Changes
- Removed the unrun migration that would have added `main_location_provider_id` to `merchants`.

### Behavior Changes
- Vehicle location sync no longer chooses one canonical provider per merchant.
- Connected tracking providers no longer show or manage a "main location provider" control in settings or integrations.
- Tracking continues to run per active merchant integration, with provider resolution based on each vehicle's unique `intergration_id`.

### Breaking Changes
- None.

### Internal Changes
- Kept `has_location_services` as backend tracking-provider metadata and retained Fleetboard integration support.
- Removed obsolete merchant main-location-provider tests and frontend state/plumbing tied only to that feature.

### Verification
- Updated files:
  - `app/Http/Requests/UpdateMerchantSettingsRequest.php`
  - `app/Http/Resources/MerchantResource.php`
  - `app/Models/Merchant.php`
  - `app/Services/MerchantService.php`
  - `app/Services/VehicleLocationSyncService.php`
  - `database/migrations/2026_03_28_230000_add_main_location_provider_id_to_merchants_table.php`
  - `tests/Feature/MerchantMainLocationProviderTest.php`
  - `website/src/app/admin/settings/integrations/page.tsx`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/components/settings/organization-settings-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `docs/release-notes.md`
- Verification run:
  - `rg -n "main_location_provider_id|mainLocationProvider|Main location provider|main_location_provider" app website/src tests docs`
  - Additional syntax/tests run in this session are listed below.

## 2026-03-28 | Version: unreleased

### Summary
- Added Fleetboard as a tracking provider option for vehicle import and v1 live location sync, and added provider-level `has_location_services` capability metadata for future tracking-provider classification.

### API Changes
- None.

### Database Changes
- Added `has_location_services` boolean on `tracking_providers`.

### Behavior Changes
- Vehicle location sync continues to run per active merchant integration, using each vehicle’s provider-specific `intergration_id` as the source of truth for provider lookups.
- Fleetboard provider metadata and setup fields are now seeded for backend/provider configuration.

### Breaking Changes
- None.

### Internal Changes
- Added a Fleetboard SOAP service adapter for login, vehicle import normalization, and live position normalization for latitude, longitude, speed, and odometer.
- Added explicit `has_location_services` capability metadata for tracking providers so backend code can classify location-capable providers without inferring support from names.

### Verification
- Updated files:
  - `app/Http/Resources/TrackingProviderResource.php`
  - `app/Models/TrackingProvider.php`
  - `app/Services/Fleetboard/FleetboardService.php`
  - `app/Services/TrackingProviderService.php`
  - `config/tracking_providers.php`
  - `database/migrations/2026_03_28_233000_add_has_location_services_to_tracking_providers_table.php`
  - `database/seeders/DatabaseSeeder.php`
  - `tests/Unit/FleetboardServiceTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/Fleetboard/FleetboardService.php`
  - `php -l app/Models/TrackingProvider.php`
  - `php -l app/Http/Resources/TrackingProviderResource.php`
  - `php -l app/Services/TrackingProviderService.php`
  - `php -l tests/Unit/FleetboardServiceTest.php`
  - `php -l database/migrations/2026_03_28_233000_add_has_location_services_to_tracking_providers_table.php`
  - `php artisan test tests/Unit/FleetboardServiceTest.php`

## 2026-03-28 | Version: unreleased

### Summary
- Fixed the invite accept form so the first submit can advance the flow instead of being blocked by hidden client-side validation.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Clicking `Accept invite` on the first step now submits the invite token correctly, allowing the UI to move to the password step when the invited user still needs to create an account.

### Breaking Changes
- None.

### Internal Changes
- Stopped pre-populating the hidden `name` form field during the initial accept step so Zod does not require hidden password fields before the API request is sent.

### Verification
- Updated files:
  - `website/src/components/auth/invite-accept-form.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-28 | Version: unreleased

### Summary
- Added backend logging for merchant invite tokens at the moment invite emails are dispatched.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- New merchant invites and resent invites now write the plain invite token and invite ID to the application logs before the invite email job is dispatched.

### Breaking Changes
- None.

### Internal Changes
- Centralized invite token logging in the shared invite-email dispatch path so initial sends and resends follow the same logging behavior.

### Verification
- Updated files:
  - `app/Services/InviteService.php`
  - `docs/release-notes.md`
- Verification run:
  - `php -l app/Services/InviteService.php`

## 2026-03-27 | Version: unreleased

### Summary
- Updated invite-link handling so unknown invite tokens show a specific `Token not found.` message instead of a generic preview failure.

### API Changes
- `GET /api/v1/merchant-invites/preview` now returns `error.code = INVITE_NOT_FOUND` with the message `Token not found.` when the invite token does not match a database record.

### Database Changes
- None.

### Behavior Changes
- `/auth/invites` now displays `Token not found.` when the invite preview token is missing from the database.

### Breaking Changes
- None.

### Internal Changes
- Preserved the specific preview validation error code through the API layer so the website can render a token-specific state.

### Verification
- Updated files:
  - `app/Services/InviteService.php`
  - `app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `website/src/app/auth/invites/page.tsx`
  - `website/src/components/auth/invite-accept-form.tsx`
  - `tests/Feature/InviteFlowTest.php`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-27 | Version: unreleased

### Summary
- Added a dedicated invite-email sender configuration so merchant invite emails can use a separate `from` address from the rest of the system mail.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Merchant invite emails now send from `USER_INVITE_FROM_EMAIL` when it is set.
- Invite email logs now store the actual invite sender address and name instead of always recording the global mail sender.

### Breaking Changes
- None.

### Internal Changes
- Added invite-specific mail config with fallback to the global `MAIL_FROM_ADDRESS` and `MAIL_FROM_NAME`.

### Verification
- Updated files:
  - `config/mail.php`
  - `app/Mail/MerchantInviteMail.php`
  - `app/Services/LoggedMailSender.php`
  - `tests/Feature/EmailLogTest.php`
  - `.env.example`
  - `docs/release-notes.md`
- Verification run:
  - Not run in this session.

## 2026-03-27 | Version: unreleased

### Summary
- Fixed the Expo driver app crash caused by structured address objects being rendered directly in shipment and vehicle screens.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The mobile app now normalizes structured location payloads into human-readable address strings before rendering shipment offers, shipment details, and vehicle location text.
- Driver screens now tolerate backend responses where `full_address` or `last_location_address` arrive as nested address objects instead of plain strings.

### Breaking Changes
- None.

### Internal Changes
- Added mobile API-layer normalization helpers for shipment, offer, presence, and vehicle payloads so address formatting is handled centrally.

### Verification
- Updated files:
  - `mobile_app/src/lib/api.ts`
  - `docs/release-notes.md`
- Verification run:
  - `npm run lint` in `mobile_app` (passes)

## 2026-03-27 | Version: unreleased

### Summary
- Fixed the website production build by aligning the vehicle API payload type with the current admin vehicle form fields.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None.

### Breaking Changes
- None.

### Internal Changes
- Made `photo_key` optional in the frontend `VehiclePayload` type so vehicle create requests match the form payload after the photo key field removal.

### Verification
- Updated files:
  - `website/src/lib/api/vehicles.ts`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build` in `website` (passes; existing ESLint warnings remain in unrelated files)

## 2026-03-27 | Version: unreleased

### Summary
- Updated the website registration page to match the new split-screen authentication design used by the login flow.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/auth/register` now uses a full-screen two-column layout with the same branded header and desktop promo panel style as the login page.
- The registration form now uses the newer auth card styling, clearer placeholders, and aligned input sizing across name, email, country, and password fields.
- Mobile registration keeps the same streamlined form-first experience while hiding the desktop-only promo panel.

### Breaking Changes
- None.

### Internal Changes
- Refactored the register form presentation so it fits the page-level auth layout without changing the existing registration and auto-login logic.

### Verification
- Updated files:
  - `website/src/app/auth/register/page.tsx`
  - `website/src/components/auth/register-form.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (could not run in this shell because `node` is not available)

## 2026-03-27 | Version: unreleased

### Summary
- Redesigned the website login page into a full-screen split authentication layout with branded marketing content and a cleaner sign-in form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/auth/login` now uses a two-column desktop layout with a dedicated brand header, a simplified sign-in card, and a branded right-side promotional panel.
- The sign-in form now includes inline forgot-password access beside the password label and clearer field placeholders for faster login completion.
- Mobile login keeps the form-first experience while preserving the new visual styling without the desktop promo panel.

### Breaking Changes
- None.

### Internal Changes
- Refactored the login form component styling to fit the new page-level auth layout instead of rendering inside the previous standalone card shell.

### Verification
- Updated files:
  - `website/src/app/auth/login/page.tsx`
  - `website/src/components/auth/login-form.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (could not run in this shell because `node` is not available)

## 2026-03-26 | Version: unreleased

### Summary
- Rebuilt the website landing page into a lighter Spoke-style SaaS experience focused on route planning, live tracking, delivery operations, and conversion.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/` now presents a cleaner product-led marketing flow with a new hero, trust bar, problem/solution section, feature grid, product showcase, process steps, metrics, testimonials, CTA, and footer.
- Homepage visuals now emphasize route maps, driver tracking, stop lists, and dispatch dashboards instead of the previous operations-heavy dark theme.
- Hover and motion behavior across buttons, cards, route lines, and driver pins were simplified into a lighter animation system tuned for desktop and mobile.

### Breaking Changes
- None.

### Internal Changes
- Replaced the previous homepage content model and module stylesheet with a page-scoped implementation tailored to the new landing-page information architecture.

### Verification
- Updated files:
  - `website/src/app/page.tsx`
  - `website/src/app/homepage.module.css`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (fails due to a pre-existing unrelated `VehiclePayload` type mismatch in `website/src/components/vehicles/vehicle-dialog.tsx:179`)

## 2026-03-26 | Version: unreleased

### Summary
- Refreshed the admin account page with a stronger profile layout, added profile photo upload, and exposed a dedicated endpoint for updating the logged-in user’s profile image.

### API Changes
- Added `POST /api/v1/me/profile-photo` to upload and persist the authenticated user’s profile image.
- `GET /api/v1/me` and `PATCH /api/v1/me` now return `profile_photo_url` in the user payload.

### Database Changes
- Added `users.profile_photo_path` to persist the stored path for each user profile image.

### Behavior Changes
- `/admin/settings/account` now shows a profile summary panel, a dedicated profile picture upload card, and updated account/password sections.
- Uploading a new profile photo updates the account page preview and the admin shell avatar using the same user session payload.

### Breaking Changes
- None.

### Internal Changes
- Added multipart upload validation and feature coverage for the logged-in user profile photo flow.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `app/Http/Requests/UploadUserProfilePhotoRequest.php`
  - `app/Http/Resources/UserResource.php`
  - `app/Models/User.php`
  - `database/migrations/2026_03_26_000001_add_profile_photo_path_to_users_table.php`
  - `routes/api.php`
  - `tests/Feature/LastAccessedMerchantTest.php`
  - `website/src/components/layout/admin-shell.tsx`
  - `website/src/components/settings/account-settings-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/auth.ts`
  - `website/src/lib/nextauth.ts`
  - `website/src/lib/types.ts`
  - `website/src/types/next-auth.d.ts`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=LastAccessedMerchantTest`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (fails due to a pre-existing unrelated `VehiclePayload` type mismatch in `website/src/components/vehicles/vehicle-dialog.tsx:179`)

## 2026-03-26 | Version: unreleased

### Summary
- Refreshed the marketing landing page with a stronger Pick n Drop brand-led hero, a full-bleed operational visual, and simpler section structure focused on platform story, outcomes, workflow, integrations, trust, and conversion.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The first viewport now presents Pick n Drop as the dominant visual and messaging signal instead of a dashboard-like split layout.
- Hero content is reduced to a single headline, one support line, a CTA group, and one dominant logistics control visual.
- Follow-up sections are reorganized so each section has one job and less visual clutter across the landing page.
- Landing page typography, color treatment, spacing, and motion were updated for a more intentional promotional surface on desktop and mobile.

### Breaking Changes
- None.

### Internal Changes
- Rebuilt the homepage module styles around page-scoped design tokens and responsive layout rules instead of the previous card-heavy dark theme.

### Verification
- Updated files:
  - `website/src/app/page.tsx`
  - `website/src/app/homepage.module.css`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit` (fails due to a pre-existing unrelated `VehiclePayload` type mismatch in `website/src/components/vehicles/vehicle-dialog.tsx:179`)

## 2026-03-26 | Version: unreleased

### Summary
- Fixed the dashboard recent activity card so each activity title always opens a detail view, falling back to the activity log detail page when no related entity route exists.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Recent activity items on the admin dashboard now link to the related entity when supported.
- Activity items without an entity-specific admin route now link to `/admin/activity-log/{activityId}` instead of rendering as plain text.

### Breaking Changes
- None.

### Internal Changes
- Reused the existing activity log detail route helper as the dashboard card fallback target.

### Verification
- Updated files:
  - `website/src/components/dashboard/recent-activity-card.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run.

## 2026-03-26 | Version: unreleased

### Summary
- Removed non-essential vehicle form inputs for location update time, integration id, and photo key from the admin vehicle dialog, and changed status to a switch control.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The admin vehicle create/edit dialog no longer shows `Location updated at`, `Intergration ID`, or `Photo key`.
- Vehicle saves from the admin dialog no longer submit those fields from the form payload.
- The admin vehicle status control now uses a shadcn switch instead of a select dropdown.

### Breaking Changes
- None.

### Internal Changes
- Simplified the vehicle dialog form state and validation to match the remaining editable inputs while preserving the existing active/inactive payload shape.

### Verification
- Updated files:
  - `website/src/components/vehicles/vehicle-dialog.tsx`
  - `docs/release-notes.md`
- Verification run:
  - Not run.

## 2026-03-26 | Version: unreleased

### Summary
- Replaced tracking-provider vehicle imports with a selection flow that loads provider vehicles into a filtered table, supports select-all, captures a vehicle type per selected row, and imports only the chosen vehicles.

### API Changes
- Added `GET /api/v1/tracking-providers/{provider_id}/vehicles` to preview provider vehicles for import selection.
- Updated `POST /api/v1/tracking-providers/{provider_id}/import_vehicles` to require `vehicles[]` entries containing `provider_vehicle_id` and `vehicle_type_id`, alongside `merchant_id`.

### Database Changes
- None.

### Behavior Changes
- Admin integrations now load provider vehicles before a vehicle import starts.
- Vehicle imports now stay disabled until at least one provider vehicle is selected and each selected row has a vehicle type chosen.
- Vehicle import jobs now create or update only the selected provider vehicles and apply the selected vehicle type to each imported vehicle.
- Tracking-provider import jobs for vehicles, drivers, and locations now dispatch onto the `imports` queue instead of the default queue.
- Vehicle import type resolution accepts the submitted vehicle type identifier more defensively and the admin UI loads a larger enabled-only vehicle type list for the import dropdown.
- Tracking-provider vehicle imports now persist the selected `merchant_id` onto imported vehicles and prefer merchant-scoped matches when updating existing provider-linked vehicles.
- Tracking-provider driver and location imports now also reclaim legacy unscoped records onto the selected merchant and persist the selected `merchant_id` during import updates.

### Breaking Changes
- `POST /api/v1/tracking-providers/{provider_id}/import_vehicles` no longer supports merchant-only bulk imports; callers must send selected provider vehicle ids.

### Verification
- Updated files:
  - `app/Jobs/ImportProviderDriversJob.php`
  - `app/Jobs/ImportProviderLocationsJob.php`
  - `app/Jobs/ImportProviderVehiclesJob.php`
  - `app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `app/Http/Requests/ListTrackingProviderVehiclesRequest.php`
  - `app/Http/Requests/ImportTrackingProviderVehiclesRequest.php`
  - `app/Http/Resources/TrackingProviderVehicleResource.php`
  - `app/Jobs/ImportProviderVehiclesJob.php`
  - `app/Services/MerchantIntegrationService.php`
  - `app/Services/Mixtelematics/MixIntegrateService.php`
  - `routes/api.php`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/components/integrations/tracking-provider-vehicle-import-table.tsx`
  - `website/src/lib/api/tracking-providers.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `openapi.yaml`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=TrackingProviderOptionsTest`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-26 | Version: unreleased

### Summary
- Fixed tracking provider activation so the admin UI submits the selected `merchant_id` and the API activates providers against the correct merchant in multi-merchant accounts.

### API Changes
- `POST /api/v1/tracking-providers/activate` now accepts `merchant_id` to scope activation to a specific merchant.

### Database Changes
- None.

### Behavior Changes
- Admin tracking provider activation now uses the currently selected merchant instead of implicitly activating against the first merchant available on the user.
- Users attached to multiple merchants can activate the same tracking provider for the intended merchant without cross-merchant leakage.

### Breaking Changes
- None.

### Internal Changes
- Added feature coverage for merchant-scoped tracking provider activation.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
  - `app/Http/Requests/ActivateTrackingProviderRequest.php`
  - `app/Services/MerchantIntegrationService.php`
  - `website/src/components/integrations/tracking-providers.tsx`
  - `website/src/lib/api/tracking-providers.ts`
  - `tests/Feature/TrackingProviderOptionsTest.php`
  - `openapi.yaml`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=TrackingProviderOptionsTest`

## 2026-03-26 | Version: unreleased

### Summary
- Changed runs tracking to default to active runs only on first load while keeping the filter dialog available for broadening the result set.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/tracking` now loads with `Only show active runs` enabled by default.
- The tracking filter dialog now opens with the active-runs switch turned on unless the user has changed the applied filters.

### Breaking Changes
- None.

### Internal Changes
- Aligned the tracking page’s initial server fetch with the client-side default filter state so the first render matches subsequent filtered requests.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/tracking/page.tsx`
  - `website/src/components/tracking/runs-tracking-view.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`
  - `npm run build`

## 2026-03-26 | Version: unreleased

### Summary
- Added a filter dialog to the runs tracking screen so operators can narrow the list to active runs and runs that still have shipments before applying the filters.

### API Changes
- `GET /api/v1/runs` now accepts:
  - `active_only`
  - `with_shipments`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/tracking` now opens a filter dialog from the filter button instead of showing a disabled control.
- Tracking can now be filtered to only runs where `completed_at` is empty.
- Tracking can now be filtered to only runs that still have non-removed attached shipments.
- Search and pagination on the tracking list now preserve the applied filter state.

### Breaking Changes
- None.

### Internal Changes
- Removed debug logging from the tracking page and view while wiring the runs filter state through the frontend and backend list flow.

### Verification
- Updated files:
  - `website/src/components/tracking/runs-tracking-view.tsx`
  - `website/src/lib/api/runs.ts`
  - `app/Services/RunService.php`
  - `tests/Feature/RunApiTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter=RunApiTest`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`
  - `npm run build`

## 2026-03-26 | Version: unreleased

### Summary
- Added reusable admin loading skeletons for table and detail screens and wired them into the admin route tree with route-level `loading.tsx` files.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin list pages now show a shared table-style loading skeleton during route transitions.
- Admin detail, form, and dashboard-style pages now show a shared detail-style loading skeleton during route transitions.
- Dynamic admin detail routes now use their own loading boundaries instead of falling back to generic parent loading states.

### Breaking Changes
- None.

### Internal Changes
- Added shared `AdminTableLoadingSkeleton` and `AdminDetailLoadingSkeleton` components under the website admin UI layer and attached them to admin route segments.

### Verification
- Updated files:
  - `website/src/components/admin/admin-loading-skeletons.tsx`
  - `website/src/app/admin/**/loading.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-26 | Version: unreleased

### Summary
- Fixed the shipment detail actions dropdown so it opens and stays interactive when the shipment detail view is rendered inside a dialog.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shipment actions menu now works correctly in embedded shipment detail dialogs, allowing users to open the menu and launch its actions.

### Breaking Changes
- None.

### Internal Changes
- Configured the shipment actions Radix dropdown to run non-modally so it no longer conflicts with the parent dialog's focus and outside-interaction handling.

### Verification
- Updated files:
  - `website/src/components/shipments/shipment-detail-actions.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-26 | Version: unreleased

### Summary
- Fixed the account billing dashboard plan selector to satisfy the production React/Next build rules by replacing the synchronous state sync effect with derived selection state.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The billing dashboard plan dropdown now keeps its local selection state without relying on a synchronous `useEffect` state reset.

### Breaking Changes
- None.

### Internal Changes
- Resolved the blocking `react-hooks/set-state-in-effect` build error in the website production build.

### Verification
- Updated files:
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `npm run build`

## 2026-03-26 | Version: unreleased

### Summary
- Split the account billing screen into a current billing-cycle invoice preview and a separate previous-invoices history table with invoice-detail dialogs.

### API Changes
- `GET /api/v1/billing/summary` now includes `current_invoice_preview` with billing-period totals and preview line items for the current cycle.

### Database Changes
- None.

### Behavior Changes
- `/admin/billing` now shows a live preview of the current billing-cycle invoice before it is generated.
- Previous invoices now appear in a data table instead of the old inline card list.
- Clicking an invoice entry opens a dialog with full invoice details loaded from `GET /api/v1/billing/invoices/{invoice_uuid}`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Services/BillingService.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `website/src/app/admin/billing/page.tsx`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added a seeded free 1-car trial plan, limited account-holder access to that plan to the first 14 days after registration, and added a downgrade confirmation because moving to the free plan automatically deletes extra merchant vehicles.

### API Changes
- `GET /api/v1/billing/plans` is now account-aware and hides the free plan after the account’s 14-day trial window ends.
- `GET /api/v1/billing/summary` now includes:
  - `can_select_free_plan`
  - `free_plan_available_until`
- Pricing plan resources now include:
  - `is_free`
  - `trial_days`

### Database Changes
- Added `pricing_plans.is_free`
- Added `pricing_plans.trial_days`
- Seeded a new `Free 1 Car` pricing plan with a 14-day trial window.

### Behavior Changes
- Account holders now see a confirmation dialog before downgrading a merchant to the free 1-car package.
- Downgrading a merchant to the free plan now keeps one deterministic vehicle and soft-deletes the rest.
- After the first 14 days from account registration, the free plan is removed from the account billing plan dropdown unless the merchant is already on that plan.

### Breaking Changes
- Merchant plan downgrades to the free plan now delete extra vehicle records for that merchant.

### Verification
- Updated files:
  - `database/migrations/2026_03_25_000006_add_free_plan_fields_to_pricing_plans_table.php`
  - `database/seeders/DatabaseSeeder.php`
  - `app/Models/PricingPlan.php`
  - `app/Services/BillingService.php`
  - `app/Http/Controllers/Api/V1/BillingController.php`
  - `app/Http/Resources/PricingPlanResource.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added account-country editing to the account settings page for account holders so they can change the billing country that drives billing currency and gateway routing.

### API Changes
- `GET /api/v1/me` now includes:
  - `is_account_holder`
  - `account_country_code`
- `PATCH /api/v1/me` now accepts `account_country_code` for account holders.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/account` now shows an all-countries dropdown only for account holders.
- Updating the account country from settings changes the owning account’s `country_code`.
- Non-account-holders do not see the field and cannot change account country through the profile update flow.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `app/Http/Resources/UserResource.php`
  - `website/src/components/settings/account-settings-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/LastAccessedMerchantTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='LastAccessedMerchantTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Removed manual gateway selection from the account billing portal so payment-method actions always use the gateway resolved from the account billing country.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/billing` no longer lets account holders choose a payment gateway when adding or syncing payment methods.
- Payment-method setup and sync actions now always use the account’s resolved billing gateway from country pricing.
- The billing UI now explains which gateway is being used and why.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/app/admin/billing/page.tsx`
  - `docs/release-notes.md`
- Verification run:
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added current billing-cycle dates and next billing date visibility to the account billing screen so users can see exactly when the next invoice will be generated.

### API Changes
- `GET /api/v1/billing/summary` now includes:
  - `current_billing_period_start`
  - `current_billing_period_end`
  - `next_billing_date`

### Database Changes
- None.

### Behavior Changes
- `/admin/billing` now shows the current billing period window and the next invoice date derived from the account’s anniversary billing schedule.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Services/BillingService.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Changed invoice generation from fixed calendar-month billing to account-anniversary billing based on each account’s registration date.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Billing cycles are now calculated from the account `created_at` date instead of calendar month boundaries.
- Invoices are now generated on each account’s billing anniversary day rather than always on the 1st of the month.
- Accounts created on the 29th, 30th, or 31st now bill on the last valid day of shorter months.
- The billing generator command still uses `billing:generate-monthly-invoices`, but it now runs daily and generates invoices only for accounts due on that date.

### Breaking Changes
- Invoice timing has changed from shared calendar-month billing to per-account anniversary billing.

### Verification
- Updated files:
  - `app/Services/BillingService.php`
  - `routes/console.php`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`

## 2026-03-25 | Version: unreleased

### Summary
- Refactored billing gateway handling to use a stricter strategy contract for customer setup, gateway-hosted payment-method setup bootstrapping, saved-card sync, and recurring charge execution without collecting card details in our own UI.

### API Changes
- Added authenticated billing endpoints:
  - `POST /api/v1/billing/payment-methods/setup`
  - `POST /api/v1/billing/payment-methods/sync`
- Billing gateway payloads now expose capability flags for `supports_card_retrieval` and `supports_hosted_card_capture`.
- Billing summary payloads now expose resolved gateway capabilities so `/admin/billing` can switch behavior per gateway.

### Database Changes
- Added masked-only metadata columns to `account_payment_methods`:
  - `funding_type`
  - `bank`
  - `signature`
  - `is_reusable`
  - `retrieved_from_gateway`

### Behavior Changes
- `/admin/billing` no longer presents manual card-entry fields.
- Payment-method setup is now gateway-driven:
  - Stripe bootstraps a setup intent/client-secret flow.
  - Paystack and PayFast expose hosted/redirect setup metadata and rely on masked authorization/token details rather than local card capture.
- Saved payment methods are now normalized through gateway strategy classes and refreshed through a shared sync flow.
- Stripe gateway sync can retrieve masked saved-card data directly from the gateway.
- Paystack and PayFast now explicitly behave as masked metadata/token-based gateways rather than pretending to support direct customer card listing.
- Recurring charges continue to use stored reusable gateway references only.

### Breaking Changes
- The account billing UI no longer supports manually typing gateway card metadata into the application.

### Verification
- Updated files:
  - `app/Services/Billing/Gateways/BillingGatewayInterface.php`
  - `app/Services/Billing/Gateways/StripeBillingGateway.php`
  - `app/Services/Billing/Gateways/PaystackBillingGateway.php`
  - `app/Services/Billing/Gateways/PayfastBillingGateway.php`
  - `app/Services/Billing/Gateways/FreeBillingGateway.php`
  - `app/Services/Billing/Data/*`
  - `app/Services/BillingService.php`
  - `app/Http/Controllers/Api/V1/BillingController.php`
  - `app/Http/Requests/BillingGatewayActionRequest.php`
  - `app/Http/Resources/PaymentGatewayResource.php`
  - `app/Http/Resources/PaymentMethodSetupIntentResource.php`
  - `app/Http/Resources/PaymentMethodSyncResource.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `app/Http/Resources/AccountPaymentMethodResource.php`
  - `app/Models/AccountPaymentMethod.php`
  - `database/migrations/2026_03_25_000005_add_masked_gateway_fields_to_account_payment_methods_table.php`
  - `routes/api.php`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/lib/api/billing.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='BillingTest|AuthTest'`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Added an account-based billing system with regional currency/gateway routing, merchant-level pricing plans, invoice generation, payment-method storage, recurring charge commands, a new account billing portal at `/admin/billing`, and a super-admin billing configuration area at `/admin/settings/billing`.

### API Changes
- Added authenticated billing endpoints:
  - `GET /api/v1/billing/summary`
  - `GET /api/v1/billing/gateways`
  - `GET /api/v1/billing/plans`
  - `GET /api/v1/billing/invoices`
  - `GET /api/v1/billing/invoices/{invoice_uuid}`
  - `POST /api/v1/billing/invoices/{invoice_uuid}/charge`
  - `POST /api/v1/billing/payment-methods`
  - `PATCH /api/v1/billing/payment-methods/{payment_method_uuid}/default`
  - `DELETE /api/v1/billing/payment-methods/{payment_method_uuid}`
  - `PATCH /api/v1/billing/merchants/{merchant_uuid}/plan`
- Added super-admin billing catalog endpoints:
  - `GET /api/v1/admin/billing/gateways`
  - `GET /api/v1/admin/billing/country-pricing`
  - `GET /api/v1/admin/billing/plans`
  - `GET /api/v1/admin/billing/accounts`
  - `GET /api/v1/admin/billing/accounts/{account_uuid}`
- `POST /api/v1/auth/register` now requires `country_code` and persists it to the created account.

### Database Changes
- Added billing fields to `accounts`: `country_code`, `is_billing_exempt`.
- Added `merchants.plan_id`.
- Added billing catalog tables: `payment_gateways`, `country_pricing`, `pricing_plans`.
- Added billing runtime tables: `account_billing_profiles`, `account_payment_methods`, `account_invoices`, `account_invoice_lines`, `account_invoice_payment_attempts`.
- Added billing config env variables for Stripe, PayFast, Paystack, and shared invoice defaults in `.env.example`.
- Seeded default gateways, country pricing rows, and starter pricing plans in `DatabaseSeeder`.

### Behavior Changes
- Account billing country now drives resolved currency and payment gateway selection.
- South African accounts resolve to ZAR pricing via PayFast seed data; non-matched countries fall back to USD via the default country-pricing row.
- Merchant plans are now account-billing aware and can be managed by account holders from `/admin/billing`.
- Monthly invoices can be generated per account and broken down by merchant plan charges and extra active vehicles.
- Saved payment methods now store non-sensitive gateway references only, with gateway-specific charge adapters for `free`, `stripe`, `payfast`, and `paystack`.
- Added recurring billing console commands:
  - `php artisan billing:generate-monthly-invoices`
  - `php artisan billing:charge-due-invoices`
- Added SQLite-safe guards to older raw `ALTER TABLE ... MODIFY ...` migrations so feature tests can boot in the default test database.

### Breaking Changes
- Registration requests that omit `country_code` now fail validation.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/BillingController.php`
  - `app/Http/Controllers/Api/V1/AdminBillingController.php`
  - `app/Services/BillingService.php`
  - `app/Services/Billing/*`
  - `app/Models/Account.php`
  - `app/Models/Merchant.php`
  - `app/Models/PaymentGateway.php`
  - `app/Models/CountryPricing.php`
  - `app/Models/PricingPlan.php`
  - `app/Models/AccountBillingProfile.php`
  - `app/Models/AccountPaymentMethod.php`
  - `app/Models/AccountInvoice.php`
  - `app/Models/AccountInvoiceLine.php`
  - `app/Models/AccountInvoicePaymentAttempt.php`
  - `app/Http/Resources/AccountBillingSummaryResource.php`
  - `app/Http/Resources/AccountInvoiceResource.php`
  - `app/Http/Resources/AccountPaymentMethodResource.php`
  - `app/Http/Requests/RegisterRequest.php`
  - `app/Services/AuthService.php`
  - `routes/api.php`
  - `routes/console.php`
  - `config/billing.php`
  - `database/migrations/2026_03_25_000002_create_billing_catalog_tables.php`
  - `database/migrations/2026_03_25_000003_create_account_billing_tables.php`
  - `database/migrations/2026_03_25_000004_add_billing_fields_to_accounts_and_merchants.php`
  - `database/seeders/DatabaseSeeder.php`
  - `website/src/app/admin/billing/page.tsx`
  - `website/src/app/admin/settings/billing/page.tsx`
  - `website/src/components/billing/account-billing-dashboard.tsx`
  - `website/src/components/billing/admin-billing-settings.tsx`
  - `website/src/components/auth/register-form.tsx`
  - `website/src/lib/api/billing.ts`
  - `website/src/lib/navigation.ts`
  - `website/src/lib/routes/admin.ts`
  - `website/src/lib/types.ts`
  - `tests/Feature/AuthTest.php`
  - `tests/Feature/BillingTest.php`
  - `docs/release-notes.md`
- Verification run:
  - `php artisan test --filter='AuthTest|BillingTest'`
  - `php artisan route:list --path=billing`
  - `website/node_modules/.bin/tsc -p website/tsconfig.json --noEmit`

## 2026-03-25 | Version: unreleased

### Summary
- Improved merchant invite acceptance errors so valid invites no longer fall back to the generic "Invite is invalid" message when more specific action is required.

### API Changes
- `POST /api/v1/merchant-invites/accept` now returns specific invite error codes and messages for missing account setup data, expired invites, revoked invites, already accepted invites, and missing tokens.

### Database Changes
- None.

### Behavior Changes
- New users opening a valid invite now receive a clear prompt to set their name and password instead of seeing a misleading invalid-invite error.
- Expired, revoked, already accepted, and missing invite tokens now return specific acceptance messages that the website can surface directly.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `app/Services/InviteService.php`
  - `website/src/components/auth/invite-accept-form.tsx`
  - `tests/Feature/InviteFlowTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Run `php artisan test --filter=InviteFlowTest` to confirm invite acceptance returns the expected success and specific validation error responses.

## 2026-03-25 | Version: unreleased

### Summary
- Extended outbound email logging to persist the rendered HTML message body for each logged email attempt.

### API Changes
- None.

### Database Changes
- Added nullable `email_logs.html_message` to store the rendered email body captured during send attempts.

### Behavior Changes
- `LoggedMailSender` now saves the rendered message body into `email_logs.html_message` before delivery and keeps it on both `sent` and `failed` outcomes.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Models/EmailLog.php`
  - `app/Services/LoggedMailSender.php`
  - `database/migrations/2026_03_25_000001_add_html_message_to_email_logs_table.php`
  - `tests/Feature/EmailLogTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Run `php artisan test --filter=EmailLogTest` to confirm email logs retain the rendered message body for both successful and failed sends.

## 2026-03-23 | Version: unreleased

### Summary
- Added persistent outbound email logging for queued mail sends so invite and shipment failure emails now record delivery attempts and outcomes.

### API Changes
- None.

### Database Changes
- Added `email_logs` table with a unique `uuid`, recipient payloads, mail metadata, contextual foreign keys, and delivery status timestamps for `pending`, `sent`, and `failed` email attempts.

### Behavior Changes
- `SendMerchantInviteEmailJob` now writes an `email_logs` row before sending and updates it to `sent` or `failed` after the mail transport completes.
- `SendOfferFailedEmailJob` now follows the same logging flow, including shipment/environment linkage for later auditing.
- Failed outbound sends now retain the transport exception message in `email_logs.error_message` before the job is re-thrown to Laravel's queue failure handling.
- When `MAIL_MAILER` uses local non-delivery transports like `log` or `array`, invite and offer-failed emails now run synchronously so `email_logs` updates do not depend on a long-running queue worker being restarted.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Jobs/SendMerchantInviteEmailJob.php`
  - `app/Jobs/SendOfferFailedEmailJob.php`
  - `app/Models/EmailLog.php`
  - `app/Services/LoggedMailSender.php`
  - `database/migrations/2026_03_23_000001_create_email_logs_table.php`
  - `tests/Feature/EmailLogTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Run `php artisan test --filter=EmailLogTest` to confirm successful sends are marked `sent` and transport exceptions are marked `failed`.

## 2026-03-22 | Version: unreleased

### Summary
- Added website middleware that forces requests on `app.spaces.za.com` into the admin area instead of rendering the public-facing site.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Requests to the Next.js website on host `app.spaces.za.com` now redirect to `/admin` unless they are already under `/admin`.
- Next.js API routes, internal asset routes, and common metadata files remain accessible without this redirect so admin auth and assets continue to work.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/middleware.ts`
  - `docs/release-notes.md`
- Verification target:
  - Confirm `app.spaces.za.com/` redirects to `/admin`.
  - Confirm `app.spaces.za.com/admin` does not redirect again.
  - Confirm Next.js API and asset paths remain unaffected by middleware matching.

## 2026-03-22 | Version: unreleased

### Summary
- Added persisted last accessed merchant selection for regular admin users so the website restores the previously selected merchant after a new login.

### API Changes
- Added authenticated endpoint `PATCH /api/v1/me/last-accessed-merchant` to save the current user’s preferred merchant by merchant UUID.
- `/api/v1/me` now includes `last_accessed_merchant_id` as the preferred merchant UUID when available.

### Database Changes
- Added nullable `users.last_accessed_merchant_id` foreign key referencing `merchants.id` with `nullOnDelete()`.

### Behavior Changes
- Admin merchant switching now persists the selected merchant in Laravel before the website session updates.
- NextAuth merchant bootstrap now falls back to the persisted preferred merchant when no newer in-session selection exists.
- Creating a merchant as a regular user now also marks that merchant as the user’s last accessed merchant.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `app/Http/Requests/UpdateLastAccessedMerchantRequest.php`
  - `app/Http/Resources/UserResource.php`
  - `app/Models/User.php`
  - `app/Services/MerchantService.php`
  - `database/migrations/2026_03_22_000001_add_last_accessed_merchant_id_to_users_table.php`
  - `routes/api.php`
  - `website/src/components/layout/admin-shell.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `website/src/types/next-auth.d.ts`
  - `tests/Feature/LastAccessedMerchantTest.php`
  - `docs/release-notes.md`
- Verification target:
  - Backend feature tests cover save success, authorization rejection, `/me` payload exposure, and null-on-delete behavior.

## 2026-03-21 | Version: unreleased

### Summary
- Extended vehicle tracking address parsing to persist Mix Telematics `FormattedAddress` values into the vehicle's last known location address.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `TrackVehicleLocationsJob` now checks Mix Telematics `FormattedAddress` in addition to the existing address keys when saving `vehicles.last_location_address`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Jobs/TrackVehicleLocationsJob.php`
  - `docs/release-notes.md`
- Verified by code review:
  - `extractAddress()` now accepts `FormattedAddress` before falling back to lat/long-only storage.
- Not run:
  - Live Mix Telematics payload sync in this shell session.

## 2026-03-21 | Version: unreleased

### Summary
- Updated vehicle tracking sync so provider-detected drivers are marked active and automatically linked to the detected vehicle when that driver-vehicle pairing does not already exist.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- When `TrackVehicleLocationsJob` receives a provider position with a resolvable driver integration ID, the matched driver now has `drivers.is_active` set to `true`.
- The same tracking sync now creates a `driver_vehicles` assignment for that driver and vehicle if one does not already exist, preserving historical multi-vehicle relationships for drivers who operate different trucks.
- Expanded tracking payload parsing to recognize additional driver identifier keys such as `DriverIntegrationId`, `driver_id`, and `DriverID`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Jobs/TrackVehicleLocationsJob.php`
  - `docs/release-notes.md`
- Verified by code review:
  - Detected drivers are resolved within the merchant/account scope before status or assignment changes are applied.
  - Assignment creation remains deduplicated through the existing `DriverVehicleService::assignVehicle()` flow.
- Not run:
  - End-to-end provider sync test against a live tracking payload in this shell session.

## 2026-03-21 | Version: unreleased

### Summary
- Switched the Expo mobile app theme source to NativeWind `useColorScheme` / `colorScheme`, added an in-app account screen theme toggle, and started replacing hard-coded mobile colors with semantic design tokens plus a shared text primitive.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Mobile app root navigation theme and status bar now follow NativeWind's active color scheme instead of the plain React Native appearance hook.
- Account screen now includes a theme control that toggles NativeWind between light and dark mode at runtime.
- Existing themed helper components now read the NativeWind-backed color scheme object so shared theme-aware UI keeps working.
- The active theme now propagates across the app shell and major driver flows, including auth, dashboard, shipments, documents, vehicles, and shipment scan/completion screens.
- Mobile styling now has shared semantic color tokens such as `background`, `card`, `primary`, `secondary`, `muted`, `destructive`, `warning`, and `success` defined in `global.css` / Tailwind.
- Converted the main tab, auth, account edit, vehicle detail, shipment detail, shipment scan, and shipment completion screens away from raw Tailwind hex background/text classes to semantic utilities like `bg-background`, `bg-card`, `bg-secondary`, and `text-card-foreground`.
- Added `@/component/ui/Text` as the shared app text primitive with default `text-foreground`, and updated app screens to use it so foreground text color is inherited centrally while still allowing extra classes per usage.
- Replaced unsupported slash-opacity token usage like `text-secondary-foreground/80` with explicit opacity utilities so NativeWind resolves the semantic text colors correctly.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/app/_layout.tsx`
  - `mobile_app/global.css`
  - `mobile_app/tailwind.config.js`
  - `mobile_app/component/ui/Text.tsx`
  - `mobile_app/app/(tabs)/_layout.tsx`
  - `mobile_app/app/(tabs)/index.tsx`
  - `mobile_app/app/(tabs)/bookings.tsx`
  - `mobile_app/app/(tabs)/vehicles.tsx`
  - `mobile_app/app/(tabs)/documents.tsx`
  - `mobile_app/app/(tabs)/explore.tsx`
  - `mobile_app/app/(auth)/login.tsx`
  - `mobile_app/app/(auth)/register.tsx`
  - `mobile_app/app/account/edit-profile.tsx`
  - `mobile_app/app/vehicles/[vehicle_id].tsx`
  - `mobile_app/app/shipments/[shipment_id].tsx`
  - `mobile_app/app/shipments/[shipment_id]/scan.tsx`
  - `mobile_app/app/shipments/completed.tsx`
  - `mobile_app/hooks/use-color-scheme.ts`
  - `mobile_app/hooks/use-color-scheme.web.ts`
  - `mobile_app/hooks/use-theme-color.ts`
  - `mobile_app/components/ui/collapsible.tsx`
  - `mobile_app/components/parallax-scroll-view.tsx`
  - `docs/release-notes.md`
- Verified by:
  - `npx expo lint` in `mobile_app` completed with 0 errors.
  - Root layout now consumes NativeWind `colorScheme` for navigation theme + status bar style.
  - Account screen toggle calls NativeWind `toggleColorScheme()`.
  - Main app screens now use NativeWind semantic color utilities or scheme-aware icon/input colors so toggling applies beyond a single screen.
  - App screens now import the shared `@/component/ui/Text` wrapper instead of raw React Native `Text`.
  - Repo search confirms no remaining hard-coded Tailwind page color classes under `mobile_app/app` / `mobile_app/components`.
- Remaining:
  - Runtime verification on device/simulator was not run in this shell session.

## 2026-03-19 | Version: unreleased

### Summary
- Fixed mobile auth session persistence crash caused by incompatible AsyncStorage native module linkage in Expo.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Mobile app no longer throws `AsyncStorageError: Native module is null, cannot access legacy storage` during session read/write.
- Session storage now auto-falls back to in-memory storage if native AsyncStorage binding is unavailable at runtime.
- Removed verbose auth storage debug logs to reduce console noise.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/package.json`
  - `mobile_app/package-lock.json`
  - `mobile_app/src/lib/auth-storage.ts`
  - `docs/release-notes.md`
- Verified by dependency check:
  - `npx expo install --check` now reports AsyncStorage version compatibility issue resolved (`@react-native-async-storage/async-storage` expected `2.2.0`).
- Not run:
  - Full Expo app runtime smoke test on device/simulator in this shell session.

## 2026-03-19 | Version: unreleased

### Summary
- Audited `DataTable` pagination wiring across app/admin pages and fixed missing URL page forwarding on invoiced shipments.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/invoiced?page=<n>` now fetches and renders the correct API page instead of always returning page 1.
- Verified other `DataTable` pages with server-backed pagination are already parsing and forwarding `page` correctly.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/invoiced/page.tsx`
  - `docs/release-notes.md`
- Verified by code audit:
  - Reviewed all `DataTable` usages under `website/src/app`.
  - Confirmed page passthrough on all paginated server data pages after this fix.
- Not run:
  - Automated tests/lint for this audit task.

## 2026-03-19 | Version: unreleased

### Summary
- Fixed admin shipments pagination so URL query `?page=<n>` is passed to the shipments API and loads the correct page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Navigating directly to routes like `/admin/logistics/shipments?page=3` now fetches and displays page 3 results instead of always showing page 1.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/admin/logistics/shipments/page.tsx`
  - `docs/release-notes.md`
- Verified logic:
  - `searchParams.page` is parsed and forwarded to `listShipments(..., { page })`.
- Not run:
  - Automated tests/lint for this page (not requested in this task).

## 2026-03-19 | Version: unreleased

### Summary
- Added targeted mobile diagnostics for the driver online/offline toggle to trace where `Unable to update online status.` originates.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Mobile app now logs online-toggle flow milestones:
  - toggle start metadata
  - geolocation availability/success/failure details
  - outgoing `/driver/presence/status` payload
  - successful status response payload
  - structured API error metadata (`status`, `code`, `requestId`, `details`) on failure
- API client request logs now include method + URL and structured failure output for non-success responses.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/app/(tabs)/index.tsx`
  - `mobile_app/src/lib/api.ts`
  - `docs/release-notes.md`
- Could not run:
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added driver profile editing in the mobile app with an `Edit profile` action and save flow backed by a new driver profile update endpoint.

### API Changes
- Added `PATCH /api/v1/driver/profile` (driver-role only) to update authenticated driver user profile fields:
  - `name` (`sometimes`, string, max 255)
  - `telephone` (`nullable`, string, max 50)
- Mobile app now calls this endpoint when saving profile updates.

### Database Changes
- None.

### Behavior Changes
- Account tab now includes an `Edit profile` button.
- New mobile screen `/account/edit-profile` allows editing:
  - name
  - telephone
- Save updates backend profile data and refreshes local session user data immediately.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/UpdateDriverProfileRequest.php`
  - `app/Http/Controllers/Api/V1/MeController.php`
  - `routes/api.php`
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/src/providers/auth-provider.tsx`
  - `mobile_app/app/(tabs)/explore.tsx`
  - `mobile_app/app/account/edit-profile.tsx`
  - `mobile_app/app/_layout.tsx`
  - `docs/release-notes.md`
- Could not run:
  - PHP lint (`php` not available in shell PATH)
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added shipment status tab filtering on the driver bookings screen with backend support for `active` and `completed` status filters.

### API Changes
- Updated `GET /api/v1/driver/shipments` to support query param `status` values:
  - `active` (returns non-completed statuses)
  - `completed` (returns `delivered`, `failed`, `cancelled`)
  - direct completed values (`delivered`, `failed`, `cancelled`)
- Mobile app now calls `GET /api/v1/driver/shipments?per_page=20&status=<tab>` when loading/switching booking tabs.

### Database Changes
- None.

### Behavior Changes
- Driver Bookings tab defaults to `Active` and fetches active shipments on load.
- Switching to `Completed` refetches shipments with `status=completed`.
- Pull-to-refresh now respects the currently selected shipment tab filter.
- Empty state messaging now changes based on selected tab.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Controllers/Api/V1/DriverShipmentController.php`
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/app/(tabs)/bookings.tsx`
  - `docs/release-notes.md`
- Could not run:
  - PHP lint (`php` not available in shell PATH)
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Enhanced driver online toggle to include current location/device context when updating presence status.

### API Changes
- No backend endpoint contract changes.
- Mobile client now sends additional fields to `POST /api/v1/driver/presence/status` when toggling online/offline:
  - `is_available`
  - `latitude`
  - `longitude`
  - `platform`
  - `user_device_id`

### Database Changes
- None.

### Behavior Changes
- Going online now attempts to fetch current coordinates before status update and submits them immediately.
- Dispatch can receive a fresh location at online-toggle time instead of waiting for the next heartbeat cycle.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/app/(tabs)/index.tsx`
  - `docs/release-notes.md`
- Could not run:
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Fixed driver mobile app online toggle flow to handle the `/driver/presence/status` response shape correctly and avoid false failure messages.

### API Changes
- No backend endpoint contract changes.
- Mobile client now expects `/driver/presence/status` response as device status payload (`user_device_id`, `platform`, `push_provider`, `push_token`, `last_seen_at`) instead of assuming full `DriverPresence`.

### Database Changes
- None.

### Behavior Changes
- Toggling online/offline no longer throws when status response does not include `active_offers` and other presence fields.
- App now updates existing in-memory presence fields safely and waits for heartbeat to refresh full presence/offers payload.
- Removed misleading Promise logging by awaiting the status request before logging response.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `mobile_app/src/lib/api.ts`
  - `mobile_app/app/(tabs)/index.tsx`
  - `docs/release-notes.md`
- Could not run:
  - Mobile lint/typecheck/tests (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added `login_context` support to auth login and enforced admin-only sign-in for the admin web app.

### API Changes
- Updated `POST /api/v1/auth/login` to accept optional `login_context`:
  - `admin`
  - `driver`
- Context enforcement:
  - `admin` accepts only `user` and `super_admin` roles.
  - `driver` accepts only `driver` role.

### Database Changes
- None.

### Behavior Changes
- NextAuth credentials login now sends `login_context: "admin"` for admin web sign-in.
- Admin layout now enforces server-side role guard `["user", "super_admin"]` for all `/admin` routes.
- Driver-role users are blocked from establishing admin web sessions and from rendering admin pages.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/LoginRequest.php`
  - `app/Services/AuthService.php`
  - `website/src/lib/nextauth.ts`
  - `website/src/components/auth/login-form.tsx`
  - `website/src/app/admin/layout.tsx`
- Passed:
  - `/opt/homebrew/bin/php -l app/Http/Requests/LoginRequest.php`
  - `/opt/homebrew/bin/php -l app/Services/AuthService.php`
- Could not run:
  - Frontend lint/typecheck (`node`/`npm` not available in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Added an admin action on the driver detail page to update a driver password via a dedicated dialog and endpoint.

### API Changes
- Added `PATCH /api/v1/drivers/{driver_uuid}/password` for updating a driver password.
- Request payload:
  - `password` (required)
  - `password_confirmation` (required via `confirmed` validation)
- Endpoint is inside admin API role middleware (`role:user,super_admin`), so it is not accessible to driver-role users.

### Database Changes
- None.

### Behavior Changes
- Driver detail `Actions` dropdown now includes `Update password`.
- Selecting it opens a dialog with:
  - New password
  - Confirm new password
- Saving calls the new password endpoint and refreshes driver detail on success.
- Password update activity is logged as `Driver password updated`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/UpdateDriverPasswordRequest.php`
  - `app/Http/Controllers/Api/V1/DriverController.php`
  - `app/Services/DriverService.php`
  - `routes/api.php`
  - `website/src/lib/api/drivers.ts`
  - `website/src/components/drivers/update-driver-password-dialog.tsx`
  - `website/src/components/drivers/driver-detail-actions.tsx`
- Passed:
  - `/opt/homebrew/bin/php -l app/Http/Requests/UpdateDriverPasswordRequest.php`
  - `/opt/homebrew/bin/php -l app/Http/Controllers/Api/V1/DriverController.php`
  - `/opt/homebrew/bin/php -l app/Services/DriverService.php`
  - `/opt/homebrew/bin/php -l routes/api.php`
- Could not run:
  - `cd website && npm run lint -- --file src/components/drivers/update-driver-password-dialog.tsx --file src/components/drivers/driver-detail-actions.tsx --file src/lib/api/drivers.ts` (Node/NPM not installed in shell PATH)

## 2026-03-19 | Version: unreleased

### Summary
- Switched merchant logo storage and retrieval to AWS S3 disk usage.

### API Changes
- No endpoint shape changes.
- `logo_url` in merchant responses is now generated from S3 storage URLs.

### Database Changes
- None.

### Behavior Changes
- Merchant logo uploads are now written to `s3` disk instead of local/public disk.
- Merchant list/detail logo URLs now resolve from the `s3` disk.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Services/MerchantService.php`
  - `app/Http/Resources/MerchantResource.php`
- Passed:
  - `/opt/homebrew/bin/php -l app/Services/MerchantService.php`
  - `/opt/homebrew/bin/php -l app/Http/Resources/MerchantResource.php`

## 2026-03-19 | Version: unreleased

### Summary
- Refactored admin setup timezone and country inputs into reusable shared components and reused them on the admin settings page.
- Implemented end-to-end settings persistence for merchant name, timezone, operating countries, and merchant logo upload.
- Added merchant logo support to merchant API resources so merchant list responses include logo URL data.

### API Changes
- Added `POST /api/v1/merchants/{merchant_uuid}/logo` (multipart form upload with `logo` image file).
- Updated merchant resource payloads (including list endpoints using `MerchantResource`) to include:
  - `logo_url`

### Database Changes
- Added nullable `logo_path` column to `merchants` table.
  - Migration: `database/migrations/2026_03_19_120000_add_logo_path_to_merchants_table.php`

### Behavior Changes
- `Settings` page now loads selected merchant context and saves:
  - organization name
  - timezone
  - operating countries
  - merchant logo (image upload)
- Setup wizard and settings now share the same country/timezone selector behavior and option sources.
- Uploading a new logo replaces the previous stored merchant logo file path.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/components/settings/timezone-select.tsx`
  - `website/src/components/settings/country-multi-select.tsx`
  - `website/src/lib/geo-options.ts`
  - `website/src/components/settings/admin-setup-wizard.tsx`
  - `website/src/components/settings/organization-settings-form.tsx`
  - `website/src/app/admin/settings/page.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `app/Http/Requests/UploadMerchantLogoRequest.php`
  - `app/Http/Controllers/Api/V1/MerchantController.php`
  - `app/Services/MerchantService.php`
  - `app/Http/Resources/MerchantResource.php`
  - `app/Models/Merchant.php`
  - `routes/api.php`
  - `database/migrations/2026_03_19_120000_add_logo_path_to_merchants_table.php`
- Passed:
  - `php -l app/Http/Controllers/Api/V1/MerchantController.php`
  - `php -l app/Services/MerchantService.php`
  - `php -l app/Http/Resources/MerchantResource.php`
  - `php -l app/Http/Requests/UploadMerchantLogoRequest.php`
  - `php -l app/Models/Merchant.php`
  - `php -l database/migrations/2026_03_19_120000_add_logo_path_to_merchants_table.php`
  - `php -l routes/api.php`
  - `cd website && npm run lint` (warnings only, no errors)

## 2026-03-18 | Version: unreleased

### Summary
- Normalized `tracking.updated` webhook event identifiers to UUID-based values and removed numeric tracking event ID leakage.

### API Changes
- Webhook payload contract change for `tracking.updated` event payloads:
  - Removed `event.id`
  - Replaced `event.uuid` with `event.event_id`
  - `event.account_id`, `event.merchant_id`, `event.shipment_id`, and `event.booking_id` now carry UUID strings (or `null` for `booking_id` when no booking exists)
- Top-level `shipment_id` and `shipment_uuid` remain unchanged.

### Database Changes
- None.

### Behavior Changes
- `ProcessCarrierWebhookJob` now constructs an explicit outbound `event` payload map instead of forwarding `TrackingEvent::toArray()`.
- Outbound event metadata keeps non-ID fields (`event_code`, `event_description`, `occurred_at`, `payload`, `created_at`, `updated_at`) while ensuring identifier fields are UUID-oriented.

### Breaking Changes
- Webhook consumers relying on numeric `event.id` or `event.uuid` must migrate to `event.event_id` and UUID-based identifier values.

### Verification
- Updated files:
  - `app/Jobs/ProcessCarrierWebhookJob.php`
  - `tests/Feature/CarrierWebhookTest.php`
- Passed:
  - `php -l app/Jobs/ProcessCarrierWebhookJob.php`
  - `php -l tests/Feature/CarrierWebhookTest.php`
- Attempted:
  - `php artisan test --filter=CarrierWebhookTest` (fails in test bootstrap due existing SQLite-incompatible migration `2026_02_06_000004_update_quote_status_enum_add_booked.php` using `ALTER TABLE ... MODIFY ... ENUM ...`)

## 2026-03-18 | Version: unreleased

### Summary
- Added support for address-level location type slug input on shipment create/on-demand/update payloads.

### API Changes
- `POST /api/v1/shipments`
- `POST /api/v1/shipments/on-demand`
- `PATCH /api/v1/shipments/{shipment_uuid}`
- `pickup_address` and `dropoff_address` now accept:
  - `location_type` (slug, e.g. `"dropoff"`)
  - `location_type_slug` (slug alias)
  - alongside existing `location_type_id` (UUID).

### Database Changes
- None.

### Behavior Changes
- Address location type resolution now supports this precedence:
  - `location_type_id` / `location_type_uuid` (UUID) first
  - then `location_type` / `location_type_slug` (slug)
  - then endpoint default slug fallback (`pickup`/`dropoff`/`waypoint` as applicable).

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/StoreShipmentRequest.php`
  - `app/Http/Requests/UpdateShipmentRequest.php`
  - `app/Services/LocationService.php`
- Passed:
  - `php -l app/Http/Requests/StoreShipmentRequest.php`
  - `php -l app/Http/Requests/UpdateShipmentRequest.php`
  - `php -l app/Services/LocationService.php`

## 2026-03-18 | Version: unreleased

### Summary
- Added support for vehicle type code input on shipment create/on-demand/update payloads.

### API Changes
- `POST /api/v1/shipments`
- `POST /api/v1/shipments/on-demand`
- `PATCH /api/v1/shipments/{shipment_uuid}`
- These endpoints now accept `requested_vehicle_type` (vehicle type `code`, e.g. `"motorcycle"`) in addition to `requested_vehicle_type_id` (UUID).

### Database Changes
- None.

### Behavior Changes
- Shipment requested vehicle type resolution now supports:
  - `requested_vehicle_type_id` (UUID) first priority
  - fallback `requested_vehicle_type` (code) when UUID is not supplied.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `app/Http/Requests/StoreShipmentRequest.php`
  - `app/Http/Requests/UpdateShipmentRequest.php`
  - `app/Services/ShipmentService.php`
- Passed:
  - `php -l app/Http/Requests/StoreShipmentRequest.php`
  - `php -l app/Http/Requests/UpdateShipmentRequest.php`
  - `php -l app/Services/ShipmentService.php`

## 2026-03-18 | Version: unreleased

### Summary
- Updated registration auto-login flow to explicitly load merchants and set the selected merchant in session, mirroring login initialization behavior.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- After successful register + auto-login, the frontend now:
  - fetches merchants using the new session access token,
  - creates a default `Main` merchant if none exist,
  - updates NextAuth session with `merchants` and `selected_merchant` before redirecting to dashboard.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/components/auth/register-form.tsx`
- Passed:
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Fixed registration flow termination caused by an accidental hard `exit()` in the account-id model trait used during user creation.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Removed debug termination statements from `HasAccountId` so `User::create()` can complete normally during registration and downstream logs/DB writes continue.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `app/Http/Traits/HasAccountId.php`
- Passed:
  - `php -l app/Http/Traits/HasAccountId.php`
  - `php -l app/Services/AuthService.php`
  - `php -l app/Http/Controllers/Api/V1/AuthController.php`
  - `php -l app/Http/Requests/RegisterRequest.php`

## 2026-03-18 | Version: unreleased

### Summary
- Added end-to-end registration debug logging across Next.js proxy and Laravel auth flow to trace upstream responses, CORS headers, validation failures, and DB write execution.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `POST /api/auth/register` (Next.js proxy) now logs full upstream response diagnostics: status, headers, raw body, timing, and CORS-related headers (`access-control-allow-*`) with an origin match check.
- Laravel registration now logs:
  - register endpoint invocation metadata in `AuthController@register`
  - validation failure details in `RegisterRequest::failedValidation`
  - service-layer registration milestones (user creation, account creation, token creation) and exceptions in `AuthService::register`.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/api/auth/register/route.ts`
  - `app/Http/Controllers/Api/V1/AuthController.php`
  - `app/Http/Requests/RegisterRequest.php`
  - `app/Services/AuthService.php`
- Passed:
  - `php -l app/Http/Controllers/Api/V1/AuthController.php`
  - `php -l app/Http/Requests/RegisterRequest.php`
  - `php -l app/Services/AuthService.php`
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Added structured observability logs for the frontend register proxy route to improve debugging of upstream signup failures.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `POST /api/auth/register` now logs request lifecycle events in the Next.js server runtime (`requestId`, duration, upstream status/content-type, and fetch failure details) without logging passwords.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/api/auth/register/route.ts`
- Passed:
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Updated frontend registration flow to always attempt automatic login after successful signup and improved registration failure observability.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- After `POST /api/auth/register` succeeds, the register form now automatically signs in with credentials using `signIn(..., { redirect: false })` and performs explicit client navigation to the dashboard callback URL.
- Registration failures now both display an error in the UI and log structured failure details (`status` and parsed `payload`) to the browser console.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/components/auth/register-form.tsx`
- Passed:
  - `cd website && npm run lint`

## 2026-03-18 | Version: unreleased

### Summary
- Fixed frontend registration CORS failures by moving signup calls to a same-origin Next.js API proxy route.

### API Changes
- Added frontend proxy endpoint `POST /api/auth/register` (Next.js route) to forward registration payloads to backend `POST /api/v1/auth/register`.

### Database Changes
- None.

### Behavior Changes
- Registration from `website` now posts to same-origin `/api/auth/register` instead of calling `NEXT_PUBLIC_API_BASE_URL` directly from the browser, eliminating browser CORS preflight dependency for signup.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/app/api/auth/register/route.ts`
  - `website/src/components/auth/register-form.tsx`
- Passed:
  - `cd website && npm run lint`

## 2026-03-12 | Version: unreleased

### Summary
- Added a dedicated frontend merchant invite acceptance flow at `/auth/invites` and updated invite emails to use the new auth route.

### API Changes
- `POST /api/v1/merchant-invites/accept` now returns accepted user context (`email`, `name`, `created`) alongside the merchant and membership role so the frontend can complete the invite flow.
- Added `GET /api/v1/merchant-invites/preview?token=...` so the frontend can resolve invite context before acceptance.

### Database Changes
- None.

### Behavior Changes
- Merchant invite emails now link to `/auth/invites?token=...` instead of `/invites/accept?token=...`.
- Added an auth-styled invite acceptance page that starts with an invite review step, then shows a dedicated password setup screen when the invite requires account creation.
- The invite acceptance page now shows invite context up front, including the recipient name when the invited email already belongs to a user account.
- Preserved backward compatibility for older emailed links by redirecting `/invites/accept` to `/auth/invites`.

### Breaking Changes
- None.

### Verification
- Updated backend files:
  - `app/Mail/MerchantInviteMail.php`
  - `app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `app/Services/InviteService.php`
  - `routes/api.php`
- Updated frontend files:
  - `website/src/app/auth/invites/page.tsx`
  - `website/src/app/invites/accept/page.tsx`
  - `website/src/components/auth/invite-accept-form.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
- Passed:
  - `php -l app/Mail/MerchantInviteMail.php`
  - `php -l app/Http/Controllers/Api/V1/MerchantInviteController.php`
  - `php -l app/Services/InviteService.php`
  - `cd website && npm run build`

## 2026-03-12 | Version: unreleased

### Summary
- Fixed the merchant role migration ordering so MySQL accepts the new membership role values before legacy rows are remapped.

### API Changes
- None.

### Database Changes
- Updated `2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php` to temporarily widen the `merchant_user.role` and `merchant_invites.role` enums during both `up()` and `down()` before applying role value remaps.

### Behavior Changes
- Prevents the migration from failing with MySQL `Data truncated for column 'role'` when converting legacy merchant roles such as `owner` or `admin` to `member`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `database/migrations/2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php`
- Passed:
  - `php -l database/migrations/2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php`

## 2026-03-12 | Version: unreleased

### Summary
- Added merchant-scoped user management with the new membership roles `account_holder`, `member`, `modifier`, `biller`, and `resource_viewer`, including a unified users/invites settings experience and dedicated user detail pages.

### API Changes
- Added merchant people endpoints:
  - `GET /api/v1/merchants/{merchant_uuid}/users`
  - `POST /api/v1/merchants/{merchant_uuid}/users`
  - `GET /api/v1/merchants/{merchant_uuid}/users/{person_uuid}`
  - `PATCH /api/v1/merchants/{merchant_uuid}/users/{person_uuid}`
  - `DELETE /api/v1/merchants/{merchant_uuid}/users/{person_uuid}`
  - `POST /api/v1/merchants/{merchant_uuid}/users/{person_uuid}/resend`
- Merchant responses now include merchant-specific access metadata for the authenticated user.
- Merchant member/invite validation now accepts and normalizes the new merchant role model.

### Database Changes
- Added migration `2026_03_12_120000_update_merchant_roles_for_memberships_and_invites.php` to remap legacy merchant membership and invite roles to the new merchant-specific role set and update MySQL enums.

### Behavior Changes
- Account holders are treated as members of every merchant in their account and can create merchants, view merchant users, and invite users without requiring explicit membership on every merchant.
- Merchant user management moved to `/admin/settings/users` for the selected merchant and now combines active members and pending invites in one list.
- Added dedicated merchant user detail pages at `/admin/settings/users/[userId]` with role editing, invite resend, and remove/revoke actions.
- Merchant users can no longer change their own membership role from the frontend user detail screen, but can update their own name and telephone details there.
- Hidden the settings Users navigation entry for merchant users who do not have user-management permission.
- Merchant resource and membership policies now use the new merchant access resolver instead of the legacy `owner/admin/developer/billing/read_only` checks.

### Breaking Changes
- Merchant membership and invite roles now use `account_holder`, `member`, `modifier`, `biller`, and `resource_viewer` as the primary role set.

### Verification
- Updated backend files:
  - `app/Support/MerchantAccess.php`
  - `app/Services/MerchantService.php`
  - `app/Services/MerchantUserService.php`
  - `app/Services/InviteService.php`
  - `app/Policies/MerchantPolicy.php`
  - `app/Policies/ShipmentPolicy.php`
  - `app/Policies/QuotePolicy.php`
  - `app/Policies/BookingPolicy.php`
  - `app/Policies/RoutePolicy.php`
  - `app/Policies/RunPolicy.php`
  - `app/Policies/MerchantEnvironmentPolicy.php`
  - `app/Policies/WebhookSubscriptionPolicy.php`
  - `app/Http/Controllers/Api/V1/MerchantUserController.php`
  - `app/Http/Resources/MerchantPersonResource.php`
  - `routes/api.php`
- Updated frontend files:
  - `website/src/app/admin/settings/users/page.tsx`
  - `website/src/app/admin/settings/users/[userId]/page.tsx`
  - `website/src/components/users/merchant-user-profile-dialog.tsx`
  - `website/src/components/users/merchant-user-invite-dialog.tsx`
  - `website/src/components/users/merchant-user-role-dialog.tsx`
  - `website/src/components/users/merchant-user-resend-button.tsx`
  - `website/src/components/users/merchant-user-delete-dialog.tsx`
  - `website/src/lib/api/merchants.ts`
  - `website/src/lib/types.ts`
  - `website/src/lib/auth.ts`
  - `website/src/lib/nextauth.ts`
  - `website/src/types/next-auth.d.ts`
  - `website/src/components/layout/admin-nav.tsx`
- Passed:
  - `php -l app/Support/MerchantAccess.php`
  - `php -l app/Services/MerchantUserService.php`
  - `php -l app/Http/Controllers/Api/V1/MerchantUserController.php`
  - `php -l app/Http/Resources/MerchantPersonResource.php`
  - `cd website && npm run build`
- Test limitation:
  - `php artisan test --filter=InviteFlowTest` is currently blocked by a pre-existing SQLite-incompatible migration (`ALTER TABLE ... MODIFY`) outside this change set.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed multiple dashboard/detail component prop type mismatches uncovered by the website production build.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver dashboard dialog, driver detail view, and location detail view now normalize nullable `merchantId` props to `undefined` before passing them into child components that require `string | undefined`.
- Prevented TypeScript build failures triggered during `npm run build` in the `website` app.

### Breaking Changes
- None.

### Verification
- Updated files:
  - `website/src/components/dashboard/driver-dialog-content.tsx`
  - `website/src/components/drivers/driver-detail-content.tsx`
  - `website/src/components/locations/location-detail-content.tsx`
- Production build passed:
  - `cd website && npm run build`
- Build completed with existing lint warnings in unrelated files, but no blocking errors.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed dashboard driver dialog file section prop typing for nullable merchant IDs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver dashboard dialog now converts nullable `merchantId` values to `undefined` before passing them into the files section component.
- Prevents TypeScript build failure where `null` was passed to a prop expecting `string | undefined`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/components/dashboard/driver-dialog-content.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed webhook subscriptions settings page data mapping type error by narrowing successful API responses before accessing `data`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/subscriptions` now uses an explicit `successResponse` guard before mapping subscription rows and normalizing pagination metadata.
- Prevents TypeScript build failure where `.map` was attempted on a union containing non-array `data`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/settings/subscriptions/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed webhook subscriptions settings page TypeScript narrowing for API error handling.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/subscriptions` now reads error messages from a properly narrowed API error object before rendering `loading_error`.
- Prevents TypeScript build failure where `message` was accessed on a non-error API response union.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/settings/subscriptions/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed missing documents analytics page pagination meta typing for `DataTable`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/missing-documents` now normalizes pagination metadata before passing it to `DataTable`.
- Keeps `summary_by_type` from raw report metadata while using strict pagination shape for table rendering.
- Prevents TypeScript build failure caused by optional pagination fields in raw API `meta`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/logistics/analytics/missing-documents/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-12 | Version: unreleased

### Summary
- Fixed document expiry analytics page pagination meta typing for `DataTable`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/document-expiry` now normalizes API pagination metadata before passing it to `DataTable`.
- Prevents TypeScript build failure caused by optional pagination fields in raw API `meta`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/logistics/analytics/document-expiry/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed document coverage analytics page pagination meta typing for `DataTable`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/analytics/document-coverage` now normalizes API pagination metadata before passing it to `DataTable`, ensuring required pagination fields are present.
- Prevents TypeScript build failure caused by optional pagination fields in raw API `meta`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/logistics/analytics/document-coverage/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed webhook deliveries list page type safety when creating detail links from optional delivery IDs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/(super)/webhook-deliveries` now generates row `href` only when `delivery_id` exists; otherwise it falls back to an empty link value.
- Prevents TypeScript build failure from passing `string | undefined` to `AdminRoute.webhookDeliveryDetails`.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/(super)/webhook-deliveries/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed webhook delivery detail page type safety for breadcrumb/title rendering when delivery fields are missing.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/(super)/webhook-deliveries/[deliveryId]` now safely falls back to default display values when a webhook delivery record has missing optional fields (`delivery_id`, `event`, `status`, `createdAt`).
- Prevents TypeScript build failure caused by passing `string | undefined` to breadcrumb labels.

### Breaking Changes
- None.

### Verification
- Updated file:
  - `website/src/app/admin/(super)/webhook-deliveries/[deliveryId]/page.tsx`
- Environment limitation:
  - `npm`/`node` unavailable in this environment, so local build could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Added route efficiency stats on route details with a new backend stats endpoint and frontend analytics cards/tooltips.

### API Changes
- Added `GET /api/v1/routes/{route_uuid}/stats`.
- Added optional query params on route stats endpoint:
  - `merchant_id`
  - `from` (`YYYY-MM-DD`)
  - `to` (`YYYY-MM-DD`)
- Endpoint returns:
  - route summary metrics (distance/time/utilization/idle/speeds/stops)
  - return-to-collection metrics
  - driver/route/fleet benchmark averages and deltas
  - time breakdown and timeline segments
  - data quality and calculation definitions metadata

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/routes/[routeId]` now displays a **Route Efficiency** section with:
  - key KPI cards (distance variance, driving/idle/utilization/speed, stop completion)
  - return-to-collection performance
  - benchmark comparison values and deltas
  - time breakdown bars and timeline segment summaries
- Added explanatory tooltips for route stats labels on the frontend.
- If stats fail to load, the route detail page still renders and shows a scoped stats error card.

### Breaking Changes
- None.

### Verification
- Backend files updated:
  - `routes/api.php`
  - `app/Http/Controllers/Api/V1/RouteController.php`
  - `app/Http/Requests/RouteStatsRequest.php`
  - `app/Services/RouteStatsService.php`
- Frontend files updated:
  - `website/src/lib/types.ts`
  - `website/src/lib/api/routes.ts`
  - `website/src/components/routes/route-stats-panel.tsx`
  - `website/src/app/admin/logistics/routes/[routeId]/page.tsx`
- Environment limitations:
  - `php` binary unavailable, so PHP syntax checks could not be executed.
  - `npm` binary unavailable, so frontend lint checks could not be executed.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed Admin Logistics Routes sorting and added backend sort support for the routes listing endpoint.

### API Changes
- `GET /api/v1/routes` now supports:
  - `sort_by`: `created_at|updated_at|title|code|estimated_distance|estimated_duration`
  - `sort_dir`: `asc|desc`
- Added request validation for routes listing via `ListRoutesRequest`.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/routes` table headers are now sortable for:
  - `Title`
  - `Code`
  - `Distance (km)`
  - `Duration (min)`
  - `Updated`
- Sorting now applies server-side and remains consistent with pagination/filter query params.
- Routes list search input now maps to backend filtering across `title`, `code`, and `description`.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/app/admin/logistics/routes/page.tsx`
  - `src/lib/api/routes.ts`
- Backend wiring reviewed:
  - `app/Http/Requests/ListRoutesRequest.php`
  - `app/Http/Controllers/Api/V1/RouteController.php`
  - `app/Services/RouteService.php`
- PHP syntax checks could not be run in this environment (`php` command unavailable).

## 2026-03-11 | Version: unreleased

### Summary
- Updated the **Add Subscription** form to match the new edit form UI and behavior.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Replaced the generic create-resource dialog on `/admin/webhooks/subscriptions` with a webhook-specific create dialog.
- New create dialog now uses:
  - the same event-type cards
  - shadcn `Switch` controls
  - the same endpoint URL input style as edit
- Create flow now submits `merchant_id`, `url`, and selected `event_types` to create subscriptions and refreshes the list on success.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/app/admin/webhooks/subscriptions/page.tsx`
  - `src/components/webhooks/webhook-subscription-create-dialog.tsx`

## 2026-03-11 | Version: unreleased

### Summary
- Refined webhook subscription edit event picker by removing `Webhook Test` from selectable events and switching controls to shadcn `Switch`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Edit dialog event list no longer includes `webhook.test` as a selectable subscription event.
- Event selection UI now uses shadcn `Switch` controls instead of native checkboxes.
- Existing legacy/custom events saved on a subscription are still displayed and can be toggled.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/components/webhooks/webhook-subscription-detail-actions.tsx`
  - `src/lib/webhooks.ts`

## 2026-03-11 | Version: unreleased

### Summary
- Updated webhook subscription edit dialog to present selectable event types instead of free-text event input.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- On `/admin/webhooks/subscriptions/[subscriptionId]` edit action:
  - Users now select event subscriptions from a list of available webhook event types.
  - Existing saved custom/legacy event keys are preserved and shown as selectable options.
- Saves continue to use `PATCH /api/v1/webhooks/subscriptions/{subscription_uuid}` with selected `event_types`.

### Breaking Changes
- None.

### Verification
- Frontend lint passed:
  - `src/components/webhooks/webhook-subscription-detail-actions.tsx`
  - `src/lib/webhooks.ts`

## 2026-03-11 | Version: unreleased

### Summary
- Added `Edit` action to webhook subscription detail page with a dialog to update endpoint URL and event types.

### API Changes
- Added `PATCH /api/v1/webhooks/subscriptions/{subscription_uuid}` to update webhook subscriptions.
- Added `UpdateWebhookSubscriptionRequest` validation for partial updates:
  - `url` (optional, valid URL)
  - `event_types` (optional array, minimum one item when provided)

### Database Changes
- None.

### Behavior Changes
- Webhook subscription detail page actions now include:
  - `Edit` (opens dialog, updates subscription, refreshes page)
  - `Test`
  - `Delete`
- Edit dialog pre-fills current URL and event types from subscription data.

### Breaking Changes
- None.

### Verification
- Frontend lint passed for updated files:
  - `src/app/admin/webhooks/subscriptions/[subscriptionId]/page.tsx`
  - `src/components/webhooks/webhook-subscription-detail-actions.tsx`
  - `src/lib/api/webhooks.ts`
- Backend route/controller/request/policy wiring reviewed:
  - `routes/api.php`
  - `app/Http/Controllers/Api/V1/WebhookSubscriptionController.php`
  - `app/Http/Requests/UpdateWebhookSubscriptionRequest.php`
  - `app/Policies/WebhookSubscriptionPolicy.php`
- PHP syntax checks could not be run in this environment (`php` command unavailable).

## 2026-03-11 | Version: unreleased

### Summary
- Added a webhook subscription detail page with delivery attempt/response history and actionable `Test`/`Delete` controls.

### API Changes
- Added `GET /api/v1/webhooks/subscriptions/{subscription_uuid}` to fetch:
  - subscription details
  - paginated delivery attempts for that subscription
- `WebhookDeliveryResource` now also returns:
  - `attempts`
  - `last_response_code`
  - `last_response_body`
  - `last_attempt_at`
  - `created_at`
  - compatibility aliases (`delivery_id`, `event`, `createdAt`)

### Database Changes
- None.

### Behavior Changes
- `/admin/webhooks/subscriptions` rows now link to a dedicated detail page.
- New page `/admin/webhooks/subscriptions/[subscriptionId]` shows:
  - endpoint details (URL, status, subscribed events)
  - delivery attempts table with response code/body and attempt count
  - actions dropdown with `Test` and `Delete`
- `Delete` now confirms in a dialog, then redirects back to subscriptions list on success.
- `Test` queues a webhook test delivery and refreshes page data.

### Breaking Changes
- None.

### Verification
- Frontend lint passed for changed website files, including new detail page and actions component.
- Backend logic reviewed for route/controller/resource wiring:
  - `routes/api.php`
  - `app/Http/Controllers/Api/V1/WebhookSubscriptionController.php`
  - `app/Http/Resources/WebhookDeliveryResource.php`
- PHP syntax checks could not be run in this environment (`php` command unavailable).

## 2026-03-11 | Version: unreleased

### Summary
- Fixed Admin Settings webhook subscriptions frontend to use merchant-scoped listing and corrected table field rendering.

### API Changes
- `GET /api/v1/webhooks/subscriptions` frontend client now sends `merchant_id` from the currently selected merchant context.
- Endpoint behavior verified in controller code: `WebhookSubscriptionController@index` accepts `merchant_id` (or `merchant_uuid`) and filters records by that merchant.

### Database Changes
- None.

### Behavior Changes
- `/admin/webhooks/subscriptions` now only loads subscriptions for the currently selected merchant (for merchant users).
- When no merchant is selected, the page now shows a clear prompt instead of attempting an unscoped request.
- Events and created timestamp now render correctly from API fields (`event_types`, `created_at`).

### Breaking Changes
- None.

### Verification
- Frontend lint passed for touched files:
  - `src/app/admin/webhooks/subscriptions/page.tsx`
  - `src/lib/api/webhooks.ts`
  - `src/lib/types.ts`
- Code review confirmed backend filtering in `app/Http/Controllers/Api/V1/WebhookSubscriptionController.php`.

## 2026-03-11 | Version: unreleased

### Summary
- Added DataTable-based sorting to Logistics Analytics document reports (`Missing Documents`, `Expired/Expiring Documents`, `Upload Coverage by Type`) with backend-supported sort params.

### API Changes
- `GET /api/v1/reports/missing-documents` now accepts:
  - `sort_by`: `merchant_name|entity_type|entity_label|file_type_name`
  - `sort_dir`: `asc|desc`
- `GET /api/v1/reports/document-expiry` now accepts:
  - `sort_by`: `merchant_name|entity_type|entity_label|file_type_name|original_name|uploaded_at|expires_at|days_to_expiry`
  - `sort_dir`: `asc|desc`
- `GET /api/v1/reports/document-coverage` now accepts:
  - `sort_by`: `merchant_name|entity_type|file_type_name|required_count|uploaded_count|missing_count|expired_count|compliance_percent`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- Replaced report table markup with shared `DataTable` component on:
  - `/admin/logistics/analytics/missing-documents`
  - `/admin/logistics/analytics/document-expiry`
  - `/admin/logistics/analytics/document-coverage`
- Added clickable sortable headers on these pages, with sorting persisted in URL query params and applied by report endpoints.
- Existing filters and pagination remain functional and now work with sort state.

### Breaking Changes
- None.

### Verification
- Code review confirmed the three analytics pages now render `DataTable` and pass `enableSorting`, `sortableColumns`, and `sortKeyMap`.
- Code review confirmed backend request validation and controller logic accept and apply allow-listed `sort_by`/`sort_dir`.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax checks not run in this environment because `php` is unavailable.

### Internal Changes
- Added report sort parameter typing in `website/src/lib/api/reports.ts`.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed analytics report runtime error caused by passing server-side functions into client `DataTable` props.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Table-based analytics pages (`route-waiting-times`, `drivers-speeding`, `stops-analysis`) now render without the React Server/Client serialization error.
- Formatted values (minutes, speed, latest timestamps) remain displayed in the same columns.

### Breaking Changes
- None.

### Verification
- Code review confirmed `customValue` function props were removed from `DataTable` column definitions in affected server pages.
- Code review confirmed each page now maps preformatted display fields into row data for client-safe rendering.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Replaced `customValue` callbacks with precomputed `*Display` fields in analytics report rows.

## 2026-03-11 | Version: unreleased

### Summary
- Migrated table-based Logistics Analytics reports to the shared `DataTable` component.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The following analytics report tables now use the standard `DataTable` UI with consistent styling and sorting indicators:
  - `/admin/logistics/analytics/route-waiting-times`
  - `/admin/logistics/analytics/drivers-speeding`
  - `/admin/logistics/analytics/stops-analysis`
- Existing URL sorting behavior (`sort_by`, `sort_dir`) remains supported for these pages.

### Breaking Changes
- None.

### Verification
- Code review confirmed raw table markup was replaced with `DataTable` on all three analytics pages.
- Code review confirmed sort key mappings and custom formatted values (`minutes`, `kph`, `date/time`) still render correctly.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added `DataTable` column configs with `customValue` and `sortKeyMap` for aggregated analytics row models.

## 2026-03-11 | Version: unreleased

### Summary
- Added clickable column sorting controls to table-based Logistics Analytics pages.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Added URL-driven sorting (`sort_by`, `sort_dir`) for:
  - `/admin/logistics/analytics/route-waiting-times`
  - `/admin/logistics/analytics/drivers-speeding`
  - `/admin/logistics/analytics/stops-analysis`
- Table headers are now clickable and toggle ascending/descending order per column on each page.

### Breaking Changes
- None.

### Verification
- Code review confirmed each analytics page now parses `searchParams` sorting values and applies deterministic in-page row sorting.
- Code review confirmed headers render sortable links via `withAdminQuery(...)` and analytics route constants.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Introduced per-page sort normalization and sorting helpers for aggregated analytics row models.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Settings Users table.

### API Changes
- `GET /api/v1/admin/users` now supports sorting params:
  - `sort_by`: `created_at|name|email|role`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/settings/users` now supports sortable headers for:
  - `Name`
  - `Email`
  - `Role`
- Sorting is applied on the backend and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed users table now enables sorting and passes `sort_by`/`sort_dir`.
- Code review confirmed `AdminController::users()` applies allow-listed sorting with fallback direction.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added users page sort normalization and admin API client sort param typing.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Carriers table.

### API Changes
- `GET /api/v1/carriers` now supports sorting params:
  - `sort_by`: `created_at|name|code|type|enabled`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/carriers` now supports sortable headers for:
  - `Carrier`
  - `Code`
  - `Type`
- Sorting is applied on the backend and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed carriers table now enables sorting and sends `sort_by`/`sort_dir`.
- Code review confirmed `AdminCarrierController@index` now applies allow-listed sorting with direction fallback.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added carriers page sort normalization and API client sort param typing.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Bookings table.

### API Changes
- `GET /api/v1/bookings` and `/api/v1/admin/bookings` now support sorting params handled by booking list service:
  - `sort_by`: `created_at|uuid|shipment_id|status|booked_at`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/bookings` now supports sortable headers for:
  - `Booking`
  - `Shipment`
  - `Status`
  - `Scheduled`
- Sorting is applied at the API layer and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed bookings table now enables sorting and passes `sort_by`/`sort_dir`.
- Code review confirmed `BookingService` now applies allow-listed sorting for both account and environment listing flows.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added `applyListSorting()` helper in `BookingService` and sort key mapping in bookings page (`booking_id -> uuid`, `scheduledAt -> booked_at`).

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Quotes table.

### API Changes
- `GET /api/v1/quotes` now supports sorting params used by the list service:
  - `sort_by`: `created_at|merchant_order_ref|collection_date|status|expires_at|requested_at`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/shipments/quotes` now supports sortable headers for:
  - `Order Ref`
  - `Collection Date`
  - `Status`
  - `Expires At`
  - `Requested At`
- Sorting is applied on the backend and preserved through pagination.

### Breaking Changes
- None.

### Verification
- Code review confirmed quotes table enables sorting and passes `sort_by`/`sort_dir`.
- Code review confirmed `QuoteService::listQuotes()` applies allow-listed sort keys with direction fallback.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added sort param typing to quotes API client and sort normalization in quotes admin page.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Vehicles table.

### API Changes
- `GET /api/v1/vehicles` now accepts sorting params consumed by the service:
  - `sort_by`: `created_at|plate_number|type|make|model|is_active`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/vehicles` now supports sortable headers for `Plate`, `Type`, `Make`, `Model`, and `Status`.
- Type sorting orders by vehicle type name; status sorting maps to `is_active`.

### Breaking Changes
- None.

### Verification
- Code review confirmed vehicles table now enables sorting and sends `sort_by`/`sort_dir`.
- Code review confirmed `VehicleService::listVehicles()` applies allow-listed sorting and joins `vehicle_types` when sorting by type.
- Code review confirmed scoped/filter/search clauses are qualified with `vehicles.*` to avoid ambiguous columns when joins are applied.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added sort param typing to `listVehicles` API client and sort key mapping in vehicles page table config.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed SQL ambiguity in Locations listing after enabling `Type` sorting.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations` no longer throws a SQL error when listing/sorting locations (including `Type` sort).

### Breaking Changes
- None.

### Verification
- Code review confirmed `LocationService::listLocations()` now qualifies location table columns (`locations.*`) in filters/search clauses to avoid ambiguous column references during joins.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Hardened query column qualification in location list service to remain safe when joining `location_types` for sorting.

## 2026-03-11 | Version: unreleased

### Summary
- Fixed Locations table sorting for the `Type` column.

### API Changes
- Extended `GET /api/v1/locations` sorting allow-list:
  - `sort_by` now also supports `type`.

### Database Changes
- None.

### Behavior Changes
- On `/admin/logistics/locations`, clicking the `Type` column header now sorts results by location type title.

### Breaking Changes
- None.

### Verification
- Code review confirmed frontend table marks `type` as sortable and sends `sort_by=type`.
- Code review confirmed `ListLocationsRequest` now validates `type` in `sort_by`.
- Code review confirmed `LocationService::listLocations()` joins `location_types` and orders by `location_types.title` for `sort_by=type`.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Updated location sort normalization and backend sortable column mapping to include `type`.

## 2026-03-11 | Version: unreleased

### Summary
- Enabled server-backed sorting for the Admin Logistics Locations table.

### API Changes
- `GET /api/v1/locations` now supports:
  - `sort_by`: `created_at|name|code|company|city`
  - `sort_dir`: `asc|desc`

### Database Changes
- None.

### Behavior Changes
- `/admin/logistics/locations` now allows clicking sortable column headers (`Name`, `Code`, `Company`, `City`) to sort results.
- Sorting is applied on the backend and reflected in paginated results.

### Breaking Changes
- None.

### Verification
- Code review confirmed frontend table now sends `sort_by` and `sort_dir` and enables sortable columns.
- Code review confirmed `ListLocationsRequest` validates `sort_by` and `sort_dir`.
- Code review confirmed `LocationService::listLocations()` applies dynamic sort with safe allow-list fallback.
- Automated lint/build not run in this environment because `npm` is unavailable.
- PHP syntax check not run in this environment because `php` is unavailable.

### Internal Changes
- Added location list sort normalization in `website/src/app/admin/logistics/locations/page.tsx` and typed sort params in `website/src/lib/api/locations.ts`.

## 2026-03-10 | Version: unreleased

### Summary
- Added in-page driver and location detail dialogs to the Locations Activity view so users can inspect those entities without leaving the page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity`:
  - Driver links in Truck details and Location details now open a driver dialog instead of navigating away.
  - Location links in Truck details and Location details now open a location dialog instead of navigating away.
  - New dialogs match the existing shipment dialog flow and stay above high-z activity overlays.

### Breaking Changes
- None.

### Verification
- Code review confirmed new dialog components and content loaders:
  - `website/src/components/dashboard/driver-map-dialog.tsx`
  - `website/src/components/dashboard/driver-dialog-content.tsx`
  - `website/src/components/dashboard/location-map-dialog.tsx`
  - `website/src/components/dashboard/location-dialog-content.tsx`
- Code review confirmed activity page now opens driver/location dialogs from detail panel references.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Reused existing driver/location detail UI building blocks in new client-side dialog content components for map-context rendering.

## 2026-03-10 | Version: unreleased

### Summary
- Refactored the admin location detail route to use a reusable location detail content component, aligned with the shipment detail page pattern.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- No intended user-facing behavior change; location detail data, actions, and layout remain the same.

### Breaking Changes
- None.

### Verification
- Code review confirmed `website/src/app/admin/logistics/locations/[locationId]/page.tsx` now only resolves auth/params and delegates rendering.
- Code review confirmed location detail data-loading and UI moved into `website/src/components/locations/location-detail-content.tsx`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added reusable server component `LocationDetailContent` with `locationId`, `accessToken`, `merchantId`, and `embedded` props for composable location detail rendering.

## 2026-03-10 | Version: unreleased

### Summary
- Refactored the admin driver detail route to use a reusable driver detail content component, matching the shipment detail page structure.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- No user-facing behavior changes intended; driver detail UI and data remain the same.

### Breaking Changes
- None.

### Verification
- Code review confirmed `website/src/app/admin/logistics/drivers/[driverId]/page.tsx` is now a thin auth/params wrapper.
- Code review confirmed driver detail rendering and data loading moved to `website/src/components/drivers/driver-detail-content.tsx`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added reusable server component `DriverDetailContent` with `driverId`, `accessToken`, `merchantId`, and `embedded` props for composable driver-detail reuse.

## 2026-03-10 | Version: unreleased

### Summary
- Expanded contextual linking in Locations Activity truck details to navigate or open related resources faster.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity` truck details:
  - Vehicle reference now links to vehicle details when `vehicleId` exists.
  - Event type now links to filtered vehicle activities when `vehicleId` exists.
  - Driver integration reference now links to driver details when `driverId` exists.
  - Driver email/phone now use `mailto:` and `tel:` links.
  - Shipment destination links to location details when location is known.
  - Shipment status now opens the shipment dialog when `shipmentId` exists.

### Breaking Changes
- None.

### Verification
- Code review confirmed additional links/buttons route to `vehicle`, `driver`, `location`, and shipment dialog contexts using available IDs.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Added `openShipmentDialog` callback and reused existing admin route helpers (`AdminLinks`, `withAdminQuery`) in truck details rendering.

## 2026-03-10 | Version: unreleased

### Summary
- Increased shipment stop timeline connector thickness and removed visible gaps between adjacent stop cards.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment stop connector rails are now 2px thick.
- Connector segments extend by 1px beyond each card boundary so lines visually touch from one stop card to the next.

### Breaking Changes
- None.

### Verification
- Code review confirmed timeline rails now use `w-[2px]` with `-top-px`/`-bottom-px` overlap in the stop list.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Refined connector segment classes in `website/src/components/shipments/shipment-stops-overview.tsx`.

## 2026-03-10 | Version: unreleased

### Summary
- Improved shipment stops timeline UI to render a continuous connector line between stop markers.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In shipment stop overview cards, timeline connector lines now stay visually connected between entries even when stop card heights vary.
- Active and hover card states were slightly refined for clearer timeline focus.

### Breaking Changes
- None.

### Verification
- Code review confirmed per-stop connector rails now render with top/bottom half segments around each stop marker.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Updated timeline card rendering in `website/src/components/shipments/shipment-stops-overview.tsx` to remove fixed-height connector blocks.

## 2026-03-10 | Version: unreleased

### Summary
- Made the truck details shipment `Reference` field open the shipment dialog when linked shipment data exists.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity`, clicking `Reference` under Truck details now opens the shipment details dialog if `shipmentRecord.shipmentId` is available.

### Breaking Changes
- None.

### Verification
- Code review confirmed `Reference` now renders as a button and sets `selectedShipmentId` from `selectedTruck.shipmentRecord.shipmentId`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Reused existing dialog open state (`selectedShipmentId`) for additional shipment reference entry point.

## 2026-03-10 | Version: unreleased

### Summary
- Raised the shipment dialog overlay z-index to fully cover high-z activity page UI elements.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment dialog backdrop now overlays activity HUD elements (search controls, totals, floating cards) on `/admin/logistics/locations/activity`.

### Breaking Changes
- None.

### Verification
- Code review confirmed `ShipmentMapDialog` now applies `overlayClassName=\"z-[2147483647]\"`.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Updated per-dialog overlay layering configuration in `ShipmentMapDialog`.

## 2026-03-10 | Version: unreleased

### Summary
- Raised shipment dialog stacking order so it renders above high-z overlays in the locations activity view.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment details dialog now reliably appears above activity HUD panels (search input, activity badges, vehicle totals) in `/admin/logistics/locations/activity`.

### Breaking Changes
- None.

### Verification
- Code review confirmed `ShipmentMapDialog` now sets content to `z-[2147483647]` and overlay to `z-[2147483646]`.
- Code review confirmed shared `DialogContent` now supports `overlayClassName` for targeted z-index overrides.
- Automated lint/build not run in this environment because `npm` is unavailable.

### Internal Changes
- Extended `DialogContent` API with an optional `overlayClassName` prop for per-dialog layering control.

## 2026-03-10 | Version: unreleased

### Summary
- Changed shipment click behavior in Locations Activity truck details to open the in-page shipment dialog instead of navigating away.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `/admin/logistics/locations/activity`, clicking a truck shipment reference now opens the `ShipmentMapDialog` with shipment details.
- Users stay on the activity view context while reviewing shipment details.

### Breaking Changes
- None.

### Verification
- Manual UI review in `website/src/app/admin/logistics/locations/activity/page.tsx` confirms shipment reference now triggers `selectedShipmentId` dialog state.
- Attempted automated lint was not run in this environment because `npm` is not available.

### Internal Changes
- Reused the existing dashboard shipment dialog component (`ShipmentMapDialog`) in the locations activity page.

## 2026-03-10 | Version: unreleased

### Summary
- Updated vehicle activity timeline entries to link to location details only when the location record is present in the activity payload.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In `Latest vehicle activities`, location text is now clickable only when `activity.location.location_id` exists.
- Activities that only have a raw `location_id` (without a loaded `location` entry) now render non-clickable location text to avoid broken navigation.

### Breaking Changes
- None.

### Verification
- Manual review of timeline rendering confirms location links now require `activity.location.location_id`.
- Attempted `npm --prefix website run lint -- src/components/vehicles/vehicle-activity-timeline-card.tsx` (failed in this environment: `npm` command not found).

### Internal Changes
- Refined timeline link rendering logic in `website/src/components/vehicles/vehicle-activity-timeline-card.tsx` to derive links from nested location resources.

## 2026-03-10 | Version: unreleased

### Summary
- Scoped dashboard summary stats and created-over-time analytics to the actively selected merchant when the admin UI has a merchant context, and started persisting `merchant_id` on vehicles.

### API Changes
- Updated `GET /api/v1/reports/dashboard_stats` to accept optional `merchant_id` filtering.
- Updated `GET /api/v1/reports/created_over_time` to accept optional `merchant_id` filtering.
- Updated `GET /api/v1/reports/shipments_full_report` to consume optional `merchant_id` filtering.
- Updated vehicle create/update payloads to persist `merchant_id`, and vehicle detail fetch now honors merchant-scoped filtering.

### Database Changes
- Added nullable `merchant_id` to `vehicles` with a backfill from runs, vehicle activity, driver assignments, and single-merchant accounts.

### Behavior Changes
- Admin dashboard and logistics analytics now send the selected merchant UUID when requesting dashboard stats.
- Admin dashboard and logistics analytics now send the selected merchant UUID when requesting created-over-time chart data.
- Admin logistics analytics now sends selected merchant UUID when requesting shipment full report data.
- Route Waiting Times analytics now sends selected merchant UUID on paginated shipment full report requests.
- Locations activity API polling now consistently reuses the selected merchant UUID for vehicle check and vehicle activity requests.
- All pages under `/admin/logistics/analytics/*` now resolve merchant scope from `session.selected_merchant` and send that UUID to their analytics endpoints.
- `GET /api/v1/vehicles/latest-activity-check` now scopes its vehicle base set by `vehicles.merchant_id` (selected merchant) instead of broad account-level matching.
- Dashboard stat counts now respect the provided merchant filter for shipments, bookings, quotes, merchants, and members.
- Dashboard `Total fleet` now counts vehicles using the actual `vehicles` schema instead of the removed/nonexistent `status` column path.
- Created-over-time chart counts now respect the provided merchant filter for quotes, shipments, and bookings.
- New and imported vehicles now store the selected merchant, and vehicle merchant filtering now uses the vehicle record's `merchant_id`.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/DashboardStatsReportRequest.php`
- `php -l app/Http/Requests/CreatedOverTimeReportRequest.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Services/VehicleActivityService.php`
- `php -l database/migrations/2026_03_10_120000_add_merchant_id_to_vehicles_table.php`
- Reviewed `storage/logs/laravel.log` and removed the failing dashboard vehicle count path that queried `vehicles.status`.

### Internal Changes
- Extended the website reports API client to pass `merchant_id` through `getDashboardStats`.

## 2026-03-05 | Version: unreleased

### Summary
- Upgraded Postman collections to YAML-based v3 schema files for easier review and source control diffs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Added YAML Postman collection files:
  - `postman/collections/Courier Integrate API - Drivers.postman_collection.yaml`
  - `postman/collections/Courier Integrate API - Super Admins.postman_collection.yaml`
  - `postman/collections/Courier Integrate API.postman_collection.yaml`
- Updated collection schema reference in YAML files to `https://schema.getpostman.com/json/collection/v3.0.0/collection.json`.

### Breaking Changes
- None.

### Verification
- Confirmed all YAML files were generated from the corresponding JSON collections and include the v3 schema URL.

### Internal Changes
- Preserved original JSON collections and added YAML variants alongside them.


## 2026-03-04 | Version: unreleased

### Summary
- Added `Expired / Expiring Documents` and `Upload Coverage by Type` reports with dedicated backend APIs and analytics pages.

### API Changes
- Added `GET /api/v1/reports/document-expiry`:
  - Params: `merchant_id`, `entity_type`, `status` (`expired|expiring`), `expiring_in_days`, `page`, `per_page`.
  - Returns paginated document rows with expiry status and days-to-expiry.
- Added `GET /api/v1/reports/document-coverage`:
  - Params: `merchant_id`, `entity_type`, `page`, `per_page`.
  - Returns paginated coverage rows per merchant/entity/file type with required/uploaded/missing/expired counts and compliance percent.

### Database Changes
- None.

### Behavior Changes
- Added analytics page: `/admin/logistics/analytics/document-expiry`.
- Added analytics page: `/admin/logistics/analytics/document-coverage`.
- Added navigation items:
  - `Expired / Expiring Documents`
  - `Upload Coverage by Type`

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/DocumentComplianceReportRequest.php`
- `php -l app/Http/Requests/MissingDocumentsReportRequest.php`
- `npm run build` (in `website/`)

### Internal Changes
- Added shared document-compliance request validation and report client typings for expiry/coverage payloads.

## 2026-03-04 | Version: unreleased

### Summary
- Added a new `Missing Documents` analytics report to identify entries that do not have required uploads by active file type.

### API Changes
- Added `GET /api/v1/reports/missing-documents`.
- Query params:
  - `merchant_id` (optional, UUID)
  - `entity_type` (optional: `shipment`, `driver`, `vehicle`)
  - `per_page` (optional, max 200)
  - `page` (optional)
- Response includes paginated missing-document rows and `summary_by_type` in metadata.

### Database Changes
- None.

### Behavior Changes
- Added analytics page: `/admin/logistics/analytics/missing-documents`.
- Added `Missing Documents` item under Logistics > Analytics navigation.
- Report displays:
  - Summary counts of missing entries per merchant/entity/document type.
  - Detailed missing rows with links to entity detail pages.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/MissingDocumentsReportRequest.php`
- `npm run build` (in `website/`)

### Internal Changes
- Extended reports API client/types and admin route constants to support missing-documents analytics.

## 2026-03-04 | Version: unreleased

### Summary
- Added three logistics analytics reports: Route Waiting Times, Stops Analysis, and Drivers Speeding.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Added new analytics pages:
  - `/admin/logistics/analytics/route-waiting-times`
  - `/admin/logistics/analytics/stops-analysis`
  - `/admin/logistics/analytics/drivers-speeding`
- Updated analytics navigation links so each submenu item opens its dedicated report page.
- Reports use existing shipment full report and vehicle activity data to compute route wait times, stop dwell metrics, and driver speeding aggregates.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Extended frontend admin routes and report row typing (`from_time_out`) to support route wait-time calculations.

## 2026-03-04 | Version: unreleased

### Summary
- Removed standalone `end_run` from location automation and renamed `start_run` in the UI to `End run & start new run` to match the enforced lifecycle.

### API Changes
- `PUT /api/v1/merchants/{merchant_uuid}/location-automation` no longer accepts `end_run` as an action.
- Supported action set is now:
  - `record_vehicle_entry`
  - `record_vehicle_exit`
  - `start_run`
  - `create_shipment`

### Database Changes
- None.

### Behavior Changes
- Stored automation rules containing `end_run` are ignored by runtime execution.
- Admin automation action pickers no longer offer `End run`; the rollover behavior remains part of `start_run`.
- Action display text now explicitly communicates rollover behavior as `End run & start new run`.

### Breaking Changes
- Existing clients that submit `end_run` in location automation updates will fail validation and must migrate to `start_run`.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Requests/UpdateMerchantLocationAutomationRequest.php`
- `npm --prefix website run build`

### Internal Changes
- Removed dead `completeActiveRunAtLocation` execution path tied to configured `end_run`.

## 2026-03-04 | Version: unreleased

### Summary
- Simplified location automation lifecycle actions and updated auto-run/auto-shipment sequencing to rely on vehicle entry/exit, run start/end, and shipment creation only.

### API Changes
- `PUT /api/v1/merchants/{merchant_uuid}/location-automation` now accepts this reduced action set for `entry`/`exit` rules:
  - `record_vehicle_entry`
  - `record_vehicle_exit`
  - `start_run`
  - `end_run`
  - `create_shipment`

### Database Changes
- None.

### Behavior Changes
- Shipment delivery completion is now triggered by vehicle geofence exit, which closes the open shipment delivery stage timing and marks the matching auto-created shipment as delivered.
- Auto-created shipments are constrained to one shipment per `run_id + dropoff_location_id`.
- Auto-created shipment `collection_date` is now set to at least one second after run start to preserve chronological stage ordering.
- `start_run` now rolls over runs by ending the current run first only when that run already has shipments; runs with no shipments remain open and are reused.
- Default fallback automation rules were simplified:
  - Entry: `record_vehicle_entry`, optional `start_run`, optional `create_shipment`
  - Exit: `record_vehicle_exit`

### Breaking Changes
- Saved automation configurations using removed actions (`attach_to_active_run`, `mark_origin_departure`, `mark_shipment_collected`, `mark_shipment_delivered`, `update_run_destination`) must be updated before re-saving through the API/UI.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Requests/UpdateMerchantLocationAutomationRequest.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test tests/Feature/AutoRunLifecycleServiceTest.php` (fails in this environment due to existing SQLite-incompatible migration SQL: `ALTER TABLE ... MODIFY ... ENUM ...`)

### Internal Changes
- Removed legacy action options from validation/types/UI and aligned local docs to the reduced lifecycle action model.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed shared table layout constraints so wide tables scroll within their container instead of stretching parent layouts.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Data tables now keep their parent container width in flex/grid layouts and use horizontal scrolling for overflow content.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to shared table container CSS classes.

### Internal Changes
- Added `min-w-0`/`max-w-full` constraints to shared table wrappers in `website/src/components/ui/table.tsx` and `website/src/components/common/data-table.tsx`.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed the tracking view type mismatch that was blocking the website production build.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None at runtime; the shipment tracking page helper now accepts the nullable location shape already used by run stop data.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Relaxed the `formatRunStopLocation` helper input type in `website/src/components/tracking/runs-tracking-view.tsx` to match the actual stop payload shape used during build-time type checking.

## 2026-03-04 | Version: unreleased

### Summary
- Changed run tracking search to query the runs endpoint instead of filtering only the already loaded client-side list.

### API Changes
- `GET /api/v1/runs` now accepts a `search` parameter that filters by run UUID, status, service area, notes, driver name/email, and vehicle plate/reference.

### Database Changes
- None.

### Behavior Changes
- Typing in the tracking page search box now refreshes the run list from the API and keeps infinite loading aligned to the active search term.
- Empty search results now show a search-specific empty state instead of reusing the generic no-runs message.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RunService.php`

### Internal Changes
- Replaced local run filtering in the tracking view with a deferred server-backed fetch path and propagated the active search term into paginated load-more requests.

## 2026-03-04 | Version: unreleased

### Summary
- Added total parcel counts to the run tracking view.

### API Changes
- `GET /api/v1/runs` shipment entries now include `total_parcel_count` for each run shipment when parcel data is loaded.

### Database Changes
- None.

### Behavior Changes
- The shipment tracking page now shows the real total parcel count for the selected run instead of a placeholder.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RunService.php`
- `php -l app/Http/Resources/RunResource.php`

### Internal Changes
- The run listing service now eager-loads shipment parcels so the tracking summary can aggregate parcel totals without extra requests.

## 2026-03-04 | Version: unreleased

### Summary
- Added location type display to the shipment tracking stop details.

### API Changes
- Vehicle activity location payloads now include nested location type metadata (`title`, `slug`, `icon`) so tracking and activity-based stop views can display the location type consistently.

### Database Changes
- None.

### Behavior Changes
- The shipment tracking page now shows `Location type` in the stop detail panel when the selected stop has location type information.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/VehicleActivityResource.php`

### Internal Changes
- Extended the website stop/location type definitions and reused them in the shared stop overview component.

## 2026-03-04 | Version: unreleased

### Summary
- Improved the run tracking map so it can render planned route locations when live stop activity coordinates are not available yet.

### API Changes
- `GET /api/v1/runs` now includes full route stop location details inside `route.stops`, including address and coordinates, for tracking consumers.

### Database Changes
- None.

### Behavior Changes
- The shipment tracking page now falls back to route-plan stops for the map and stop list when the run has no mapped vehicle activity stops yet.
- Run tracking maps should now load location markers more reliably for newly planned or lightly updated runs.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/RunResource.php`

### Internal Changes
- Corrected the website run type to treat `run.stops` as vehicle-activity-shaped stop records and added `run.route` typing for route-plan fallback rendering.

## 2026-03-04 | Version: unreleased

### Summary
- Added automation action and condition context to vehicle activity metadata for records created while location automation actions execute.

### API Changes
- `vehicle_activity.metadata` for automation-triggered records now includes an `automation_action` object with the executed action name, action ID, event, location context, and condition details.

### Database Changes
- None.

### Behavior Changes
- Vehicle activities emitted by configured location automation now record which automation action triggered them and whether that action had conditions, including the matched condition list and count.
- Visit metadata automation execution logs now also record action IDs plus condition presence and count.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`

### Internal Changes
- Wrapped configured action execution in a temporary automation context so downstream `recordVehicleActivity()` calls inherit consistent automation metadata automatically.

## 2026-03-04 | Version: unreleased

### Summary
- Improved location automation flow-map event node interaction so the full event card can be used to add actions.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The `On Entry` and `On Exit` nodes in the location automation flow map are now directly clickable instead of relying on a small floating control, making them easier to interact with.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to event-node interaction behavior in the website UI.

### Internal Changes
- Replaced the event node's small positioned button with a full-card add-action trigger and corrected it to call the add-action handler.

## 2026-03-04 | Version: unreleased

### Summary
- Added inline action-type dropdowns to the location automation flow map nodes.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin users can now change an automation action directly from the flow map node instead of switching to the rule editor list below.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to the website flow-map interaction UI.

### Internal Changes
- Passed the existing `updateActionType` handler into React Flow node data so custom action nodes can render the shared action selector.

## 2026-03-04 | Version: unreleased

### Summary
- Changed location automation action descriptions from inline copy to info-icon tooltips.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The location automation flow cards and action editor rows now show detailed action help in a hover/focus tooltip instead of always-visible text, reducing visual clutter while keeping the runtime explanation available.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to tooltip-based presentation in the website UI.

### Internal Changes
- Reused the shared tooltip component for action help in the location automation manager.

## 2026-03-04 | Version: unreleased

### Summary
- Added a markdown reference document listing the current location automation actions and their reviewed descriptions.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None at runtime.

### Breaking Changes
- None.

### Verification
- Reviewed `docs/location-automation-actions.md` for action coverage and description alignment with the current automation UI copy.

### Internal Changes
- Added `docs/location-automation-actions.md` with a two-column action name/description table for location automation review.

## 2026-03-04 | Version: unreleased

### Summary
- Expanded location automation action descriptions so each option explains the real runtime side effects it can trigger.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The location automation UI now describes when actions only document the existing visit record versus when they create runs, attach shipments, update bookings, increment attempts, or record additional vehicle activity events.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to descriptive copy in the website UI.

### Internal Changes
- Updated `ACTION_OPTIONS` descriptions in the location automation manager to match `AutoRunLifecycleService` behavior more closely.

## 2026-03-04 | Version: unreleased

### Summary
- Added visible action descriptions to the location automation flow cards and action editor rows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Admin users can now read a short explanation for each automation action directly in the flow canvas and in the per-step editor.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to rendering existing action description text in the website UI.

### Internal Changes
- Reused the existing `ACTION_OPTIONS` description metadata instead of introducing new action copy sources.

## 2026-03-04 | Version: unreleased

### Summary
- Replaced the vehicle activities page filter form with the shared `DataTable` filter controls.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Vehicle activity filtering now uses the table's built-in filter tray for merchant, vehicle, location, plate number, event type, date range, and page size.
- Resetting to the full list now uses the `All` table view instead of a standalone form reset button.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to filter UI wiring in the Next.js page.

### Internal Changes
- Removed the custom GET form from the vehicle activities page and mapped its existing query params to `DataTable.filters`.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed the vehicle activities table so the vehicle column links to the correct vehicle detail page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Clicking a vehicle in the admin vehicle activities table now opens the matching vehicle detail page.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to the vehicle link mapping in the Next.js table row data.

### Internal Changes
- Updated the vehicle activity row mapper to use `vehicle.vehicle_id` from the API resource instead of the missing top-level `vehicle_id` field for `vehicle_href`.

## 2026-03-04 | Version: unreleased

### Summary
- Expanded vehicle activity table linking so operational columns open the relevant related record or activity detail page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The vehicle activities table now links `Occurred`, `Event`, `Coordinates`, `Speed / Limit`, and `Run ID` cells to the vehicle activity detail view.
- Merchant, vehicle, driver, location, shipment, and activity ID cells continue linking to their corresponding entity pages.

### Breaking Changes
- None.

### Verification
- Not run; change is limited to static column link configuration in the Next.js page.

### Internal Changes
- Updated the admin vehicle activities table column definitions to reuse the existing `activity_href` link target for detail-oriented cells.

## 2026-03-04 | Version: unreleased

### Summary
- Added a dedicated admin vehicle activity detail view with related entity links, event timing, speed, coordinates, and raw metadata.

### API Changes
- Added `GET /api/v1/vehicle-activities/{activity_uuid}` to fetch one scoped vehicle activity record.

### Database Changes
- None.

### Behavior Changes
- The vehicle activities table now links each activity ID to a dedicated detail page.
- Admin users can inspect one vehicle event in more depth, including the related vehicle, driver, location, shipment, visit timestamps, and map coordinates.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Extended the website vehicle activity API helper/types and added a scoped backend fetch method for single-record activity retrieval.

## 2026-03-04 | Version: unreleased

### Summary
- Fixed the website production build by correcting the React Flow node state typing used by the location automation settings canvas.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- None at runtime; the admin location automation page now passes Next.js production type-checking during `npm run build`.

### Breaking Changes
- None.

### Verification
- `npm run build` (in `website/`)

### Internal Changes
- Updated `website/src/components/settings/location-automation-manager.tsx` to use `useNodesState<Node<FlowNodeData>>` so the hook generic matches `@xyflow/react`'s node constraint.

## 2026-03-04 | Version: unreleased

### Summary
- Wired `AutoRunLifecycleService` to execute saved merchant location automation rules for location entry and exit events.

### API Changes
- None beyond the previously added merchant location automation GET/PATCH endpoints.

### Database Changes
- None beyond the previously added `merchants.location_automation_settings` JSON column.

### Behavior Changes
- Auto run and auto shipment lifecycle handling now reads the selected merchant's saved `entry` and `exit` actions for the visited location type.
- When no saved rule exists for a location type yet, the lifecycle still falls back to the previous collection/delivery-point-based default behavior so existing flows keep working.
- Supported runtime actions now include starting runs, ending runs, creating shipments, attaching visits to active runs, marking origin departure, marking shipments delivered, updating run destinations, and recording automation execution metadata on `vehicle_activity.metadata`.
- Location automation conditions are now evaluated at runtime against the current run, shipment, and location context before each configured action executes.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test --filter=AutoRunLifecycleServiceTest` (blocked by existing SQLite-incompatible migration `2026_02_06_000004_update_quote_status_enum_add_booked.php`)

### Internal Changes
- Added a saved-rule execution layer in `AutoRunLifecycleService` so future location automation changes can be applied without re-hardcoding merchant behavior in service branches.

## 2026-03-04 | Version: unreleased

### Summary
- Connected the website `Location Automation` settings page to the new merchant location automation GET/PATCH endpoints.

### API Changes
- None beyond the previously added `GET /api/v1/merchants/{merchant_uuid}/location-automation` and `PATCH /api/v1/merchants/{merchant_uuid}/location-automation` endpoints.

### Database Changes
- None beyond the previously added `merchants.location_automation_settings` JSON column.

### Behavior Changes
- The website location automation page now loads persisted merchant automation rules from the API instead of relying on browser-local draft state.
- Saving the flow editor now persists the selected merchant's `entry` and `exit` rule graph through the PATCH endpoint.
- Merchants with no saved automation rules now still get default editor rows generated from their current location types, which can then be saved to the API.
- The page now shows a `Saved` versus `Unsaved changes` state based on the current rule graph.

### Breaking Changes
- None.

### Verification
- `cd website && npx eslint src/components/settings/location-automation-manager.tsx src/lib/api/location-automation.ts`

### Internal Changes
- Added a dedicated website API helper for merchant location automation and merged server-saved rules with current location types before rendering the editor.

## 2026-03-04 | Version: unreleased

### Summary
- Added dedicated merchant location automation GET/PATCH endpoints backed by persisted merchant-level location automation settings.

### API Changes
- Added `GET /api/v1/merchants/{merchant_uuid}/location-automation` to return merchant-wide location automation settings and the current `enabled` state.
- Added `PATCH /api/v1/merchants/{merchant_uuid}/location-automation` to update the merchant-wide location automation rule graph and optionally toggle `enabled`.

### Database Changes
- Added nullable `location_automation_settings` JSON to `merchants`.

### Behavior Changes
- Merchant owners/admins and super admins can now persist location automation rules per merchant instead of relying only on browser-local draft state.
- The location automation payload now validates action types, condition fields/operators, and rejects `location_type_id` values that do not belong to the route merchant.
- Location automation responses now include current location type metadata such as name, slug, icon, and color alongside the stored `entry` and `exit` rules.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/UpdateMerchantLocationAutomationRequest.php`
- `php -l app/Http/Resources/MerchantLocationAutomationResource.php`
- `php -l app/Services/MerchantService.php`
- `php -l app/Http/Controllers/Api/V1/MerchantController.php`
- `php -l tests/Feature/MerchantTest.php`
- `php artisan test --filter=MerchantTest` (blocked by existing SQLite-incompatible migration `2026_02_06_000004_update_quote_status_enum_add_booked.php`)

### Internal Changes
- Stored a snapshot of location type presentation metadata together with the automation rules so GET responses remain usable even if the location type details change later.

## 2026-03-03 | Version: unreleased

### Summary
- Added a new admin `Location Automation` settings page with a UI-first editor for merchant-wide vehicle visit automation rules grouped by merchant location type, now rendered in a single draggable flow diagram with `@xyflow/react`.

### API Changes
- None.
- Reused the existing `PATCH /api/v1/merchants/{merchant_uuid}/settings` endpoint to toggle `allow_auto_shipment_creations_at_locations` from the new page.

### Database Changes
- None.

### Behavior Changes
- The admin settings area now includes a `Location Automation` page at `admin/settings/location-automation`.
- Users can now review merchant location types in a single shared flow canvas where location types run across the top, each type has `Entry` and `Exit` child nodes, and actions are arranged beneath those event nodes.
- Users can now configure ordered draft `entry` and `exit` action lists per location type with drag-and-drop reordering directly in the diagram, with action nodes stacked vertically under each event node.
- Users can now add actions directly from each event node and remove actions directly from action nodes without leaving the diagram.
- Flow diagram add/remove buttons inside custom nodes now respond correctly instead of being swallowed by React Flow drag and pan gestures.
- Flow diagram node controls now stop pointer, mouse, and touch gestures early so add/remove buttons remain clickable inside draggable custom nodes.
- Widened each location type branch in the flow canvas so longer action labels like `Record vehicle exit` have more horizontal room before wrapping.
- Entry and exit action stacks now both load directly beneath their own event nodes instead of placing exit actions much lower on initial render.
- Increased the vertical spacing between stacked action nodes so multi-line action cards no longer overlap on initial load.
- Each action now supports draft condition rows in the UI so future automation endpoint payloads have a clear editing model.
- The page persists draft action matrices locally in the browser per merchant while backend GET/PATCH automation endpoints are still pending.
- The page exposes the existing merchant automation enable/disable switch in-context so users can toggle location automation without leaving the editor.

### Breaking Changes
- None.

### Verification
- `cd website && npx eslint src/components/settings/location-automation-manager.tsx src/app/admin/settings/location-automation/page.tsx src/app/admin/settings/page.tsx src/lib/routes/admin.ts src/lib/navigation.ts src/lib/types.ts`

### Internal Changes
- Added shared frontend types for location automation rules, actions, and conditions to support later API integration without redesigning the UI.
- Added the `@xyflow/react` dependency to support node-based rule editing on the website.

## 2026-03-03 | Version: unreleased

### Summary
- Refined the shipment stops overview dialog so it only shows stop detail rows and section headers when corresponding data is present.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipment stop detail dialogs in the website admin no longer render placeholder rows for missing vehicle, driver, location, or shipment context fields.
- Stop details now still show valid zero-like values such as `0` coordinates or speed values instead of hiding them.

### Breaking Changes
- None.

### Verification
- `cd website && npx eslint src/components/shipments/shipment-stops-overview.tsx`

### Internal Changes
- Added display-value guards and section row builders to centralize conditional detail rendering.

## 2026-03-02 | Version: unreleased

### Summary
- Added standalone merchant data purge support for `vehicle_activity`, so vehicle activity logs can be deleted without also purging runs, vehicles, or locations.

### API Changes
- Extended `POST /api/v1/merchants/{merchant_uuid}/purge-data` so `types` now accepts `vehicle_activity` as a valid purge target.

### Database Changes
- None.

### Behavior Changes
- Merchant account owners can now submit a purge request with only `vehicle_activity` selected and remove just that merchant's vehicle activity records.
- Purging `vehicle_activity` no longer requires deleting the related vehicles, runs, or locations as a side effect.
- The admin settings delete-data screen now exposes `Vehicle activity` as its own selectable purge option and clarifies that it can be deleted independently.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/DataPurgeService.php`
- `php -l tests/Feature/DataPurgeControllerTest.php`
- `php artisan test --filter=DataPurgeControllerTest`
- `cd website && npx eslint src/lib/api/delete-data.ts src/components/settings/delete-data-manager.tsx`

### Internal Changes
- Added a dedicated purge handler for the `vehicle_activity` table and a focused feature test for the purge endpoint.

## 2026-03-02 | Version: unreleased

### Summary
- Added a live admin dashboard bookings map backed by a new mapped bookings report endpoint, with vehicle plate search, status-count legend overlays, and shipment details opened in an AJAX-loaded dialog from map markers.

### API Changes
- Added `GET /api/v1/reports/mapped-bookings` to return active mapped bookings for the authenticated user, with optional `merchant_id` and `search` filters.
- The mapped bookings report searches booking UUID, shipment UUID, merchant order reference, driver name, vehicle plate number, and vehicle reference code.
- The mapped bookings payload now returns map-ready rows containing `booking_id`, `shipment_id`, `status`, `latitude`, `longitude`, `merchant_order_ref`, `driver_name`, `vehicle_plate_number`, `vehicle_label`, and `updated_at`, plus `meta.counts_by_status`.

### Database Changes
- None.

### Behavior Changes
- The admin dashboard now shows a `Live bookings map` card for the selected merchant, plotting active bookings with status-colored markers.
- The map legend now floats over the bottom of the map and shows filtered counts like `In transit - 20`.
- Dashboard users can now search the live map by vehicle plate number, booking, shipment, merchant order reference, driver name, or vehicle reference code.
- Clicking a map marker now opens the related shipment details inside a dialog without refreshing the page; the dialog fetches shipment data over the API and keeps the full shipment detail page route available.
- Shipment detail rendering is now shared between the standalone shipment page and the dashboard dialog so both surfaces stay aligned.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/MappedBookingsReportRequest.php`
- `php -l app/Http/Resources/MappedBookingReportResource.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Models/Shipment.php`
- `php -l routes/api.php`
- `cd website && npx eslint src/app/admin/page.tsx 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx' src/components/shipments/shipment-detail-content.tsx src/components/dashboard/mapped-bookings-map-card.tsx src/components/dashboard/shipment-map-dialog.tsx src/lib/api/reports.ts src/lib/types.ts src/components/common/status-badge.tsx`
- `cd website && npm run build`

### Internal Changes
- Added a dedicated mapped bookings report request/resource pair and extracted the shipment detail page body into a reusable component for dialog embedding.

## 2026-03-01 | Version: unreleased

### Summary
- Added fleet maintenance tracking for vehicles, a dashboard fleet status pie chart, and vehicle detail actions to place vehicles in and out of maintenance mode.

### API Changes
- Added `GET /api/v1/reports/fleet_status` to return `active`, `maintenance`, `standby`, and `total` vehicle counts, with optional `merchant_id` scoping.
- Added `PATCH /api/v1/vehicles/{vehicle_uuid}/maintenance` to enter or clear maintenance mode for a vehicle.
- Extended vehicle API responses with `maintenance_mode_at`, `maintenance_expected_resolved_at`, and `maintenance_description`.

### Database Changes
- Added nullable `maintenance_mode_at`, `maintenance_expected_resolved_at`, and `maintenance_description` columns to `vehicles`.

### Behavior Changes
- The admin dashboard now shows a client-fetched fleet status pie chart for the selected merchant.
- Vehicle detail pages now expose maintenance metadata and show either `Put in maintenance mode` or `Remove maintenance mode` in the actions dropdown.
- Entering maintenance mode now requires an expected resolve date and maintenance description; removing maintenance mode clears the stored maintenance fields.
- Fleet status reporting now treats vehicles with `maintenance_mode_at` as maintenance, vehicles with non-delivered/non-cancelled assigned shipments as active, and the remaining non-maintenance vehicles as standby.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/UpdateVehicleMaintenanceRequest.php`
- `php -l app/Http/Requests/FleetStatusReportRequest.php`
- `php -l app/Http/Controllers/Api/V1/VehicleController.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Resources/VehicleResource.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Models/Vehicle.php`
- `php -l database/migrations/2026_03_01_190000_add_maintenance_fields_to_vehicles_table.php`
- `cd website && npx eslint src/app/admin/page.tsx 'src/app/admin/logistics/vehicles/[vehicleId]/page.tsx' src/components/reports/fleet-status-chart.tsx src/components/vehicles/vehicle-detail-actions.tsx src/components/vehicles/vehicle-maintenance-dialog.tsx src/lib/api/reports.ts src/lib/api/vehicles.ts src/lib/types.ts`

### Internal Changes
- Reused the existing vehicle service scoping rules for the new fleet status summary and kept the dashboard fleet chart self-fetching inside its own component.

## 2026-03-01 | Version: unreleased

### Summary
- Added an `Expired files` card to the admin dashboard and linked each expired file item to its related shipment, driver, or vehicle detail page.

### API Changes
- Added `GET /api/v1/files/expired` to list expired entity files visible to the authenticated user, with optional `merchant_id` and `per_page` filters.
- Extended expired file payloads with `entity_id` and `entity_label` so the website can route users to the relevant detail page.

### Database Changes
- None.

### Behavior Changes
- The admin dashboard now shows up to five expired files for the selected merchant under a dedicated `Expired files` section.
- Each expired file row links directly to the related entity file section, including opening the shipment detail `Files` tab, and shows the expired document name, type, and expiry date.
- The dashboard recent activity card is now rendered through a reusable component alongside the new expired files component.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ListExpiredEntityFilesRequest.php`
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Services/EntityFileService.php`
- `php -l app/Http/Resources/EntityFileResource.php`
- `cd website && npx eslint src/app/admin/page.tsx 'src/app/admin/logistics/drivers/[driverId]/page.tsx' 'src/app/admin/logistics/vehicles/[vehicleId]/page.tsx' 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx' src/components/files/entity-files-section.tsx src/components/dashboard/recent-activity-card.tsx src/components/dashboard/expired-files-card.tsx src/lib/api/entity-files.ts src/lib/types.ts`

### Internal Changes
- Added a reusable website API helper for expired entity files and moved the dashboard activity rendering into a standalone card component.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed website build-blocking type errors across routes, shipments, and shared file table components.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The website production build now completes successfully again.
- Admin routes view links now point to the correct routes index constant.
- Shipment parcel typing now includes parcel codes used by the shipment detail UI.

### Breaking Changes
- None.

### Verification
- `npm run build` in `website`

### Internal Changes
- Added missing `page` and `per_page` request params to the typed website shipments API client.
- Tightened shared entity file table column typing so conditional columns do not leak `null` into `DataTable`.

## 2026-03-01 | Version: unreleased

### Summary
- The website admin activity log now uses the shared `DataTable` filter panel instead of a standalone filter form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Activity log filtering for account, merchant, environment, actor, action, entity, date range, null-environment-only, and page size now runs through the shared table filter UI while keeping the same query params.
- The activity log page no longer renders a separate inline filter form above the table.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Replaced the page-level activity log GET form with shared `DataTable` URL-backed text, date, and select filters.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed the admin tracking providers UI so import actions only appear for provider capabilities returned by the API.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Integrations admin page now hides `Import Drivers`, `Import Locations`, and `Import Vehicles` actions unless the selected tracking provider exposes the matching capability flag:
  - `has_driver_importing`
  - `has_locations_importing`
  - `has_vehicle_importing`

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/integrations/tracking-providers.tsx src/lib/types.ts`

### Internal Changes
- Extended the website `TrackingProvider` type with import capability flags and gated import button rendering with a shared capability helper.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed tracking provider listing so invalid encrypted merchant integration payloads no longer crash the API response.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `GET /api/v1/tracking-providers` now returns tracking providers even if a related merchant integration row contains invalid encrypted `integration_data`; the affected integration payload is returned as `null` instead of triggering a decrypt exception.
- Admin tracking provider list responses now go through normal controller error handling again.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/TrackingProviderResource.php`
- `php -l app/Http/Controllers/Api/V1/AdminTrackingProviderController.php`

### Internal Changes
- Wrapped merchant integration payload access in the tracking provider resource with decrypt-exception handling to tolerate legacy or corrupted ciphertext.

## 2026-03-01 | Version: unreleased

### Summary
- Added driver shipment file uploads in the mobile app and allowed shipment file types to be marked as driver-uploadable from admin settings.

### API Changes
- Added driver shipment file endpoints:
  - `GET /api/v1/driver/shipments/{shipment_uuid}/files`
  - `POST /api/v1/driver/shipments/{shipment_uuid}/files`
- Extended `GET /api/v1/driver/files/types` to accept `entity_type`, including `entity_type=shipment`.
- Driver-authenticated file downloads now rely on the shared authenticated file download endpoint:
  - `GET /api/v1/files/{file_uuid}/download?format=url`

### Database Changes
- None.

### Behavior Changes
- Drivers can now upload shipment files from the mobile shipment detail screen, but only for shipment file types flagged as driver-uploadable.
- Driver shipment file access is restricted to shipments currently assigned to that driver.
- Admins can now enable the existing driver upload flag for shipment file types in the File Types settings UI.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/EntityFileService.php`
- `php -l app/Services/FileTypeService.php`
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Http/Controllers/Api/V1/FileTypeController.php`
- `php -l routes/api.php`
- `npx eslint src/components/settings/file-types-manager.tsx`
- `npx eslint src/lib/api.ts 'app/shipments/[shipment_id].tsx'`

### Internal Changes
- Reused the existing `driver_can_upload` file type flag for shipment file types and wired the mobile shipment detail screen to the new shipment-specific driver file endpoints.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed shipment file tables so `hideStatusColumn` now removes the status column when requested.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `EntityFilesSection` now respects `hideStatusColumn`, allowing shipment file tabs to hide the status column while keeping the rest of the file table unchanged.

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/files/entity-files-section.tsx 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx'`

### Internal Changes
- Added an optional `hideStatusColumn` prop to the shared website entity file section and used it to build table columns conditionally.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed shipment file tables so `hideExpiryColumn` now removes the expiry column when requested.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `EntityFilesSection` now respects `hideExpiryColumn`, allowing shipment file tabs to hide the expiry column while keeping the rest of the file table unchanged.

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/files/entity-files-section.tsx 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx'`

### Internal Changes
- Added an optional `hideExpiryColumn` prop to the shared website entity file section and used it to build table columns conditionally.

## 2026-03-01 | Version: unreleased

### Summary
- Moved shipment file uploads and file listing into a dedicated Files tab on the shipment detail page.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The shipment detail page now shows uploads and existing shipment files under a separate `Files` tab instead of mixing them into the main `Details` tab.

### Breaking Changes
- None.

### Verification
- `npx eslint 'src/app/admin/logistics/shipments/[shipmentId]/page.tsx'`

### Internal Changes
- Repositioned the existing shipment `EntityFilesSection` within the shipment detail tabs without changing its upload or download behavior.

## 2026-03-01 | Version: unreleased

### Summary
- Fixed the admin file types settings page crash caused by relying on `useEffectEvent` in a runtime where it was unavailable.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The File Types settings page now loads and refreshes file types with a standard effect-based fetch flow instead of calling `useEffectEvent`.
- Saving a file type now safely refreshes the current list without leaving the dialog in a stuck loading state if the reload fails.

### Breaking Changes
- None.

### Verification
- `npx eslint src/components/settings/file-types-manager.tsx`

### Internal Changes
- Replaced the `useEffectEvent`-based list loader in the website file types manager with a shared async helper plus guarded `useEffect` reload logic.

## 2026-03-01 | Version: unreleased

### Summary
- Added admin and driver-app interfaces for managing merchant-scoped shipment, driver, and vehicle files, including mobile driver document uploads.

### API Changes
- Website now uses the previously added `GET/POST/PATCH /api/v1/file-types` endpoints to manage merchant file types in admin settings.
- Website now uses the previously added entity file endpoints to list, upload, download, and delete shipment, driver, and vehicle files.
- Mobile driver app now uses:
  - `GET /api/v1/driver/files/types`
  - `GET /api/v1/driver/files`
  - `POST /api/v1/driver/files`
  - `GET /api/v1/driver/files/{file_uuid}/download?format=url`

### Database Changes
- None.

### Behavior Changes
- Admin settings now include a File Types area with shipment, driver, and vehicle views for managing active upload requirements.
- Shipment, driver, and vehicle detail pages now show a secure files section with upload, download, and delete actions.
- The driver mobile app now has a Documents tab where drivers can upload only the allowed driver file types and must supply an expiry date when the file type requires one.
- Driver file downloads in the mobile app open through authorized temporary URLs instead of public links.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Http/Resources/FileTypeResource.php`
- `php -l app/Http/Resources/EntityFileResource.php`
- `npx eslint mobile_app/src/lib/api.ts 'mobile_app/app/(tabs)/documents.tsx' 'mobile_app/app/(tabs)/_layout.tsx'`
- `npx eslint website/src/components/files/entity-files-section.tsx website/src/components/settings/file-types-manager.tsx website/src/app/admin/settings/file-types/page.tsx`

### Internal Changes
- Added shared website file-management clients and a multipart-capable mobile API request path for secure file uploads.

## 2026-03-01 | Version: unreleased

### Summary
- Added the backend foundation for merchant-scoped shipment, driver, and vehicle file management with private storage support and configurable merchant-specific file types.

### API Changes
- Added merchant-scoped file type endpoints:
  - `GET /api/v1/file-types`
  - `POST /api/v1/file-types`
  - `PATCH /api/v1/file-types/{file_type_uuid}`
- Added authenticated entity file endpoints:
  - `GET /api/v1/shipments/{shipment_uuid}/files`
  - `POST /api/v1/shipments/{shipment_uuid}/files`
  - `GET /api/v1/drivers/{driver_uuid}/files`
  - `POST /api/v1/drivers/{driver_uuid}/files`
  - `GET /api/v1/vehicles/{vehicle_uuid}/files`
  - `POST /api/v1/vehicles/{vehicle_uuid}/files`
  - `GET /api/v1/files/{file_uuid}/download`
  - `DELETE /api/v1/files/{file_uuid}`
- Added driver-mobile file endpoints:
  - `GET /api/v1/driver/files/types`
  - `GET /api/v1/driver/files`
  - `POST /api/v1/driver/files`
  - `GET /api/v1/driver/files/{file_uuid}/download`

### Database Changes
- Added `file_types` table for merchant-specific shipment, driver, and vehicle file type definitions.
- Added `entity_files` table for polymorphic file attachments with secure storage metadata and optional expiry dates.

### Behavior Changes
- File types are now merchant-specific and can be configured per entity type (`shipment`, `driver`, `vehicle`).
- Driver-uploadable file types are controlled by a dedicated `driver_can_upload` flag.
- File types can require expiry dates, and uploads for those file types are rejected without `expires_at`.
- Uploaded files are stored on the configured filesystem disk with private visibility and are only downloadable through authorized endpoints.
- File deletion removes the underlying object from storage before deleting the application record.

### Breaking Changes
- None.

### Verification
- `php -l app/Models/FileType.php`
- `php -l app/Models/EntityFile.php`
- `php -l app/Services/FileTypeService.php`
- `php -l app/Services/EntityFileService.php`
- `php -l app/Http/Controllers/Api/V1/FileTypeController.php`
- `php -l app/Http/Controllers/Api/V1/EntityFileController.php`
- `php -l app/Http/Requests/StoreFileTypeRequest.php`
- `php -l app/Http/Requests/UpdateFileTypeRequest.php`
- `php -l app/Http/Requests/UploadEntityFileRequest.php`
- `php -l app/Http/Resources/FileTypeResource.php`
- `php -l app/Http/Resources/EntityFileResource.php`
- `php -l routes/api.php`

### Internal Changes
- Added shared backend services for merchant access checks, file type management, secure private file storage, expiry enforcement, and authorized download resolution.

## 2026-03-01 | Version: unreleased

### Summary
- The website admin routes list now uses the shared `DataTable` filter panel instead of a standalone filter form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Routes filtering for merchant ID, search text, and page size now runs through the shared table filter UI while keeping the same URL query params.
- The routes page no longer renders a separate inline filter form above the table.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Removed duplicated page-level filter form markup from the website routes admin page and reused the existing shared `DataTable` filter configuration.

## 2026-03-01 | Version: unreleased

### Summary
- The website admin locations list now uses the shared `DataTable` filter panel instead of a standalone filter form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Locations filtering for search text, location type, and page size now runs through the shared table filter UI and continues to drive the same URL query params.
- The locations page no longer renders a separate inline filter form above the table.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Updated the shared website `DataTable` to only show its client-side quick search input when `searchKeys` are configured, preventing duplicate search controls on server-filtered pages.

## 2026-03-01 | Version: unreleased

### Summary
- Shipment detail parcel cards on the website now display a QR code image when a parcel code exists.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Parcel detail cards now render a QR image for each parcel that has a `parcel_code`, alongside the existing parcel metadata.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added lightweight QR image URL generation for parcel codes in the website shipment detail view without introducing a new frontend dependency.

## 2026-03-01 | Version: unreleased

### Summary
- The shipments report page now uses the shared `DataTable` filter system instead of a custom inline GET form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Shipments report filters now live in the shared table filter panel and continue to drive the same report query params.
- The report page reset action now clears filters from the page header instead of the removed inline form.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added URL-backed text filter support to the shared website `DataTable` so report pages can reuse the same filter infrastructure as other list views.

## 2026-03-01 | Version: unreleased

### Summary
- The shipments API endpoint now honors website sorting for pickup location, dropoff location, and collection date.

### API Changes
- `GET /api/v1/shipments` sorting now accepts `sort_dir` as an alias for `sort_direction`.
- `GET /api/v1/shipments` sorting now accepts `pickup_location` and `dropoff_location` as aliases for the joined pickup/dropoff location name sorts.

### Database Changes
- None.

### Behavior Changes
- Website shipment list sorting now works when users sort by pickup location, dropoff location, or collection date from the shared table UI.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/ShipmentService.php`

### Internal Changes
- Added sort-key and sort-direction aliases in `ShipmentService::applyShipmentListSorting()` to match the website table query params.

## 2026-03-01 | Version: unreleased

### Summary
- The website shipments page now forwards the `per_page` query param to the shipments API so URL-driven page size requests take effect.

### API Changes
- The website shipments page now passes `per_page` through to `GET /api/v1/shipments`.

### Database Changes
- None.

### Behavior Changes
- URLs such as `/admin/logistics/shipments?from=2026-02-01&to=2026-02-28&per_page=100` now request up to 100 shipment rows from the API instead of falling back to the default page size.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added `per_page` query-param parsing to the website shipments list page.

## 2026-03-01 | Version: unreleased

### Summary
- Website data table date filters now use the shared shadcn-style date picker instead of native date inputs.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` date filters now open a calendar popover and still write URL-backed filter values in `YYYY-MM-DD` format.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Updated the shared `DatePicker` to stay synchronized with controlled values so URL-driven table filters render the selected date correctly.

## 2026-03-01 | Version: unreleased

### Summary
- Website data tables now auto-open their filter panel when the current URL already contains an active filter query param.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` sets its filter panel open on initial load when any configured filter `url_param_name` exists in the current query string with a non-empty value.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Reused existing URL-backed filter metadata to derive the initial filter-panel visibility state in the shared website table component.

## 2026-03-01 | Version: unreleased

### Summary
- The website shipments list now exposes more server-backed filters for shipment status workflows, invoicing, auto assignment, priority, and created-date range.

### API Changes
- The website shipments page now sends `priority`, `auto_assign`, `invoiced`, `from`, and `to` query params to `GET /api/v1/shipments` when those filters are selected.

### Database Changes
- None.

### Behavior Changes
- Shipment list filters now include priority, auto-assign state, invoiced state, created-from date, and created-to date.
- URL-backed date filters now render as date inputs in the shared website `DataTable`.
- URL-backed filters are treated as server-side filters, so the table no longer tries to re-filter fetched rows client-side for those params.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Extended the shared website `DataTable` filter model with a date input type and broadened shipment API typings to cover supported list filters.

## 2026-03-01 | Version: unreleased

### Summary
- URL-backed `DataTable` filters on the website now update the current route query string and stay synchronized with query-param values.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` filters can now declare `url_param_name` to push the selected option into the current page URL.
- URL-backed filters read their selected value from the current query string, falling back to the filter `value` prop when needed.
- Changing a URL-backed filter clears the `page` query param so pagination resets when the filter changes.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Extended the shared website table filter model with URL param support while keeping local in-memory filtering for non-URL filters.

## 2026-03-01 | Version: unreleased

### Summary
- The shared website data table now supports top-of-table view links with automatic active-state highlighting based on the current route and query string.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `DataTable` consumers can now pass a `views` prop to render linked view pills above the table header.
- View pills highlight automatically when the current pathname matches and the current query string matches the view link exactly or as a subset, depending on the view configuration.
- Table pagination and sorting params are ignored for view matching so the active view remains highlighted while paging or sorting within the same view.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Added shared `DataTableView` matching logic to the website table component so list pages can reuse the same top-level view navigation pattern.

## 2026-03-01 | Version: unreleased

### Summary
- Shipment detail pages on the website now hide empty parcel metadata fields instead of rendering placeholder parcel rows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Parcel cards on `website` shipment detail pages now render only weight, dimensions, declared value, contents, and parcel code when those values exist.
- Parcels with no populated metadata now show a compact "No parcel details available." message instead of empty placeholders.

### Breaking Changes
- None.

### Verification
- Not run.

### Internal Changes
- Simplified parcel detail rendering in the website shipment detail view by building a filtered list of visible parcel fields before render.

## 2026-03-01 | Version: unreleased

### Summary
- Website auth now refreshes expired API access tokens through the refresh-token endpoint and logs the user out when refresh fails.

### API Changes
- Website frontend now calls `POST /api/v1/auth/refresh` automatically after authenticated API requests receive `401 Unauthorized`.

### Database Changes
- None.

### Behavior Changes
- NextAuth sessions now track access-token expiry and refresh tokens before expiry during session resolution.
- Browser-side authenticated API requests retry once with a newly refreshed access token when the original token has expired.
- If token refresh fails or no refresh token is available, the website signs the user out and redirects to `/auth/login`.

### Breaking Changes
- None.

### Verification
- `npm run lint` in `website`

### Internal Changes
- Added a website session bridge so shared API helpers can update NextAuth token state after refresh and trigger a centralized logout on refresh failure.

## 2026-03-01 | Version: unreleased

### Summary
- Auto-created shipments now receive a default parcel with a generated parcel code, and shipment parcel measurements are now optional while `contents_description` remains required.

### API Changes
- Shipment create and update payloads now allow parcel `weight`, `weight_measurement`, `length_cm`, `width_cm`, and `height_cm` to be omitted.
- Shipment create and update payloads now require `parcels.*.contents_description`.
- Added maintenance command: `php artisan shipments:backfill-auto-created-parcels`

### Database Changes
- Made `shipment_parcels.weight`, `weight_measurement`, `length_cm`, `width_cm`, and `height_cm` nullable.

### Behavior Changes
- Auto-created shipments created from geofence lifecycle events now also create a default parcel with `contents_description` set to `Parcel #1`.
- Default parcels created for auto-created shipments now receive a generated stable `parcel_code`.
- Existing auto-created shipments without parcels can be backfilled with the new Artisan command.

### Breaking Changes
- Shipment parcel payloads now require `contents_description`.

### Verification
- `php -l app/Services/ShipmentParcelService.php`
- `php -l app/Services/ShipmentService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l routes/console.php`
- `php -l database/migrations/2026_03_01_190000_make_shipment_parcel_measurements_nullable.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test --filter=AutoRunLifecycleServiceTest` blocked by existing SQLite-incompatible migration `database/migrations/2026_02_06_000004_update_quote_status_enum_add_booked.php`

### Internal Changes
- Added `ShipmentParcelService` so default parcel creation and auto-created shipment parcel backfills use the same code path.

## 2026-03-01 | Version: unreleased

### Summary
- Added stable parcel QR codes and parcel-level pickup scanning so shipments only move to `in_transit` after every parcel is scanned.

### API Changes
- `POST /api/v1/driver/shipments/{shipment_uuid}/scan` now requires `parcel_code` and records pickup scans per parcel instead of generic shipment-only scan events.
- Driver shipment responses now include parcel scan progress fields:
  - `total_parcel_count`
  - `scanned_parcel_count`
  - `all_parcels_scanned`
  - per-parcel `parcel_code`, `is_picked_up_scanned`, and pickup scan timestamps
- Added maintenance command: `php artisan shipments:backfill-parcel-codes`

### Database Changes
- Added `parcel_code`, `picked_up_scanned_at`, and `picked_up_scanned_by_user_id` to `shipment_parcels`.

### Behavior Changes
- Shipment parcels now receive stable uppercase alphanumeric parcel codes suitable for QR printing.
- Duplicate parcel scans are ignored and return an `already_scanned` result.
- Parcel scans are rejected when the scanned code does not belong to the shipment being picked up.
- Shipments remain in pickup state until all parcels are scanned.
- Once all parcels are scanned, booking status is written to `picked_up`, then immediately moved to `in_transit`, and shipment status also moves to `in_transit`.
- The Expo driver app now opens a dedicated camera-based parcel scanning screen with live scan progress and a bottom-sheet list of scanned parcels.

### Breaking Changes
- Driver scan clients must send `parcel_code` instead of relying on a shipment-level `event_code` scan payload.

### Verification
- `php -l app/Services/ParcelCodeService.php`
- `php -l app/Services/ShipmentService.php`
- `php -l app/Http/Controllers/Api/V1/DriverShipmentController.php`
- `php -l app/Http/Resources/ShipmentParcelResource.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Http/Requests/DriverScanRequest.php`
- `php -l routes/console.php`
- `php -l tests/Feature/DriverShipmentApiTest.php`
- `php -l database/migrations/2026_03_01_170000_add_pickup_scan_fields_to_shipment_parcels_table.php`
- `npm run lint` in `expo-driver-app`
- `php artisan test --filter=DriverShipmentApiTest` blocked by existing SQLite-incompatible migration `database/migrations/2026_02_06_000004_update_quote_status_enum_add_booked.php`

### Internal Changes
- Added a reusable parcel code generation/backfill service, scan-result metadata for the driver app scan flow, and a dedicated Expo scan route using `expo-camera` with `@gorhom/bottom-sheet`.

## 2026-03-01 | Version: unreleased

### Summary
- Added internal booking lifecycle support for auto-created shipments so auto-run flows now create and advance bookings through run start and delivery.

### API Changes
- Added one-time maintenance command: `php artisan shipments:backfill-auto-bookings`.

### Database Changes
- None.

### Behavior Changes
- Auto-created shipments now create an internal booking when they are attached to an auto-created run.
- Auto-created shipment bookings now sync `current_driver_id` from the run driver.
- Starting a run now moves attached auto-created shipment bookings to `in_transit` and stamps `collected_at`.
- Auto-delivering a shipment now also marks the related booking as `delivered` and stamps `delivered_at`.
- Existing auto-created shipments missing bookings can be backfilled with the new Artisan command.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/InternalBookingLifecycleService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/RunService.php`
- `php -l routes/console.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php -l tests/Feature/RunApiTest.php`

### Internal Changes
- Centralized internal booking lifecycle updates in `InternalBookingLifecycleService` so auto-run booking creation, driver sync, and status stamping are handled consistently.

## 2026-03-01 | Version: unreleased

### Summary
- Added sorting and free-text search support to the driver list endpoint.

### API Changes
- `GET /api/v1/drivers` now accepts:
  - `search` to match driver `name` or `email`
  - `sort_by` with `created_at`, `name`, `email`, `telephone`, `intergration_id`, `is_active`, or `imported_at`
  - `sort_direction` with `asc` or `desc`

### Database Changes
- None.

### Behavior Changes
- Driver list responses can now be ordered explicitly instead of always returning `created_at desc`.
- Driver list filtering now supports `?search=xyz` against the related driver user name and email fields.

### Breaking Changes
- None.

### Verification
- `php artisan test --filter=DriverIndexTest`
- `php -l app/Http/Requests/ListDriversRequest.php`
- `php -l app/Services/DriverService.php`
- `php -l app/Http/Controllers/Api/V1/DriverController.php`

### Internal Changes
- Added a dedicated list request for driver index validation and updated `openapi.yaml` to document the new query parameters.

## 2026-03-01 | Version: unreleased

### Summary
- Added a timed driver delivery-offer workflow with driver online presence, device registration, offer acceptance/decline APIs, merchant dispatch settings, and app-side online/offer handling.

### API Changes
- Added driver device and presence endpoints:
  - `POST /api/v1/driver/devices/register`
  - `POST /api/v1/driver/presence/heartbeat`
  - `POST /api/v1/driver/presence/status`
- Added driver offer endpoints:
  - `GET /api/v1/driver/offers`
  - `POST /api/v1/driver/offers/{offer_uuid}/accept`
  - `POST /api/v1/driver/offers/{offer_uuid}/decline`
- Added shipment offer management endpoints:
  - `POST /api/v1/shipments/{shipment_uuid}/dispatch-offers/start`
  - `GET /api/v1/shipments/{shipment_uuid}/offers`
- Merchant APIs now support dispatch-offer settings:
  - `support_email`
  - `max_driver_distance`
  - `delivery_offers_expiry_time`
  - `driver_offline_timeout_minutes`
- Shipment APIs now support `requested_vehicle_type_id`.
- Shipment resources can now expose delivery offer history for merchant/admin consumers.

### Database Changes
- Added merchant fields for support email, offer expiry, max driver distance, and driver offline timeout.
- Added `requested_vehicle_type_id` to shipments.
- Added `user_devices`, `driver_presences`, and `delivery_offers` tables.
- Added a migration to allow internal bookings without `quote_option_id`.

### Behavior Changes
- Auto-assignable shipments now start a timed delivery-offer flow instead of requiring immediate manual booking/driver assignment.
- Drivers can go online/offline from the mobile app, send heartbeat/location updates, and receive active offers in heartbeat responses.
- Drivers can accept or decline delivery offers from the app dashboard.
- Accepting an offer creates an internal booking without a quote option, creates a run, attaches the shipment, and moves the shipment to `booked`.
- Declined or expired offers rotate to the next eligible online driver.
- When no eligible driver remains, shipment status moves to `offer_failed` and a support email job is queued to the merchant support address.

### Breaking Changes
- Merchant and shipment payloads now include new dispatch-related fields.
- Shipments may now enter the `offer_failed` status.
- Internal booking creation now assumes `quote_option_id` may be null after the new migration is applied.

### Verification
- `php artisan route:list --path=driver`
- `php -l app/Services/DeliveryOfferService.php`
- `php -l app/Services/DriverPresenceService.php`
- `php -l app/Services/UserDeviceService.php`
- `php -l app/Http/Controllers/Api/V1/DriverOfferController.php`
- `php -l app/Http/Controllers/Api/V1/DriverPresenceController.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentOfferController.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l app/Http/Resources/DeliveryOfferResource.php`
- `php -l app/Http/Resources/DriverPresenceResource.php`
- `php -l app/Services/ShipmentService.php`
- `npm run lint` in `expo-driver-app`

### Internal Changes
- Added delivery-offer orchestration, offer expiry job handling, support-email notification job/mail, device and presence persistence models, and app-side timed heartbeat/offer controls.

---

## 2026-03-01 | Version: unreleased

### Summary
- Migrated the driver delivery API from booking-centric endpoints to shipment-centric endpoints and updated the Expo driver app to consume the new shipment contract.

### API Changes
- Replaced `GET /api/v1/driver/bookings` with `GET /api/v1/driver/shipments`.
- Replaced `GET /api/v1/driver/bookings/{booking_uuid}` with `GET /api/v1/driver/shipments/{shipment_uuid}`.
- Replaced driver status, scan, POD, and cancel routes to use `/api/v1/driver/shipments/{shipment_uuid}/...`.
- Driver shipment responses are now shipment-first and include booking operational fields under a nested `booking` object.
- Updated `openapi.yaml` to document the new driver shipment endpoints.

### Database Changes
- None.

### Behavior Changes
- Driver shipment visibility still follows active runs assigned to the authenticated driver with statuses `draft`, `dispatched`, or `in_progress`.
- Driver shipment actions still only allow internal carriers and still persist booking-backed operational changes such as tracking events, POD, and cancellations.
- The Expo driver app now loads list and detail data from `/driver/shipments`, navigates by `shipment_id`, and exposes in-app controls for shipment status updates, scan events, POD submission, and cancellation.

### Breaking Changes
- Removed the v1 driver booking endpoints:
  - `GET /api/v1/driver/bookings`
  - `GET /api/v1/driver/bookings/{booking_uuid}`
  - `PATCH /api/v1/driver/bookings/{booking_uuid}/status`
  - `POST /api/v1/driver/bookings/{booking_uuid}/scan`
  - `POST /api/v1/driver/bookings/{booking_uuid}/pod`
  - `POST /api/v1/driver/bookings/{booking_uuid}/cancel`

### Verification
- `php -l app/Http/Controllers/Api/V1/DriverShipmentController.php`
- `php -l app/Http/Resources/DriverShipmentResource.php`
- `php -l tests/Feature/DriverShipmentApiTest.php`
- `npm run lint` in `expo-driver-app`
- `php artisan test --filter=DriverShipmentApiTest` blocked by an existing SQLite-incompatible migration in `database/migrations/2026_02_05_000098_update_booking_status_enum.php` (`ALTER TABLE ... MODIFY ...`)

### Internal Changes
- Added `DriverShipmentResource`, a shipment-scoped `DriverShipmentController`, feature coverage for shipment-based driver actions, and Expo driver API helpers/forms for all driver shipment mutations.

---

## 2026-03-01 | Version: unreleased

### Summary
- Reworked the driver bookings lookup to derive eligible records from shipments assigned to the driver's active runs, and added SQL debug logging for that query path.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver booking endpoints now determine visibility from `shipments.currentRunShipment.run.driver_id` instead of starting from a bookings-based relationship filter.
- Driver booking endpoints now emit a debug log entry containing the raw SQL, bindings array, and interpolated SQL for both the booking query and the shipment subquery used by `queryDriverBookings()`.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/DriverBookingController.php`

### Internal Changes
- Added an interpolation helper in `DriverBookingController` to render query bindings into the logged SQL string for both the outer booking query and the shipment subquery.

---

## 2026-03-01 | Version: unreleased

### Summary
- Synced run driver and vehicle assignments into `driver_vehicles` so dispatching a run also guarantees the driver has that vehicle assignment record.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Creating a run with both `driver_id` and `vehicle_id` now automatically creates the corresponding `driver_vehicles` row when it does not already exist.
- Updating a draft or dispatched run to a driver and vehicle pair now backfills the missing `driver_vehicles` assignment without creating duplicates.
- Shipment driver assignment inherits the same sync behavior because it reuses the run create/update flow.

### Breaking Changes
- None.

### Verification
- `php artisan test --filter=RunApiTest`

### Internal Changes
- `RunService` now reuses `DriverVehicleService::assignVehicle()` after run persistence to keep run assignments and driver vehicle assignments aligned.

---

## 2026-03-01 | Version: unreleased

### Summary
- Fixed the Expo driver login regression caused by strict native storage failures interrupting the sign-in flow after a successful API login.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Driver login no longer redirects and then drops back to the login screen when native session persistence fails at write time.
- The auth provider now commits the persisted session before publishing authenticated UI state.
- Native auth storage falls back to in-memory session storage again when the runtime cannot complete `AsyncStorage` operations.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Removed the debug auth hydration log and reordered sign-in session persistence in `expo-driver-app/src/providers/auth-provider.tsx`.

---

## 2026-03-01 | Version: unreleased

### Summary
- Stopped the Expo driver app from silently storing auth sessions in native in-memory fallback storage, which was causing sessions to disappear after the app closed.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Native auth session reads and writes now require real `AsyncStorage` persistence instead of degrading to process memory.
- Existing driver sessions persist across full app restarts only when the runtime provides a working native storage module.
- Web auth storage continues using `window.localStorage`.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Removed the native in-memory fallback from `expo-driver-app/src/lib/auth-storage.ts`.

---

## 2026-03-01 | Version: unreleased

### Summary
- Added an explicit login-screen auth guard so the Expo driver app redirects authenticated drivers straight to the dashboard instead of leaving them on the login form.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `/(auth)/login` now shows a loading state during auth hydration.
- If a driver session already exists after hydration, the login route immediately redirects to `/(tabs)`.
- The login form only renders when no authenticated session is present.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Added route-level auth guarding in `expo-driver-app/app/(auth)/login.tsx` to complement the root layout redirect logic.

---

## 2026-03-01 | Version: unreleased

### Summary
- Fixed Expo driver auth persistence so a saved driver session survives app refreshes unless the backend explicitly rejects the token or refresh token.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Expo driver app now restores the last saved session immediately during startup instead of forcing a fresh login on every reload.
- Startup validation failures caused by transient network/API errors no longer clear the saved driver session.
- Saved auth is only removed when `/me` and token refresh both fail with `401 Unauthorized`.

### Breaking Changes
- None.

### Verification
- `npm run lint`

### Internal Changes
- Simplified the auth bootstrap flow in `expo-driver-app/src/providers/auth-provider.tsx` to distinguish invalid auth from transient bootstrap failures.

---

## 2026-03-01 | Version: unreleased

### Summary
- Fixed driver booking endpoints to resolve assignments from shipment runs instead of the legacy `bookings.current_driver_id` field.

### API Changes
- No endpoint changes.
- Driver booking responses now prefer the active run driver when populating `current_driver_id`.

### Database Changes
- None.

### Behavior Changes
- `GET /api/v1/driver/bookings` and related driver booking actions now only expose bookings whose shipment is attached to an active run assigned to the authenticated driver.
- Driver booking detail, status update, scan, POD, and cancel actions now follow run-based driver assignment consistently.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/DriverBookingController.php`
- `php -l app/Http/Resources/BookingResource.php`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added a shipment driver assignment endpoint that updates the shipment's active run or creates a new draft run when none exists.

### API Changes
- Added `POST /api/v1/shipments/{shipment_uuid}/assign_driver`.
- Request payload accepts `driver_id` and optional `vehicle_id`.
- Response returns `ShipmentResource`; new run creation responds with `201 Created`, existing run updates respond with `200 OK`.

### Database Changes
- None.

### Behavior Changes
- Assigning a driver from a shipment now reuses the current active run when present by updating its `driver_id` and optional `vehicle_id`.
- If a shipment has no active run, the API creates a new draft run for the shipment's merchant/environment and attaches that shipment automatically.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l app/Http/Requests/AssignShipmentDriverRequest.php`
- `php -l app/Services/RunService.php`
- `php -l tests/Feature/RunApiTest.php`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added SQL logging for the driver list query so `listDrivers()` now records the generated SQL and bound parameters for debugging.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `GET /api/v1/drivers` now writes a debug log entry with the final `listDrivers()` SQL, its bindings, and an interpolated SQL string before pagination executes.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/DriverService.php`

### Internal Changes
- Added application logging around the driver listing query builder.

---

## 2026-03-01 | Version: unreleased

### Summary
- Added `merchant_id` to drivers and now persist merchant ownership whenever drivers are created manually or imported.

### API Changes
- Driver responses now include `merchant_id`.
- `POST /api/v1/drivers` now stores the resolved merchant on the created driver record.
- Driver CSV import and tracking-provider driver import now also persist merchant ownership on imported drivers.

### Database Changes
- Added nullable foreign key `drivers.merchant_id` referencing `merchants.id`.
- Existing driver rows are backfilled from their linked carrier merchant where available.

### Behavior Changes
- Merchant-scoped driver queries now prefer the driver’s own `merchant_id` instead of relying only on carrier ownership.
- Run driver resolution and tracking-provider driver import matching now scope drivers to the merchant first, with fallback handling for legacy rows that still lack `merchant_id`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/DriverService.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Services/RunService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/DataPurgeService.php`
- `php -l app/Models/Driver.php`
- `php -l app/Http/Resources/DriverResource.php`
- `php -l database/migrations/2026_03_01_120000_add_merchant_id_to_drivers_table.php`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added real driver bookings and vehicles tabs in the Expo app, including booking and vehicle detail screens backed by Laravel driver endpoints.

### API Changes
- No backend endpoint changes.
- The Expo driver app now consumes:
  - `GET /api/v1/driver/bookings`
  - `GET /api/v1/driver/bookings/{booking_uuid}`
  - `GET /api/v1/driver/vehicles`
  - `GET /api/v1/driver/vehicles/{vehicle_uuid}`

### Database Changes
- None.

### Behavior Changes
- The mobile app tab bar now includes dedicated `Bookings` and `Vehicles` sections.
- Bookings list and detail screens load real assigned-booking data for the authenticated driver.
- Vehicles list and detail screens load real assigned-vehicle data for the authenticated driver.
- API failures in the new list/detail screens are shown directly in the UI.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Hardened Expo auth storage again so each AsyncStorage operation falls back when the module exists but throws because its native binding is unavailable.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Session storage now catches runtime failures from `getItem`, `setItem`, and `removeItem` on the AsyncStorage module itself.
- Auth bootstrap and logout continue using fallback storage even when the AsyncStorage package is installed but not linked in the active runtime.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Restored the Expo auth storage fallback adapter after a direct `AsyncStorage` implementation reintroduced native-module crashes during session cleanup.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Session clear, read, and write operations no longer call native AsyncStorage directly when the runtime does not expose the module.
- Login bootstrap and logout now degrade safely to web storage or in-memory storage instead of crashing on missing native storage bindings.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Improved Expo driver login error handling so API authentication and validation failures are shown directly in the login screen.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Login failures now surface Laravel API error messages in the Expo driver app.
- Validation error details returned by the API are expanded and displayed as individual messages on the login form.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Hardened Expo driver auth storage to avoid runtime crashes when the native AsyncStorage module is unavailable.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- The Expo driver app now falls back to `localStorage` on web and in-memory session storage when native AsyncStorage is unavailable.
- Corrupted stored session payloads are cleared automatically instead of crashing session restore.

### Breaking Changes
- None.

### Verification
- `npm run lint`

---

## 2026-03-01 | Version: unreleased

### Summary
- Added a driver-focused Expo login flow with persisted auth state, environment-based API configuration, and a placeholder authenticated dashboard.

### API Changes
- No backend endpoint changes.
- The Expo driver app now consumes:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/me`

### Database Changes
- None.

### Behavior Changes
- Unauthenticated users in `expo-driver-app` are redirected to a login screen.
- Authenticated users are redirected to the driver dashboard after successful login.
- The mobile app persists access and refresh tokens locally and attempts token refresh during session restore when the access token is no longer valid.
- Non-driver accounts are blocked from signing into the driver app.
- Driver self-registration is intentionally unavailable in-app and is shown as a placeholder screen.

### Breaking Changes
- None.

### Verification
- `npm install @react-native-async-storage/async-storage`
- `npm run lint`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added run stop history to run responses using the run's related vehicle activity events.

### API Changes
- Run payloads now include:
  - `stops`
- `stops` is an ordered collection of `vehicle_activity` entries related to the run, serialized with the vehicle activity response shape.

### Database Changes
- None.

### Behavior Changes
- Run responses now include all recorded vehicle events for the run ordered by `occurred_at`, oldest to newest.

### Breaking Changes
- None.

### Verification
- `php -l app/Models/Run.php`
- `php -l app/Services/RunService.php`
- `php -l app/Http/Resources/RunResource.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added run last-location details sourced from the latest location-based stop recorded for each run.

### API Changes
- Run payloads now include:
  - `last_location`
- `last_location` uses the standard `LocationResource` shape.

### Database Changes
- None.

### Behavior Changes
- Run responses now expose the latest location-based stop for the run itself using the standard `LocationResource` shape in a top-level `last_location` block.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/RunResource.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added tracking provider capability flags and a default-tracking flag, and now enforce import availability from provider configuration.

### API Changes
- Tracking provider payloads now include:
  - `default_tracking`
  - `has_driver_importing`
  - `has_locations_importing`
  - `has_vehicle_importing`
- Admin tracking provider create/update requests now accept the same fields.

### Database Changes
- Added nullable/boolean flags on `tracking_providers`:
  - `default_tracking`
  - `has_driver_importing`
  - `has_locations_importing`
  - `has_vehicle_importing`

### Behavior Changes
- Provider import endpoints now require both:
  - the provider capability flag to be enabled in the database
  - the underlying provider service method to exist
- Providers with disabled import flags are treated as not supporting that import feature even if an implementation exists.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_28_000004_add_capability_flags_to_tracking_providers_table.php`
- `php -l app/Models/TrackingProvider.php`
- `php -l app/Http/Resources/TrackingProviderResource.php`
- `php -l app/Http/Requests/StoreTrackingProviderRequest.php`
- `php -l app/Http/Requests/UpdateTrackingProviderRequest.php`
- `php -l app/Services/TrackingProviderService.php`
- `php -l app/Services/MerchantIntegrationService.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment list filtering by invoice state.

### API Changes
- `GET /api/v1/shipments` now accepts:
  - `invoiced=true` to return only shipments with a non-null `invoiced_at`
  - `invoiced=false` to return only shipments with a null `invoiced_at`

### Database Changes
- None.

### Behavior Changes
- Shipment list filtering now supports invoice state using `shipments.invoiced_at`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/ShipmentService.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment stop history to single-shipment responses using the shipment's related vehicle activity events.

### API Changes
- Single-shipment payloads now include:
  - `driver`
  - `vehicle`
  - `stops`
- `stops` is an ordered collection of `vehicle_activity` entries related to the shipment, serialized with the vehicle activity response shape.
- Applies to single-shipment responses from:
  - `POST /api/v1/shipments`
  - `POST /api/v1/shipments/on-demand`
  - `GET /api/v1/shipments/{shipment_uuid}`
  - `PATCH /api/v1/shipments/{shipment_uuid}`

### Database Changes
- None.

### Behavior Changes
- Shipment responses now include the assigned run driver and vehicle details when a current run exists for the shipment.
- Shipment detail responses now return all recorded vehicle events for the shipment ordered by `occurred_at`, oldest to newest.
- Shipment list responses remain unchanged and do not eager-load shipment stops.

### Breaking Changes
- None.

### Verification
- `php -l app/Models/Shipment.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Http/Controllers/Api/V1/ShipmentController.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment invoice fields to CRUD APIs and automatic invoice timestamping when an invoice number is assigned without an explicit invoice date.

### API Changes
- Shipment payloads now include:
  - `delivery_note_number`
  - `invoice_number`
  - `invoiced_at`
- Applies to shipment create, on-demand create, list, show, and update responses.
- Shipment create/update requests now accept:
  - `invoice_number`
  - `invoiced_at`

### Database Changes
- Added nullable `shipments.invoice_number`.
- Added nullable `shipments.invoiced_at`.

### Behavior Changes
- Creating a shipment with `invoice_number` but without `invoiced_at` now defaults `invoiced_at` to the current timestamp.
- Updating a shipment with a changed `invoice_number` but without `invoiced_at` now defaults `invoiced_at` to the current timestamp.
- Explicit `invoiced_at` values are preserved when provided.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_28_000003_add_invoice_fields_to_shipments_table.php`
- `php -l app/Models/Shipment.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l app/Services/ShipmentService.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added CSV import endpoints for merchant vehicles and drivers.

### API Changes
- Added endpoint:
  - `POST /api/v1/vehicles/import`
  - request body: `merchant_id`, `file` (`csv`/`txt`)
- Added endpoint:
  - `POST /api/v1/drivers/import`
  - request body: `merchant_id`, `file` (`csv`/`txt`)
- Both endpoints return:
  - `processed`
  - `created`
  - `updated`
  - `failed`
  - `errors` (row-level import failures)

### Database Changes
- None.

### Behavior Changes
- Vehicle CSV import upserts rows by `intergration_id`, then `plate_number`, then `ref_code`.
- Driver CSV import upserts rows by `email`, then `intergration_id`.
- Merchant users import drivers into their merchant carrier automatically; admin users may optionally provide `carrier_id` in the CSV.
- Driver imports generate a random password for newly created driver users when the CSV password column is blank.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ImportVehiclesRequest.php`
- `php -l app/Http/Requests/ImportDriversRequest.php`
- `php -l app/Http/Controllers/Api/V1/VehicleController.php`
- `php -l app/Http/Controllers/Api/V1/DriverController.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Services/DriverService.php`
- `php -l routes/api.php`
- `php -l tests/Feature/VehicleCsvImportTest.php`
- `php -l tests/Feature/DriverCsvImportTest.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added vehicle last-known-driver tracking so tracking events can update a persistent driver snapshot on each vehicle.

### API Changes
- Vehicle payloads now include:
  - `last_driver_id`
  - `driver_logged_at`
  - `last_driver`
- Applies to:
  - `GET /api/v1/vehicles`
  - `GET /api/v1/vehicles/{vehicle_uuid}`
  - vehicle objects returned from `GET /api/v1/vehicle-activities`
  - vehicle objects returned from `GET /api/v1/vehicles/latest-activity-check`

### Database Changes
- Added nullable `vehicles.last_driver_id` foreign key to `drivers.id`.
- Added nullable `vehicles.driver_logged_at`.

### Behavior Changes
- Tracking vehicle activity events now update the owning vehicle's last-known driver when a driver can be resolved from the event metadata or linked run.
- Driver snapshots only advance when the new activity row has a newer `vehicle_activity.created_at` value than the current `driver_logged_at`.
- Tracking events without a resolvable driver leave the existing vehicle driver snapshot unchanged.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_28_000002_add_last_driver_fields_to_vehicles_table.php`
- `php -l app/Models/Vehicle.php`
- `php -l app/Models/VehicleActivity.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Services/VehicleService.php`
- `php -l app/Services/VehicleActivityService.php`
- `php -l app/Http/Resources/VehicleResource.php`
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l app/Http/Resources/VehicleLatestActivityCheckResource.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added a merchant-scoped vehicle latest-activity check endpoint that returns every vehicle for a merchant, including vehicles with no activity history.

### API Changes
- Added endpoint:
  - `GET /api/v1/vehicles/latest-activity-check?merchant_id={merchant_uuid}`
- Response shape mirrors vehicle activity payloads while remaining vehicle-backed:
  - always includes `merchant` and `vehicle`
  - returns latest activity fields from the most recent row by `occurred_at`
  - returns `null` for activity-derived fields when a vehicle has no activity
- The endpoint returns all vehicles for the merchant in a single response and does not paginate.

### Database Changes
- None.

### Behavior Changes
- Vehicle latest-activity checks now include inactive and activity-less vehicles in the merchant account scope.
- When multiple activities exist for a vehicle, the endpoint selects the latest by `occurred_at` and uses the highest `id` as a tie-breaker.

### Breaking Changes
- None.

### Verification
- `vendor/bin/phpunit --filter=VehicleLatestActivityCheckTest`
- `php -l app/Http/Requests/ListVehicleLatestActivityCheckRequest.php`
- `php -l app/Http/Resources/VehicleLatestActivityCheckResource.php`
- `php -l app/Http/Controllers/Api/V1/VehicleActivityController.php`
- `php -l app/Services/VehicleActivityService.php`
- `php -l routes/api.php`

---

## 2026-02-28 | Version: unreleased

### Summary
- Added shipment-stage collection and delivery activity attempts plus run origin departure tracking so shipment full reports can show real collection and delivery durations.
- Added shipment listing sorting for merchant reference, service type, pickup, dropoff, status, collection date, ready time, priority, and created time.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now returns:
  - `from_vehicle_activity`
  - `to_vehicle_activity`
- `GET /api/v1/shipments` now accepts:
  - `sort_by=created_at`
  - `sort_by=merchant_order_ref`
  - `sort_by=service_type`
  - `sort_by=from`
  - `sort_by=to`
  - `sort_by=status`
  - `sort_by=collection_date`
  - `sort_by=ready_at`
  - `sort_by=priority`
  - optional `sort_direction=asc|desc`
- These fields now prefer the latest `shipment_collection` and `shipment_delivery` activity attempts, with fallback to legacy shipment-linked location visits.
- Run payloads now include `origin_departure_time`.
- Vehicle activity listing now accepts `shipment_collection` and `shipment_delivery` in the `event_type` filter.

### Database Changes
- Added nullable `runs.origin_departure_time`.

### Behavior Changes
- Exiting an origin pickup geofence now records `runs.origin_departure_time` when the open `entered_location` visit belongs to the run origin.
- Auto-created shipments now set `collection_date` from `run.started_at` when available during creation.
- Shipment listings now support sorting by created time, merchant reference, service type, pickup location name, dropoff location name, shipment status, collection date, ready time, and priority.
- Shipment listing filters now qualify `shipments.*` columns correctly when location joins are present, preventing ambiguous-column SQL errors.
- Entering a dropoff geofence for an active run now creates one shipment attempt row per attempt for:
  - `shipment_collection`, populated from `run.started_at` and `run.origin_departure_time` when both values exist
  - `shipment_delivery`, opened with the real dropoff entry timestamp
- Exiting the dropoff geofence closes the latest open `shipment_delivery` attempt for that shipment/run/location.
- Raw `entered_location` and `exited_location` events continue to be recorded.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/ShipmentService.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Resources/RunResource.php`
- `php -l app/Models/Run.php`
- `php -l app/Models/VehicleActivity.php`
- `php -l app/Http/Requests/ListVehicleActivitiesRequest.php`
- `php -l database/migrations/2026_02_28_000001_add_origin_departure_time_to_runs_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added `location_type_id` and free-text `search` filters to the merchant-scoped locations listing endpoint.

### API Changes
- `GET /api/v1/locations` now accepts:
  - `location_type_id` to filter locations by a specific location type UUID
  - `search` to match locations by name, code, address, contact, province/post code, or integration id

### Database Changes
- None.

### Behavior Changes
- Location listing now validates list query params through a dedicated request class.
- `location_type_id` filtering is scoped to the authenticated account and requested merchant context.
- `search` supports partial multi-word matching across common location text fields.

### Breaking Changes
- None.

### Verification
- `vendor/bin/phpunit --filter=LocationIndexFiltersTest`
- `php -l app/Http/Requests/ListLocationsRequest.php`
- `php -l app/Http/Controllers/Api/V1/LocationController.php`
- `php -l app/Services/LocationService.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Corrected MiX location polygon coordinate handling so imported geofence WKT remains in the original axis order while API polygon arrays and derived map centers use valid latitude/longitude positions.

### API Changes
- `LocationResource` now serializes stored `polygon_bounds` WKT to `[latitude, longitude]` coordinate pairs consistently with location create/update APIs.

### Database Changes
- None.

### Behavior Changes
- Fixed MiX `shapeWkt` centroid fallback to read WKT points as `longitude latitude` instead of duplicating the latitude value.
- Imported MiX locations now derive fallback center points without corrupting longitude values.
- Stored polygon WKT is still passed through unchanged to the database geometry column.

### Breaking Changes
- None.

### Verification
- `phpunit --filter=MixIntegrateServiceTest`
- `phpunit --filter=LocationResourceTest`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added a protected merchant data purge endpoint with password confirmation and typed bulk-deletion controls.

### API Changes
- Added endpoint:
  - `POST /api/v1/merchants/{merchant_uuid}/purge-data`
- Request body:
  - `merchant_id` (required merchant UUID; must match route merchant)
  - `password` (required)
  - `types` (required array; allowed: `shipments`, `runs`, `routes`, `drivers`, `vehicles`, `locations`, `location_types`, `merchant_integrations`, `webhooks`, `api_call_logs`, `idempotency_keys`, `merchant_invites`, `activity_logs`)
- Response now includes:
  - `merchant_uuid`
  - `requested_types`
  - `processed_types`
  - `results` (deleted row counts per table/type)

### Database Changes
- None.

### Behavior Changes
- Purge endpoint now:
  - requires authenticated `user`/`super_admin` role
  - requires `merchant_id` in payload to match the route merchant
  - allows only the owning user of the merchant account to execute the purge
  - verifies the caller password before any delete operation
  - executes deletes in a dependency-safe order inside a transaction
  - records an activity log entry describing requested/processed types and deleted counts
- Added guardrail: `locations` purge is blocked when shipments still exist unless `shipments` is included.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/DataPurgeRequest.php`
- `php -l app/Http/Controllers/Api/V1/DataPurgeController.php`
- `php -l app/Services/DataPurgeService.php`
- `php -l routes/api.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Updated MiX import location-type auto-creation to generate and persist merchant-unique slugs from location type titles.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- When MiX location import encounters an unknown `LocationType` title:
  - creates `location_types` with `slug` generated from title
  - ensures slug is unique per merchant (suffixes like `-2`, `-3` as needed)
  - persists default flags/sequence values required by location types schema
- Removed temporary debug `HERE` logs from this import path.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- Import locations with new `LocationType` titles and confirm created rows include valid `slug` values.

---

## 2026-02-27 | Version: unreleased

### Summary
- Ensured provider import payloads include merchant/account context values for queued imports.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `MerchantIntegrationService` now augments integration data passed to provider import methods with:
  - `account_id`
  - `merchant_id`
  - `merchant_uuid`
- Applies to:
  - `import_vehicles`
  - `import_drivers`
  - `import_locations`

### Breaking Changes
- None.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- Run import locations job and confirm provider receives `integrationData.account_id` and `integrationData.merchant_id`.

---

## 2026-02-27 | Version: unreleased

### Summary
- Disabled MiX bearer token caching so each token request is fetched live.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `MixIntegrateService::getBearerToken` no longer uses cache storage.
- Every call now requests a fresh token from MiX identity endpoint.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added detailed lifecycle/error logging to provider location import queue job to diagnose queue failures.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- `ImportProviderLocationsJob` now logs:
  - job start (with request context)
  - pre-import call start
  - post-import call completion with `imported_count`
  - skip completion when import user is missing
  - failure details with exception class, message, and trace

### Breaking Changes
- None.

### Verification
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Replaced `imports_in_progress` with richer `imports_stats` tracking for provider imports.

### API Changes
- Import queue acknowledgement payload now returns `imports_stats` instead of `imports_in_progress`.
- `GET /api/v1/tracking-providers/imports-statuses` now returns:
  - `inprogress` (`locations`, `drivers`, `vehicles`)
  - `last_import_counts` (`locations`, `drivers`, `vehicles`)
  - `last_import_errors` (`locations`, `drivers`, `vehicles`)

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_181000_replace_imports_in_progress_with_imports_stats_on_merchants_table.php`
- Migration actions:
  - add `merchants.imports_stats` (JSON nullable)
  - backfill from existing `imports_in_progress`
  - drop `merchants.imports_in_progress`

### Behavior Changes
- Queue start now sets `imports_stats.inprogress.{type}` to start timestamp.
- Queue completion now updates:
  - `imports_stats.inprogress.{type}` to `null`
  - `imports_stats.last_import_counts.{type}` with imported row count
  - `imports_stats.last_import_errors.{type}` with error message or `null`

### Breaking Changes
- Yes.
- Clients reading `imports_in_progress` must switch to `imports_stats` and nested fields.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Jobs/ImportProviderVehiclesJob.php`
- `php -l app/Jobs/ImportProviderDriversJob.php`
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Models/Merchant.php`
- `php -l database/migrations/2026_02_27_181000_replace_imports_in_progress_with_imports_stats_on_merchants_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Moved tracking-provider imports (locations, drivers, vehicles) to queued jobs and added merchant-level import progress tracking.

### API Changes
- Import endpoints now queue jobs and return immediate accepted responses:
  - `POST /api/v1/tracking-providers/{provider_id}/import_vehicles`
  - `POST /api/v1/tracking-providers/{provider_id}/import_drivers`
  - `POST /api/v1/tracking-providers/{provider_id}/import_locations`
- New endpoint:
  - `GET /api/v1/tracking-providers/imports-statuses?merchant_id={merchant_uuid}`
- Import endpoint response shape now includes:
  - `queued` (bool)
  - `already_in_progress` (bool)
  - `imports_in_progress` (object with `locations`, `drivers`, `vehicles`)

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_180000_add_imports_in_progress_to_merchants_table.php`
- Migration adds nullable JSON `merchants.imports_in_progress`.

### Behavior Changes
- Import requests no longer run long-running provider sync inline; they dispatch queue jobs.
- On queue dispatch, `merchants.imports_in_progress.{type}` is set to current timestamp (`Y-m-d H:i:s`).
- On job completion/failure, that key is reset to `null`.
- If an import type is already in progress, duplicate queue requests for the same type are not enqueued.

### Breaking Changes
- Yes.
- Import endpoints changed from synchronous result payloads (`imported_count` + resources) to asynchronous queue acknowledgement payloads.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Jobs/ImportProviderVehiclesJob.php`
- `php -l app/Jobs/ImportProviderDriversJob.php`
- `php -l app/Jobs/ImportProviderLocationsJob.php`
- `php -l app/Http/Requests/GetTrackingProviderImportStatusesRequest.php`
- `php -l routes/api.php`
- `php -l database/migrations/2026_02_27_180000_add_imports_in_progress_to_merchants_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added explicit API CORS configuration to allow local Next.js frontend requests.

### API Changes
- Cross-origin requests from local frontend origins are now allowed for `api/*` routes.

### Database Changes
- None.

### Behavior Changes
- Added `config/cors.php` with:
  - `paths`: `api/*`, `sanctum/csrf-cookie`
  - `allowed_origins`: `http://localhost:3000`, `http://127.0.0.1:3000`
  - `allowed_methods`: `*`
  - `allowed_headers`: `*`
- Browser preflight (`OPTIONS`) requests for API endpoints can now be answered with CORS headers before auth middleware blocks them.

### Breaking Changes
- None.

### Verification
- `php -l config/cors.php`
- `php artisan config:clear`
- Re-test `POST /api/v1/tracking-providers/{provider_id}/import_locations` from `http://localhost:3000`.

---

## 2026-02-27 | Version: unreleased

### Summary
- MiX location import now derives missing coordinates from geofence polygon center.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- During tracking-provider location import, if `latitude`/`longitude` are missing but a polygon `ShapeWkt` geofence is present:
  - the system computes polygon centroid coordinates, and
  - stores those as location latitude/longitude.
- If centroid cannot be computed (invalid/degenerate polygon), coordinates remain null.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`
- Import a location with `ShapeWkt` but no `latitude`/`longitude` and confirm stored coordinates are populated from polygon center.

---

## 2026-02-27 | Version: unreleased

### Summary
- Added `imported_at` tracking to imported locations, drivers, and vehicles.

### API Changes
- Import responses for locations, drivers, and vehicles now include:
  - `imported_at`

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_170000_add_imported_at_to_locations_drivers_vehicles_tables.php`
- Migration adds nullable timestamp `imported_at` to:
  - `locations`
  - `drivers`
  - `vehicles`

### Behavior Changes
- Each successful tracking-provider import upsert now sets `imported_at` on the affected row for:
  - vehicles
  - drivers
  - locations
- `metadata.imported_at` behavior remains unchanged.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_170000_add_imported_at_to_locations_drivers_vehicles_tables.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Models/Location.php`
- `php -l app/Models/Driver.php`
- `php -l app/Models/Vehicle.php`
- `php -l app/Http/Resources/LocationResource.php`
- `php -l app/Http/Resources/DriverResource.php`
- `php -l app/Http/Resources/VehicleResource.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added `only_with_geofences` support to tracking-provider location imports so clients can import only geofenced locations on demand.

### API Changes
- `POST /api/v1/tracking-providers/{provider_id}/import_locations` now accepts:
  - `only_with_geofences` (optional boolean)

### Database Changes
- None.

### Behavior Changes
- Import request can now override integration options for a single run with `only_with_geofences`.
- For MiX imports, when `only_with_geofences=true`, locations are imported only if geofence data exists:
  - non-empty `ShapeWkt`, or
  - numeric `Radius` greater than `0`.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Requests/ImportTrackingProviderLocationsRequest.php`
- `php -l app/Http/Controllers/Api/V1/MerchantIntegrationController.php`
- `php -l app/Services/MerchantIntegrationService.php`
- `php -l app/Services/Mixtelematics/MixIntegrateService.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added support for location contact email storage and response serialization.

### API Changes
- Location create/update payloads now accept:
  - `email` (nullable, valid email, max 255)
- Location resource payloads now return:
  - `email`

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_160000_add_email_to_locations_table.php`
- Migration adds nullable `email` column to `locations`.

### Behavior Changes
- Location email can now be persisted via manual create/update, CSV import, address-based location creation, and tracking-provider location imports.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_160000_add_email_to_locations_table.php`
- `php -l app/Models/Location.php`
- `php -l app/Http/Resources/LocationResource.php`
- `php -l app/Http/Requests/StoreLocationRequest.php`
- `php -l app/Http/Requests/UpdateLocationRequest.php`
- `php -l app/Services/LocationService.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Fixed tracking-provider location import failures when provider polygon WKT is saved into `locations.polygon_bounds` (MySQL geometry).

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Provider-imported `polygon_bounds` is now persisted as geometry using `ST_GeomFromText(...)` for non-sqlite drivers.
- On sqlite, imported polygon WKT continues to be stored as plain text.
- Invalid polygon WKT strings are skipped with a warning log instead of causing a full location import failure.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/MerchantIntegrationService.php`
- Import provider locations with `polygon_bounds` WKT and confirm no MySQL 1416 geometry error.

---

## 2026-02-27 | Version: unreleased

### Summary
- Made key location address fields nullable to support integration/import payloads that do not provide full structured address data.

### API Changes
- None.

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_150000_make_location_address_fields_nullable.php`
- Migration changes `locations` columns to nullable:
  - `address_line_1`
  - `city`
  - `province`
  - `post_code`

### Behavior Changes
- Location records can now be persisted with missing values for the four address fields above.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_150000_make_location_address_fields_nullable.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Switched auto run/shipment lifecycle logic from `locations.is_loading_location` to location type flags (`collection_point`, `delivery_point`) and added lifecycle vehicle activity events.

### API Changes
- Vehicle activity event type filters now support:
  - `shipment_created`
  - `shipment_ended`
  - `run_started`
  - `run_ended`
- Vehicle activity location payload no longer includes `is_loading_location`.

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_140000_drop_is_loading_location_from_locations_table.php`
- Migration drops `locations.is_loading_location`.

### Behavior Changes
- Auto lifecycle decisions now use location type flags:
  - `collection_point=true` drives run start/finish behavior.
  - `delivery_point=true` drives auto shipment creation/attempt behavior.
  - if both flags are true, delivery handling and collection handling are both executed.
  - if location has no `location_type_id`/relation, auto create/complete behavior is skipped.
- On lifecycle transitions, system now records explicit vehicle activity events for shipment and run boundaries.
- Collection-point re-entry to the same origin location no longer completes the active run unless at least one run shipment exists.

### Breaking Changes
- Yes.
- `locations.is_loading_location` is removed from runtime behavior and database schema; clients should rely on `location_types.collection_point` and `location_types.delivery_point`.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Models/VehicleActivity.php`
- `php -l app/Http/Requests/ListVehicleActivitiesRequest.php`
- `php -l app/Services/LocationService.php`
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l database/migrations/2026_02_27_140000_drop_is_loading_location_from_locations_table.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Updated shipment full report pickup timing fields to use the latest previous pickup location visit per shipment.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now includes:
  - `from_time_out` (alias of pickup `time_out`)
- `from_time_to` remains for backward compatibility and now resolves from the same latest pickup visit source.

### Database Changes
- None.

### Behavior Changes
- Pickup-side report times now resolve from the latest `vehicle_activity` record where:
  - `shipment_id` matches shipment
  - `location_id` matches `shipments.pickup_location_id`
  - `event_type = entered_location`
- This replaces aggregate `MIN(entered_at)` / `MAX(exited_at)` behavior with latest-visit values.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l docs/release-notes.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Added merchant onboarding timestamp support via `setup_completed_at` on merchant settings updates.

### API Changes
- `PATCH /api/v1/merchants/{merchant_uuid}/settings` now accepts:
  - `setup_completed_at` (optional, nullable date/datetime)
- Merchant responses now include:
  - `setup_completed_at` (formatted in merchant timezone)

### Database Changes
- Added `setup_completed_at` (nullable timestamp) to `merchants`:
  - migration: `database/migrations/2026_02_27_130000_add_setup_completed_at_to_merchants_table.php`

### Behavior Changes
- Merchant settings update now persists `setup_completed_at` when supplied.
- Returned merchant payloads include `setup_completed_at` immediately after update.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_27_130000_add_setup_completed_at_to_merchants_table.php`
- `php -l app/Http/Requests/UpdateMerchantSettingsRequest.php`
- `php -l app/Services/MerchantService.php`
- `php -l app/Http/Resources/MerchantResource.php`
- `php -l tests/Feature/MerchantTest.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Replaced legacy `locations.type` usage with `locations.location_type_id` across schema, APIs, and services.

### API Changes
- Location payloads now use `location_type_id` (UUID of `location_types`) instead of `type`.
- `POST /api/v1/locations` now accepts `location_type_id` (and defaults to merchant `waypoint` when omitted).
- `PATCH /api/v1/locations/{location_uuid}` now accepts `location_type_id` for updates.
- Location responses now return:
  - `location_type_id`
  - `location_type_slug`
- Route/run location stop payloads now expose `location_type_id`/`location_type_slug` instead of string `type`.
- Shipment/quote address payloads now accept optional:
  - `pickup_address.location_type_id`
  - `dropoff_address.location_type_id`

### Database Changes
- Added migration:
  - `database/migrations/2026_02_27_120000_replace_locations_type_with_location_type_id.php`
- Migration actions:
  - add `locations.location_type_id` foreign key to `location_types`
  - backfill `location_type_id` from existing `locations.type` values (creating merchant `location_types` rows as needed)
  - drop `locations.type`

### Behavior Changes
- Location create/update/import now resolve and persist location type via `location_type_id`.
- Address-based location creation for shipments/quotes now assigns default types by context:
  - pickup addresses default to `pickup`
  - dropoff addresses default to `dropoff`
  - imports/default address flows use `waypoint` when type is unspecified
- CSV import now validates optional `location_type_id` UUID input instead of `type` slug.

### Breaking Changes
- Yes.
- Clients must stop sending/reading `locations.type` and move to `location_type_id` (`UUID`) for all location type handling.

### Verification
- `php -l database/migrations/2026_02_27_120000_replace_locations_type_with_location_type_id.php`
- `php -l app/Services/LocationService.php`
- `php -l app/Http/Requests/StoreLocationRequest.php`
- `php -l app/Http/Requests/UpdateLocationRequest.php`
- `php -l app/Http/Resources/LocationResource.php`
- `php -l app/Http/Resources/RouteResource.php`
- `php -l app/Http/Resources/RunResource.php`

---

## 2026-02-27 | Version: unreleased

### Summary
- Made location type sync accept missing slugs by deriving them from the provided title.

### API Changes
- `PATCH /api/v1/location-types` now supports payload items without `types[].slug`.
- If `types[].slug` is omitted (or blank), the backend resolves slug from `types[].title`.
- Sync now returns validation errors for:
  - invalid provided slugs that cannot be normalized
  - duplicate resolved slugs within the same `types` payload

### Database Changes
- None.

### Behavior Changes
- Bulk sync now updates/creates records using a resolved slug (`slug` input or title-derived slug).
- Clients can send cleaner payloads using only `title` for new/updated type entries when explicit slugs are unnecessary.
- Location types docs now reflect optional `slug` behavior and title-based slug generation.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/LocationTypeService.php`
- `rg -n "types\\[\\]\\.slug|generates it from" docs/location-types-explained.md`

---

## 2026-02-27 | Version: unreleased

### Summary
- Updated location type fallback defaults to return seven operational slugs instead of a single `default` type.

### API Changes
- `GET /api/v1/location-types` fallback payload now returns these slugs when a merchant has no saved location types:
  - `depot`, `pickup`, `dropoff`, `service`, `waypoint`, `break`, `fuel`
- Fallback point flags now map as:
  - `collection_point=true`: `depot`, `pickup`
  - `delivery_point=true`: `service`

### Database Changes
- None.

### Behavior Changes
- Merchant fallback location types now align with configured operational defaults:
  - `depot` is fallback `default=true` at sequence `1`
  - remaining fallback types are returned in sequence order through `fuel` (`7`)
- Added feature coverage for fallback order and point flag behavior.
- Updated location type API docs examples to reflect the new fallback defaults.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/LocationTypeService.php`
- `php -l tests/Feature/LocationTypeFallbackTest.php`
- `rg -n "Fallback slugs are|delivery_point=true only for \`service\`" docs/location-types-explained.md`
- `php artisan test --filter=LocationTypeFallbackTest`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added `delivery_point` support to location types across database, API validation, responses, service sync logic, docs, and Postman samples.

### API Changes
- `LocationTypeResource` now includes:
  - `delivery_point` (boolean)
- `PATCH /api/v1/location-types` request now accepts:
  - `types[].delivery_point` (optional boolean)
- `GET /api/v1/location-types` responses now include `delivery_point` for each type (including fallback default types).

### Database Changes
- Added `delivery_point` column to `location_types`:
  - migration: `database/migrations/2026_02_26_130000_add_delivery_point_to_location_types_table.php`
  - type: `boolean`
  - default: `false`

### Behavior Changes
- Bulk location type sync now persists `delivery_point` per submitted type.
- Fallback/default location type payload now includes `delivery_point=false`.
- Updated Postman patch request examples and location-type docs to include `delivery_point`.

### Breaking Changes
- None.

### Verification
- `php -l database/migrations/2026_02_26_130000_add_delivery_point_to_location_types_table.php`
- `php -l app/Models/LocationType.php`
- `php -l app/Http/Resources/LocationTypeResource.php`
- `php -l app/Http/Requests/SyncLocationTypesRequest.php`
- `php -l app/Services/LocationTypeService.php`
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} } echo "OK\n";'`

---

## 2026-02-26 | Version: unreleased

### Summary
- Restored location type listing endpoint while retaining bulk sync patch endpoint.

### API Changes
- Added back:
  - `GET /api/v1/location-types?merchant_id={merchant_uuid}`
- Existing retained:
  - `PATCH /api/v1/location-types`
- `GET /api/v1/location-types` supports optional filters:
  - `collection_point` (boolean)
  - `default` (boolean)
- `GET /api/v1/location-types` response includes `meta.is_default_fallback` to indicate when fallback defaults are returned.

### Database Changes
- None.

### Behavior Changes
- Clients can fetch merchant location types without submitting a patch payload.
- If a merchant has no saved types, GET returns default fallback types (`is_default_fallback=true`) as before.
- Postman collections now expose both GET and PATCH requests for location types.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/LocationTypeController.php`
- `php -l app/Services/LocationTypeService.php`
- `php -l routes/api.php`
- `php artisan route:list --path=api/v1/location-types`
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} } echo "OK\n";'`

---

## 2026-02-26 | Version: unreleased

### Summary
- Refactored location type management to a single bulk sync endpoint using `PATCH /api/v1/location-types`.

### API Changes
- Removed location type endpoints:
  - `GET /api/v1/location-types`
  - `GET /api/v1/location-types/{location_type_uuid}`
  - `POST /api/v1/location-types`
  - `PATCH /api/v1/location-types/{location_type_uuid}`
  - `DELETE /api/v1/location-types/{location_type_uuid}`
- Added single endpoint:
  - `PATCH /api/v1/location-types`
- New request contract:
  - `merchant_id` (required UUID)
  - `types` (required array, min 1)
  - `types[].location_type_id` (optional UUID)
  - `types[].slug` (required, distinct in payload)
  - `types[].title` (required)
  - `types[].collection_point`, `types[].sequence`, `types[].icon`, `types[].color`, `types[].default` (optional)
- New response contract for patch:
  - returns full saved location type list for the merchant.

### Database Changes
- None.

### Behavior Changes
- Patch now performs bulk sync:
  - creates types when merchant has none
  - updates existing types by `location_type_id` or `slug`
  - creates new submitted types
  - removes omitted merchant types
- Default handling is normalized so only one submitted `default=true` (first encountered) is kept.
- Updated Postman collections and docs to reflect bulk patch-only flow.

### Breaking Changes
- Yes.
- Clients must stop using location type `GET/POST/DELETE` and item-level patch endpoints and use only `PATCH /api/v1/location-types`.

### Verification
- `php -l app/Http/Controllers/Api/V1/LocationTypeController.php`
- `php -l app/Services/LocationTypeService.php`
- `php -l app/Http/Requests/SyncLocationTypesRequest.php`
- `php -l routes/api.php`
- `php artisan route:list --path=api/v1/location-types`
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} } echo "OK\n";'`

---

## 2026-02-26 | Version: unreleased

### Summary
- Updated Postman collections to include the new `location-types` endpoints.

### API Changes
- No runtime API contract changes.
- Documentation/testing collections now include:
  - `GET /api/v1/location-types?merchant_id={{merchant_id}}`
  - `POST /api/v1/location-types`
  - `GET /api/v1/location-types/{{location_type_uuid}}`
  - `PATCH /api/v1/location-types/{{location_type_uuid}}`
  - `DELETE /api/v1/location-types/{{location_type_uuid}}`

### Database Changes
- None.

### Behavior Changes
- No application runtime behavior changes.

### Internal Changes
- Added and standardized `location-types` request entries in:
  - `postman/collections/Courier Integrate API.postman_collection.json`
  - `postman/collections/Courier Integrate API - Super Admins.postman_collection.json`
  - `postman/collections/Courier Integrate API - Drivers.postman_collection.json`
  - `postman/collections/New Collection.postman_collection.json`

### Breaking Changes
- None.

### Verification
- `php -r 'foreach (glob("postman/collections/*.json") as $f) { json_decode(file_get_contents($f), true); if (json_last_error()) { echo "INVALID $f: ".json_last_error_msg()."\n"; exit(1);} echo "OK $f\n"; }'`
- `rg -n "GET /api/v1/location-types|POST /api/v1/location-types|GET /api/v1/location-types/\{\{location_type_uuid\}\}|PATCH /api/v1/location-types/\{\{location_type_uuid\}\}|DELETE /api/v1/location-types/\{\{location_type_uuid\}\}" postman/collections/*.json`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added merchant-managed `location_types` API with full CRUD and default fallback response when a merchant has no saved location types.

### API Changes
- Added endpoints:
  - `GET /api/v1/location-types` (requires `merchant_id` for merchant-scoped listing)
  - `GET /api/v1/location-types/{location_type_uuid}`
  - `POST /api/v1/location-types`
  - `PATCH /api/v1/location-types/{location_type_uuid}`
  - `DELETE /api/v1/location-types/{location_type_uuid}`
- Added request/response schema support for fields:
  - `slug`, `title`, `collection_point`, `sequence`, `icon`, `color`, `default`, `merchant_id`, `account_id`
- `GET /api/v1/location-types` now returns `meta.is_default_fallback=true` and a built-in default type when no location types exist for the merchant.

### Database Changes
- Added table `location_types` with merchant/account scoping and soft deletes:
  - migration: `database/migrations/2026_02_26_120000_create_location_types_table.php`
  - columns: `uuid`, `account_id`, `merchant_id`, `slug`, `title`, `collection_point`, `sequence`, `icon`, `color`, `default`, timestamps, `deleted_at`
  - constraints/indexes:
    - unique: `(merchant_id, slug)`
    - indexes on `(merchant_id, sequence)` and `(merchant_id, default)`

### Behavior Changes
- Users can now manage merchant-specific location types instead of relying only on hardcoded location `type` values.
- When a merchant has no saved location types, the API returns a default type payload (`slug=default`, `title=Default`) so clients always have at least one option.
- Setting `default=true` on create/update clears existing default flags for other location types under the same merchant.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/LocationTypeController.php`
- `php -l app/Services/LocationTypeService.php`
- `php -l app/Http/Requests/StoreLocationTypeRequest.php`
- `php -l app/Http/Requests/UpdateLocationTypeRequest.php`
- `php -l app/Http/Resources/LocationTypeResource.php`
- `php -l app/Models/LocationType.php`
- `php -l app/Http/Requests/BaseRequest.php`
- `php -l routes/api.php`
- `php -l database/migrations/2026_02_26_120000_create_location_types_table.php`
- `php artisan route:list --path=api/v1/location-types`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added driver details to vehicle activity API responses.

### API Changes
- `VehicleActivityResource` now includes a `driver` object (when activity is linked to a run with a driver), with:
  - `driver_id`
  - `name`
  - `email`
  - `telephone`
  - `intergration_id`
  - `is_active`

### Database Changes
- None.

### Behavior Changes
- Vehicle activity list responses now expose driver identity/contact fields for easier UI rendering without separate run/driver fetches.
- `VehicleActivityService` now eager-loads `run.driver.user` to avoid N+1 queries when serializing driver details.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l app/Services/VehicleActivityService.php`

---

## 2026-02-26 | Version: unreleased

### Summary
- Added real-time vehicle activity broadcasting over authenticated private socket channels.

### API Changes
- Added broadcast auth endpoint for private channels:
  - `POST /api/v1/broadcasting/auth` (middleware: `auth.api`)
- Added private channel:
  - `merchant.{merchantUuid}.vehicle-activities`
- Added event name on the channel:
  - `vehicle.activity.created` (payload includes `VehicleActivityResource` data under `activity`)

### Database Changes
- None.

### Behavior Changes
- Every newly created `vehicle_activity` record in the auto-run lifecycle now emits `vehicle.activity.created` to the merchant-scoped private channel.
- Channel authorization allows:
  - `super_admin`
  - users in the same account as the merchant
  - users linked to or owning the merchant
- Added `config/broadcasting.php` with a safe default (`BROADCAST_CONNECTION=log`) so broadcast dispatch does not break when no realtime provider is configured yet.
- Implemented in `app/Events/VehicleActivityCreated.php`, `routes/channels.php`, `app/Providers/AppServiceProvider.php`, and `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Events/VehicleActivityCreated.php`
- `php -l routes/channels.php`
- `php -l app/Providers/AppServiceProvider.php`
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l config/broadcasting.php`

---

## 2026-02-25 | Version: unreleased

### Summary
- Auto-created runs now attempt to resolve and assign driver from tracking payload `driverID` (`driverIntegrationId`) by matching `drivers.intergration_id`.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- In geofence loading-location entry flow, auto-created runs now set `runs.driver_id` using:
  1. `drivers.intergration_id == driverIntegrationId` (same merchant account), otherwise
  2. fallback to latest `driver_vehicles` assignment for the vehicle (existing behavior).
- Updated in `app/Services/AutoRunLifecycleService.php`.
- Added coverage for integration-id assignment in `tests/Feature/AutoRunLifecycleServiceTest.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`
- `php artisan test --filter=AutoRunLifecycleServiceTest` (fails due pre-existing SQLite-incompatible migration: `2026_02_05_000098_update_booking_status_enum.php` uses MySQL `ALTER TABLE ... MODIFY ... ENUM`)

---

## 2026-02-24 | Version: unreleased

### Summary
- Added filter and sort capabilities to the full shipments report endpoint.

### API Changes
- `GET /api/v1/reports/shipments_full_report` now supports filters:
  - `date_created`
  - `collection_date`
  - `shipment_number`
  - `delivery_note_number`
  - `truck_plate_number`
  - `driver_id`
  - `from_location_id`
  - `to_location_id`
  - `shipment_status`
- `GET /api/v1/reports/shipments_full_report` now supports sorting:
  - `sort_by=date_created|collection_date|shipment_number|delivery_note_number|truck_plate_number|driver_name|shipment_status|delivered_volume`
  - `sort_direction=asc|desc`

### Database Changes
- None.

### Behavior Changes
- Report rows are now filtered at query level before pagination.
- Sorting by truck plate and driver name is based on the latest non-removed run-shipment association.
- Sorting by `delivered_volume` uses parcel weight totals for deterministic ordering.

### Breaking Changes
- None.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`

---

## 2026-02-24 | Version: unreleased

### Summary
- Added a full shipments reporting endpoint with shipment, routing, location, timing, and delivered-volume data.
- Added `delivery_note_number` to shipments.
- Updated shipment parcel schema from `weight_kg` to `weight` with explicit `weight_measurement`, and added parcel `type`.

### API Changes
- Added endpoint:
  - `GET /api/v1/reports/shipments_full_report`
- Report rows now include:
  - `date_created`, `collection_date`, `shipment_number` (`merchant_order_ref`), `delivery_note_number`, `truck_plate_number`, `driver`, `shipment_type`, `from_location`, `from_time_in`, `from_time_to`, `to_location`, `to_time_in`, `to_time_out`, `shipment_status`, `delivered_volume`.
- Shipment create/update payloads now accept:
  - `delivery_note_number`
  - parcel `weight`, `weight_measurement`, `type` (replacing `weight_kg`)
- Quote request payload parcel validation now expects:
  - `weight`, `weight_measurement`, `type` (replacing `weight_kg`)
- Shipment resource now exposes `delivery_note_number`.
- Shipment parcel resource now exposes `weight`, `weight_measurement`, and `type`.

### Database Changes
- Added shipment field:
  - `database/migrations/2026_02_24_202457_add_delivery_note_number_to_shipments_table.php`
- Updated `shipment_parcels` weight schema:
  - rename `weight_kg` -> `weight`
  - add `weight_measurement` (default `kg`)
  - add `type`
  - migration: `database/migrations/2026_02_24_202458_update_shipment_parcels_weight_fields.php`

### Behavior Changes
- Full shipment report now returns full `LocationResource` objects for both pickup and dropoff locations.
- Pickup/dropoff in/out times are derived from shipment-linked `vehicle_activity` geofence enter visits.
- Delivered volume is rendered as grouped totals by measurement unit (example: `12 kg, 4 l`) and only populated for delivered shipments.

### Breaking Changes
- `weight_kg` is replaced by `weight` + `weight_measurement` in shipment parcel API payloads/resources and in the `shipment_parcels` table schema.

### Verification
- `php -l app/Http/Controllers/Api/V1/ReportController.php`
- `php -l app/Http/Requests/CreateQuoteRequest.php`
- `php -l app/Http/Requests/StoreShipmentRequest.php`
- `php -l app/Http/Requests/UpdateShipmentRequest.php`
- `php -l app/Http/Resources/ShipmentParcelResource.php`
- `php -l app/Http/Resources/ShipmentResource.php`
- `php -l app/Models/Shipment.php`
- `php -l app/Models/ShipmentParcel.php`
- `php -l app/Services/ShipmentService.php`
- `php -l database/migrations/2026_02_24_202457_add_delivery_note_number_to_shipments_table.php`
- `php -l database/migrations/2026_02_24_202458_update_shipment_parcels_weight_fields.php`
- `php -l tests/Feature/ShipmentQuoteTest.php`
- `php -l routes/api.php`
- `php artisan route:list --path=api/v1/reports/shipments_full_report`
- `php artisan test --filter=ShipmentQuoteTest` (fails due pre-existing SQLite-incompatible migration: `2026_02_05_000098_update_booking_status_enum.php` uses MySQL `ALTER TABLE ... MODIFY ... ENUM`)

---

## 2026-02-23 | Version: unreleased

### Summary
- Removed route stop uniqueness requirement on `(route_id, sequence)` to allow multiple stops sharing the same sequence.

### API Changes
- Route create/update validation now allows repeated `stops.*.sequence` values.

### Database Changes
- Dropped unique index `uq_route_stops_route_sequence` on `route_stops(route_id, sequence)`.
- Added non-unique index `idx_route_stops_route_sequence` on `route_stops(route_id, sequence)`.
- Migration:
  - `database/migrations/2026_02_23_000014_drop_unique_route_sequence_on_route_stops_table.php`

### Behavior Changes
- Route stop syncing now supports repeated sequence values for a single route and preserves requested duplicates.
- Updated in `app/Services/RouteService.php`, `app/Http/Requests/StoreRouteRequest.php`, and `app/Http/Requests/UpdateRouteRequest.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RouteService.php`
- `php -l app/Http/Requests/StoreRouteRequest.php`
- `php -l app/Http/Requests/UpdateRouteRequest.php`
- `php -l tests/Feature/RouteServiceTest.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Fixed duplicate `route_stops` sequence writes during repeated auto-route sync in vehicle tracking workflows.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Auto-route stop syncing now reuses/restores existing stop rows by `sequence` instead of soft-deleting and reinserting.
- Prevents `SQLSTATE[23000] ... Duplicate entry '<route_id>-<sequence>' for key 'route_stops.uq_route_stops_route_sequence'` during repeated auto-route creation/sync.
- Updated in `app/Services/RouteService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/RouteService.php`
- `php -l tests/Feature/RouteServiceTest.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Changed auto-created shipment default lifecycle status from `booked` to `in_transit`.

### API Changes
- None.

### Database Changes
- Expanded shipment status enum to include `in_transit` (MySQL):
  - `database/migrations/2026_02_23_000013_update_shipment_status_enum_add_in_transit.php`

### Behavior Changes
- In geofence-driven auto shipment creation, new auto-created shipments now start as `in_transit`.
- Existing non-terminal auto-created shipments encountered in the same flow are normalized to `in_transit` instead of `booked`.
- Updated in `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l database/migrations/2026_02_23_000013_update_shipment_status_enum_add_in_transit.php`
- `php -l tests/Feature/AutoRunLifecycleServiceTest.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Added shipment linkage to vehicle activity records.

### API Changes
- `GET /api/v1/vehicle-activities` now returns `shipment_id` and `shipment` object on each activity.
- Added `shipment_id` filter support on `GET /api/v1/vehicle-activities`.

### Database Changes
- Added nullable `shipment_id` foreign key to `vehicle_activity`:
  - `database/migrations/2026_02_23_000012_add_shipment_id_to_vehicle_activity_table.php`

### Behavior Changes
- On dropoff geofence entry, `vehicle_activity` enter events now store the related shipment.
- On dropoff geofence exit, exit events now carry `shipment_id` and delivery sync uses the linked shipment when available.
- Updated in `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`
- `php -l app/Http/Resources/VehicleActivityResource.php`
- `php -l app/Services/VehicleActivityService.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Updated auto-created shipment lifecycle around geofence events.

### API Changes
- None.

### Database Changes
- None.

### Behavior Changes
- Auto-created shipments for dropoff geofence entry are now created/normalized with `status=booked`.
- When vehicle exits that dropoff geofence visit, the matching auto-created shipment is marked `delivered`.
- Related `run_shipments` row is moved to `done` when auto-delivery occurs on location exit.
- Changed in `app/Services/AutoRunLifecycleService.php`.

### Breaking Changes
- None.

### Verification
- `php -l app/Services/AutoRunLifecycleService.php`

---

## 2026-02-23 | Version: unreleased

### Summary
- Added route management domain and route assignment to runs.
- Added location stop type support (`locations.type`).
- Wired auto-run lifecycle to create/assign auto routes when ending a run at a loading location.

### API Changes
- Added route endpoints:
  - `GET /api/v1/routes`
  - `GET /api/v1/routes/{route_uuid}`
  - `POST /api/v1/routes`
  - `PATCH /api/v1/routes/{route_uuid}`
  - `DELETE /api/v1/routes/{route_uuid}`
- Run payloads now accept `route_id` and responses include route details.
- Location payloads now accept `type`.

### Database Changes
- Added `locations.type`:
  - `database/migrations/2026_02_22_000008_add_type_to_locations_table.php`
- Added `routes` table:
  - `database/migrations/2026_02_22_000009_create_routes_table.php`
- Added `route_stops` table:
  - `database/migrations/2026_02_22_000010_create_route_stops_table.php`
- Added `runs.route_id`:
  - `database/migrations/2026_02_22_000011_add_route_id_to_runs_table.php`

### Behavior Changes
- Route stop order is sequence-based with unique sequence per route.
- Auto route code format:
  - `AUTO-ROUTE-{origin_location_name_or_company}-{destination_location_name_or_company}`
- Auto-created routes are restored if previously soft-deleted and reused.

### Breaking Changes
- None.

### Verification
- `php -l` passed for new/updated route/location/run service and request/resource files.
- `php artisan route:list --path=api/v1/routes` confirms route endpoints are registered.

---

## Entry Template

```md
## YYYY-MM-DD | Version: x.y.z

### Summary
- ...

### API Changes
- ...

### Database Changes
- ...

### Behavior Changes
- ...

### Breaking Changes
- None.

### Verification
- ...
```
