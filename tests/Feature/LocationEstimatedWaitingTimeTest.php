<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationEstimatedWaitingTimeTest extends TestCase
{
    use RefreshDatabase;

    public function test_estimated_waiting_time_can_be_created_updated_serialized_and_cleared(): void
    {
        [$user, $merchant] = $this->createMerchantUser();

        $response = $this->authenticated($user)->postJson('/api/v1/locations', [
            'merchant_id' => $merchant->uuid,
            'name' => 'Waiting Time Depot',
            'address_line_1' => '1 Depot Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'estimated_waiting_time' => 25,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.estimated_waiting_time', 25);

        $locationUuid = $response->json('data.location_id');
        $this->assertDatabaseHas('locations', [
            'uuid' => $locationUuid,
            'estimated_waiting_time' => 25,
        ]);

        $this->authenticated($user)
            ->patchJson("/api/v1/locations/{$locationUuid}", [
                'estimated_waiting_time' => 40,
            ])
            ->assertOk()
            ->assertJsonPath('data.estimated_waiting_time', 40);

        $this->authenticated($user)
            ->getJson("/api/v1/locations/{$locationUuid}")
            ->assertOk()
            ->assertJsonPath('data.estimated_waiting_time', 40);

        $this->authenticated($user)
            ->patchJson("/api/v1/locations/{$locationUuid}", [
                'estimated_waiting_time' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.estimated_waiting_time', null);

        $this->assertNull(Location::query()->where('uuid', $locationUuid)->value('estimated_waiting_time'));
    }

    public function test_estimated_waiting_time_must_be_a_supported_non_negative_integer(): void
    {
        [$user, $merchant] = $this->createMerchantUser();
        $location = $this->createLocation($merchant, 'Validation Depot');

        foreach ([-1, 1.5, 4_294_967_296] as $invalidValue) {
            $this->authenticated($user)
                ->patchJson("/api/v1/locations/{$location->uuid}", [
                    'estimated_waiting_time' => $invalidValue,
                ])
                ->assertUnprocessable()
                ->assertJsonPath('error.code', 'VALIDATION');
        }

        $this->assertNull($location->fresh()->estimated_waiting_time);
    }

    public function test_locations_can_be_sorted_by_estimated_waiting_time(): void
    {
        [$user, $merchant] = $this->createMerchantUser();
        $shortWait = $this->createLocation($merchant, 'Short Wait', 5);
        $longWait = $this->createLocation($merchant, 'Long Wait', 30);
        $this->createLocation($merchant, 'No Estimate');

        $response = $this->authenticated($user)->getJson('/api/v1/locations?'.http_build_query([
            'merchant_id' => $merchant->uuid,
            'sort_by' => 'estimated_waiting_time',
            'sort_dir' => 'desc',
        ]));

        $response->assertOk()
            ->assertJsonPath('data.0.location_id', $longWait->uuid)
            ->assertJsonPath('data.0.estimated_waiting_time', 30)
            ->assertJsonPath('data.1.location_id', $shortWait->uuid)
            ->assertJsonPath('data.1.estimated_waiting_time', 5)
            ->assertJsonPath('data.2.estimated_waiting_time', null);
    }

    private function authenticated(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }

    private function createMerchantUser(): array
    {
        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant];
    }

    private function createLocation(Merchant $merchant, string $name, ?int $estimatedWaitingTime = null): Location
    {
        return Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => $name,
            'address_line_1' => '1 Depot Street',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'estimated_waiting_time' => $estimatedWaitingTime,
        ]);
    }
}
