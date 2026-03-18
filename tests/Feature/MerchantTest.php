<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\LocationType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MerchantTest extends TestCase
{
    use RefreshDatabase;

    public function test_merchant_creation_and_scoping(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $response = $this->actingAs($userA)
            ->postJson('/api/v1/merchants', [
                'name' => 'Acme Logistics',
            ]);

        $response->assertStatus(201);

        $listA = $this->actingAs($userA)->getJson('/api/v1/merchants');
        $listA->assertStatus(200);
        $this->assertCount(1, $listA->json('data'));

        $listB = $this->actingAs($userB)->getJson('/api/v1/merchants');
        $listB->assertStatus(200);
        $this->assertCount(0, $listB->json('data'));
    }

    public function test_super_admin_can_list_all_merchants(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        Merchant::factory()->create(['name' => 'M1']);
        Merchant::factory()->create(['name' => 'M2']);

        $list = $this->actingAs($admin)->getJson('/api/v1/admin/merchants');
        $list->assertStatus(200);
        $this->assertGreaterThanOrEqual(2, $list->json('meta.total'));
    }

    public function test_merchant_settings_can_be_updated(): void
    {
        $owner = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $owner->id,
            'account_id' => $owner->account_id,
        ]);
        $merchant->users()->attach($owner->id, ['role' => 'owner']);

        $response = $this->actingAs($owner)
            ->patchJson("/api/v1/merchants/{$merchant->uuid}/settings", [
                'timezone' => 'Africa/Johannesburg',
                'operating_countries' => ['za', 'BW'],
                'setup_completed_at' => '2026-02-27T10:00:00Z',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.timezone', 'Africa/Johannesburg')
            ->assertJsonPath('data.operating_countries.0', 'ZA')
            ->assertJsonPath('data.operating_countries.1', 'BW')
            ->assertJsonPath('data.setup_completed_at', '2026-02-27T12:00:00+02:00');

        $this->assertDatabaseHas('merchants', [
            'id' => $merchant->id,
            'timezone' => 'Africa/Johannesburg',
            'setup_completed_at' => '2026-02-27 10:00:00',
        ]);
    }

    public function test_merchant_created_at_is_returned_in_merchant_timezone(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-02-17 08:00:00', 'UTC'));
        try {
            $owner = User::factory()->create();
            $merchant = Merchant::factory()->create([
                'owner_user_id' => $owner->id,
                'account_id' => $owner->account_id,
                'timezone' => 'Africa/Johannesburg',
            ]);
            $merchant->users()->attach($owner->id, ['role' => 'owner']);

            $response = $this->actingAs($owner)->getJson("/api/v1/merchants/{$merchant->uuid}");

            $response->assertStatus(200)
                ->assertJsonPath('data.created_at', '2026-02-17T10:00:00+02:00')
                ->assertJsonPath('data.timezone', 'Africa/Johannesburg');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_merchant_location_automation_can_be_updated_and_fetched(): void
    {
        $owner = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $owner->id,
            'account_id' => $owner->account_id,
        ]);
        $merchant->users()->attach($owner->id, ['role' => 'owner']);

        $siteType = LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'slug' => 'site',
            'title' => 'Site',
            'collection_point' => true,
            'delivery_point' => true,
            'sequence' => 1,
            'icon' => 'map-pin',
            'color' => '#10B981',
            'default' => false,
        ]);

        $patch = $this->actingAs($owner)
            ->patchJson("/api/v1/merchants/{$merchant->uuid}/location-automation", [
                'enabled' => true,
                'location_types' => [
                    [
                        'location_type_id' => $siteType->uuid,
                        'entry' => [
                            [
                                'id' => 'entry-action-1',
                                'action' => 'record_vehicle_entry',
                                'conditions' => [
                                    [
                                        'id' => 'condition-1',
                                        'field' => 'has_active_run',
                                        'operator' => 'equals',
                                        'value' => 'true',
                                    ],
                                ],
                            ],
                        ],
                        'exit' => [
                            [
                                'id' => 'exit-action-1',
                                'action' => 'record_vehicle_exit',
                                'conditions' => [],
                            ],
                        ],
                    ],
                ],
            ]);

        $patch->assertStatus(200)
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.location_types.0.location_type_id', $siteType->uuid)
            ->assertJsonPath('data.location_types.0.location_type_name', 'Site')
            ->assertJsonPath('data.location_types.0.entry.0.action', 'record_vehicle_entry')
            ->assertJsonPath('data.location_types.0.exit.0.action', 'record_vehicle_exit');

        $merchant->refresh();

        $this->assertTrue($merchant->allow_auto_shipment_creations_at_locations);
        $this->assertSame([
            'location_types' => [
                [
                    'location_type_id' => $siteType->uuid,
                    'location_type_name' => 'Site',
                    'location_type_slug' => 'site',
                    'location_type_icon' => 'map-pin',
                    'location_type_color' => '#10B981',
                    'entry' => [
                        [
                            'id' => 'entry-action-1',
                            'action' => 'record_vehicle_entry',
                            'conditions' => [
                                [
                                    'id' => 'condition-1',
                                    'field' => 'has_active_run',
                                    'operator' => 'equals',
                                    'value' => 'true',
                                ],
                            ],
                        ],
                    ],
                    'exit' => [
                        [
                            'id' => 'exit-action-1',
                            'action' => 'record_vehicle_exit',
                            'conditions' => [],
                        ],
                    ],
                ],
            ],
        ], $merchant->location_automation_settings);

        $show = $this->actingAs($owner)
            ->getJson("/api/v1/merchants/{$merchant->uuid}/location-automation");

        $show->assertStatus(200)
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.location_types.0.location_type_name', 'Site')
            ->assertJsonPath('data.location_types.0.entry.0.conditions.0.field', 'has_active_run');
    }

    public function test_merchant_location_automation_rejects_location_types_from_other_merchants(): void
    {
        $owner = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $owner->id,
            'account_id' => $owner->account_id,
        ]);
        $merchant->users()->attach($owner->id, ['role' => 'owner']);

        $otherMerchant = Merchant::factory()->create();
        $foreignLocationType = LocationType::create([
            'account_id' => $otherMerchant->account_id,
            'merchant_id' => $otherMerchant->id,
            'slug' => 'foreign-site',
            'title' => 'Foreign Site',
            'collection_point' => false,
            'delivery_point' => true,
            'sequence' => 1,
            'icon' => 'flag',
            'color' => '#2563EB',
            'default' => false,
        ]);

        $response = $this->actingAs($owner)
            ->patchJson("/api/v1/merchants/{$merchant->uuid}/location-automation", [
                'location_types' => [
                    [
                        'location_type_id' => $foreignLocationType->uuid,
                        'entry' => [],
                        'exit' => [],
                    ],
                ],
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.message', 'All location_type_id values must belong to the route merchant.');
    }
}
