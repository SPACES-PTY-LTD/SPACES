<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocationTypeFallbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_configured_default_location_types_when_merchant_has_none(): void
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $merchant = Merchant::withoutEvents(fn () => Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]));
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $response = $this->actingAs($user)
            ->getJson("/api/v1/location-types?merchant_id={$merchant->uuid}");

        $response->assertStatus(200)
            ->assertJsonPath('meta.is_default_fallback', true)
            ->assertJsonPath('data.0.slug', 'depot')
            ->assertJsonPath('data.0.collection_point', true)
            ->assertJsonPath('data.0.delivery_point', false)
            ->assertJsonPath('data.1.slug', 'pickup')
            ->assertJsonPath('data.1.collection_point', true)
            ->assertJsonPath('data.3.slug', 'service')
            ->assertJsonPath('data.3.delivery_point', true)
            ->assertJsonPath('data.2.delivery_point', false)
            ->assertJsonPath('data.0.default', true);

        $this->assertSame(
            ['depot', 'pickup', 'dropoff', 'service', 'waypoint', 'break', 'fuel'],
            array_column($response->json('data'), 'slug')
        );
    }
}
