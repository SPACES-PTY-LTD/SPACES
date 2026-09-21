# Admin run-map timeline proposals

Date: 2026-09-21. Status: option 3 selected and implemented in the shared admin run map. The user subsequently removed the separate colour key and requested the compact 32px car icon. Browser verification uses labelled illustrative data; live run verification requires sign-in.

The three images are saved in their displayed conversation order:

1. [Timeline option 1](timeline-option-1.png)
2. [Timeline option 2](timeline-option-2.png)
3. [Timeline option 3](timeline-option-3.png)

These are illustrative ImageGen UI concepts, not screenshots or actual data for the requested run. Typography, map geometry, labels and time positions must be reconciled with real data during implementation. Use existing Space Grotesk/Inter, neutral shadcn surfaces, 10px radii and blue/green/slate/red marker colours. Generated with the built-in image-generation tool.

## Shared interaction requirements

- A single straight time slider at the bottom of the map, with readable start/end and selected timestamps.
- Dragging or keyboard adjustment moves a replay car and updates the selected activity, location and known stopped duration.
- During a confirmed stop interval the car stays at the stop. Clearly distinguish the selected replay position from the latest mapped stop; Back to latest exits replay.
- Show GPS gaps and unknown activity without inventing vehicle movement, routes or a reason for stopping.
- Whole-trip playback fetches the relevant paginated history, with loading/error/partial states. API responses remain bounded, and unproven continuity across page boundaries stays a gap.
- Preserve marker filters and accessible details. Avoid forced map recentering on every tiny drag.
- Show date and time zone for multi-day trips; provide accessible slider names and keyboard controls.

## Generation brief

Each independent prompt requested a 1440 × 900 production-quality admin map component, a muted Johannesburg/Sandton illustrative basemap, blue route, coloured event pins, vehicle icon, top-right marker filter and bottom scrubber. Date anchor: 21 September 2026. Shared sample: 08:00–14:30 trip, selected 10:42 delivery at an illustrative Sandton customer, 18-minute stop from 10:30–10:48. No dashboard redesign, sidebars, charts or speed-control clutter.

- First prompt: fixed activity summary above a compact linear rail, selected-time tooltip and Back to latest.
- Second prompt: narrow floating rail with an activity bubble anchored above the thumb.
- Third prompt: integrated footer with stop-duration bands, selected activity below and a dashed GPS gap.

The canonical behavior and implementation status are recorded in [the dashboard plan](../dashboard/README.md).

## Implementation evidence

- [Desktop fixture](implemented-timeline-desktop.png)
- [Mobile-width fixture](implemented-timeline-mobile.png)
- [Visual verification report](../../../website/design-qa.md)

The local development preview `/dev-run-replay-preview` exercises the real component with sample history; it returns 404 outside development. The mockups remain historical design references.
