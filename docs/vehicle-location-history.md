# Vehicle GPS history and run tracks

Implemented 2026-09-18; deployment flags default off. This does not change odometer totals, billing or shipment-distance allocation.

## Rollout

1. Deploy the additive `2026_09_18_150000_create_vehicle_location_history` migration before enabling either flag. It creates history and deduplication receipts and adds the run actual-interval index. Keep the existing one-minute tracking schedule.
2. Enable `VEHICLE_HISTORY_RECORDING_ENABLED=true`, refresh Laravel configuration and restart queue workers. Confirm ingestion metrics and row growth. Keep display off initially.
3. Deploy API, website and mobile consumers, then enable `VEHICLE_HISTORY_DISPLAY_ENABLED=true`. Use a shared cache across API and queue hosts. Both flags can be switched off independently without deleting captured data. While display is off, maps show that recorded display is disabled.
4. Verify native iOS/Android map interaction and foreground/background behavior on the deployed build, and check the database query plan on the production database engine before broad rollout.

Optional environment settings: `VEHICLE_HISTORY_STATIONARY_SPEED_KPH` (3) and `VEHICLE_HISTORY_STATIONARY_RADIUS_METRES` (25). Gap limit is 300 seconds in `config/vehicle_history.php`; the coordinate ceiling cannot exceed 2,000.

There is no history pruning, expiry, backfill or payload storage. Do not roll back the migration after capture begins unless deliberately deleting history. Cache entries expire; history and receipt rows do not.

## Capture semantics

Each distinct provider observation has a SHA-256 receipt. A separate compact `vehicle_location_receipts` table retains every receipt indefinitely so that retries of any sample within a merged stationary interval remain idempotent. It stores identity/time only, not provider payloads or duplicate coordinates.

History stores UTC observation/receipt times, account/merchant/vehicle/integration/run IDs, original and latest coordinates, latest speed/odometer, stationary status and sample count. Coordinates must be finite and within latitude/longitude bounds. Zero is valid. Source timestamps are normalized before hashing. Missing source timestamps use a stable queue-job capture time and delivery identity, and are marked `source_time_known=false`.

A stop extends only when a newer sample reports 0–3 km/h, remains within 25m of its original coordinate, arrives within five minutes of its previous observation, and has the same merchant/integration/run. Original position/time remain unchanged. Missing speed, movement, excessive drift/gap, or association change creates a new row. Delayed observations are retained individually and do not replay lifecycle transitions or rewind the live vehicle snapshot.

All ingestion locks the vehicle inside a transaction. MySQL/PostgreSQL use row locks; SQLite acquires its writer lock before reading because it lacks `SELECT FOR UPDATE`. Network provider lookups occur before this critical section. Receipt, stop and latest-snapshot mutations commit together in the tracking job, with transaction retry handling.

Run association uses vehicle plus merchant/account and actual `started_at <= observation <= completed_at`; an open active run has no upper bound. An unclosed cancelled run is excluded. The lifecycle service runs before history capture so the automatic-start observation can join its new run. Overlapping intervals remain unassigned and log `vehicle_history.ambiguous_run`. Unassigned history is retained; it is not retrospectively attached to today's active run.

## API and map contract

- `GET /api/v1/runs/{run_uuid}/track`: existing run policy and merchant-environment scope.
- `GET /api/v1/driver/runs/{run_uuid}/track`: assigned driver and matching account/merchant, including completed runs.
- Optional opaque `before` cursor selects an earlier window. Invalid cursors return 422.
- Standard API response envelope contains `status`, `source`, chronological `segments`, stationary `stops`, `active`, `updated_at` (receipt freshness), `latest_observed_at` (capture freshness) and `coverage`.
- At most 10,000 source rows are read per window using the run/time index; response geometry contains at most 2,000 coordinates. Evenly sampled intermediate points are simplified at read time. Segment endpoints and stop boundaries are retained. Excess boundaries produce earlier windows rather than being silently discarded; `coverage.next_before` supports Earlier route, with Latest route to return.
- Segments break at gaps over five minutes and conservatively around delayed/overlapping intervals. Lines connect observed points; no directions or road matching runs in Recorded mode. This is sampled GPS evidence, not a guarantee of every road travelled.
- No new history query is added to shipment reports, run lists or dashboard payloads. The admin map requests it when visible; Run KM requests it when expanded. Mobile requests it only in Recorded mode, retaining the current truck marker. Planned remains the initial mode with its existing routing.
- Visible active recorded views refresh every minute, and skip requests while the document/app is hidden or backgrounded. Errors retain prior data for the same run/window and offer retry. Empty, stale and disabled states are explicit.
- Completed maps cache for 24 hours; live maps cache for 15 seconds. Committed history mutations change the affected run's cache version, including late points. Old cache versions expire naturally.
- Runs lacking new history can show up to 2,000 activity-derived positions as **Limited historical data**, always partial. Missing historic points cannot be reconstructed. `coverage.partial` indicates a bounded/earlier window, gaps, a missing start/end interval over five minutes, or estimated source timestamps. Additional coverage fields identify these causes. It never asserts that sampled GPS proves every road travelled.

## Operations

Consume structured `vehicle_history.ingestion` logs for created/merged/duplicate/invalid counts, job result and duration (including provider fetch time). Existing tracking failure logs retain exception details. `vehicle_history.route` logs uncached build duration, displayed coordinate count and response bytes. Alert on increasing failures, invalid/ambiguous assignments, unexpected duplicate ratios, stale active vehicles, or a sustained p95 ingestion time approaching the one-minute poll interval. No coordinates/provider payloads are added to these metrics.

Track daily history/receipt row counts and data/index bytes, provision storage for indefinite retention and include both tables in backups. Monitor receipt growth even when parked trucks use one history row. On MySQL, query `information_schema.tables` for these two tables' `table_rows`, `data_length` and `index_length`; use `EXPLAIN` for scoped `run_id` + `observed_at/id` cursor queries and vehicle latest-history lookups. The indexes are `vlh_run_time`, `vlh_vehicle_latest`, `vlh_vehicle_time` and `runs_vehicle_actual_interval`. Production alerts/retention capacity remain deployment operations, not installed external monitoring infrastructure.

## Verification

Automated checks cover stationary merging/drift/gaps, resumed movement, missing speed, permanent deduplication, UTC offsets/microseconds, delayed samples and live-snapshot protection, run boundaries/overlaps, merchant and driver authorization, feature flags, a 12,000-row multi-day history with 6,000 stops, bounded responses and SQLite indexed query plans. A separate temporary SQLite database exercises four concurrent processes delivering the same observations; committed late samples invalidate a completed route's cache. Existing lifecycle and run API tests remain regression checks for event and odometer behavior.

A temporary browser fixture verified separate drawn segments, stale/empty/error states and Retry. The fixture was removed after testing. Native device checks and production-engine load/lock/query-plan checks are release verification gates. Local synthetic fixtures do not establish production capacity or Google/native SDK reliability.
