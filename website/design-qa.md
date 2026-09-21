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
