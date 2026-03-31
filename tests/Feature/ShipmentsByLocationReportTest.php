<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShipmentsByLocationReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_returns_grouped_pickup_counts_for_selected_range(): void
    {
        Carbon::setTestNow('2026-03-30 10:00:00');

        [$user, $merchant, $account] = $this->createMerchantContext();
        $headers = $this->authHeaders($user);
        $pickupA = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $pickupB = $this->createLocation($account->id, $merchant->id, 'Warehouse B', 'PICKUP-B', 'Johannesburg');
        $dropoff = $this->createLocation($account->id, $merchant->id, 'Customer Hub', 'DROPOFF-A', 'Durban');

        $this->createShipment(
            $account->id,
            $merchant->id,
            $pickupA,
            $dropoff,
            Carbon::now()->subDays(2)
        );
        $this->createShipment(
            $account->id,
            $merchant->id,
            $pickupA,
            $dropoff,
            Carbon::now()->subDays(10)
        );
        $this->createShipment(
            $account->id,
            $merchant->id,
            $pickupB,
            $dropoff,
            Carbon::now()->subMonths(2)
        );

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/reports/shipments-by-location?date_range=1month&location_type=pickup');

        $response->assertOk()
            ->assertJsonPath('meta.location_type', 'pickup')
            ->assertJsonPath('meta.date_range', '1month')
            ->assertJsonPath('meta.total_locations', 1)
            ->assertJsonPath('meta.total_shipments', 2)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.location_name', 'Warehouse A')
            ->assertJsonPath('data.0.city', 'Cape Town')
            ->assertJsonPath('data.0.total_shipments', 2);

        Carbon::setTestNow();
    }

    public function test_report_returns_grouped_dropoff_counts(): void
    {
        Carbon::setTestNow('2026-03-30 10:00:00');

        [$user, $merchant, $account] = $this->createMerchantContext();
        $headers = $this->authHeaders($user);
        $pickup = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $dropoffA = $this->createLocation($account->id, $merchant->id, 'Store A', 'STORE-A', 'Cape Town');
        $dropoffB = $this->createLocation($account->id, $merchant->id, 'Store B', 'STORE-B', 'Durban');

        $this->createShipment($account->id, $merchant->id, $pickup, $dropoffA, Carbon::now()->subDays(1));
        $this->createShipment($account->id, $merchant->id, $pickup, $dropoffA, Carbon::now()->subDays(3));
        $this->createShipment($account->id, $merchant->id, $pickup, $dropoffB, Carbon::now()->subDays(5));

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/reports/shipments-by-location?date_range=1month&location_type=dropoff');

        $response->assertOk()
            ->assertJsonPath('meta.location_type', 'dropoff')
            ->assertJsonPath('meta.total_locations', 2)
            ->assertJsonPath('meta.total_shipments', 3)
            ->assertJsonPath('data.0.location_name', 'Store A')
            ->assertJsonPath('data.0.total_shipments', 2)
            ->assertJsonPath('data.1.location_name', 'Store B')
            ->assertJsonPath('data.1.total_shipments', 1);

        Carbon::setTestNow();
    }

    public function test_report_rejects_invalid_date_range(): void
    {
        [$user] = $this->createMerchantContext();
        $headers = $this->authHeaders($user);

        $response = $this->withHeaders($headers)
            ->getJson('/api/v1/reports/shipments-by-location?date_range=invalid');

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION');
    }

    private function createMerchantContext(): array
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant, $account];
    }

    private function authHeaders(User $user): array
    {
        return [
            'Authorization' => 'Bearer ' . $user->createToken('test-token')->plainTextToken,
            'Accept' => 'application/json',
        ];
    }

    private function createLocation(int $accountId, int $merchantId, string $name, string $code, string $city): int
    {
        $existingId = DB::table('locations')
            ->where('account_id', $accountId)
            ->where('merchant_id', $merchantId)
            ->where('code', $code)
            ->value('id');

        if ($existingId) {
            return (int) $existingId;
        }

        return DB::table('locations')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'environment_id' => null,
            'name' => $name,
            'code' => $code,
            'company' => null,
            'address_line_1' => "{$name} address",
            'address_line_2' => null,
            'town' => null,
            'city' => $city,
            'country' => 'ZA',
            'first_name' => null,
            'last_name' => null,
            'phone' => null,
            'province' => 'Western Cape',
            'post_code' => '8000',
            'latitude' => null,
            'longitude' => null,
            'google_place_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }

    private function createShipment(
        int $accountId,
        int $merchantId,
        int $pickupLocationId,
        int $dropoffLocationId,
        Carbon $createdAt
    ): void {
        DB::table('shipments')->insert([
            'uuid' => (string) Str::uuid(),
            'merchant_id' => $merchantId,
            'merchant_order_ref' => 'ORDER-' . Str::upper(Str::random(8)),
            'status' => 'draft',
            'account_id' => $accountId,
            'environment_id' => null,
            'pickup_location_id' => $pickupLocationId,
            'dropoff_location_id' => $dropoffLocationId,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
            'deleted_at' => null,
        ]);
    }
}
