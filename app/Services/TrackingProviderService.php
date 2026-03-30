<?php

namespace App\Services;

use App\Models\TrackingProvider;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class TrackingProviderService
{
    public function listProviders(array $filters): LengthAwarePaginator
    {
        $query = TrackingProvider::query()
            ->orderByDesc('created_at')
            ->with(['formFields', 'options']);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['merchant_id'])) {
            $merchantId = Merchant::where('uuid', $filters['merchant_id'])->value('id');
            if ($merchantId) {
                $query->with([
                    'merchantIntegrations' => function ($builder) use ($merchantId) {
                        $builder->where('merchant_id', $merchantId);
                    },
                ]);
                $query->withCount([
                    'merchantIntegrations as activated' => function ($builder) use ($merchantId) {
                        $builder->where('merchant_id', $merchantId);
                    },
                ]);
            } else {
                $query->addSelect(['activated' => MerchantIntegration::selectRaw('0')]);
            }
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->paginate($perPage);
    }

    public function getProvider(string $providerUuid, ?string $merchantUuid = null): TrackingProvider
    {
        $query = TrackingProvider::where('uuid', $providerUuid)
            ->with(['formFields', 'options']);

        if (!empty($merchantUuid)) {
            $merchantId = Merchant::where('uuid', $merchantUuid)->value('id');
            if ($merchantId) {
                $query->with([
                    'merchantIntegrations' => function ($builder) use ($merchantId) {
                        $builder->where('merchant_id', $merchantId);
                    },
                ]);
                $query->withCount([
                    'merchantIntegrations as activated' => function ($builder) use ($merchantId) {
                        $builder->where('merchant_id', $merchantId);
                    },
                ]);
            } else {
                $query->addSelect(['activated' => MerchantIntegration::selectRaw('0')]);
            }
        }

        return $query->firstOrFail();
    }

    public function createProvider(array $data): TrackingProvider
    {
        return TrackingProvider::create([
            'name' => $data['name'],
            'status' => $data['status'] ?? 'active',
            'logo_file_name' => $data['logo_file_name'] ?? null,
            'website' => $data['website'] ?? null,
            'documentation' => $data['documentation'] ?? null,
            'supports_bulk_vehicle_requests' => $data['supports_bulk_vehicle_requests'] ?? false,
            'default_tracking' => $data['default_tracking'] ?? false,
            'has_location_services' => $data['has_location_services'] ?? false,
            'has_driver_importing' => $data['has_driver_importing'] ?? false,
            'has_locations_importing' => $data['has_locations_importing'] ?? false,
            'has_vehicle_importing' => $data['has_vehicle_importing'] ?? false,
        ]);
    }

    public function updateProvider(string $providerUuid, array $data): TrackingProvider
    {
        $provider = $this->getProvider($providerUuid);
        $provider->update($data);

        return $provider;
    }

    public function deleteProvider(string $providerUuid): void
    {
        $provider = $this->getProvider($providerUuid);
        $provider->delete();
    }
}
