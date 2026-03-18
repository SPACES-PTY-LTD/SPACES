<?php

namespace App\Services;

use App\Models\FileType;
use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class FileTypeService
{
    public function listFileTypes(User $user, Merchant $merchant, array $filters = []): LengthAwarePaginator
    {
        $this->assertMerchantAccess($user, $merchant);

        $query = FileType::query()
            ->with('merchant')
            ->where('merchant_id', $merchant->id)
            ->orderBy('entity_type')
            ->orderBy('sort_order')
            ->orderBy('name');

        if (!empty($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }

        if (array_key_exists('is_active', $filters)) {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min((int) ($filters['per_page'] ?? 50), 200);

        return $query->paginate($perPage);
    }

    public function createFileType(User $user, Merchant $merchant, array $data): FileType
    {
        $this->assertMerchantAccess($user, $merchant);

        $slug = Str::slug($data['slug'] ?? $data['name']);
        if ($slug === '') {
            throw new UnprocessableEntityHttpException('File type slug could not be generated.');
        }

        if (FileType::where('merchant_id', $merchant->id)
            ->where('entity_type', $data['entity_type'])
            ->where('slug', $slug)
            ->exists()) {
            throw new UnprocessableEntityHttpException('A file type with this slug already exists for the selected entity.');
        }

        return FileType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'entity_type' => $data['entity_type'],
            'name' => $data['name'],
            'slug' => $slug,
            'description' => $data['description'] ?? null,
            'requires_expiry' => (bool) ($data['requires_expiry'] ?? false),
            'driver_can_upload' => (bool) ($data['driver_can_upload'] ?? false),
            'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
        ])->load('merchant');
    }

    public function updateFileType(User $user, string $fileTypeUuid, array $data): FileType
    {
        $fileType = FileType::with('merchant')->where('uuid', $fileTypeUuid)->firstOrFail();
        $this->assertMerchantAccess($user, $fileType->merchant);

        if (array_key_exists('name', $data)) {
            $fileType->name = $data['name'];
        }
        if (array_key_exists('entity_type', $data)) {
            $fileType->entity_type = $data['entity_type'];
        }
        if (array_key_exists('description', $data)) {
            $fileType->description = $data['description'];
        }
        if (array_key_exists('requires_expiry', $data)) {
            $fileType->requires_expiry = (bool) $data['requires_expiry'];
        }
        if (array_key_exists('driver_can_upload', $data)) {
            $fileType->driver_can_upload = (bool) $data['driver_can_upload'];
        }
        if (array_key_exists('is_active', $data)) {
            $fileType->is_active = (bool) $data['is_active'];
        }
        if (array_key_exists('sort_order', $data)) {
            $fileType->sort_order = (int) $data['sort_order'];
        }
        if (array_key_exists('slug', $data) || array_key_exists('name', $data) || array_key_exists('entity_type', $data)) {
            $slug = Str::slug($data['slug'] ?? $fileType->slug ?? $fileType->name);
            if ($slug === '') {
                throw new UnprocessableEntityHttpException('File type slug could not be generated.');
            }
            $exists = FileType::where('merchant_id', $fileType->merchant_id)
                ->where('entity_type', $fileType->entity_type)
                ->where('slug', $slug)
                ->whereKeyNot($fileType->id)
                ->exists();
            if ($exists) {
                throw new UnprocessableEntityHttpException('A file type with this slug already exists for the selected entity.');
            }
            $fileType->slug = $slug;
        }

        $fileType->save();

        return $fileType->fresh('merchant');
    }

    public function listDriverUploadTypes(User $user, ?string $entityType = null): array
    {
        $driver = $user->driver()->firstOrFail();

        $query = FileType::query()
            ->where('merchant_id', $driver->merchant_id)
            ->where('driver_can_upload', true)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($entityType) {
            $query->where('entity_type', $entityType);
        }

        return $query->get()->all();
    }

    private function assertMerchantAccess(User $user, Merchant $merchant): void
    {
        if ($user->role === 'super_admin') {
            return;
        }

        if (!MerchantAccess::canViewResources($user, $merchant)) {
            throw new AccessDeniedHttpException('You are not authorized to access this merchant.');
        }
    }
}
