# Background merchant data deletion

The delete-data settings page submits an authenticated, password-confirmed request and monitors a durable operation. Closing the page does not cancel deletion. Returning to the page loads the latest operation for the selected merchant.

## Deployment

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

States: `queued` → `running` → `completed` or `failed`. The running state is visible before deletion begins. All deletion results and the audit record commit in the same database transaction; results are published only after commit. Failed transactions roll back. The UI polls every three seconds, disables submission while an operation is active or status is unknown, and resumes monitoring on refresh. Results represent database deletion only: uploaded-file removal still uses the separate `DeleteMerchantFilesJob`, with its existing retries and failed-job monitoring. The page explicitly discloses this distinction; it does not claim storage cleanup is finished.

The operation table survives selected activity/API-log deletion, providing an independent status record. Progress is lifecycle status, not an estimated percentage. Existing GPS/background integrations continue to run and can still contend for locks or recreate data; this change does not pause integrations.
