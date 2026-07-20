<?php

namespace Tests\Unit;

use App\Services\Integrations\OpenAIService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class OpenAIServiceTest extends TestCase
{
    public function test_it_sends_an_image_with_a_strict_delivery_note_schema(): void
    {
        config()->set('services.openai.api_key', 'test-key');
        config()->set('services.openai.delivery_note_model', 'gpt-5.6-terra');

        $extraction = [
            'delivery_note_number' => 'DN-100',
            'merchant_order_ref' => null,
            'collection_date' => '2026-07-20',
            'pickup_address' => $this->address('Origin'),
            'dropoff_address' => $this->address('Destination'),
            'pickup_instructions' => null,
            'dropoff_instructions' => null,
            'line_items' => [[
                'merchant_order_ref' => 'ORDER-1',
                'description' => 'Widgets',
                'quantity' => 2,
                'type' => 'box',
                'weight' => 10,
                'length_cm' => null,
                'width_cm' => null,
                'height_cm' => null,
            ]],
        ];

        Http::fake([
            'api.openai.com/v1/responses' => Http::response([
                'model' => 'gpt-5.6-terra',
                'output' => [[
                    'content' => [['type' => 'output_text', 'text' => json_encode($extraction)]],
                ]],
            ]),
        ]);

        $result = app(OpenAIService::class)->extractDeliveryNote(UploadedFile::fake()->image('note.png'));

        $this->assertSame('ORDER-1', $result['data']['line_items'][0]['merchant_order_ref']);
        Http::assertSent(function ($request) {
            return $request->url() === 'https://api.openai.com/v1/responses'
                && $request['model'] === 'gpt-5.6-terra'
                && $request['text']['format']['type'] === 'json_schema'
                && $request['text']['format']['strict'] === true
                && $request['input'][0]['content'][1]['type'] === 'input_image';
        });
    }

    public function test_it_fails_cleanly_when_the_api_key_is_missing(): void
    {
        config()->set('services.openai.api_key', null);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('OpenAI API key is not configured.');

        app(OpenAIService::class)->extractDeliveryNote(UploadedFile::fake()->image('note.png'));
    }

    private function address(string $name): array
    {
        return [
            'name' => $name, 'company' => null, 'address_line_1' => '1 Main Road',
            'address_line_2' => null, 'town' => null, 'city' => 'Cape Town',
            'province' => 'Western Cape', 'post_code' => '8000', 'country' => 'ZA',
            'first_name' => null, 'last_name' => null, 'phone' => null,
        ];
    }
}
