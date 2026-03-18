<?php

namespace App\Services;

use App\Models\TrackingProvider;
use App\Models\TrackingProviderIntegrationFormField;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class TrackingProviderFormFieldService
{
    public function listFields(string $providerUuid, array $filters): LengthAwarePaginator
    {
        $provider = $this->getProvider($providerUuid);

        $query = TrackingProviderIntegrationFormField::query()
            ->with('provider')
            ->where('provider_id', $provider->id)
            ->orderBy('order_id')
            ->orderByDesc('created_at');

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->paginate($perPage);
    }

    public function getField(string $providerUuid, string $fieldUuid): TrackingProviderIntegrationFormField
    {
        $provider = $this->getProvider($providerUuid);

        return TrackingProviderIntegrationFormField::where('provider_id', $provider->id)
            ->where('uuid', $fieldUuid)
            ->with('provider')
            ->firstOrFail();
    }

    public function createField(string $providerUuid, array $data): TrackingProviderIntegrationFormField
    {
        $provider = $this->getProvider($providerUuid);

        return TrackingProviderIntegrationFormField::create([
            'provider_id' => $provider->id,
            'label' => $data['label'],
            'name' => $data['name'],
            'type' => $data['type'],
            'is_required' => $data['is_required'] ?? false,
            'options' => $data['options'] ?? null,
            'order_id' => $data['order_id'] ?? 0,
        ]);
    }

    public function updateField(string $providerUuid, string $fieldUuid, array $data): TrackingProviderIntegrationFormField
    {
        $field = $this->getField($providerUuid, $fieldUuid);
        $field->update($data);

        return $field;
    }

    public function deleteField(string $providerUuid, string $fieldUuid): void
    {
        $field = $this->getField($providerUuid, $fieldUuid);
        $field->delete();
    }

    private function getProvider(string $providerUuid): TrackingProvider
    {
        return TrackingProvider::where('uuid', $providerUuid)->firstOrFail();
    }
}
