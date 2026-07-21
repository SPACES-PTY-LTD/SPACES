<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DeliveryNoteImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_note_can_be_analyzed_and_confirmed_on_an_in_progress_run(): void
    {
        Storage::fake('local');
        config()->set('filesystems.default', 'local');
        config()->set('services.openai.api_key', 'test-key');

        Http::fake([
            'api.openai.com/v1/responses' => Http::response([
                'model' => 'gpt-5.6-terra',
                'output' => [[
                    'content' => [[
                        'type' => 'output_text',
                        'text' => json_encode($this->extraction()),
                    ]],
                ]],
            ]),
        ]);

        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);
        $run = Run::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'status' => Run::STATUS_IN_PROGRESS,
        ]);

        $analysis = $this->apiAs($user)->post(
            "/api/v1/runs/{$run->uuid}/delivery-note-imports",
            ['file' => UploadedFile::fake()->image('delivery-note.png')]
        );

        $analysis->assertCreated()
            ->assertJsonPath('data.status', 'analyzed')
            ->assertJsonPath('data.grouping_mode', 'separate_shipments')
            ->assertJsonPath('data.extracted_data.line_items.1.merchant_order_ref', 'ORDER-2');

        $importId = $analysis->json('data.import_id');
        $confirmation = $this->apiAs($user)->postJson(
            "/api/v1/runs/{$run->uuid}/delivery-note-imports/{$importId}/confirm",
            ['grouping_mode' => 'separate_shipments', ...$this->extraction()]
        );

        $confirmation->assertOk()
            ->assertJsonCount(2, 'data.shipment_ids')
            ->assertJsonPath('data.run.shipment_count', 2);

        $this->assertDatabaseHas('shipments', [
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-1',
            'delivery_note_number' => 'DN-100',
            'auto_assign' => false,
        ]);
        $this->assertDatabaseCount('delivery_note_import_shipments', 2);
        $this->assertDatabaseHas('run_shipments', [
            'run_id' => $run->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('delivery_note_imports', [
            'uuid' => $importId,
            'status' => 'confirmed',
        ]);

        $repeat = $this->apiAs($user)->postJson(
            "/api/v1/runs/{$run->uuid}/delivery-note-imports/{$importId}/confirm",
            ['grouping_mode' => 'separate_shipments', ...$this->extraction()]
        );
        $repeat->assertOk()
            ->assertJsonPath('data.already_confirmed', true)
            ->assertJsonCount(2, 'data.shipment_ids');
        $this->assertDatabaseCount('shipments', 2);
    }

    private function extraction(): array
    {
        return [
            'delivery_note_number' => 'DN-100',
            'merchant_order_ref' => 'ORDER-GROUPED',
            'collection_date' => '2026-07-20',
            'pickup_address' => $this->address('Origin', 'Cape Town'),
            'dropoff_address' => $this->address('Destination', 'Johannesburg'),
            'pickup_instructions' => null,
            'dropoff_instructions' => null,
            'line_items' => [
                $this->line('ORDER-1', 'Widgets'),
                $this->line('ORDER-2', 'Gadgets'),
            ],
        ];
    }

    private function address(string $name, string $city): array
    {
        return [
            'name' => $name,
            'company' => null,
            'address_line_1' => '1 Main Road',
            'address_line_2' => null,
            'town' => null,
            'city' => $city,
            'province' => 'Gauteng',
            'post_code' => '2000',
            'country' => 'ZA',
            'first_name' => null,
            'last_name' => null,
            'phone' => null,
        ];
    }

    private function line(string $reference, string $description): array
    {
        return [
            'merchant_order_ref' => $reference,
            'description' => $description,
            'quantity' => 1,
            'type' => 'box',
            'weight' => 5,
            'length_cm' => null,
            'width_cm' => null,
            'height_cm' => null,
        ];
    }

    private function apiAs(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }
}
