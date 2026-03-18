<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantUserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_holder_can_see_all_merchants_in_their_account_without_explicit_membership(): void
    {
        $accountHolder = User::factory()->create();
        $account = Account::create(['owner_user_id' => $accountHolder->id]);
        $accountHolder->forceFill(['account_id' => $account->id])->save();

        $merchantA = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $accountHolder->id,
            'name' => 'Alpha',
        ]);
        $merchantB = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $accountHolder->id,
            'name' => 'Beta',
        ]);

        $merchantA->users()->syncWithoutDetaching([$accountHolder->id => ['role' => 'account_holder']]);

        $response = $this->actingAs($accountHolder)->getJson('/api/v1/merchants');

        $response->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.access.role', 'account_holder');

        $this->assertEqualsCanonicalizing(
            [$merchantA->uuid, $merchantB->uuid],
            collect($response->json('data'))->pluck('merchant_id')->all()
        );
    }

    public function test_member_can_invite_and_list_users_for_selected_merchant(): void
    {
        $accountHolder = User::factory()->create();
        $account = Account::create(['owner_user_id' => $accountHolder->id]);
        $accountHolder->forceFill(['account_id' => $account->id])->save();

        $member = User::factory()->create(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $accountHolder->id,
        ]);

        $merchant->users()->attach($member->id, ['role' => 'member']);

        $inviteResponse = $this->actingAs($member)->postJson("/api/v1/merchants/{$merchant->uuid}/users", [
            'email' => 'invitee@example.com',
            'role' => 'modifier',
        ]);

        $inviteResponse->assertCreated()
            ->assertJsonPath('data.kind', 'invite')
            ->assertJsonPath('data.role', 'modifier');

        $listResponse = $this->actingAs($member)->getJson("/api/v1/merchants/{$merchant->uuid}/users");

        $listResponse->assertOk();
        $this->assertSame(
            ['invite', 'member', 'member'],
            collect($listResponse->json('data'))->pluck('kind')->sort()->values()->all()
        );
    }

    public function test_modifier_cannot_access_merchant_users_endpoints(): void
    {
        $accountHolder = User::factory()->create();
        $account = Account::create(['owner_user_id' => $accountHolder->id]);
        $accountHolder->forceFill(['account_id' => $account->id])->save();

        $modifier = User::factory()->create(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $accountHolder->id,
        ]);

        $merchant->users()->attach($modifier->id, ['role' => 'modifier']);

        $this->actingAs($modifier)
            ->getJson("/api/v1/merchants/{$merchant->uuid}/users")
            ->assertForbidden();

        $this->actingAs($modifier)
            ->postJson("/api/v1/merchants/{$merchant->uuid}/users", [
                'email' => 'blocked@example.com',
                'role' => 'resource_viewer',
            ])
            ->assertForbidden();
    }
}
