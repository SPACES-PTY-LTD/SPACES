# Website API additions

All paths below are relative to `/api/v1`. Successful responses use `{ "data": ... }`. Validation errors use Laravel's 422 validation response. No existing endpoint is replaced. Management authorization uses an authenticated personal user token, never a merchant environment API key.

## Public reads

- `GET /website/content?kind=help&q=search`: published content only, with stable slug, kind, published snapshot and first publication timestamp. Drafts are never returned. Search matches title/body. Includes page, blog, help, update and vacancy types.
- `GET /website/pricing`: approved active paid plans only, with UUID, title, vehicle limit, monthly/extra-vehicle ZAR charges and VAT wording. No unapproved fallback amounts.
- `GET /website/contact`: allowlisted verified company contact settings only; never hours or internal settings.
- `GET /website/demo/slots?date=YYYY-MM-DD`: UTC ISO timestamps and Africa/Johannesburg timezone. No attendee information.

## Public booking writes

- `POST /website/demo/book`: `starts_at`, `name`, `email`, `company`, `fleet_size` (`1–10`, `11–20`, `21–50`, `51–100`, `100+`), optional `phone`, `message`; optional honeypot `website` must be empty. Returns booking ID, start and status, not the management secret. Rate limited to five requests/hour/IP.
- `POST /website/demo/manage`: private `token`, `action` (`cancel` or `reschedule`), and `starts_at` for rescheduling. Returns start and status. Expired/unknown tokens return 404; inactive/past reservations return 409; unavailable slots return 422. Rate limited to ten requests/minute/IP.

## Super-admin website management

- `GET /website/admin`: draft/published records, calendar settings, billing plans with approval state, latest 200 appointments, pending/failed mail metadata and super-admin staff IDs/names.
- `POST /website/admin/content`: optional numeric `id`, stable `kind`/`slug`, `draft` containing title, description, HTML body, optional named author/category/image URL/alt text/SEO title/description. Vacancies also support location, employment type and application email. Saves a sanitised draft only.
- `POST /website/admin/content/{id}/publication`: `action: publish|unpublish`. Articles/updates need a named author; vacancies need location, employment type and application email.
- `PATCH /website/admin/settings`: hours object keyed by ISO weekday 1–7, each `{from: "09:00", to: "17:00"}`, blackout date array and optional verified company/contact fields. Empty hours disable booking.
- `PATCH /website/admin/pricing/{numericPlanId}`: `public_vat_wording`, `public_order`, boolean `approved`. Binds approval to the current plan values.
- `GET /website/admin/bookings?date=YYYY-MM-DD&page=1`: paginated appointment list, 50 per page, with optional Johannesburg calendar-date filter.
- `PATCH /website/admin/bookings/{uuid}`: HTTPS `meeting_url` and/or `status: cancelled`; queues an attendee update. Cannot revive cancelled/past appointments.
- `POST /website/admin/mail/{uuid}/retry`: resets failed delivery for another retry cycle. Only failed records can be retried.

## Authenticated customer support

All routes require web-admin user or super-admin role and current merchant access. Drivers and environment API keys are excluded.

- `GET /support/tickets?merchant_id={merchantUuid}&page=1`: paginated 50 per page. Customer users must supply an accessible merchant; super admins see the shared queue.
- `POST /support/tickets`: merchant UUID, subject, category, body and optional multipart `attachments[]`. Creates the ticket and first reply together.
- `GET /support/tickets/{uuid}`: ticket, ordered reply thread, author names and attachment IDs/names; no private storage paths.
- `POST /support/tickets/{uuid}/replies`: body and optional multipart attachments.
- `PATCH /support/tickets/{uuid}`: customers can set `status: resolved`; super admins can set open/awaiting_customer/resolved and nullable super-admin `assigned_to` ID.
- `GET /support/attachments/{uuid}`: authorised private attachment download. Up to five files per reply, each up to 10 MB; PDF/JPEG/PNG only.

Ticket notifications contain a sign-in link rather than conversation content. Public content search cannot access ticket records.
