<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\FileType;
use App\Models\Merchant;
use App\Models\User;
use Database\Seeders\MerchantFileTypeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantFileTypeSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_adds_default_file_types_to_every_merchant(): void
    {
        $firstMerchant = $this->createMerchant('First Merchant');
        $secondMerchant = $this->createMerchant('Second Merchant');

        $this->seed(MerchantFileTypeSeeder::class);

        foreach ([$firstMerchant, $secondMerchant] as $merchant) {
            $this->assertSame(16, FileType::where('merchant_id', $merchant->id)->count());
            $this->assertSame(7, FileType::where('merchant_id', $merchant->id)->where('entity_type', FileType::ENTITY_VEHICLE)->count());
            $this->assertSame(5, FileType::where('merchant_id', $merchant->id)->where('entity_type', FileType::ENTITY_DRIVER)->count());
            $this->assertSame(4, FileType::where('merchant_id', $merchant->id)->where('entity_type', FileType::ENTITY_SHIPMENT)->count());

            $this->assertDatabaseHas('file_types', [
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'entity_type' => FileType::ENTITY_DRIVER,
                'slug' => 'drivers-licence',
                'requires_expiry' => true,
                'driver_can_upload' => true,
                'is_active' => true,
            ]);
            $this->assertDatabaseHas('file_types', [
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'entity_type' => FileType::ENTITY_SHIPMENT,
                'slug' => 'invoice',
                'requires_expiry' => false,
                'driver_can_upload' => false,
                'is_active' => true,
            ]);
        }
    }

    public function test_it_does_not_duplicate_or_overwrite_an_existing_file_type(): void
    {
        $merchant = $this->createMerchant('Configured Merchant');
        FileType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Custom Vehicle Licence',
            'slug' => 'vehicle-licence-disc',
            'description' => 'Merchant-specific configuration.',
            'requires_expiry' => false,
            'driver_can_upload' => false,
            'is_active' => false,
            'sort_order' => 999,
        ]);

        $this->seed(MerchantFileTypeSeeder::class);
        $this->seed(MerchantFileTypeSeeder::class);

        $this->assertSame(16, FileType::where('merchant_id', $merchant->id)->count());
        $this->assertSame(1, FileType::where('merchant_id', $merchant->id)->where('slug', 'vehicle-licence-disc')->count());
        $this->assertDatabaseHas('file_types', [
            'merchant_id' => $merchant->id,
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Custom Vehicle Licence',
            'slug' => 'vehicle-licence-disc',
            'description' => 'Merchant-specific configuration.',
            'requires_expiry' => false,
            'is_active' => false,
            'sort_order' => 999,
        ]);
    }

    public function test_it_treats_a_soft_deleted_file_type_as_existing(): void
    {
        $merchant = $this->createMerchant('Deleted Type Merchant');
        $fileType = FileType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'entity_type' => FileType::ENTITY_DRIVER,
            'name' => 'Identity Document',
            'slug' => 'identity-document',
            'description' => null,
            'requires_expiry' => false,
            'driver_can_upload' => true,
            'is_active' => true,
            'sort_order' => 30,
        ]);
        $fileType->delete();

        $this->seed(MerchantFileTypeSeeder::class);

        $this->assertSame(16, FileType::withTrashed()->where('merchant_id', $merchant->id)->count());
        $this->assertSame(1, FileType::onlyTrashed()->whereKey($fileType->id)->count());
    }

    private function createMerchant(string $name): Merchant
    {
        $owner = User::factory()->create();
        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->forceFill(['account_id' => $account->id])->save();

        return Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $owner->id,
            'name' => $name,
        ]);
    }
}
