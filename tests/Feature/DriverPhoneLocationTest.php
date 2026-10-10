<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverPhoneLocationTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $owner = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $owner->id]);
        $merchant->users()->attach($owner, ['role' => 'owner']);
        $user = User::factory()->create(['role' => 'driver', 'account_id' => $account->id]);
        $driver = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'metadata' => ['existing' => 'preserve']]);
        $this->withHeader('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);

        return [$owner, $merchant, $user, $driver];
    }

    public function test_profile_exposes_the_drivers_actual_merchant_and_photo(): void
    {
        [, $merchant, $user] = $this->context();
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.driver_merchant.merchant_id', $merchant->uuid)
            ->assertJsonPath('data.driver_merchant.name', $merchant->name)->assertJsonPath('data.profile_photo_url', null);
        $this->patchJson('/api/v1/driver/profile', ['name' => 'Updated driver'])->assertOk()
            ->assertJsonPath('data.driver_merchant.merchant_id', $merchant->uuid);
    }

    public function test_sharing_requires_opt_in_and_does_not_change_presence_or_vehicle_tracking(): void
    {
        [, , , $driver] = $this->context();
        $this->getJson('/api/v1/driver/location-sharing')->assertOk()->assertJsonPath('data.enabled', false);
        $this->postJson('/api/v1/driver/phone-location', ['latitude' => 0, 'longitude' => 0, 'observed_at' => now()->toIso8601String()])->assertStatus(409);
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertOk()->assertJsonPath('data.enabled', true);
        $this->postJson('/api/v1/driver/phone-location', ['latitude' => 0, 'longitude' => 0, 'accuracy' => 5, 'observed_at' => now()->toIso8601String()])->assertOk();
        $metadata = $driver->fresh()->metadata;
        $this->assertSame('preserve', $metadata['existing']);
        $this->assertEquals(0, $metadata['phone_location']['latitude']);
        $this->assertNull($driver->fresh()->presence);
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_disabling_clears_coordinates_and_alerts_dispatch_once_with_retry(): void
    {
        [$owner, $merchant, , $driver] = $this->context();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertOk();
        $this->postJson('/api/v1/driver/phone-location', ['latitude' => -26.1, 'longitude' => 28.1, 'observed_at' => now()->toIso8601String()])->assertOk();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => false])->assertOk()->assertJsonPath('data.enabled', false);
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => false])->assertOk();
        $this->assertDatabaseCount('messages', 1);
        $alert = Message::firstOrFail();
        $this->assertSame($driver->user_id, $alert->user_id);
        $this->assertSame($merchant->id, $alert->merchant_id);
        $this->assertNull($alert->read_at);
        $this->assertArrayNotHasKey('latitude', $driver->fresh()->metadata['phone_location']);
        $this->assertNotNull($driver->fresh()->metadata['phone_location']['dispatch_alerted_at']);
        $this->withHeader('Authorization', 'Bearer '.$owner->createToken('dispatch')->plainTextToken);
        $this->getJson('/api/v1/conversations?merchant_id='.$merchant->uuid)->assertOk()
            ->assertJsonPath('data.0.latest_message.body', $alert->body);
    }

    public function test_older_reports_do_not_overwrite_a_newer_coordinate_and_invalid_reports_are_rejected(): void
    {
        [, , , $driver] = $this->context();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertOk();
        $this->postJson('/api/v1/driver/phone-location', ['latitude' => 10, 'longitude' => 20, 'observed_at' => now()->toIso8601String()])->assertOk();
        $this->postJson('/api/v1/driver/phone-location', ['latitude' => 11, 'longitude' => 21, 'observed_at' => now()->subMinute()->toIso8601String()])->assertOk();
        $this->assertEquals(10, $driver->fresh()->metadata['phone_location']['latitude']);
        foreach ([['latitude' => 91], ['longitude' => -181], ['accuracy' => -1], ['observed_at' => now()->addMinutes(5)->toIso8601String()], ['observed_at' => now()->subMinutes(10)->toIso8601String()]] as $bad) {
            $this->postJson('/api/v1/driver/phone-location', array_merge(['latitude' => 10, 'longitude' => 20, 'observed_at' => now()->toIso8601String()], $bad))->assertStatus(422);
        }
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => 'invalid'])->assertStatus(422);
    }

    public function test_foreign_merchant_and_non_drivers_cannot_change_phone_sharing(): void
    {
        [$owner, , , $driver] = $this->context();
        $driver->update(['merchant_id' => Merchant::factory()->create()->id]);
        $this->getJson('/api/v1/driver/location-sharing')->assertForbidden();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertForbidden();
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.driver_merchant', null);
        $this->withHeader('Authorization', 'Bearer '.$owner->createToken('staff')->plainTextToken);
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertForbidden();
    }

    public function test_alert_failure_rolls_back_the_disable(): void
    {
        [, , , $driver] = $this->context();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertOk();
        $this->postJson('/api/v1/conversations/driver')->assertOk();
        $driver->fresh()->load('user');
        \App\Models\Conversation::firstOrFail()->delete();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => false])->assertStatus(410);
        $this->assertTrue($driver->fresh()->metadata['phone_location']['enabled']);
        $this->assertDatabaseCount('messages', 0);
    }
    public function test_reports_have_a_dedicated_driver_limit_and_retry_headers(): void
    {
        [, , $first] = $this->context();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertOk();
        // These numeric-throttled requests used to consume the location-report bucket.
        for ($i = 0; $i < 10; $i++) {
            $this->getJson('/api/v1/driver/position')->assertOk();
        }
        $body = ['latitude' => 0, 'longitude' => 0, 'observed_at' => now()->toIso8601String()];
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/driver/phone-location', $body)->assertOk();
        }
        $blocked = $this->postJson('/api/v1/driver/phone-location', $body)->assertStatus(429)
            ->assertHeader('X-RateLimit-Limit', '10')->assertHeader('Retry-After');
        $this->assertGreaterThan(0, (int) $blocked->headers->get('Retry-After'));
        // A second driver on the same IP has an independent report allowance.
        $this->context();
        $this->patchJson('/api/v1/driver/location-sharing', ['enabled' => true])->assertOk();
        $this->postJson('/api/v1/driver/phone-location', $body)->assertOk();
        $this->withHeader('Authorization', 'Bearer '.$first->createToken('another-device')->plainTextToken);
        $this->postJson('/api/v1/driver/phone-location', $body)->assertStatus(429);
        $this->travel(61)->seconds();
        $body['observed_at'] = now()->toIso8601String();
        $this->postJson('/api/v1/driver/phone-location', $body)->assertOk();
    }

    public function test_global_api_limit_remains_sixty_per_authenticated_user(): void
    {
        $this->context();
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/v1/me')->assertOk();
        }
        $this->getJson('/api/v1/me')->assertStatus(429)->assertHeader('X-RateLimit-Limit', '60');
        $this->context();
        $this->getJson('/api/v1/me')->assertOk();
    }

    public function test_unauthenticated_reports_are_rejected_before_driver_throttling(): void
    {
        $this->withHeader('Authorization', 'Bearer invalid');
        $this->postJson('/api/v1/driver/phone-location')->assertUnauthorized();
    }

}
