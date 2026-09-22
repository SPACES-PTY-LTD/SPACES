# Audit and clean false geofence shipments

The command uses **current drawn polygons**, with strict polygon containment. It identifies auto-created shipments whose creation event was outside the destination and whose available trip observations contain no interior evidence. These are review candidates, not proof that a truck never entered between GPS samples.

Deploy the code and apply the new migration before using the command. The migration creates `geofence_cleanup_batches`, `geofence_cleanup_items`, and a nullable invalidation field on `vehicle_activity`. Restart long-running workers after deployment. No cleanup runs as part of migration or deployment.

## 1. Audit a bounded merchant scope

```bash
php artisan shipments:cleanup-geofence audit \
  --merchant=<merchant-uuid> \
  --from=2026-09-01T00:00:00+02:00 \
  --to=2026-09-23T00:00:00+02:00
```

Optionally add `--run=<run-uuid>` to start with one run. Dates require ISO 8601 timestamps with explicit time zones; `from` is inclusive and `to` exclusive. Scope uses the original `shipment_created` event, not backdated shipment creation dates. Auto-created shipments missing this event are also included when an associated completed run overlaps the window; their creation date is not guessed.

Audit writes only the audit ledger and private reports. It does not change shipments, bookings, runs, visits or GPS data. Each shipment is inspected transactionally; the audit is a sequence of per-shipment snapshots, not a single database-wide instant. Large scopes can take time and briefly lock related rows; begin with a single run or short date window.

The command prints an audit UUID and writes:

- `storage/app/private/geofence-cleanup/<audit-uuid>/report.json`
- `storage/app/private/geofence-cleanup/<audit-uuid>/report.csv`

Files include references/UUIDs, run and destination, original event time/coordinates, polygon fingerprint, interior evidence, coverage gaps, classification, reasons and proposed changes. Reports contain private location data and are created with owner-only file permissions. CSV cells are escaped against spreadsheet formula interpretation. Audit scope and evidence are also retained in the database.

### Classifications

| Classification | Meaning |
| --- | --- |
| `cleanup_candidate` | Outside creation point, no recorded interior evidence, sufficient retained samples and no protection flags. Requires explicit operator selection. |
| `keep` | At least one observation within the destination polygon on the same run, including a later valid visit. |
| `insufficient_evidence` | Missing/ambiguous original event, invalid coordinates, absent GPS, significant gaps or compressed/unknown-time history. Cannot be applied. |
| `protected` | Open/invalid run, ambiguous associations, foreign scope, missing/invalid polygon, known polygon change since trip, invoicing, delivery note/import, proof of delivery, parcel scan, external booking, dispatch/quote records, tracking/manual processing, prior cancellation/failure/deletion/invalidation. Cannot be applied. |

Coverage checks the whole recorded run, including its start/end gaps. No consecutive retained endpoints may be more than **five minutes** apart. No interpolation is used. Merged records containing more than two samples cannot establish complete coverage because intermediate positions have been discarded; those shipments need review outside this command. Unknown source times or invalid history coordinates likewise prevent cleanup candidacy. Activity coordinates are conservative evidence to **keep**, never a substitute for complete GPS coverage.

Only explicit `auto_created=true` and `metadata.auto_created_from=vehicle_location_geofence` shipments are considered. Known polygon edits are detected from available location audit logs. Absent/pruned audit logs cannot establish that geometry or records were never edited. Review the reports against operational knowledge before selecting candidates; the command has no force option.

## 2. Apply reviewed candidates

```bash
php artisan shipments:cleanup-geofence apply \
  --audit=<audit-uuid> \
  --shipment=<reviewed-shipment-uuid> \
  --shipment=<another-reviewed-shipment-uuid>
```

To apply every cleanup candidate in a reviewed audit without listing shipment IDs:

```bash
php artisan shipments:cleanup-geofence apply --audit=<audit-uuid> --all-candidates
```

Use either `--all-candidates` or explicit `--shipment` options, never both. The flag is valid only for apply and selects only `cleanup_candidate` rows from that completed audit. Keep/protected/insufficient-evidence rows and other audits/merchants are excluded. Every candidate is still revalidated; changed records are skipped. An audit with no candidates returns an error without creating a cleanup batch. Large selections are read in chunks of 100.

There is no apply-all default; omitting both selection options is an error. The command prints a **cleanup batch UUID** and reports each outcome in its CSV/JSON report.

For each candidate it locks the vehicle/run/shipment context and related records, checks the merchant and current eligibility, and compares evidence fingerprints. Changed records are skipped and require a new audit. Successful changes commit together per shipment; a failure rolls that shipment back while allowing other selected candidates to be processed. A partial batch returns a non-zero exit status.

Applied changes:

- Soft-delete the shipment and its eligible internal booking.
- Mark its run assignments `removed`, excluding them from active run counts/lists.
- Tag its automatic shipment-created/collection/delivery/ended activities as invalidated. Normal activity queries omit them; source rows remain stored.
- Record ownership in shipment metadata to prevent lifecycle automation from silently restoring it.

Runs, physical visits, raw GPS, odometers, parcels and source activity rows remain stored. The command does not recalculate run lifecycle, cancel carrier jobs, send notifications or replay historical GPS. GPS/physical evidence digests are retained for change detection; the ledger does not duplicate the complete route for each shipment.

Repeating apply for a currently cleanup-deleted shipment reports `already_applied`. Preserve the UUID of the batch that actually applied the change; a repeated no-op batch does not own the original changes.

## 3. Restore a cleanup batch

```bash
php artisan shipments:cleanup-geofence restore --batch=<cleanup-batch-uuid>
```

Restore rechecks ownership and fingerprints. It restores only the deletion timestamps, shipment metadata, assignment states and marker visibility changed by that batch. It refuses intervening edits or changed evidence instead of overwriting them. Repeated restoration reports `already_restored`. A conflict remains recorded on the item and returns a partial/non-zero result.

Keep the cleanup ledger and normal database backups. The migration refuses rollback while any applied item remains unrestored, because dropping it would lose recovery information. Production cleanup is an explicit operator action; local tests do not execute it against production.

## Verification

Automated tests cover classification, merchant/run scope, date validation, review selection, changed evidence, transaction rollback, multiple shipments on one run, JSON key ordering, apply/restore commands and exports, idempotency, restoration conflicts and lifecycle resurrection prevention. API tests verify shipment reports, run counts/markers and booking lists after cleanup. Production-engine locking/spatial behaviour and live UI review remain deployment checks.

## Audit performance

Deploy the lookup-index migration before rerunning a large audit:

```bash
php artisan migrate
```

The audit prints its batch UUID immediately, then processed counts after the first shipment, every 25 shipments and on completion. It does not run an expensive total-count query.

Shipments sharing a run, location and polygon reuse calculated trip evidence within that audit. The cache retains at most eight entries, each limited to 1 MiB of serialized evidence, and is cleared when the audit finishes or fails. Larger evidence sets are evaluated without caching. This limit describes serialized cache data, not total PHP memory. Shipment-specific checks still run for every item. Apply and restore bypass the cache and check current source fingerprints under locks, so late GPS or edits cause stale candidates to be skipped. Start a new audit to incorporate late history.

Composite indexes cover merchant/automatic/deleted shipment selection, shipment creation events, run activities and entity logs. Existing vehicle/time indexes support GPS lookups. Index creation can take time on large tables; deploy during a suitable maintenance window. These optimizations reduce repeated work but do not impose a CPU limit. Production query plans and CPU impact still require measurement.
