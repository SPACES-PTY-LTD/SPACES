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

    public function test_report_filters_shipments_by_pickup_or_dropoff_location_tag(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $taggedPickup = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $taggedDropoff = $this->createLocation($account->id, $merchant->id, 'Store A', 'STORE-A', 'Cape Town');
        $untaggedLocation = $this->createLocation($account->id, $merchant->id, 'Plain Hub', 'PLAIN', 'Cape Town');
        $tagId = $this->createTag($account->id, $merchant->id, 'Depot', 'depot');
        $tagUuid = DB::table('tags')->where('id', $tagId)->value('uuid');

        $this->attachTagToLocation($tagId, $taggedPickup);
        $this->attachTagToLocation($tagId, $taggedDropoff);

        $pickupMatchUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'PICKUP-MATCH',
            $taggedPickup,
            $untaggedLocation
        );
        $dropoffMatchUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'DROPOFF-MATCH',
            $untaggedLocation,
            $taggedDropoff
        );
        $nonMatchUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'NO-MATCH',
            $untaggedLocation,
            $untaggedLocation
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?' . http_build_query([
                'merchant_id' => $merchant->uuid,
                'location_tag_id' => $tagUuid,
                'per_page' => 10,
            ]));

        $response->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonFragment(['shipment_id' => $pickupMatchUuid])
            ->assertJsonFragment(['shipment_id' => $dropoffMatchUuid])
            ->assertJsonMissing(['shipment_id' => $nonMatchUuid]);
    }

    public function test_report_filters_shipments_by_report_vehicle_tag(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $location = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $matchingVehicle = $this->createVehicle($account->id, $merchant->id, 'TAG-REPORT-1');
        $otherVehicle = $this->createVehicle($account->id, $merchant->id, 'TAG-REPORT-2');
        $tagId = $this->createTag($account->id, $merchant->id, 'Cold Chain', 'cold-chain');
        $tagUuid = DB::table('tags')->where('id', $tagId)->value('uuid');
        $this->attachTagToVehicle($tagId, $matchingVehicle);

        $matchingShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'VEHICLE-TAG-MATCH',
            $location,
            $location
        );
        $nonMatchShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'VEHICLE-TAG-NO-MATCH',
            $location,
            $location
        );

        $this->attachShipmentToRun(
            $account->id,
            $merchant->id,
            (int) DB::table('shipments')->where('uuid', $matchingShipmentUuid)->value('id'),
            $matchingVehicle
        );
        $this->attachShipmentToRun(
            $account->id,
            $merchant->id,
            (int) DB::table('shipments')->where('uuid', $nonMatchShipmentUuid)->value('id'),
            $otherVehicle
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?' . http_build_query([
                'merchant_id' => $merchant->uuid,
                'vehicle_tag_id' => $tagUuid,
                'per_page' => 10,
            ]));

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonFragment(['shipment_id' => $matchingShipmentUuid])
            ->assertJsonMissing(['shipment_id' => $nonMatchShipmentUuid]);
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

    private function createTag(int $accountId, int $merchantId, string $name, string $slug): int
    {
        return DB::table('tags')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'name' => $name,
            'slug' => $slug,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createVehicle(int $accountId, int $merchantId, string $plateNumber): int
    {
        return DB::table('vehicles')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'plate_number' => $plateNumber,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }

    private function attachTagToLocation(int $tagId, int $locationId): void
    {
        DB::table('taggables')->insert([
            'tag_id' => $tagId,
            'taggable_type' => \App\Models\Location::class,
            'taggable_id' => $locationId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachTagToVehicle(int $tagId, int $vehicleId): void
    {
        DB::table('taggables')->insert([
            'tag_id' => $tagId,
            'taggable_type' => \App\Models\Vehicle::class,
            'taggable_id' => $vehicleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachShipmentToRun(int $accountId, int $merchantId, int $shipmentId, int $vehicleId): void
    {
        $runId = DB::table('runs')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'vehicle_id' => $vehicleId,
            'status' => 'dispatched',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('run_shipments')->insert([
            'uuid' => (string) Str::uuid(),
            'run_id' => $runId,
            'shipment_id' => $shipmentId,
            'sequence' => 1,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
