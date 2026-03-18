# API V2 Resource Roadmap

## Goal
Standardize API behavior around clear resource boundaries:
- `shipments` = merchant intent/order
- `quotes` = pricing options for a shipment
- `bookings` = committed carrier booking for a shipment
- driver actions modeled as booking subresources

## Proposed V2 Endpoints

### Shipments
1. `POST /v2/shipments`
Create a shipment.

2. `GET /v2/shipments`
List shipments with filters/pagination.

3. `GET /v2/shipments/{shipment}`
Get one shipment.

4. `PATCH /v2/shipments/{shipment}`
Update mutable shipment fields.

### Shipment Quotes
1. `POST /v2/shipments/{shipment}/quotes`
Request/fetch quote set for a shipment.

2. `GET /v2/shipments/{shipment}/quotes`
List quotes already generated for the shipment.

### Shipment Bookings
1. `POST /v2/shipments/{shipment}/bookings`
Create booking using selected quote option.

2. `GET /v2/shipments/{shipment}/bookings`
List bookings for the shipment (current + history if needed).

### Booking Operations
1. `POST /v2/bookings/{booking}/cancellations`
Cancel booking via cancellation resource (replaces `/cancel` verb route).

2. `POST /v2/bookings/{booking}/assignments`
Assign driver/vehicle.

3. `DELETE /v2/bookings/{booking}/assignments/{assignment}`
Unassign by assignment resource id.

### Driver Booking Subresources
1. `POST /v2/driver/bookings/{booking}/scans`
Create tracking scan event for booking.

2. `POST /v2/driver/bookings/{booking}/pods`
Create/update proof-of-delivery record.

3. `PATCH /v2/driver/bookings/{booking}`
Apply valid booking status transition.

## Status & Transition Rules

### Shipment
- Suggested statuses: `draft`, `ready`, `booked`, `delivered`, `failed`, `cancelled`
- Shipment status updates should reflect booking terminal outcomes.

### Booking
- Suggested statuses: `booked`, `pickup_scheduled`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `failed`, `cancelled`
- Transitions must be forward-only unless explicit override policy is defined.

## Validation & Guardrails
1. Enforce merchant/environment/account scoping on every endpoint.
2. Disallow booking cancellation when already terminal, unless override role.
3. Require booking ownership/assignment checks for driver routes.
4. Ensure idempotency on create commands (`POST /shipments`, `POST /quotes`, `POST /bookings`).
5. Record audit logs for status transitions, cancellations, and assignments.

## Response Shape
1. Keep existing envelope format (`data`, `meta.request_id`, pagination metadata).
2. Use UUIDs externally for resource identifiers.
3. Return related summaries where useful:
- shipment responses include latest booking summary
- booking responses include shipment summary and POD presence

## Rollout Plan

### Phase 1: Foundation
1. Add `v2` routes with dedicated controllers or thin adapters.
2. Reuse existing services where possible to avoid behavior drift.
3. Add request validation classes aligned to v2 payloads.

### Phase 2: Compatibility
1. Keep `v1` routes active.
2. Add deprecation headers on `v1` endpoints that have `v2` replacements.
3. Provide endpoint mapping docs for client migration.

### Phase 3: Migration Completion
1. Migrate frontend/driver app/postman/openapi to `v2`.
2. Track v1 traffic and remove unused v1 routes.
3. Finalize v2 as primary public contract.

## V1 to V2 Mapping (Core)
1. `POST /v1/shipments/{shipment}/book` -> `POST /v2/shipments/{shipment}/bookings`
2. `POST /v1/shipments/{shipment}/cancel` -> `POST /v2/bookings/{booking}/cancellations`
3. `POST /v1/admin/bookings/{booking}/assign-driver` -> `POST /v2/bookings/{booking}/assignments`
4. `POST /v1/admin/bookings/{booking}/unassign-driver` -> `DELETE /v2/bookings/{booking}/assignments/{assignment}`
5. `POST /v1/driver/bookings/{booking}/scan` -> `POST /v2/driver/bookings/{booking}/scans`
6. `POST /v1/driver/bookings/{booking}/pod` -> `POST /v2/driver/bookings/{booking}/pods`
7. `PATCH /v1/driver/bookings/{booking}/status` -> `PATCH /v2/driver/bookings/{booking}`
