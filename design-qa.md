# Monitor V2 design verification — 2026-10-15

Compared the selected original and native implementation side-by-side in `docs/design/monitoring-v2/verification/comparison.png`. Six view references and fixture captures are stored alongside it. This is a functional native interpretation, not a pixel-identical image clone.

## Findings and changes

- Preserved white/blue controls, pale schematic scene, fleet summary and contextual detail layouts. Reused actual app navigation in production; preview sidebar is a fixture.
- Improved warehouse silhouettes with doors, roof details, guardhouses and props. Native truck geometry intentionally remains low-poly rather than the reference's photorealistic trailers.
- Fixed location/attention panel overflow with internal scrolling; checked 390px layout without document horizontal overflow.
- User feedback supersedes expanded reference cards: compact location anchors now reveal detail on hover/keyboard focus and a visibility toggle clears them. Browser verified zero location markers while hidden. `09-compact-locations.png` records the updated state.
- Restored direct pan/wheel controls and stable gesture listeners. Ground-plane panning, polar limits and height floor prevent underside views. Strong pan/zoom checked in the browser; physical pinch remains unverified.

## Verification and limits

18 targeted tests, TypeScript and focused ESLint pass. Browser fixture checks cover view navigation, filtering/search, pause, camera reset, mouse pan/wheel and 500/1000-vehicle lists. Local fixture FPS was roughly 50–60; no production-device guarantee. Existing numbered view screenshots document intermediate implementation states; compact-label and ground-camera captures supersede them for those interactions.

Remaining release checks: authenticated merchant data, live GPS map, real touch/pinch, production build and broader device performance. Source artwork is more realistic than native geometry; visual fidelity is therefore partial, not an exact-match pass. No P0/P1 usability issue identified in the exercised fixture flows; live behavior has not received full acceptance testing.

## Location-type verification

All 26 catalog types rendered in the V2 browser fixture. Each marker opened the matching location detail view (28 selection checks including missing/unsupported fallback). Reviewed the captured model contact sheet; both fallback cases render the warehouse. No browser console errors were recorded. Evidence: `docs/design/monitoring-v2/verification/location-type-contact-sheet.png` and individual captures in `verification/location-types/`. Reproduce with `/dev-monitoring-v2-preview?catalog=1`; choose Preview location type. Catalog mapping/asset/registry tests also pass.

---

# Runs reference design QA

- Source visual truth: `/var/folders/h7/lj5bmd8j4sqcf493s0xjt_180000gn/T/codex-clipboard-63e472af-3c8c-4aed-a241-cb9e5d05ba40.png`.
- Source dimensions: 1290 × 2796 pixels; conversation display 945 × 2048. Native logical size/density is not specified; compare app-owned content after capture.
- Implementation: Expo `mobile_app/app/(tabs)/runs.tsx`, completed list, light mode. Implementation screenshot: unavailable.
- Target viewport/state: populated Completed tab with two cards, matching merchant/route data; dark/large-text/native interaction coverage also required.
- Full-view comparison evidence: blocked. Simulator showed a black boot screen/spinner; the in-app browser preview timed out. Figma completed-list screenshots were reviewed but are not evidence of the rendered Expo app.
- Focused region comparison: unavailable because no implementation screenshot could be captured.
- Fonts/typography, spacing/layout rhythm, colour tokens, icon/rail fidelity and app copy: not visually verified in Expo. Code uses native typography, existing route assets and installed icon library; these do not constitute a visual pass.
- Interaction checks: API search/sort/date/pagination regressions and existing route-provenance tests pass. Native calendar, sort sheet, keyboard search, detail navigation, refresh, themes and large text remain pending.
- Console errors: browser inspection unavailable; no clean-console claim.
- Comparison history: no source-to-rendered-implementation comparison completed. Figma overrides were repaired using compact variants and layout reviewed separately.

## Required follow-up

Capture the populated native list at the reference state, compare the full view and key regions, repair any P0/P1/P2 differences, and exercise filters/navigation on iOS and Android.

final result: blocked
