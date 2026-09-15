<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Run;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdditionalCostsTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
        $merchant->users()->attach($user, ['role' => 'owner']);
        $location = Location::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'name' => 'Depot', 'address_line_1' => '1 Test Street', 'city' => 'Cape Town', 'province' => 'Western Cape', 'post_code' => '8001']);
        $run = Run::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'status' => Run::STATUS_COMPLETED]);
        $this->asUser($user);

        return [$user, $merchant, $location, $run];
    }

    private function asUser(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('cost-tests')->plainTextToken);
    }

    public function test_completed_run_costs_can_be_created_edited_removed_and_audited(): void
    {
        [$user, , , $run] = $this->context();
        $url = "/api/v1/runs/{$run->uuid}/additional-costs";
        $response = $this->postJson($url, ['source' => 'manual', 'title' => 'Parking', 'amount' => '10.10'])
            ->assertCreated()->assertJsonPath('data.additional_cost_totals.0.amount', '10.10');
        $id = $response->json('data.additional_costs.0.cost_id');
        $this->patchJson("$url/$id", ['title' => 'Overnight parking', 'amount' => '12.30'])->assertOk()
            ->assertJsonPath('data.additional_costs.0.title', 'Overnight parking');
        $this->getJson("/api/v1/runs/{$run->uuid}")->assertOk()->assertJsonPath('data.additional_cost_totals.0.amount', '12.30');
        $this->deleteJson("$url/$id")->assertOk()->assertJsonCount(0, 'data.additional_costs');
        $this->assertSoftDeleted('run_costs', ['uuid' => $id]);
        $this->assertDatabaseHas('run_costs', ['uuid' => $id, 'created_by' => $user->id, 'updated_by' => $user->id]);
        $this->assertSame(3, ActivityLog::where('entity_type', 'run')->where('entity_uuid', $run->uuid)->where('action', 'like', 'additional_cost_%')->count());
        $this->assertSame(Run::STATUS_COMPLETED, $run->fresh()->status);
    }

    public function test_geofence_snapshots_and_mixed_currency_totals_survive_configuration_changes(): void
    {
        [, $merchant, $location, $run] = $this->context();
        $locUrl = "/api/v1/locations/{$location->uuid}/additional-costs";
        $runUrl = "/api/v1/runs/{$run->uuid}/additional-costs";
        $id = $this->postJson($locUrl, ['title' => 'Gate', 'amount' => '0.10'])->assertCreated()->json('data.additional_costs.0.cost_id');
        $this->postJson($runUrl, ['source' => 'geofence', 'location_cost_id' => $id])->assertCreated()
            ->assertJsonPath('data.additional_costs.0.location_name', 'Depot');
        $this->patchJson("$locUrl/$id", ['title' => 'New gate fee', 'amount' => '5.00'])->assertOk();
        $this->patchJson("/api/v1/merchants/{$merchant->uuid}/settings", ['currency' => 'USD'])->assertOk()->assertJsonPath('data.currency', 'USD');
        $this->postJson($locUrl, ['title' => 'USD gate', 'amount' => '2.00'])->assertCreated()
            ->assertJsonPath('data.additional_cost_totals', [['currency' => 'USD', 'amount' => '2.00'], ['currency' => 'ZAR', 'amount' => '5.00']]);
        $this->postJson($runUrl, ['source' => 'manual', 'title' => 'Extra', 'amount' => '0.20'])->assertCreated();
        $this->deleteJson("$locUrl/$id")->assertOk();
        $this->getJson($runUrl)->assertOk()
            ->assertJsonPath('data.additional_costs.0.title', 'Gate')
            ->assertJsonPath('data.additional_cost_totals', [['currency' => 'USD', 'amount' => '0.20'], ['currency' => 'ZAR', 'amount' => '0.10']]);
    }

    public function test_selected_geofence_cost_can_be_overridden_without_changing_configuration(): void
    {
        [, , $location, $run] = $this->context();
        $configured = $location->additionalCosts()->create(['title' => 'Toll', 'amount' => '20.00', 'currency' => 'ZAR']);
        $this->postJson("/api/v1/runs/{$run->uuid}/additional-costs", ['source' => 'geofence', 'location_cost_id' => $configured->uuid, 'title' => 'Reduced toll', 'amount' => '15.00'])
            ->assertCreated()->assertJsonPath('data.additional_costs.0.amount', '15.00');
        $this->assertSame('20.0000', $configured->fresh()->amount);
    }

    public function test_money_validation_and_currency_precision(): void
    {
        [, $merchant, $location] = $this->context();
        $url = "/api/v1/locations/{$location->uuid}/additional-costs";
        foreach (['-1', '1.001', '1e3', '10000000000', '', '1,00', 1.25] as $amount) {
            $this->postJson($url, ['title' => 'Cost', 'amount' => $amount])->assertUnprocessable();
        }
        $this->postJson($url, ['title' => ' ', 'amount' => '1.00'])->assertUnprocessable();
        $this->postJson($url, ['title' => 'Cost', 'amount' => '1.00', 'currency' => 'USD'])->assertUnprocessable();
        $this->patchJson("/api/v1/merchants/{$merchant->uuid}/settings", ['currency' => 'XYZ'])->assertUnprocessable();
        $merchant->update(['currency' => 'JPY']);
        $this->postJson($url, ['title' => 'JPY', 'amount' => '1.1'])->assertUnprocessable();
        $this->postJson($url, ['title' => 'JPY', 'amount' => '0'])->assertCreated()->assertJsonPath('data.additional_cost_totals.0.amount', '0');
        $merchant->update(['currency' => 'KWD']);
        $this->postJson($url, ['title' => 'KWD', 'amount' => '1.123'])->assertCreated();
    }

    public function test_costs_cannot_cross_merchants_parents_or_environments(): void
    {
        [$user, $merchant, $location, $run] = $this->context();
        [, , $otherLocation, $otherRun] = $this->context();
        $configured = $otherLocation->additionalCosts()->create(['title' => 'Other', 'amount' => '1.00', 'currency' => 'ZAR']);
        $otherCost = $otherRun->additionalCosts()->create(['source' => 'manual', 'title' => 'Other', 'amount' => '1.00', 'currency' => 'ZAR']);
        $this->asUser($user);
        $url = "/api/v1/runs/{$run->uuid}/additional-costs";
        $this->getJson("/api/v1/runs/{$otherRun->uuid}/additional-costs")->assertForbidden();
        $this->getJson("/api/v1/locations/{$otherLocation->uuid}/additional-costs")->assertForbidden();
        $this->postJson($url, ['source' => 'geofence', 'location_cost_id' => $configured->uuid])->assertNotFound();
        $this->patchJson("$url/{$otherCost->uuid}", ['amount' => '2.00'])->assertNotFound();
        $environment = MerchantEnvironment::create(['merchant_id' => $merchant->id, 'account_id' => $merchant->account_id, 'name' => 'Other environment', 'color' => '#ffffff', 'url' => 'https://example.test', 'token_hash' => hash('sha256', 'test-token')]);
        $location->update(['environment_id' => $environment->id]);
        $configured = $location->additionalCosts()->create(['title' => 'Other environment', 'amount' => '1.00', 'currency' => 'ZAR']);
        $this->postJson($url, ['source' => 'geofence', 'location_cost_id' => $configured->uuid])->assertNotFound();
    }

    public function test_viewers_cannot_edit_and_modifiers_cannot_delete(): void
    {
        [, $merchant, $location, $run] = $this->context();
        $viewer = User::factory()->create(['account_id' => $merchant->account_id, 'role' => 'user']);
        $merchant->users()->attach($viewer, ['role' => 'read_only']);
        $this->asUser($viewer);
        foreach (["runs/{$run->uuid}", "locations/{$location->uuid}"] as $parent) {
            $this->getJson("/api/v1/$parent/additional-costs")->assertOk()->assertJsonPath('data.can_edit', false);
            $this->postJson("/api/v1/$parent/additional-costs", ['source' => 'manual', 'title' => 'Cost', 'amount' => '1.00'])->assertForbidden();
        }
        $merchant->users()->updateExistingPivot($viewer, ['role' => 'developer']);
        $url = "/api/v1/runs/{$run->uuid}/additional-costs";
        $id = $this->postJson($url, ['source' => 'manual', 'title' => 'Cost', 'amount' => '1.00'])->assertCreated()->json('data.additional_costs.0.cost_id');
        $this->deleteJson("$url/$id")->assertForbidden();
    }

    public function test_list_resources_include_exact_cost_totals_and_no_costs_default(): void
    {
        [, $merchant, $location, $run] = $this->context();
        $this->assertSame('ZAR', $merchant->fresh()->currency);
        $url = "/api/v1/locations/{$location->uuid}/additional-costs";
        $this->getJson($url)->assertOk()->assertJsonPath('data.additional_cost_totals', []);
        foreach (['0.10', '0.20'] as $amount) {
            $this->postJson($url, ['title' => 'Cost', 'amount' => $amount])->assertCreated();
            $run->additionalCosts()->create(['source' => 'manual', 'title' => 'Cost', 'amount' => $amount, 'currency' => 'ZAR']);
        }
        $this->getJson("/api/v1/locations?merchant_id={$merchant->uuid}")->assertOk()->assertJsonPath('data.0.additional_cost_totals.0.amount', '0.30');
        $this->getJson("/api/v1/runs?merchant_id={$merchant->uuid}")->assertOk()->assertJsonPath('data.0.additional_cost_totals.0.amount', '0.30');
    }
}
