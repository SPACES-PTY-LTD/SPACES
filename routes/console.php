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
use App\Services\BillingService;
use App\Models\AccountInvoice;
use App\Models\Account;
use Carbon\Carbon;

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

Artisan::command('billing:generate-monthly-invoices {--date=}', function (BillingService $service) {
    $targetDate = $this->option('date')
        ? Carbon::parse((string) $this->option('date'))->startOfDay()
        : now()->startOfDay();

    $count = 0;
    Account::query()->whereNotNull('owner_user_id')->chunkById(50, function ($accounts) use ($service, $targetDate, &$count) {
        foreach ($accounts as $account) {
            if (!$service->shouldGenerateInvoiceOnDate($account, $targetDate)) {
                continue;
            }

            [$periodStart, $periodEnd] = $service->billingPeriodForDate($account, $targetDate);
            $service->generateInvoiceForAccount($account, $periodStart, $periodEnd);
            $count++;
        }
    });

    $this->info("Generated or refreshed {$count} account-anniversary billing invoices.");
})->purpose('Generate monthly account billing invoices');

Artisan::command('billing:charge-due-invoices', function (BillingService $service) {
    $count = 0;
    AccountInvoice::query()
        ->whereIn('payment_status', ['unpaid', 'failed', 'overdue'])
        ->whereDate('due_date', '<=', now()->toDateString())
        ->chunkById(50, function ($invoices) use ($service, &$count) {
            foreach ($invoices as $invoice) {
                $service->chargeInvoice($invoice, true);
                $count++;
            }
        });

    $this->info("Processed {$count} due billing invoices.");
})->purpose('Attempt automatic charges for due account billing invoices');

Schedule::job(new CleanupExpiredIdempotencyKeysJob())->hourly();
Schedule::job(new CleanupOldWebhookDeliveriesJob())->daily();
Schedule::job(new CleanupExpiredInvitesJob())->daily();
Schedule::command('model:prune --model='.ActivityLog::class)->daily();
Schedule::command('tracking:sync-vehicle-locations')
    ->everyFiveMinutes();
Schedule::command('billing:generate-monthly-invoices')->dailyAt('01:00');
Schedule::command('billing:charge-due-invoices')->dailyAt('02:00');
