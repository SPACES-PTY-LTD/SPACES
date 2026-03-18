<?php

namespace App\Services;

use App\Models\TrackingProvider;
use App\Models\TrackingProviderOption;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class TrackingProviderOptionService
{
    public function listOptions(string $providerUuid, array $filters): LengthAwarePaginator
    {
        $provider = $this->getProvider($providerUuid);

        $query = TrackingProviderOption::query()
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

    public function getOption(string $providerUuid, string $optionUuid): TrackingProviderOption
    {
        $provider = $this->getProvider($providerUuid);

        return TrackingProviderOption::where('provider_id', $provider->id)
            ->where('uuid', $optionUuid)
            ->with('provider')
            ->firstOrFail();
    }

    public function createOption(string $providerUuid, array $data): TrackingProviderOption
    {
        $provider = $this->getProvider($providerUuid);

        return TrackingProviderOption::create([
            'provider_id' => $provider->id,
            'label' => $data['label'],
            'name' => $data['name'],
            'type' => $data['type'],
            'options' => $data['options'] ?? null,
            'order_id' => $data['order_id'] ?? 0,
        ]);
    }

    public function updateOption(string $providerUuid, string $optionUuid, array $data): TrackingProviderOption
    {
        $option = $this->getOption($providerUuid, $optionUuid);
        $option->update($data);

        return $option;
    }

    public function deleteOption(string $providerUuid, string $optionUuid): void
    {
        $option = $this->getOption($providerUuid, $optionUuid);
        $option->delete();
    }

    private function getProvider(string $providerUuid): TrackingProvider
    {
        return TrackingProvider::where('uuid', $providerUuid)->firstOrFail();
    }
}
