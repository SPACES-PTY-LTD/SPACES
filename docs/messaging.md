# Conversations and driver messaging

Implemented locally on 2026-10-07. Production deployment, production MySQL concurrency under load, authenticated website visual review and physical-device push delivery remain rollout checks.

## Clients and permissions

Expo navigation is Dashboard / Shipments / Messages / Documents / Account. Account → **Vehicles assigned to me** opens `/account/vehicles`; existing `/vehicles/{vehicle_id}` details remain available. Messages opens the current driver's conversation directly. Normal conversations are website/API-only initially.

Website `/admin/messages` uses the selected merchant. Authorized staff can open any driver chat in that merchant or create a normal conversation with a title and at least one additional member. Conversation owners manage normal-chat members. Removing a member immediately blocks history, sends and attachment downloads; re-adding restores access to the conversation history. Closed conversations retain history but reject new messages.

Driver conversation access comes from `drivers.user_id`. Staff means account holder, merchant member/modifier (including normalized legacy roles), or super admin. Viewers/billers cannot access driver chats. Normal chats require active conversation membership and current merchant access, including for super admins. Account/merchant ownership is derived on the server; request bodies cannot assign message ownership or sender. Drivers are selected through `drivers.id` internally and UUIDs publicly.

## Schema

`conversations`, `conversation_members`, `messages`, and `message_attachments` follow the supplied reference schemas, replacing every `site_id` with `merchant_id`. UUIDs, account ownership, timestamps and soft deletion are retained. Driver conversations have a unique `(account_id, merchant_id, type, type_entry_id)` key and are created under a driver-row lock. Normal `type_entry_id` is null. Deleted driver chats are not silently recreated.

Messages have a unique `(conversation_id, user_id, temporary_id)` key. Clients provide a stable temporary ID for retries; retries return the original message without saving duplicate files or sending duplicate notifications. A changed draft gets a new temporary ID. Sends lock the conversation and recheck membership/status. Driver `read_at` records the first read by the opposite side, not other staff reading each other's messages. Normal reads use monotonic member `last_read_at`. Group read receipts are not displayed.

Push tokens are nullable and unique. The device-token migration clears tokens on deleted devices, empty tokens and older duplicate registrations before adding the unique key. Rolling back the constraint does not recover cleared legacy tokens; those devices register again on app entry.

## API

All routes are under `/api/v1`, require user Bearer authentication, and return the existing `success/data/meta/error` envelope. Public identifiers are UUIDs. Staff list/open requests provide `merchant_id`; drivers derive their merchant from their authenticated profile. Existing feedback routes and tables are separate.

| Method and path | Input / result |
| --- | --- |
| `GET /conversations` | `merchant_id`, `page`, `per_page` (1–100); authorized inbox with pagination, latest message and members |
| `POST /conversations/driver` | Staff: `merchant_id`, `driver_id`; driver: empty body. Get/create one driver chat |
| `GET /conversations/participants` | Staff: `merchant_id`, optional `search` and `page`; eligible normal members, 100 per page |
| `POST /conversations` | `merchant_id`, `title`, optional `description`, `member_ids[]`; create normal chat with creator as owner |
| `GET /conversations/{conversation_uuid}` | Conversation detail, active members, latest message and `can_manage` |
| `PATCH /conversations/{conversation_uuid}` | Authorized manager: `title`, `description`, `status=active|closed` |
| `POST /conversations/{conversation_uuid}/members` | Normal-chat owner: `user_id`; add/re-add member |
| `DELETE /conversations/{conversation_uuid}/members/{user_uuid}` | Normal-chat owner: remove member; owner cannot be removed |
| `GET /conversations/{conversation_uuid}/messages` | Optional `before` message UUID and `per_page` (1–100, default 50); chronological page, `meta.next_before` |
| `POST /conversations/{conversation_uuid}/messages` | JSON or multipart: `temporary_id`, optional `body`, optional `attachments[]`; 201 created / 200 deduplicated |
| `POST /conversations/{conversation_uuid}/read` | `message_id`; mark only the displayed history through that message as read |
| `GET /conversations/{conversation_uuid}/attachments/{attachment_uuid}/download` | Authorized five-minute download URL |

A message needs trimmed text or a file. Limits: 10,000 text characters, five files, 20 MB each. File bytes and metadata are uploaded together; clients cannot supply arbitrary paths or persistent URLs. Storage uses the configured default disk with private visibility, a generated path, and `meta.disk`; `url` remains null. Failed transactions delete saved files. Set PHP/web-server upload and request-body limits to accept up to five 20 MB files plus multipart overhead (`upload_max_filesize >= 20M`, `post_max_size >= 110M`). A supported private disk with temporary URLs is required (existing local and S3 disks provide this).

## Notifications and rollout

Visible clients refresh every ten seconds and on foreground/focus; polling stops while hidden/backgrounded and stale conversation/session responses are discarded. Failed send drafts remain available for retry.

Install dependencies from the lockfile. `expo-notifications` and `expo-device` are SDK-compatible native dependencies. Rebuild development clients after adding the plugin. Existing Expo Go clients can use chat, but remote-push testing uses development builds and physical devices.

1. Deploy the backend and run `php artisan migrate` before clients. The two new migrations have been applied to local MAMP only.
2. Use an asynchronous queue and run `php artisan queue:work --tries=4`. If the configured default is `sync`, message pushes/receipts explicitly use the existing `database` queue; run `php artisan queue:work database --tries=4` in that case.
3. Android requires Firebase FCM v1 credentials in EAS and the Firebase app configuration for `com.spaces.logistics`. Configure the EAS File variable `GOOGLE_SERVICES_JSON`; `app.config.js` passes its path to `android.googleServicesFile`. Keep the configuration/credentials out of Git.
4. iOS requires APNs credentials and a signed development build for `com.spaces.logistics`. Configure credentials through EAS before building. Simulator-only builds do not establish physical-device push acceptance.
5. Register an Expo push token on sign-in and foreground through existing `/driver/devices/register`. Denied permission does not block chat. Logout clears the user's server-side push tokens; registration transfers token ownership rather than retaining a previous user.
6. Staff messages enqueue pushes after database commit; driver messages and normal chats do not notify devices in this version. Payloads contain generic dispatch text and conversation/message UUIDs, never message bodies, attachments or location data. Taps are retained through session hydration/login and wait for mounted navigation, then open Messages with the conversation UUID. The Messages screen authorizes that specific driver thread through GET show; navigation itself does not depend on network availability. Duplicate initial/listener responses are ignored. Suppress banners when that chat is already visible.
7. Pushes use the registered Android `default` Messages channel, high priority and default sound. Push jobs retry transient errors with backoff; delayed receipt checks clear `DeviceNotRegistered` tokens. Monitor failed queue jobs. Queue-enqueue outages are reported without turning a committed message into a failed send or deleting its attachments; foreground polling still delivers that message.

FCM/APNs credentials and new development builds have not been configured/submitted in this task because the required Firebase/Apple push credentials were not supplied. Follow [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [delivery/receipts](https://docs.expo.dev/push-notifications/sending-notifications/) to complete that external setup. Website/normal-conversation pushes and WebSockets are deferred.

Verification: focused conversation/auth/device/run-action/shipment regressions: 48 tests, 376 assertions; mobile/website TypeScript and focused lint pass. Two overlapping local MySQL driver-chat opens, including an outer REPEATABLE READ transaction, return one conversation. SQLite verifies schema rollback, uniqueness, tenant isolation, unauthorized access, membership removal/re-add, pagination, reads, closed/deleted chats, retry deduplication, private downloads, file limits, upload-failure cleanup, commit/rollback push dispatch, recipient payloads, receipt invalidation and token ownership/logout. Simulator and Figma visual checks are recorded in the dashboard handoff. Live provider delivery and production-engine races are not covered by these checks.

### Driver unread navigation badge

`GET /api/v1/conversations/driver/unread` is driver-only and returns `{ unread_count: number }` in the standard API envelope without creating a chat. It counts live received messages with null `read_at` in the authenticated driver’s account/merchant/conversation. The Expo tab displays the count (99+ above 99), hides zero and refreshes on navigation, foreground, successful read acknowledgement and every ten seconds while foregrounded.

### Mobile Messages design

Selected [Figma option 1 — Calm conversation](https://www.figma.com/design/dmyymVqVKc7Nz0HTdn9xi0?node-id=169-1477) is implemented locally. An illustrated, centred empty state replaces the plain empty-list text. The Dispatch avatar/title/subtitle and default composer helper text are omitted. The fully rounded multiline composer includes attachment and send buttons with 44-point targets, selected-file removal, a sending spinner, retry feedback and closed-conversation guidance. Send is disabled until the active chat has text or an attachment. The screen follows the app theme, keeps the composer above the keyboard and preserves history, downloads, polling and unread counts. Bundled SVG icons have no runtime Figma dependency.

Verification: mobile TypeScript/focused lint and iOS empty-state, input/clear/send gating and software-keyboard visual checks pass. No message was sent during this UI verification. Android, dark mode and attachment/send/retry/closed interactions still need device verification.
