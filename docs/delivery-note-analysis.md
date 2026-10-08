# Shared asynchronous delivery-note analysis

Implemented locally on 2026-10-08. Production deployment, managed worker operation and real-device/live-AI timeout recovery remain unverified.

## API contract

Authenticated personal driver and admin tokens use the same endpoints:

- `POST /api/v1/delivery-note-imports/analyze`: multipart `file` (PDF/JPEG/PNG/WebP, maximum 20 MB), required client-generated UUID `import_id`, optional `run_id`. Returns `202` with the normal API envelope immediately after private storage and queuing, without calling the AI provider in the request.
- `GET /api/v1/delivery-note-imports/{import_id}/status`: returns `queued`, `processing`, `analyzed`, `confirmed` or `failed`, plus `failure_message`, `poll_after_ms: 3200`, filename, run ID and extraction/confirmation data when available. `analyzed` is the signal to open review; a timer never confirms success.

Admins supply `merchant_id` or `X-Merchant-Id`; optional `environment_id`/`environment_uuid` selects a merchant environment. Creating analysis requires existing shipment-create/resource-edit permission; status requires resource-view permission. Admins can check authorized merchant imports regardless of uploader. Drivers require an active profile and can analyze only their own merchant and eligible assigned runs, and read only their own imports. Environment API tokens without a signed-in user are not supported by this user-upload flow. Cross-merchant and cross-environment lookups remain scoped; reusing an import UUID with another uploader/run/environment is rejected.

Reusing the same UUID in the same upload context returns the existing import and never queues extraction twice. Clients persist the UUID **before** upload. If the upload acknowledgement is lost or returns 504, query that UUID rather than uploading again. Brief 404s while creation commits can be retried. A new file or an explicitly failed terminal analysis uses a fresh UUID.

The legacy driver upload/show routes remain supported; `async=1` plus `import_id` opts into queued processing. Legacy synchronous clients and run-specific analysis/confirmation/download endpoints remain compatible. New mobile and website admin callers use the shared endpoints. Confirmation remains an explicit, separate existing action; analysis creates no shipments or runs.

## Background processing and rollout

Use the existing `jobs` and `failed_jobs` tables. No new schema or backfill is required; `delivery_note_imports.status` is already a string. New values are `queued` and `processing`.

Before routing clients to asynchronous analysis:

1. Deploy backend routes, job, service and queue configuration together; clear/rebuild cached Laravel configuration and restart managed workers.
2. Run a supervised worker on the dedicated **connection and queue** (the ordinary default worker does not consume this queue):

   ```sh
   php artisan queue:work document-imports --queue=document-imports --timeout=300 --tries=1
   ```

3. Ensure the database queue connection and private file disk are reachable by the worker. `document-imports` uses database queuing even if the default connection is `sync`. Its reservation is 330 seconds, longer than the 300-second job timeout. The worker must support Laravel process timeouts; supervise/restart it in deployment.
4. Deploy mobile/website callers after verifying a real queued import progresses to analyzed and a controlled failure becomes failed. Confirm duplicate delivery and a lost HTTP response recover through the same UUID. A reverse proxy must still allow file transfer; AI latency no longer occupies that request.

The worker atomically claims queued imports once, streams private stored files into a temporary file compatible with extraction, cleans up the temporary file, and records failure reasons. Failed jobs do not overwrite terminal success. A status check expires queued/processing imports stale for 15 minutes with retry guidance, preventing indefinite waiting when a worker is unavailable. Monitor queue depth, failed jobs and job latency. Existing synchronous endpoints can still experience gateway timeouts until their callers migrate.

## Client recovery

Both clients poll at 3.2-second intervals, with individual status requests aborted after 10 seconds. Each check session is bounded to approximately two minutes (at most 38 checks), then retains the UUID and offers **Check processing status**. Transient gateway/network/408/429 failures and brief 404s retry; authorization failures stop. **Check later**, close/unmount or a context change stops client polling without cancelling the server job. Mobile stores the pending UUID/filename by user; the website stores it by merchant/run in local storage. Reopening offers status recovery. Selecting a replacement starts a separate import; cancelling file selection preserves the pending one.

Mobile keeps **Uploading your file for analysis…** until byte progress or the accepted response confirms receipt; then runs the 15 illustrative messages every 3.2 seconds and holds **Wrapping up…** after 48 seconds. The API result advances immediately. Error responses and job failure reasons remain visible; retry/replacement stays available.

## Local verification

25 focused Laravel tests (189 assertions) cover legacy analysis/confirmation, async receipt/status, duplicate queuing, private saved-file extraction, duplicate job delivery, job failure/stale timeout, admin/driver ownership and merchant/environment/permission boundaries. Both frontend TypeScript checks and focused lint pass. The 56 client regressions include polling success, transient 404/504/network recovery, terminal failure, authorization, bounded checking and unmount cancellation for both client implementations. Native/browser visual checks, production worker supervision and live provider/gateway recovery remain rollout gates.
