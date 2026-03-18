<?php

namespace Database\Seeders;

use App\Models\CancelReason;
use App\Models\Carrier;
use App\Models\Account;
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
            ]
        );
        $account->wasRecentlyCreated
            ? $this->command?->info('Seeded account for normal_admin@example.com')
            : $this->command?->info('Account already exists for normal_admin@example.com');

        $normal_admin->account_id = $account->id;
        $normal_admin->save();
        



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
