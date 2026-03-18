<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_users_account')
                ->index();
        });

        Schema::table('merchants', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_merchants_account')
                ->index();
        });

        Schema::table('merchant_invites', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_merchant_invites_account')
                ->index();
        });

        Schema::table('merchant_environments', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_merchant_environments_account')
                ->index();
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_shipments_account')
                ->index();
        });

        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_shipment_parcels_account')
                ->index();
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_quotes_account')
                ->index();
        });

        Schema::table('quote_options', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_quote_options_account')
                ->index();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_bookings_account')
                ->index();
        });

        Schema::table('tracking_events', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_tracking_events_account')
                ->index();
        });

        Schema::table('webhook_subscriptions', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_webhook_subscriptions_account')
                ->index();
        });

        Schema::table('webhook_deliveries', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_webhook_deliveries_account')
                ->index();
        });

        Schema::table('idempotency_keys', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_idempotency_keys_account')
                ->index();
        });

        Schema::table('booking_pods', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_booking_pods_account')
                ->index();
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_drivers_account')
                ->index();
        });

        Schema::table('driver_assignments', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_driver_assignments_account')
                ->index();
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('account_id')
                ->nullable()
                ->after('uuid')
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_vehicles_account')
                ->index();
        });

    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropForeign('fk_vehicles_account');
            $table->dropColumn('account_id');
        });

        Schema::table('driver_assignments', function (Blueprint $table) {
            $table->dropForeign('fk_driver_assignments_account');
            $table->dropColumn('account_id');
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->dropForeign('fk_drivers_account');
            $table->dropColumn('account_id');
        });

        Schema::table('booking_pods', function (Blueprint $table) {
            $table->dropForeign('fk_booking_pods_account');
            $table->dropColumn('account_id');
        });

        Schema::table('idempotency_keys', function (Blueprint $table) {
            $table->dropForeign('fk_idempotency_keys_account');
            $table->dropColumn('account_id');
        });

        Schema::table('webhook_deliveries', function (Blueprint $table) {
            $table->dropForeign('fk_webhook_deliveries_account');
            $table->dropColumn('account_id');
        });

        Schema::table('webhook_subscriptions', function (Blueprint $table) {
            $table->dropForeign('fk_webhook_subscriptions_account');
            $table->dropColumn('account_id');
        });

        Schema::table('tracking_events', function (Blueprint $table) {
            $table->dropForeign('fk_tracking_events_account');
            $table->dropColumn('account_id');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign('fk_bookings_account');
            $table->dropColumn('account_id');
        });

        Schema::table('quote_options', function (Blueprint $table) {
            $table->dropForeign('fk_quote_options_account');
            $table->dropColumn('account_id');
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign('fk_quotes_account');
            $table->dropColumn('account_id');
        });

        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->dropForeign('fk_shipment_parcels_account');
            $table->dropColumn('account_id');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->dropForeign('fk_shipments_account');
            $table->dropColumn('account_id');
        });

        Schema::table('merchant_environments', function (Blueprint $table) {
            $table->dropForeign('fk_merchant_environments_account');
            $table->dropColumn('account_id');
        });

        Schema::table('merchant_invites', function (Blueprint $table) {
            $table->dropForeign('fk_merchant_invites_account');
            $table->dropColumn('account_id');
        });

        Schema::table('merchants', function (Blueprint $table) {
            $table->dropForeign('fk_merchants_account');
            $table->dropColumn('account_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign('fk_users_account');
            $table->dropColumn('account_id');
        });
    }
};
