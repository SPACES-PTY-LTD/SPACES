<?php

namespace Database\Seeders;

use App\Models\CancelReason;
use App\Models\Carrier;
use App\Models\Account;
use App\Models\CountryPricing;
use App\Models\PaymentGateway;
use App\Models\PricingPlan;
use App\Models\TrackingProvider;
use App\Models\TrackingProviderIntegrationFormField;
use App\Models\User;
use App\Models\VehicleType;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {



        $password = Hash::make('password1234');
        $superAdmin = User::firstOrCreate(
            ['email' => 'super_admin@example.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Super Admin',
                'password' => $password,
                'role' => 'super_admin',
            ]
        );
        $superAdmin->wasRecentlyCreated
            ? $this->command?->info('Seeded super_admin user: super_admin@example.com')
            : $this->command?->info('Super_admin user already exists: super_admin@example.com');

        $normal_admin = User::firstOrCreate(
            ['email' => 'normal_admin@example.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Normal Admin',
                'password' => $password,
                'role' => 'user',
            ]
        );
        $normal_admin->wasRecentlyCreated
            ? $this->command?->info('Seeded admin user: normal_admin@example.com')
            : $this->command?->info('Admin user already exists: normal_admin@example.com');

        $account = Account::firstOrCreate(
            [
                'owner_user_id' => $normal_admin->id,
            ],
            [
                'uuid' => (string) Str::uuid(),
                'owner_user_id' => $normal_admin->id,
                'country_code' => 'ZA',
                'is_billing_exempt' => false,
            ]
        );
        $account->wasRecentlyCreated
            ? $this->command?->info('Seeded account for normal_admin@example.com')
            : $this->command?->info('Account already exists for normal_admin@example.com');

        $normal_admin->account_id = $account->id;
        $normal_admin->save();

        $gateways = [
            ['code' => 'free', 'name' => 'Free', 'type' => 'free', 'sort_order' => 0],
            ['code' => 'stripe', 'name' => 'Stripe', 'type' => 'card', 'sort_order' => 10],
            ['code' => 'payfast', 'name' => 'PayFast', 'type' => 'card', 'sort_order' => 20],
            ['code' => 'paystack', 'name' => 'Paystack', 'type' => 'card', 'sort_order' => 30],
        ];

        foreach ($gateways as $gateway) {
            $record = PaymentGateway::firstOrCreate(
                ['code' => $gateway['code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $gateway['name'],
                    'type' => $gateway['type'],
                    'is_active' => true,
                    'sort_order' => $gateway['sort_order'],
                ]
            );

            $record->wasRecentlyCreated
                ? $this->command?->info('Seeded payment gateway: ' . $gateway['code'])
                : $this->command?->info('Payment gateway already exists: ' . $gateway['code']);
        }

        $payfastGateway = PaymentGateway::where('code', 'payfast')->first();
        $stripeGateway = PaymentGateway::where('code', 'stripe')->first();

        $countryPricingRows = [
            [
                'country_code' => 'ZA',
                'country_name' => 'South Africa',
                'currency' => 'ZAR',
                'payment_gateway_id' => $payfastGateway?->id,
                'is_default' => false,
            ],
            [
                'country_code' => 'US',
                'country_name' => 'Rest of world',
                'currency' => 'USD',
                'payment_gateway_id' => $stripeGateway?->id,
                'is_default' => true,
            ],
        ];

        foreach ($countryPricingRows as $row) {
            $record = CountryPricing::firstOrCreate(
                ['country_code' => $row['country_code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'country_name' => $row['country_name'],
                    'currency' => $row['currency'],
                    'payment_gateway_id' => $row['payment_gateway_id'],
                    'is_default' => $row['is_default'],
                ]
            );

            $record->wasRecentlyCreated
                ? $this->command?->info('Seeded country pricing: ' . $row['country_code'])
                : $this->command?->info('Country pricing already exists: ' . $row['country_code']);
        }

        $plans = [
            [
                'title' => 'Free 1 Car',
                'vehicle_limit' => 1,
                'monthly_charge_zar' => 0,
                'monthly_charge_usd' => 0,
                'extra_vehicle_price_zar' => 0,
                'extra_vehicle_price_usd' => 0,
                'is_free' => true,
                'trial_days' => 14,
                'sort_order' => 0,
            ],
            [
                'title' => 'Starter 20',
                'vehicle_limit' => 20,
                'monthly_charge_zar' => 9000,
                'monthly_charge_usd' => 499,
                'extra_vehicle_price_zar' => 300,
                'extra_vehicle_price_usd' => 20,
                'is_free' => false,
                'trial_days' => null,
                'sort_order' => 10,
            ],
            [
                'title' => 'Growth 50',
                'vehicle_limit' => 50,
                'monthly_charge_zar' => 18000,
                'monthly_charge_usd' => 999,
                'extra_vehicle_price_zar' => 250,
                'extra_vehicle_price_usd' => 15,
                'is_free' => false,
                'trial_days' => null,
                'sort_order' => 20,
            ],
            [
                'title' => 'Enterprise 100',
                'vehicle_limit' => 100,
                'monthly_charge_zar' => 30000,
                'monthly_charge_usd' => 1599,
                'extra_vehicle_price_zar' => 200,
                'extra_vehicle_price_usd' => 12,
                'is_free' => false,
                'trial_days' => null,
                'sort_order' => 30,
            ],
        ];

        foreach ($plans as $plan) {
            $record = PricingPlan::updateOrCreate(
                ['title' => $plan['title']],
                [
                    'uuid' => PricingPlan::query()->where('title', $plan['title'])->value('uuid') ?? (string) Str::uuid(),
                    'vehicle_limit' => $plan['vehicle_limit'],
                    'monthly_charge_zar' => $plan['monthly_charge_zar'],
                    'monthly_charge_usd' => $plan['monthly_charge_usd'],
                    'extra_vehicle_price_zar' => $plan['extra_vehicle_price_zar'],
                    'extra_vehicle_price_usd' => $plan['extra_vehicle_price_usd'],
                    'is_free' => $plan['is_free'],
                    'trial_days' => $plan['trial_days'],
                    'is_active' => true,
                    'sort_order' => $plan['sort_order'],
                ]
            );

            $record->wasRecentlyCreated
                ? $this->command?->info('Seeded pricing plan: ' . $plan['title'])
                : $this->command?->info('Pricing plan synced: ' . $plan['title']);
        }
        



        $internalCarrier = Carrier::firstOrCreate(
            ['code' => 'internal'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Internal Carrier',
                'type' => 'internal',
                'enabled' => true,
            ]
        );
        $internalCarrier->wasRecentlyCreated
            ? $this->command?->info('Seeded carrier: internal')
            : $this->command?->info('Carrier already exists: internal');

        $motorcycle = VehicleType::firstOrCreate(
            ['code' => 'motorcycle'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Motorcycle',
                'enabled' => true,
            ]
        );
        $motorcycle->wasRecentlyCreated
            ? $this->command?->info('Seeded vehicle type: motorcycle')
            : $this->command?->info('Vehicle type already exists: motorcycle');

        $car = VehicleType::firstOrCreate(
            ['code' => 'car'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Car',
                'enabled' => true,
            ]
        );
        $car->wasRecentlyCreated
            ? $this->command?->info('Seeded vehicle type: car')
            : $this->command?->info('Vehicle type already exists: car');

        //Trailer
        $trailer = VehicleType::firstOrCreate(
            ['code' => 'trailer'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Trailer',
                'enabled' => true,
            ]
        );
        $trailer->wasRecentlyCreated
            ? $this->command?->info('Seeded vehicle type: trailer')
            : $this->command?->info('Vehicle type already exists: trailer');

        $powerFleetProvider = TrackingProvider::firstOrCreate(
            ['name' => 'PowerFleet'],
            [
                'uuid' => (string) Str::uuid(),
                'status' => 'active',
                'supports_bulk_vehicle_requests' => true,
                'has_location_services' => true,
            ]
        );
        $powerFleetProvider->wasRecentlyCreated
            ? $this->command?->info('Seeded tracking provider: PowerFleet')
            : $this->command?->info('Tracking provider already exists: PowerFleet');

        $powerFleetFields = [
            ['label' => 'Username', 'name' => 'username', 'order_id' => 1],
            ['label' => 'Password', 'name' => 'password', 'order_id' => 2],
            ['label' => 'Client ID', 'name' => 'client_id', 'order_id' => 3],
            ['label' => 'Client Secret', 'name' => 'client_secret', 'order_id' => 4],
            ['label' => 'Identity Server URL', 'name' => 'identity_server_url', 'order_id' => 5],
            ['label' => 'Rest Base URL', 'name' => 'rest_base_url', 'order_id' => 6],
            ['label' => 'Organisation ID', 'name' => 'organisation_id', 'order_id' => 7],
        ];

        foreach ($powerFleetFields as $field) {
            $record = TrackingProviderIntegrationFormField::firstOrNew([
                'provider_id' => $powerFleetProvider->id,
                'name' => $field['name'],
            ]);

            if (!$record->exists) {
                $record->uuid = (string) Str::uuid();
            }

            $record->fill([
                'label' => $field['label'],
                'type' => 'text',
                'is_required' => true,
                'order_id' => $field['order_id'],
            ])->save();

            $record->wasRecentlyCreated
                ? $this->command?->info('Seeded provider field: PowerFleet ' . $field['name'])
                : $this->command?->info('Provider field already exists: PowerFleet ' . $field['name']);
        }

        $fleetboardProvider = TrackingProvider::firstOrCreate(
            ['name' => 'Fleetboard'],
            [
                'uuid' => (string) Str::uuid(),
                'status' => 'active',
                'supports_bulk_vehicle_requests' => false,
                'default_tracking' => false,
                'has_location_services' => true,
                'has_vehicle_importing' => true,
                'has_driver_importing' => false,
                'has_locations_importing' => false,
                'logo_file_name' => 'fleetboard_logo.png',
                'website' => 'https://www.fleetboard.com',
                'documentation' => 'https://soap.api.fleetboard.com/soap_v1_1/services/BasicService',
            ]
        );
        $fleetboardProvider->wasRecentlyCreated
            ? $this->command?->info('Seeded tracking provider: Fleetboard')
            : $this->command?->info('Tracking provider already exists: Fleetboard');

        $fleetboardFields = [
            ['label' => 'Username', 'name' => 'username', 'order_id' => 1],
            ['label' => 'Password', 'name' => 'password', 'order_id' => 2, 'type' => 'password'],
            ['label' => 'Basic Service URL', 'name' => 'basic_service_url', 'order_id' => 3],
            ['label' => 'Position Service URL', 'name' => 'pos_service_url', 'order_id' => 4],
        ];

        foreach ($fleetboardFields as $field) {
            $record = TrackingProviderIntegrationFormField::firstOrNew([
                'provider_id' => $fleetboardProvider->id,
                'name' => $field['name'],
            ]);

            if (!$record->exists) {
                $record->uuid = (string) Str::uuid();
            }

            $record->fill([
                'label' => $field['label'],
                'type' => $field['type'] ?? 'text',
                'is_required' => true,
                'order_id' => $field['order_id'],
            ])->save();

            $record->wasRecentlyCreated
                ? $this->command?->info('Seeded provider field: Fleetboard ' . $field['name'])
                : $this->command?->info('Provider field already exists: Fleetboard ' . $field['name']);
        }

        $cancelReasons = [
            ['code' => 'customer_cancelled', 'title' => 'Customer cancelled'],
            ['code' => 'driver_unavailable', 'title' => 'Driver unavailable'],
            ['code' => 'vehicle_breakdown', 'title' => 'Vehicle breakdown'],
            ['code' => 'pickup_failed', 'title' => 'Pickup failed'],
            ['code' => 'recipient_unavailable', 'title' => 'Recipient unavailable'],
            ['code' => 'address_issue', 'title' => 'Address issue'],
            ['code' => 'weather_delay', 'title' => 'Weather delay'],
            ['code' => 'other', 'title' => 'Other'],
        ];

        foreach ($cancelReasons as $reason) {
            $record = CancelReason::firstOrCreate(
                ['code' => $reason['code']],
                [
                    'uuid' => (string) Str::uuid(),
                    'title' => $reason['title'],
                    'enabled' => true,
                ]
            );
            $record->wasRecentlyCreated
                ? $this->command?->info('Seeded cancel reason: ' . $reason['code'])
                : $this->command?->info('Cancel reason already exists: ' . $reason['code']);
        }
    }
}
