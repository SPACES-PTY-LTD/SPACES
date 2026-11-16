# Background merchant data deletion

The delete-data settings page submits an authenticated, password-confirmed request and monitors a durable operation. Closing the page does not cancel deletion. Returning to the page loads the latest operation for the selected merchant.

## Deployment

The `2026_11_16_170000_add_data_purge_lookup_indexes` migration adds vehicle/location activity lookups, merchant-first GPS history interval lookups, and vehicle/time receipt lookups. Schedule index creation outside active purges on large production tables. Restart workers to use the revised order: the vehicle activity stage runs last, while dependency cleanup inside run/vehicle/location deletion still runs where needed. This is not a change to the all-or-nothing transaction or the five-minute worker limit.

1. Run `php artisan migrate --force` to create `data_purges` before deploying the frontend.
2. Use a persistent `QUEUE_CONNECTION` (`database`, `redis`, `sqs`, or `beanstalkd`). Sync/deferred/background/failover drivers are rejected for this destructive operation to prevent inline execution or silent drops.
3. Run a queue worker for that connection's default queue. The job has a 300-second timeout and one queue attempt, with three database transaction attempts for transient lock errors. Keep `retry_after` (or SQS visibility timeout) greater than 300 seconds; the application's database/Redis/Beanstalk defaults are at least 330. Ensure the worker process manager permits at least 330 seconds for graceful shutdown and PHP CLI has PCNTL timeout support. Restart workers with the release. An example is `php artisan queue:work --timeout=300 --tries=1`; job settings also apply when existing workers use other defaults.
4. Keep failed-job storage enabled and inspect `php artisan queue:failed` if an operation fails. Check worker health if it remains queued. A force-killed worker's operation can remain running until the broker redelivers it and Laravel marks the exhausted job failed. A failed purge should be resubmitted with a fresh password confirmation; manually retrying its old queue payload does not rerun a terminal operation.

Deploy API and frontend together: the POST response contract has changed. This change removes the gateway timeout from the deletion path, but does not eliminate database deadlocks or the worker time limit. Large operations that exceed five minutes require smaller selections or a separately planned longer worker/visibility timeout configuration. Never retry a previously timed-out synchronous request blindly: check that the old request is no longer executing.

## API

- `POST /api/v1/merchants/{merchant_uuid}/purge-data`: same `merchant_id`, `password`, and `types` input; now returns HTTP 202 with an operation (`job_id`, `status`, `requested_types`, timestamps, `result`, `error_message`). Password and token are never stored in the operation or queue job.
- `GET /api/v1/merchants/{merchant_uuid}/purge-data`: latest operation, or `data: null` when none exists.
- `GET /api/v1/merchants/{merchant_uuid}/purge-data/{job_id}`: a specific operation. Unknown/cross-merchant IDs return 404.

All three routes require the merchant account owner. Ownership is checked again by the worker before deletion. A duplicate POST while one operation is queued/running returns that operation without expanding its requested types. A nullable unique database slot prevents simultaneous active requests for the same merchant.

States: `queued` → `running` → `completed` or `failed`. The running state is visible before deletion begins. All deletion results and the audit record commit in the same database transaction; results are published only after commit. Failed transactions roll back. The UI polls every five seconds while queued/running (and retries monitoring failures), stops on completion/failure or when no operation exists, disables submission while an operation is active or status is unknown, and resumes monitoring on refresh. Results represent database deletion only: uploaded-file removal still uses the separate `DeleteMerchantFilesJob`, with its existing retries and failed-job monitoring. The page explicitly discloses this distinction; it does not claim storage cleanup is finished.

The operation table survives selected activity/API-log deletion, providing an independent status record. Progress includes the server execution order, explicit processed-type list, current data type and completed-type count, with an equal-weight percentage that reserves one step for audit/commit. It is not row-based or a time estimate. A retry may reset progress because deletion is transactional. Only committed completion displays 100%; failed jobs discard cached progress. Progress uses the configured cache with a one-hour TTL. Database cache writes use a separate database connection so progress remains visible during the deletion transaction; use a shared cache across web/worker instances. Cache failure falls back to indeterminate progress without failing deletion. No new migration is required for progress. Existing GPS/background integrations continue to run and can still contend for locks or recreate data; this change does not pause integrations.

The status card lists each requested type as Done, Deleting or Waiting in server execution order. Done means processed within the pending transaction until final completion; failure clears those markers. Older workers without explicit lists show Awaiting progress instead of inferring completion from request order.

## Cancellation

Run the `data_purge_cancellations` migration before deploying cancellation support, and restart workers. The owner can POST `/api/v1/merchants/{merchant_uuid}/purge-data/{job_id}/cancel`. This writes a durable, idempotent cancellation request in an independent table without waiting for the locked operation row. Status exposes `cancel_requested`; the UI keeps polling every five seconds until the worker confirms a terminal result.

Queued jobs check cancellation before deleting anything. Running jobs check between data types and immediately before final completion. MySQL workers read requests through a separate connection using the primary database so their transaction snapshot/replica lag cannot hide new cancellation requests. Cancellation rolls back the whole deletion transaction, discards pending after-commit callbacks, releases the active slot and records `cancelled`. The request does not forcibly interrupt an SQL statement; a large data type may take time to reach the checkpoint. A request arriving after the final checkpoint may lose the race to commit; completed work cannot be undone. Queued cancellations still need a worker to acknowledge them. Cancellation does not stop separate uploaded-file cleanup after database completion.
