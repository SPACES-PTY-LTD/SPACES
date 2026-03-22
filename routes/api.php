<?php

use App\Http\Controllers\Api\V1\AdminController;
use App\Http\Controllers\Api\V1\AdminCancelReasonController;
use App\Http\Controllers\Api\V1\AdminCarrierController;
use App\Http\Controllers\Api\V1\AdminDriverAssignmentController;
use App\Http\Controllers\Api\V1\AdminDriverVehicleController;
use App\Http\Controllers\Api\V1\AdminTrackingProviderController;
use App\Http\Controllers\Api\V1\AdminTrackingProviderFormFieldController;
use App\Http\Controllers\Api\V1\AdminTrackingProviderOptionController;
use App\Http\Controllers\Api\V1\AdminVehicleTypeController;
use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BookingController;
use App\Http\Controllers\Api\V1\CarrierWebhookController;
use App\Http\Controllers\Api\V1\DriverController;
use App\Http\Controllers\Api\V1\DriverDeviceController;
use App\Http\Controllers\Api\V1\DriverOfferController;
use App\Http\Controllers\Api\V1\DriverShipmentController;
use App\Http\Controllers\Api\V1\DriverPresenceController;
use App\Http\Controllers\Api\V1\DriverVehicleController;
use App\Http\Controllers\Api\V1\DataPurgeController;
use App\Http\Controllers\Api\V1\EntityFileController;
use App\Http\Controllers\Api\V1\FileTypeController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\LocationTypeController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\MerchantIntegrationController;
use App\Http\Controllers\Api\V1\MerchantController;
use App\Http\Controllers\Api\V1\MerchantEnvironmentController;
use App\Http\Controllers\Api\V1\MerchantInviteController;
use App\Http\Controllers\Api\V1\MerchantMemberController;
use App\Http\Controllers\Api\V1\MerchantUserController;
use App\Http\Controllers\Api\V1\QuoteController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RouteController;
use App\Http\Controllers\Api\V1\RunController;
use App\Http\Controllers\Api\V1\ShipmentController;
use App\Http\Controllers\Api\V1\ShipmentOfferController;
use App\Http\Controllers\Api\V1\VehicleController;
use App\Http\Controllers\Api\V1\VehicleActivityController;
use App\Http\Controllers\Api\V1\WebhookSubscriptionController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    });

    Route::get('merchant-invites/preview', [MerchantInviteController::class, 'preview']);
    Route::post('merchant-invites/accept', [MerchantInviteController::class, 'accept']);

    Route::post('webhooks/carriers/{carrier_code}', [CarrierWebhookController::class, 'handle']);

    Route::middleware('auth.api')->group(function () {
        Route::get('me', [MeController::class, 'show']);
        Route::patch('me/last-accessed-merchant', [MeController::class, 'updateLastAccessedMerchant']);

        Route::post('merchants', [MerchantController::class, 'store']);
        Route::get('merchants', [MerchantController::class, 'index']);
        Route::get('merchants/{merchant_uuid}', [MerchantController::class, 'show']);
        Route::patch('merchants/{merchant_uuid}', [MerchantController::class, 'update']);
        Route::patch('merchants/{merchant_uuid}/settings', [MerchantController::class, 'updateSettings']);
        Route::post('merchants/{merchant_uuid}/logo', [MerchantController::class, 'updateLogo']);
        Route::get('merchants/{merchant_uuid}/location-automation', [MerchantController::class, 'showLocationAutomation']);
        Route::patch('merchants/{merchant_uuid}/location-automation', [MerchantController::class, 'updateLocationAutomation']);
        Route::delete('merchants/{merchant_uuid}', [MerchantController::class, 'destroy']);
        Route::post('merchants/{merchant_uuid}/purge-data', [DataPurgeController::class, 'purge'])
            ->middleware('role:user,super_admin');

        Route::post('merchants/{merchant_uuid}/members/invite', [MerchantInviteController::class, 'invite']);
        Route::get('merchants/{merchant_uuid}/members', [MerchantMemberController::class, 'index']);
        Route::patch('merchants/{merchant_uuid}/members/{user_uuid}', [MerchantMemberController::class, 'update']);
        Route::delete('merchants/{merchant_uuid}/members/{user_uuid}', [MerchantMemberController::class, 'destroy']);

        Route::get('merchants/{merchant_uuid}/invites', [MerchantInviteController::class, 'list']);
        Route::post('merchants/{merchant_uuid}/invites/{invite_uuid}/resend', [MerchantInviteController::class, 'resend']);
        Route::post('merchants/{merchant_uuid}/invites/{invite_uuid}/revoke', [MerchantInviteController::class, 'revoke']);

        Route::get('merchants/{merchant_uuid}/users', [MerchantUserController::class, 'index']);
        Route::post('merchants/{merchant_uuid}/users', [MerchantUserController::class, 'store']);
        Route::get('merchants/{merchant_uuid}/users/{person_uuid}', [MerchantUserController::class, 'show']);
        Route::patch('merchants/{merchant_uuid}/users/{person_uuid}', [MerchantUserController::class, 'update']);
        Route::delete('merchants/{merchant_uuid}/users/{person_uuid}', [MerchantUserController::class, 'destroy']);
        Route::post('merchants/{merchant_uuid}/users/{person_uuid}/resend', [MerchantUserController::class, 'resend']);

        Route::get('merchants/{merchant_uuid}/environments', [MerchantEnvironmentController::class, 'index']);
        Route::post('merchants/{merchant_uuid}/environments', [MerchantEnvironmentController::class, 'store']);
        Route::get('merchants/{merchant_uuid}/environments/{environment_uuid}', [MerchantEnvironmentController::class, 'show']);
        Route::patch('merchants/{merchant_uuid}/environments/{environment_uuid}', [MerchantEnvironmentController::class, 'update']);
        Route::delete('merchants/{merchant_uuid}/environments/{environment_uuid}', [MerchantEnvironmentController::class, 'destroy']);
        Route::post('merchants/{merchant_uuid}/environments/{environment_uuid}/token', [MerchantEnvironmentController::class, 'rotateToken']);

        Route::post('webhooks/subscriptions', [WebhookSubscriptionController::class, 'store']);
        Route::get('webhooks/subscriptions', [WebhookSubscriptionController::class, 'index']);
        Route::get('webhooks/subscriptions/{subscription_uuid}', [WebhookSubscriptionController::class, 'show']);
        Route::patch('webhooks/subscriptions/{subscription_uuid}', [WebhookSubscriptionController::class, 'update']);
        Route::delete('webhooks/subscriptions/{subscription_uuid}', [WebhookSubscriptionController::class, 'destroy']);
        Route::post('webhooks/subscriptions/{subscription_uuid}/test', [WebhookSubscriptionController::class, 'test']);

        Route::middleware('role:super_admin')->prefix('admin')->group(function () {
            Route::get('users', [AdminController::class, 'users']);
            Route::get('merchants', [AdminController::class, 'merchants']);
            Route::get('shipments', [AdminController::class, 'shipments']);
            Route::get('bookings', [AdminController::class, 'bookings']);
            Route::get('webhook-deliveries', [AdminController::class, 'webhookDeliveries']);
        });
    });

    Route::middleware('auth.api')->group(function () {
        Route::get('reports/created_over_time', [ReportController::class, 'createdOverTime']);
        Route::get('reports/dashboard_stats', [ReportController::class, 'dashboardStats']);
        Route::get('reports/fleet_status', [ReportController::class, 'fleetStatus']);
        Route::get('reports/mapped-bookings', [ReportController::class, 'mappedBookings']);
        Route::get('reports/missing-documents', [ReportController::class, 'missingDocuments']);
        Route::get('reports/document-expiry', [ReportController::class, 'documentExpiry']);
        Route::get('reports/document-coverage', [ReportController::class, 'documentCoverage']);
        Route::get('reports/shipments_full_report', [ReportController::class, 'shipmentsFullReport']);

        Route::get('quotes', [QuoteController::class, 'index'])->middleware('merchant.context');
        Route::post('quotes', [QuoteController::class, 'store']);
        Route::get('quotes/{quote_uuid}', [QuoteController::class, 'show']);
        Route::get('shipments/{shipment_uuid}/quotes', [QuoteController::class, 'listForShipment']);

        Route::post('shipments', [ShipmentController::class, 'store']);
        Route::post('shipments/on-demand', [ShipmentController::class, 'requestOnDemand']);
        Route::get('shipments', [ShipmentController::class, 'index'])->middleware('merchant.context');
        Route::get('shipments/{shipment_uuid}', [ShipmentController::class, 'show']);
        Route::post('shipments/{shipment_uuid}/assign_driver', [ShipmentController::class, 'assignDriver']);
        Route::post('shipments/{shipment_uuid}/dispatch-offers/start', [ShipmentOfferController::class, 'start']);
        Route::patch('shipments/{shipment_uuid}', [ShipmentController::class, 'update']);
        Route::delete('shipments/{shipment_uuid}', [ShipmentController::class, 'destroy']);
        Route::get('shipments/{shipment_uuid}/label', [ShipmentController::class, 'label']);
        Route::get('shipments/{shipment_uuid}/tracking', [ShipmentController::class, 'tracking']);
        Route::get('shipments/{shipment_uuid}/offers', [ShipmentOfferController::class, 'index']);

        Route::post('shipments/{shipment_uuid}/book', [BookingController::class, 'book']);
        Route::post('shipments/{shipment_uuid}/rebook', [BookingController::class, 'rebook']);

        Route::post('runs', [RunController::class, 'store']);
        Route::get('runs', [RunController::class, 'index'])->middleware('merchant.context');
        Route::get('runs/{run_uuid}', [RunController::class, 'show']);
        Route::patch('runs/{run_uuid}', [RunController::class, 'update']);
        Route::post('runs/{run_uuid}/shipments', [RunController::class, 'attachShipments']);
        Route::delete('runs/{run_uuid}/shipments/{shipment_uuid}', [RunController::class, 'detachShipment']);
        Route::post('runs/{run_uuid}/dispatch', [RunController::class, 'dispatch']);
        Route::post('runs/{run_uuid}/start', [RunController::class, 'start']);
        Route::post('runs/{run_uuid}/complete', [RunController::class, 'complete']);
        
        Route::get('bookings', [BookingController::class, 'index'])->middleware('merchant.context');
        Route::get('bookings/{booking_uuid}', [BookingController::class, 'show']);
        Route::post('shipments/{shipment_uuid}/cancel', [BookingController::class, 'cancel']);

        Route::get('cancel-reasons', [AdminCancelReasonController::class, 'index']);

        Route::middleware('role:super_admin')->prefix('admin')->group(function () {
            Route::get('users', [AdminController::class, 'users']);
            Route::get('merchants', [AdminController::class, 'merchants']);
            Route::get('shipments', [AdminController::class, 'shipments']);
            Route::get('bookings', [AdminController::class, 'bookings']);
            Route::get('webhook-deliveries', [AdminController::class, 'webhookDeliveries']);

            Route::get('vehicle-types/{vehicle_type_uuid}', [AdminVehicleTypeController::class, 'show']);
            Route::post('vehicle-types', [AdminVehicleTypeController::class, 'store']);
            Route::patch('vehicle-types/{vehicle_type_uuid}', [AdminVehicleTypeController::class, 'update']);
            Route::delete('vehicle-types/{vehicle_type_uuid}', [AdminVehicleTypeController::class, 'destroy']);

            Route::post('tracking-providers', [AdminTrackingProviderController::class, 'store']);
            Route::get('tracking-providers/{provider_uuid}', [AdminTrackingProviderController::class, 'show']);
            Route::patch('tracking-providers/{provider_uuid}', [AdminTrackingProviderController::class, 'update']);
            Route::delete('tracking-providers/{provider_uuid}', [AdminTrackingProviderController::class, 'destroy']);

            Route::get('tracking-providers/{provider_uuid}/integration-form-fields', [AdminTrackingProviderFormFieldController::class, 'index']);
            Route::post('tracking-providers/{provider_uuid}/integration-form-fields', [AdminTrackingProviderFormFieldController::class, 'store']);
            Route::get('tracking-providers/{provider_uuid}/integration-form-fields/{field_uuid}', [AdminTrackingProviderFormFieldController::class, 'show']);
            Route::patch('tracking-providers/{provider_uuid}/integration-form-fields/{field_uuid}', [AdminTrackingProviderFormFieldController::class, 'update']);
            Route::delete('tracking-providers/{provider_uuid}/integration-form-fields/{field_uuid}', [AdminTrackingProviderFormFieldController::class, 'destroy']);
            Route::get('tracking-providers/{provider_uuid}/options', [AdminTrackingProviderOptionController::class, 'index']);
            Route::post('tracking-providers/{provider_uuid}/options', [AdminTrackingProviderOptionController::class, 'store']);
            Route::get('tracking-providers/{provider_uuid}/options/{option_uuid}', [AdminTrackingProviderOptionController::class, 'show']);
            Route::patch('tracking-providers/{provider_uuid}/options/{option_uuid}', [AdminTrackingProviderOptionController::class, 'update']);
            Route::delete('tracking-providers/{provider_uuid}/options/{option_uuid}', [AdminTrackingProviderOptionController::class, 'destroy']);

            Route::get('bookings', [BookingController::class, 'index']);
            Route::post('bookings/{booking_uuid}/assign-driver', [AdminDriverAssignmentController::class, 'assign']);
            Route::post('bookings/{booking_uuid}/unassign-driver', [AdminDriverAssignmentController::class, 'unassign']);
        });

        Route::middleware('role:user,super_admin')->group(function () {
            Route::get('tracking-providers', [AdminTrackingProviderController::class, 'index']);
            Route::get('activity-logs', [ActivityLogController::class, 'index']);
            Route::get('activity-logs/{log_id}', [ActivityLogController::class, 'show']);
            Route::get('vehicle-activities', [VehicleActivityController::class, 'index']);
            Route::get('vehicle-activities/{activity_uuid}', [VehicleActivityController::class, 'show']);
            Route::get('vehicles/latest-activity-check', [VehicleActivityController::class, 'latestActivityCheck']);
            
            Route::middleware('role:user')->group(function () {
                Route::post('tracking-providers/activate', [MerchantIntegrationController::class, 'activateTrackingProvider']);
                Route::put('tracking-providers/{provider_id}/options_data', [MerchantIntegrationController::class, 'updateTrackingProviderOptionsData']);
                Route::post('tracking-providers/{provider_id}/import_vehicles', [MerchantIntegrationController::class, 'importTrackingProviderVehicles']);
                Route::post('tracking-providers/{provider_id}/import_drivers', [MerchantIntegrationController::class, 'importTrackingProviderDrivers']);
                Route::post('tracking-providers/{provider_id}/import_locations', [MerchantIntegrationController::class, 'importTrackingProviderLocations']);
                Route::get('tracking-providers/imports-statuses', [MerchantIntegrationController::class, 'importStatuses']);
            });

            Route::get('vehicle-types', [AdminVehicleTypeController::class, 'index']);
            
            Route::post('cancel-reasons', [AdminCancelReasonController::class, 'store']);
            Route::middleware('role:super_admin')->group(function () {
                Route::get('cancel-reasons/{cancel_reason_uuid}', [AdminCancelReasonController::class, 'show']);
                Route::patch('cancel-reasons/{cancel_reason_uuid}', [AdminCancelReasonController::class, 'update']);
                Route::delete('cancel-reasons/{cancel_reason_uuid}', [AdminCancelReasonController::class, 'destroy']);
            });

            Route::get('carriers', [AdminCarrierController::class, 'index']);
            Route::get('carriers/{carrier_uuid}', [AdminCarrierController::class, 'show']);
            Route::post('carriers', [AdminCarrierController::class, 'store']);
            Route::patch('carriers/{carrier_uuid}', [AdminCarrierController::class, 'update']);
            Route::delete('carriers/{carrier_uuid}', [AdminCarrierController::class, 'destroy']);

            Route::get('drivers', [DriverController::class, 'index'])->middleware('merchant.context');
            Route::post('drivers/import', [DriverController::class, 'import']);
            Route::get('drivers/{driver_uuid}', [DriverController::class, 'show']);
            Route::post('drivers', [DriverController::class, 'store']);
            Route::patch('drivers/{driver_uuid}', [DriverController::class, 'update']);
            Route::patch('drivers/{driver_uuid}/password', [DriverController::class, 'updatePassword']);
            Route::delete('drivers/{driver_uuid}', [DriverController::class, 'destroy']);
            Route::get('vehicles', [VehicleController::class, 'index'])->middleware('merchant.context');
            Route::post('vehicles/import', [VehicleController::class, 'import']);
            Route::get('vehicles/{vehicle_uuid}', [VehicleController::class, 'show']);
            Route::post('vehicles', [VehicleController::class, 'store']);
            Route::patch('vehicles/{vehicle_uuid}/maintenance', [VehicleController::class, 'updateMaintenance']);
            Route::patch('vehicles/{vehicle_uuid}', [VehicleController::class, 'update']);
            Route::delete('vehicles/{vehicle_uuid}', [VehicleController::class, 'destroy']);

            Route::get('routes', [RouteController::class, 'index'])->middleware('merchant.context');
            Route::get('routes/{route_uuid}/stats', [RouteController::class, 'stats']);
            Route::get('routes/{route_uuid}', [RouteController::class, 'show']);
            Route::post('routes', [RouteController::class, 'store']);
            Route::patch('routes/{route_uuid}', [RouteController::class, 'update']);
            Route::delete('routes/{route_uuid}', [RouteController::class, 'destroy']);

            Route::get('locations', [LocationController::class, 'index'])->middleware('merchant.context');
            Route::get('locations/{location_uuid}', [LocationController::class, 'show']);
            Route::post('locations/import', [LocationController::class, 'import']);
            Route::post('locations', [LocationController::class, 'store']);
            Route::patch('locations/{location_uuid}', [LocationController::class, 'update']);
            Route::delete('locations/{location_uuid}', [LocationController::class, 'destroy']);

            Route::get('location-types', [LocationTypeController::class, 'index'])->middleware('merchant.context');
            Route::patch('location-types', [LocationTypeController::class, 'update'])->middleware('merchant.context');
            Route::get('file-types', [FileTypeController::class, 'index'])->middleware('merchant.context');
            Route::post('file-types', [FileTypeController::class, 'store'])->middleware('merchant.context');
            Route::patch('file-types/{file_type_uuid}', [FileTypeController::class, 'update']);

            Route::get('drivers/{driver_uuid}/vehicles', [AdminDriverVehicleController::class, 'index']);
            Route::post('drivers/{driver_uuid}/vehicles', [AdminDriverVehicleController::class, 'store']);
            Route::patch('drivers/{driver_uuid}/vehicles/{vehicle_uuid}', [AdminDriverVehicleController::class, 'update']);
            Route::delete('drivers/{driver_uuid}/vehicles/{vehicle_uuid}', [AdminDriverVehicleController::class, 'destroy']);

            Route::get('shipments/{shipment_uuid}/files', [EntityFileController::class, 'shipmentIndex']);
            Route::post('shipments/{shipment_uuid}/files', [EntityFileController::class, 'shipmentStore']);
            Route::get('drivers/{driver_uuid}/files', [EntityFileController::class, 'driverIndex']);
            Route::post('drivers/{driver_uuid}/files', [EntityFileController::class, 'driverStore']);
            Route::get('vehicles/{vehicle_uuid}/files', [EntityFileController::class, 'vehicleIndex'])->middleware('merchant.context');
            Route::post('vehicles/{vehicle_uuid}/files', [EntityFileController::class, 'vehicleStore'])->middleware('merchant.context');
            Route::get('files/expired', [EntityFileController::class, 'expiredIndex']);
            Route::get('files/{file_uuid}/download', [EntityFileController::class, 'download']);
            Route::delete('files/{file_uuid}', [EntityFileController::class, 'destroy']);
        });

        Route::middleware('role:driver')->prefix('driver')->group(function () {
            Route::patch('profile', [MeController::class, 'updateDriverProfile']);
            Route::post('devices/register', [DriverDeviceController::class, 'store']);
            Route::post('presence/heartbeat', [DriverPresenceController::class, 'heartbeat']);
            Route::post('presence/status', [DriverPresenceController::class, 'status']);
            Route::get('offers', [DriverOfferController::class, 'index']);
            Route::post('offers/{offer_uuid}/accept', [DriverOfferController::class, 'accept']);
            Route::post('offers/{offer_uuid}/decline', [DriverOfferController::class, 'decline']);

            Route::get('shipments', [DriverShipmentController::class, 'index']);
            Route::get('shipments/{shipment_uuid}', [DriverShipmentController::class, 'show']);
            Route::patch('shipments/{shipment_uuid}/status', [DriverShipmentController::class, 'updateStatus']);
            Route::post('shipments/{shipment_uuid}/scan', [DriverShipmentController::class, 'scan']);
            Route::post('shipments/{shipment_uuid}/pod', [DriverShipmentController::class, 'pod']);
            Route::post('shipments/{shipment_uuid}/cancel', [DriverShipmentController::class, 'cancel']);

            Route::get('vehicles', [DriverVehicleController::class, 'index']);
            Route::get('vehicles/{vehicle_uuid}', [DriverVehicleController::class, 'show']);
            Route::post('vehicles', [DriverVehicleController::class, 'store']);
            Route::patch('vehicles/{vehicle_uuid}', [DriverVehicleController::class, 'update']);
            Route::delete('vehicles/{vehicle_uuid}', [DriverVehicleController::class, 'destroy']);
            Route::get('files/types', [FileTypeController::class, 'driverUploadTypes']);
            Route::get('files', [EntityFileController::class, 'ownDriverIndex']);
            Route::post('files', [EntityFileController::class, 'ownDriverStore']);
            Route::get('files/{file_uuid}/download', [EntityFileController::class, 'ownDriverDownload']);
            Route::get('shipments/{shipment_uuid}/files', [EntityFileController::class, 'ownDriverShipmentIndex']);
            Route::post('shipments/{shipment_uuid}/files', [EntityFileController::class, 'ownDriverShipmentStore']);
        });
    });
});
