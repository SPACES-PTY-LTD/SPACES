# Location Types API

## Endpoints

- `GET /api/v1/location-types?merchant_id={merchant_uuid}`
- `PATCH /api/v1/location-types`

## GET /api/v1/location-types

Query params:
- `merchant_id` (required, uuid)
- `collection_point` (optional, boolean)
- `default` (optional, boolean)

Behavior:
- Returns all location types for the merchant.
- If merchant has no saved records, returns default fallback types and sets `meta.is_default_fallback=true`.
- Fallback slugs are: `depot`, `pickup`, `dropoff`, `service`, `waypoint`, `break`, `fuel`.
- In fallback defaults: `collection_point=true` for `depot` and `pickup`; `delivery_point=true` only for `service`.

Success example (200):

```json
{
  "success": true,
  "data": [
    {
      "location_type_id": null,
      "slug": "depot",
      "title": "Depot",
      "collection_point": true,
      "delivery_point": false,
      "sequence": 1,
      "icon": "warehouse",
      "color": "#1D4ED8",
      "default": true,
      "merchant_id": "1f72f8f8-d9c8-4d6b-850b-e20f8990de65",
      "account_id": "9f2f2d6f-1681-459a-a2a9-8e08dc810ec1",
      "created_at": null,
      "updated_at": null
    },
    {
      "location_type_id": null,
      "slug": "pickup",
      "title": "Pickup",
      "collection_point": true,
      "delivery_point": false,
      "sequence": 2,
      "icon": "map-pin",
      "color": "#16A34A",
      "default": false,
      "merchant_id": "1f72f8f8-d9c8-4d6b-850b-e20f8990de65",
      "account_id": "9f2f2d6f-1681-459a-a2a9-8e08dc810ec1",
      "created_at": null,
      "updated_at": null
    },
    {
      "location_type_id": null,
      "slug": "dropoff",
      "title": "Dropoff",
      "collection_point": false,
      "delivery_point": false,
      "sequence": 3,
      "icon": "flag",
      "color": "#2563EB",
      "default": false,
      "merchant_id": "1f72f8f8-d9c8-4d6b-850b-e20f8990de65",
      "account_id": "9f2f2d6f-1681-459a-a2a9-8e08dc810ec1",
      "created_at": null,
      "updated_at": null
    },
    {
      "location_type_id": null,
      "slug": "service",
      "title": "Service",
      "collection_point": false,
      "delivery_point": true,
      "sequence": 4,
      "icon": "wrench",
      "color": "#F59E0B",
      "default": false,
      "merchant_id": "1f72f8f8-d9c8-4d6b-850b-e20f8990de65",
      "account_id": "9f2f2d6f-1681-459a-a2a9-8e08dc810ec1",
      "created_at": null,
      "updated_at": null
    }
  ],
  "meta": {
    "request_id": "req_abc123",
    "is_default_fallback": true
  },
  "error": null
}
```

Validation example (422):

```json
{
  "success": false,
  "data": null,
  "meta": {
    "request_id": "req_xyz789"
  },
  "error": {
    "code": "VALIDATION",
    "message": "The merchant_id field is required.",
    "details": [],
    "request_id": "req_xyz789"
  }
}
```

## PATCH /api/v1/location-types

Headers:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Body params:
- `merchant_id` (required, uuid)
- `types` (required, array, min: 1)
- `types[].location_type_id` (optional, uuid)
- `types[].slug` (optional, string, max 100, distinct in payload)
- `types[].title` (required, string, max 255)
- `types[].collection_point` (optional, boolean)
- `types[].delivery_point` (optional, boolean)
- `types[].sequence` (optional, integer, min 0)
- `types[].icon` (optional, nullable string, max 255)
- `types[].color` (optional, nullable string, max 32)
- `types[].default` (optional, boolean)

Behavior:
- Accepts an array of types in one request.
- If merchant has no records, creates them.
- If `types[].slug` is omitted or blank, the API generates it from `types[].title`.
- Updates existing items by `location_type_id` or `slug`.
- Creates new submitted items.
- Deletes omitted merchant types.
- Returns all saved types.

Request example:

```json
{
  "merchant_id": "1f72f8f8-d9c8-4d6b-850b-e20f8990de65",
  "types": [
    {
      "location_type_id": "4b3eb9fe-6b6e-4ec8-bde1-4d7bb6d06ac2",
      "slug": "pickup",
      "title": "Pickup",
      "collection_point": true,
      "delivery_point": false,
      "sequence": 1,
      "icon": "map-pin",
      "color": "#16A34A",
      "default": true
    },
    {
      "title": "Dropoff",
      "collection_point": false,
      "delivery_point": true,
      "sequence": 2,
      "icon": "flag",
      "color": "#2563EB",
      "default": false
    }
  ]
}
```

Success example (200):

```json
{
  "success": true,
  "data": [
    {
      "location_type_id": "4b3eb9fe-6b6e-4ec8-bde1-4d7bb6d06ac2",
      "slug": "pickup",
      "title": "Pickup",
      "collection_point": true,
      "delivery_point": false,
      "sequence": 1,
      "icon": "map-pin",
      "color": "#16A34A",
      "default": true,
      "merchant_id": "1f72f8f8-d9c8-4d6b-850b-e20f8990de65",
      "account_id": "9f2f2d6f-1681-459a-a2a9-8e08dc810ec1",
      "created_at": "2026-02-26T12:30:00+00:00",
      "updated_at": "2026-02-26T13:10:00+00:00"
    }
  ],
  "meta": {
    "request_id": "req_sync_123"
  },
  "error": null
}
```
