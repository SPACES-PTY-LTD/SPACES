# Driver Runs Roadmap

## Purpose
Support one driver delivering multiple shipments in a single operational trip ("run") while preserving shipment-level tracking, proof of delivery, and billing integrity.

## Core Principles
- `Shipment` is the customer/business unit.
- `Run` is the dispatch/operations unit.
- Shipment lifecycle and run lifecycle are separate.
- Partial outcomes are allowed inside a run (some delivered, some failed).

## Booking vs Shipment vs Run
- Keep `bookings` if needed for external carrier booking flow and provider integration state.
- Keep `shipments` as the merchant order delivery unit.
- Introduce `runs` for batching and route execution.

If one order maps 1:1 to shipment in our product, creation should happen through `shipments`. A run is created later for dispatch operations.

## When Runs Are Created
Default strategy:
1. Merchant creates shipment(s).
2. Shipments remain unassigned.
3. Dispatcher creates a run and attaches shipments.
4. Driver starts and executes run.

Optional strategy (future):
- Auto-assign during shipment creation with `auto_assign_to_run=true` if a compatible open run exists.

## Proposed Data Model
### `runs`
- `id` (uuid)
- `account_id`, `merchant_id`, `environment_id`
- `driver_id` (nullable at creation)
- `vehicle_id` (nullable)
- `status` (`draft`, `dispatched`, `in_progress`, `completed`, `cancelled`)
- `planned_start_at`, `started_at`, `completed_at`
- `zone`/`service_area` (nullable)
- `notes` (nullable)
- timestamps

### `run_shipments` (pivot)
- `id` (uuid)
- `run_id`
- `shipment_id`
- `sequence` (int, nullable until ordered)
- `pickup_stop_order` (int, nullable)
- `dropoff_stop_order` (int, nullable)
- `status` (`planned`, `active`, `done`, `failed`, `removed`)
- timestamps

### Optional `run_stops` (phase 2+)
- Explicit stop list if we need richer stop-level telemetry:
- `run_id`, `type` (`pickup`/`dropoff`), address snapshot, eta, arrival/completion timestamps.

## API Roadmap
All routes assumed under `/api/v1`.

### Phase 1 (manual batching)
1. `POST /runs`
Creates a run in `draft`.

2. `GET /runs`
Lists runs with filters (`status`, `driver_id`, `date`, `merchant_id`).

3. `GET /runs/{run}`
Returns run details + attached shipments.

4. `PATCH /runs/{run}`
Updates editable fields before start (driver/vehicle/planned_start_at/notes).

5. `POST /runs/{run}/shipments`
Attaches shipment IDs to run.

6. `DELETE /runs/{run}/shipments/{shipment}`
Removes shipment while run is still mutable.

7. `POST /runs/{run}/dispatch`
Locks run and moves to `dispatched`.

8. `POST /runs/{run}/start`
Driver starts run, status to `in_progress`.

9. `POST /runs/{run}/complete`
Completes run after all attached shipments are resolved.

### Existing shipment endpoints (used during run)
1. `POST /shipments/{shipment}/deliver`
2. `POST /shipments/{shipment}/fail`

These remain shipment-level so POD/failure reason stays tied to each shipment.

### Phase 2 (routing support)
1. `POST /runs/{run}/optimize`
Reorders shipment execution sequence.

2. `POST /runs/{run}/resequence`
Manual sequence override.

3. Optional stop telemetry:
- `POST /runs/{run}/stops/{stop}/arrive`
- `POST /runs/{run}/stops/{stop}/complete`

## Operational Rules
1. Do not allow attaching cancelled/completed shipments.
2. Prevent cross-merchant and cross-environment attachments.
3. Enforce driver/vehicle capacity constraints where available.
4. Freeze structural edits once run is `in_progress` (or require supervised override).
5. Run can complete only when each attached shipment is terminal (`delivered` or `failed`).

## Suggested Implementation Phases
### Phase 1: Foundation
- Add migrations/models for `runs` and `run_shipments`.
- Add relationships on `Shipment`, `Driver`, and `Run`.
- Build CRUD + attach/detach + dispatch/start/complete endpoints.
- Expose run context in `ShipmentResource`.

### Phase 2: Dispatch Quality
- Sequencing fields and manual reorder endpoint.
- Validation for time windows and basic capacity checks.
- Driver app run timeline UI.

### Phase 3: Optimization & Dynamic Ops
- Route optimization endpoint.
- Mid-run supervised reassignment.
- Stop-level telemetry and SLA analytics.

## Resource / Response Changes
- `ShipmentResource`: include run summary when assigned:
  - `run_id`, `run_status`, `run_sequence`.
- New `RunResource`: include shipment count, terminal count, and driver summary.

## Testing Checklist
1. Run creation, update, and status transitions.
2. Attach/detach constraints (merchant/environment/state guards).
3. Shipment status updates inside active run.
4. Partial success behavior and valid run completion.
5. Authorization checks (merchant scoping and roles).

## Open Questions
1. Should one shipment belong to more than one run historically (reassignment audit) or only current run pointer?
2. Should we model explicit stops in phase 1, or keep sequence only and add stops later?
3. What roles can dispatch/override run mutation after dispatch?

## Roadmap Feature: Merchant Parcel Sizes
Allow each merchant to configure reusable parcel presets (display label + dimensions + max weight) to speed up shipment creation and enforce standard packaging profiles.

### Example Presets
```json
{
  "parcel_sizes": [
    {
      "display_name": "Extra Large",
      "parcel_id": "parcel-xlarge",
      "dimensions": { "height": 300, "width": 150, "length": 280 },
      "weight": 20
    },
    {
      "display_name": "Small",
      "parcel_id": "parcel-small",
      "dimensions": { "height": 30, "width": 15, "length": 35 },
      "weight": 2
    },
    {
      "display_name": "Medium",
      "parcel_id": "parcel-medium",
      "dimensions": { "height": 100, "width": 75, "length": 100 },
      "weight": 5
    },
    {
      "display_name": "Large",
      "parcel_id": "parcel-large",
      "dimensions": { "height": 150, "width": 95, "length": 180 },
      "weight": 10
    },
    {
      "display_name": "A4 Envelope",
      "parcel_id": "parcel-a4-envelope",
      "dimensions": { "height": 6, "width": 3, "length": 8 },
      "weight": 0
    }
  ]
}
```

### Proposed Table: `merchant_parcel_sizes`
- `id` (bigint)
- `uuid` (36, unique)
- `account_id` (nullable fk to `accounts`)
- `merchant_id` (fk to `merchants`)
- `parcel_id` (string, merchant-unique)
- `display_name` (string)
- `length_cm` (decimal 10,2)
- `width_cm` (decimal 10,2)
- `height_cm` (decimal 10,2)
- `weight_kg` (decimal 10,3)
- `is_active` (boolean, default true)
- `sort_order` (unsigned int, default 0)
- `metadata` (json, nullable)
- timestamps
- soft deletes

Constraints:
1. Unique key on `merchant_id + parcel_id`.
2. Index on `merchant_id + is_active`.
3. Validation: dimensions and weight cannot be negative.

### Migration Blueprint (for later implementation)
Suggested migration name:
- `create_merchant_parcel_sizes_table`

Suggested file name:
- `database/migrations/YYYY_MM_DD_HHMMSS_create_merchant_parcel_sizes_table.php`

Laravel schema blueprint:
```php
Schema::create('merchant_parcel_sizes', function (Blueprint $table) {
    $table->id();
    $table->string('uuid', 36)->unique();
    $table->foreignId('account_id')
        ->nullable()
        ->constrained('accounts')
        ->nullOnDelete()
        ->name('fk_merchant_parcel_sizes_account')
        ->index();
    $table->foreignId('merchant_id')
        ->constrained('merchants')
        ->cascadeOnDelete()
        ->name('fk_merchant_parcel_sizes_merchant')
        ->index();
    $table->string('parcel_id', 64);
    $table->string('display_name');
    $table->decimal('length_cm', 10, 2);
    $table->decimal('width_cm', 10, 2);
    $table->decimal('height_cm', 10, 2);
    $table->decimal('weight_kg', 10, 3);
    $table->boolean('is_active')->default(true)->index();
    $table->unsignedInteger('sort_order')->default(0);
    $table->json('metadata')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->unique(['merchant_id', 'parcel_id'], 'uq_merchant_parcel_sizes_merchant_parcel_id');
    $table->index(['merchant_id', 'is_active'], 'idx_merchant_parcel_sizes_merchant_active');
});
```

Rollback:
```php
Schema::dropIfExists('merchant_parcel_sizes');
```

### Parcel Size API (Phase 1)
1. `GET /merchants/{merchant}/parcel-sizes`
2. `POST /merchants/{merchant}/parcel-sizes`
3. `PATCH /merchants/{merchant}/parcel-sizes/{parcelSize}`
4. `DELETE /merchants/{merchant}/parcel-sizes/{parcelSize}`

### Shipment Creation Integration
At shipment create/update time:
1. Client can provide `parcel_size_id` (or `parcel_id`) instead of raw dimensions.
2. API resolves preset into shipment parcel fields.
3. Optional override policy:
- strict mode: no overrides allowed
- flexible mode: allow overrides and store source preset in metadata
