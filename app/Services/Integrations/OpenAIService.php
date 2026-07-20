<?php

namespace App\Services\Integrations;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAIService
{
    public function extractDeliveryNote(UploadedFile $file): array
    {
        $apiKey = (string) config('services.openai.api_key');
        if ($apiKey === '') {
            throw new RuntimeException('OpenAI API key is not configured.');
        }

        $model = (string) config('services.openai.delivery_note_model', 'gpt-5.6-terra');
        $bytes = file_get_contents($file->getRealPath());
        if ($bytes === false) {
            throw new RuntimeException('Unable to read the uploaded delivery note.');
        }

        $mime = (string) $file->getMimeType();
        $isPdf = $mime === 'application/pdf';
        $content = [
            [
                'type' => 'input_text',
                'text' => 'Extract the delivery note into the required schema. Preserve printed references exactly. Use ISO 8601 dates when a date is visible. Never invent missing addresses, dates, quantities, weights, dimensions, contacts, or references; return null for uncertainty. Each printed product/order row must be a separate line_items entry.',
            ],
            $isPdf
                ? [
                    'type' => 'input_file',
                    'filename' => $file->getClientOriginalName(),
                    'file_data' => 'data:application/pdf;base64,'.base64_encode($bytes),
                ]
                : [
                    'type' => 'input_image',
                    'image_url' => 'data:'.$mime.';base64,'.base64_encode($bytes),
                    'detail' => 'high',
                ],
        ];

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout((int) config('services.openai.timeout', 90))
            ->post(rtrim((string) config('services.openai.base_url', 'https://api.openai.com'), '/').'/v1/responses', [
                'model' => $model,
                'instructions' => 'You extract logistics delivery notes. Return only data matching the supplied JSON schema.',
                'input' => [['role' => 'user', 'content' => $content]],
                'max_output_tokens' => (int) config('services.openai.delivery_note_max_output_tokens', 4000),
                'text' => [
                    'format' => [
                        'type' => 'json_schema',
                        'name' => 'delivery_note_extraction',
                        'strict' => true,
                        'schema' => $this->schema(),
                    ],
                ],
            ])
            ->throw()
            ->json();

        $outputText = collect($response['output'] ?? [])
            ->flatMap(fn (array $item) => $item['content'] ?? [])
            ->first(fn (array $item) => ($item['type'] ?? null) === 'output_text')['text'] ?? null;
        if (! is_string($outputText) || $outputText === '') {
            throw new RuntimeException('OpenAI returned no delivery-note extraction.');
        }

        $data = json_decode($outputText, true, 512, JSON_THROW_ON_ERROR);

        return ['model' => $response['model'] ?? $model, 'data' => $data];
    }

    private function schema(): array
    {
        $nullableString = ['type' => ['string', 'null']];
        $addressProperties = [
            'name' => $nullableString, 'company' => $nullableString,
            'address_line_1' => $nullableString, 'address_line_2' => $nullableString,
            'town' => $nullableString, 'city' => $nullableString,
            'province' => $nullableString, 'post_code' => $nullableString,
            'country' => $nullableString, 'first_name' => $nullableString,
            'last_name' => $nullableString, 'phone' => $nullableString,
        ];
        $address = [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => $addressProperties,
            'required' => array_keys($addressProperties),
        ];
        $lineProperties = [
            'merchant_order_ref' => $nullableString,
            'description' => $nullableString,
            'quantity' => ['type' => ['integer', 'null']],
            'type' => $nullableString,
            'weight' => ['type' => ['number', 'null']],
            'length_cm' => ['type' => ['number', 'null']],
            'width_cm' => ['type' => ['number', 'null']],
            'height_cm' => ['type' => ['number', 'null']],
        ];
        $properties = [
            'delivery_note_number' => $nullableString,
            'merchant_order_ref' => $nullableString,
            'collection_date' => $nullableString,
            'pickup_address' => $address,
            'dropoff_address' => $address,
            'pickup_instructions' => $nullableString,
            'dropoff_instructions' => $nullableString,
            'line_items' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'properties' => $lineProperties,
                    'required' => array_keys($lineProperties),
                ],
            ],
        ];

        return [
            'type' => 'object',
            'additionalProperties' => false,
            'properties' => $properties,
            'required' => array_keys($properties),
        ];
    }
}
