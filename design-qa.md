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
