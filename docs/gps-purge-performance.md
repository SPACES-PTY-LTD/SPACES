# GPS purge performance

The queued Vehicle Activity purge commits each deletion batch separately. Cancellation stops remaining work; committed deletions stay deleted.

## Query changes

- Vehicle Activity-only requests skip discovery of drivers, carriers and driver/vehicle assignments.
- History batches fetch their own `run_id` values. After committing, only runs represented in that batch get a new track-cache version. This also invalidates partial results before a cancellation checkpoint; there is no final duplicate invalidation of all runs.
- New GPS receipts store `merchant_id` and `vehicle_location_history_id`. The recorder writes the exact history link for both newly created and merged history, in the same transaction as the receipt. Duplicate samples retain their existing receipt.
- Full activity purges delete explicitly owned receipts directly by merchant, including receipts whose history has already disappeared. Run/vehicle subset purges additionally restrict receipts to the selected history IDs.
- Legacy receipts with NULL ownership retain the conservative vehicle/time matching path. That path cannot delete receipts explicitly owned by another merchant.

## Deployment

Run `2026_11_17_100000_add_gps_receipt_ownership_and_purge_indexes` before restarting workers with the new code. It adds nullable receipt ownership columns, receipt merchant/history indexes, and history indexes `(merchant_id, id)` and `(vehicle_id, merchant_id)`. Existing columns and named indexes are skipped so partial/manual application can be retried.

Index construction can take time on large tables. Avoid running migrations alongside an active purge. These changes have not verified the production index definitions or execution plans.

There is deliberately no large deployment-time data backfill. Existing receipts benefit from the history indexes and reduced cache writes but keep the legacy matching logic. Any later backfill must resolve ownership without guessing from current vehicle ownership or ambiguous time intervals.

Tests cover exact ownership for overlapping history, preservation of another merchant's receipts, legacy fallback, merged samples, cache writes limited to each history batch, and repeatable migration execution. SQLite tests do not establish production MySQL throughput.
