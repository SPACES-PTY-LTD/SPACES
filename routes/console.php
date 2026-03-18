<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Models\ActivityLog;
use App\Jobs\CleanupExpiredIdempotencyKeysJob;
use App\Jobs\CleanupExpiredInvitesJob;
use App\Jobs\CleanupOldWebhookDeliveriesJob;
use App\Services\VehicleLocationSyncService;
use App\Services\InternalBookingLifecycleService;
use App\Services\ParcelCodeService;
use App\Services\ShipmentParcelService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('tracking:sync-vehicle-locations', function (VehicleLocationSyncService $service) {
    $summary = $service->sync();

    $this->info('Vehicle location sync summary: ' . json_encode($summary));
})->purpose('Sync vehicle locations from tracking providers');

Artisan::command('shipments:backfill-auto-bookings', function (InternalBookingLifecycleService $service) {
    $summary = $service->backfillAutoShipmentBookings();

    $this->info('Auto shipment booking backfill summary: ' . json_encode($summary));
})->purpose('Create missing internal bookings for auto-created shipments');

Artisan::command('shipments:backfill-parcel-codes', function (ParcelCodeService $service) {
    $summary = $service->backfillMissingCodes();

    $this->info('Parcel code backfill summary: ' . json_encode($summary));
})->purpose('Generate missing stable parcel QR codes');

Artisan::command('shipments:backfill-auto-created-parcels', function (ShipmentParcelService $service) {
    $summary = $service->backfillAutoCreatedShipmentParcels();

    $this->info('Auto-created shipment parcel backfill summary: ' . json_encode($summary));
})->purpose('Create default parcels for auto-created shipments missing parcels');

Schedule::job(new CleanupExpiredIdempotencyKeysJob())->hourly();
Schedule::job(new CleanupOldWebhookDeliveriesJob())->daily();
Schedule::job(new CleanupExpiredInvitesJob())->daily();
Schedule::command('model:prune --model='.ActivityLog::class)->daily();
Schedule::command('tracking:sync-vehicle-locations')
    ->everyFiveMinutes();
