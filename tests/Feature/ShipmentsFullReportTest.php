<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShipmentsFullReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_requires_merchant_id_when_no_merchant_environment_is_present(): void
    {
        [$user] = $this->createMerchantContext();

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report');

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonPath('error.details.merchant_id.0', 'The merchant_id field is required.');
    }

    public function test_report_returns_only_shipments_for_the_requested_merchant(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $otherMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $otherMerchant->users()->attach($user->id, ['role' => 'owner']);

        $pickup = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $dropoff = $this->createLocation($account->id, $merchant->id, 'Store A', 'STORE-A', 'Cape Town');
        $otherPickup = $this->createLocation($account->id, $otherMerchant->id, 'Warehouse B', 'PICKUP-B', 'Durban');
        $otherDropoff = $this->createLocation($account->id, $otherMerchant->id, 'Store B', 'STORE-B', 'Durban');

        $selectedShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'ORDER-SELECTED',
            $pickup,
            $dropoff
        );
        $this->createShipment(
            $account->id,
            $otherMerchant->id,
            'ORDER-OTHER',
            $otherPickup,
            $otherDropoff
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?merchant_id=' . $merchant->uuid);

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.shipment_id', $selectedShipmentUuid)
            ->assertJsonPath('data.0.shipment_number', 'ORDER-SELECTED');
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
        string $orderRef,
        int $pickupLocationId,
        int $dropoffLocationId
    ): string
    {
        $uuid = (string) Str::uuid();
        $createdAt = Carbon::now();

        DB::table('shipments')->insert([
            'uuid' => $uuid,
            'merchant_id' => $merchantId,
            'merchant_order_ref' => $orderRef,
            'status' => 'draft',
            'account_id' => $accountId,
            'environment_id' => null,
            'pickup_location_id' => $pickupLocationId,
            'dropoff_location_id' => $dropoffLocationId,
            'collection_date' => $createdAt,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
            'deleted_at' => null,
        ]);

        return $uuid;
    }
}
