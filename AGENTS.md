This project is a laravel project but the is a expo mobile app in this folder /mobile_app and the main frontend and admin area is on the /website folder

## Dashboard Plan (Required)

Read `docs/design/dashboard/README.md` before dashboard, run-map, run-lifecycle, or driver delivery-note upload work. It is the canonical intended behaviour and implementation handoff.

Whenever the dashboard plan changes, update that README in the same task, including its revision history, acceptance criteria, and implementation status. Keep the affected Figma designs consistent with the plan. Do not describe a planned feature as already implemented.

## Release Notes Policy (Required)

For every code change (feature, fix, refactor, migration, endpoint change), update `docs/release-notes.md` in the same task.

Rules:
1. Add newest entries at the top.
2. Include:
   - Date (YYYY-MM-DD)
   - Version/tag
   - Summary
   - API Changes
   - Database Changes
   - Behavior Changes
   - Breaking Changes (or None)
   - Verification
3. If no user-facing/runtime impact, still add a short `Internal Changes` note.
4. Do not finish a task until release notes are updated.
