<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class LocationWaitingTimeMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_waiting_time_rename_preserves_null_zero_and_positive_values_in_both_directions(): void
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);

        foreach ([null, 0, 45] as $index => $value) {
            DB::table('locations')->insert([
                'uuid' => (string) Str::uuid(),
                'account_id' => $account->id,
                'merchant_id' => $merchant->id,
                'name' => "Migration Location {$index}",
                'address_line_1' => '1 Test Street',
                'city' => 'Cape Town',
                'province' => 'Western Cape',
                'post_code' => '8001',
                'expected_waiting_time' => $value,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $migration = require database_path('migrations/2026_08_29_000002_rename_estimated_waiting_time_to_expected_waiting_time_on_locations_table.php');
        $migration->down();

        try {
            $this->assertTrue(Schema::hasColumn('locations', 'estimated_waiting_time'));
            $this->assertFalse(Schema::hasColumn('locations', 'expected_waiting_time'));
            $this->assertSame(
                [null, 0, 45],
                DB::table('locations')->orderBy('name')->pluck('estimated_waiting_time')->all()
            );
        } finally {
            $migration->up();
        }

        $this->assertTrue(Schema::hasColumn('locations', 'expected_waiting_time'));
        $this->assertFalse(Schema::hasColumn('locations', 'estimated_waiting_time'));
        $this->assertSame(
            [null, 0, 45],
            DB::table('locations')->orderBy('name')->pluck('expected_waiting_time')->all()
        );
    }
}
