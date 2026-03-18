<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\EntityFile;
use App\Models\FileType;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Support\MerchantAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class EntityFileService
{
    public function listExpiredFiles(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = $this->scopedQuery($user)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->orderByDesc('expires_at')
            ->orderByDesc('created_at');

        if (!empty($filters['merchant_id'])) {
            $merchantId = Merchant::query()->where('uuid', $filters['merchant_id'])->value('id');
            if ($merchantId) {
                $query->where('merchant_id', $merchantId);
            } else {
                $query->whereRaw('1=0');
            }
        }

        $perPage = min((int) ($filters['per_page'] ?? 10), 100);

        return $query->paginate($perPage);
    }

    public function listShipmentFiles(User $user, string $shipmentUuid): LengthAwarePaginator
    {
        $shipment = Shipment::with('merchant')->where('uuid', $shipmentUuid)->firstOrFail();
        $this->assertShipmentAccess($user, $shipment);

        return $this->listForAttachable($shipment, $shipment->merchant_id);
    }

    public function uploadShipmentFile(User $user, string $shipmentUuid, array $data): EntityFile
    {
        $shipment = Shipment::with('merchant')->where('uuid', $shipmentUuid)->firstOrFail();
        $this->assertShipmentAccess($user, $shipment);

        return $this->storeForAttachable(
            actor: $user,
            attachable: $shipment,
            merchant: $shipment->merchant,
            fileTypeUuid: $data['file_type_id'],
            uploadedFile: $data['file'],
            expiresAt: $data['expires_at'] ?? null,
            isDriverUpload: $user->role === 'driver'
        );
    }

    public function listOwnDriverShipmentFiles(User $user, string $shipmentUuid): LengthAwarePaginator
    {
        $shipment = Shipment::with('merchant')->where('uuid', $shipmentUuid)->firstOrFail();
        $this->assertShipmentAccess($user, $shipment);

        return $this->listForAttachable($shipment, $shipment->merchant_id);
    }

    public function uploadOwnDriverShipmentFile(User $user, string $shipmentUuid, array $data): EntityFile
    {
        $shipment = Shipment::with('merchant')->where('uuid', $shipmentUuid)->firstOrFail();
        $this->assertShipmentAccess($user, $shipment);

        return $this->storeForAttachable(
            actor: $user,
            attachable: $shipment,
            merchant: $shipment->merchant,
            fileTypeUuid: $data['file_type_id'],
            uploadedFile: $data['file'],
            expiresAt: $data['expires_at'] ?? null,
            isDriverUpload: true
        );
    }

    public function listDriverFiles(User $user, string $driverUuid): LengthAwarePaginator
    {
        $driver = Driver::with('merchant', 'user')->where('uuid', $driverUuid)->firstOrFail();
        $this->assertDriverAccess($user, $driver);

        return $this->listForAttachable($driver, $driver->merchant_id);
    }

    public function uploadDriverFile(User $user, string $driverUuid, array $data): EntityFile
    {
        $driver = Driver::with('merchant', 'user')->where('uuid', $driverUuid)->firstOrFail();
        $this->assertDriverAccess($user, $driver);

        return $this->storeForAttachable(
            actor: $user,
            attachable: $driver,
            merchant: $driver->merchant,
            fileTypeUuid: $data['file_type_id'],
            uploadedFile: $data['file'],
            expiresAt: $data['expires_at'] ?? null,
            isDriverUpload: $user->role === 'driver'
        );
    }

    public function listVehicleFiles(User $user, Merchant $merchant, string $vehicleUuid): LengthAwarePaginator
    {
        $this->assertMerchantAccess($user, $merchant);
        $vehicle = Vehicle::where('uuid', $vehicleUuid)->where('account_id', $merchant->account_id)->firstOrFail();

        return $this->listForAttachable($vehicle, $merchant->id);
    }

    public function uploadVehicleFile(User $user, Merchant $merchant, string $vehicleUuid, array $data): EntityFile
    {
        $this->assertMerchantAccess($user, $merchant);
        $vehicle = Vehicle::where('uuid', $vehicleUuid)->where('account_id', $merchant->account_id)->firstOrFail();

        return $this->storeForAttachable(
            actor: $user,
            attachable: $vehicle,
            merchant: $merchant,
            fileTypeUuid: $data['file_type_id'],
            uploadedFile: $data['file'],
            expiresAt: $data['expires_at'] ?? null
        );
    }

    public function downloadForUser(User $user, string $fileUuid): array
    {
        $entityFile = EntityFile::with(['fileType', 'merchant', 'attachable'])->where('uuid', $fileUuid)->firstOrFail();
        $this->assertEntityFileAccess($user, $entityFile);

        return $this->resolveDownloadPayload($entityFile);
    }

    public function deleteForUser(User $user, string $fileUuid): void
    {
        $entityFile = EntityFile::with(['merchant', 'attachable'])->where('uuid', $fileUuid)->firstOrFail();
        $this->assertEntityFileAccess($user, $entityFile);

        Storage::disk($entityFile->disk)->delete($entityFile->path);
        $entityFile->delete();
    }

    public function listOwnDriverFiles(User $user): LengthAwarePaginator
    {
        $driver = $user->driver()->with('merchant')->firstOrFail();

        return $this->listForAttachable($driver, $driver->merchant_id);
    }

    public function uploadOwnDriverFile(User $user, array $data): EntityFile
    {
        $driver = $user->driver()->with('merchant')->firstOrFail();

        return $this->storeForAttachable(
            actor: $user,
            attachable: $driver,
            merchant: $driver->merchant,
            fileTypeUuid: $data['file_type_id'],
            uploadedFile: $data['file'],
            expiresAt: $data['expires_at'] ?? null,
            isDriverUpload: true
        );
    }

    private function listForAttachable(Model $attachable, int $merchantId): LengthAwarePaginator
    {
        return EntityFile::query()
            ->with(['fileType', 'merchant', 'uploadedBy'])
            ->where('merchant_id', $merchantId)
            ->where('attachable_type', $attachable::class)
            ->where('attachable_id', $attachable->getKey())
            ->orderByDesc('created_at')
            ->paginate(50);
    }

    private function scopedQuery(User $user)
    {
        $query = EntityFile::query()->with(['fileType', 'merchant', 'uploadedBy', 'attachable']);

        if ($user->role === 'super_admin') {
            return $query;
        }

        return MerchantAccess::scopeToMerchants($query, $user);
    }

    private function storeForAttachable(
        User $actor,
        Model $attachable,
        Merchant $merchant,
        string $fileTypeUuid,
        UploadedFile $uploadedFile,
        ?string $expiresAt = null,
        bool $isDriverUpload = false
    ): EntityFile {
        $fileType = FileType::query()
            ->where('uuid', $fileTypeUuid)
            ->where('merchant_id', $merchant->id)
            ->where('is_active', true)
            ->firstOrFail();

        $expectedEntityType = $this->resolveEntityTypeForAttachable($attachable);
        if ($fileType->entity_type !== $expectedEntityType) {
            throw new ConflictHttpException('The selected file type does not belong to this entity.');
        }

        if ($isDriverUpload) {
            if (!$fileType->driver_can_upload) {
                throw new AccessDeniedHttpException('Drivers are not allowed to upload this file type.');
            }
        }

        $resolvedExpiresAt = null;
        if ($fileType->requires_expiry) {
            if (!$expiresAt) {
                throw new UnprocessableEntityHttpException('This file type requires an expiry date.');
            }
            $resolvedExpiresAt = Carbon::parse($expiresAt);
        } elseif ($expiresAt) {
            $resolvedExpiresAt = Carbon::parse($expiresAt);
        }

        $disk = config('filesystems.default', 'local');
        $extension = $uploadedFile->getClientOriginalExtension();
        $filename = (string) Str::uuid().($extension ? '.'.$extension : '');
        $path = sprintf(
            'entity-files/%s/%s/%s/%s',
            $merchant->uuid,
            $expectedEntityType,
            method_exists($attachable, 'getAttribute') ? $attachable->getAttribute('uuid') : $attachable->getKey(),
            $filename
        );

        Storage::disk($disk)->putFileAs(
            dirname($path),
            $uploadedFile,
            basename($path),
            ['visibility' => 'private']
        );

        return EntityFile::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'file_type_id' => $fileType->id,
            'attachable_type' => $attachable::class,
            'attachable_id' => $attachable->getKey(),
            'uploaded_by_user_id' => $actor->id,
            'uploaded_by_role' => $actor->role,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $uploadedFile->getClientOriginalName(),
            'mime_type' => $uploadedFile->getClientMimeType(),
            'size_bytes' => (int) $uploadedFile->getSize(),
            'expires_at' => $resolvedExpiresAt,
        ])->load(['fileType', 'merchant', 'uploadedBy']);
    }

    private function resolveDownloadPayload(EntityFile $entityFile): array
    {
        $disk = Storage::disk($entityFile->disk);

        if (method_exists($disk, 'providesTemporaryUrls') && $disk->providesTemporaryUrls()) {
            return [
                'type' => 'redirect',
                'url' => $disk->temporaryUrl($entityFile->path, now()->addMinutes(5)),
            ];
        }

        if (!$disk->exists($entityFile->path)) {
            throw new NotFoundHttpException('The requested file could not be found.');
        }

        return [
            'type' => 'download',
            'disk' => $entityFile->disk,
            'path' => $entityFile->path,
            'name' => $entityFile->original_name,
            'mime_type' => $entityFile->mime_type,
        ];
    }

    private function assertShipmentAccess(User $user, Shipment $shipment): void
    {
        if ($user->role === 'super_admin') {
            return;
        }

        if ($user->role === 'driver') {
            $driver = $user->driver;
            if (!$driver) {
                throw new AccessDeniedHttpException('Driver profile not found.');
            }

            $isAssigned = $shipment->currentRunShipment()
                ->whereHas('run', function ($query) use ($driver) {
                    $query->where('driver_id', $driver->id);
                })
                ->exists();

            if (!$isAssigned) {
                throw new AccessDeniedHttpException('Drivers can only access shipment files for assigned shipments.');
            }

            return;
        }

        if (!MerchantAccess::canViewResources($user, $shipment->merchant)) {
            throw new AccessDeniedHttpException('You are not authorized to access this shipment.');
        }
    }

    private function assertDriverAccess(User $user, Driver $driver): void
    {
        if ($user->role === 'super_admin') {
            return;
        }

        if ($user->role === 'driver') {
            if ($user->driver?->id !== $driver->id) {
                throw new AccessDeniedHttpException('Drivers can only access their own files.');
            }

            return;
        }

        if (!MerchantAccess::canViewResources($user, $driver->merchant)) {
            throw new AccessDeniedHttpException('You are not authorized to access this driver.');
        }
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

    private function assertEntityFileAccess(User $user, EntityFile $entityFile): void
    {
        $attachable = $entityFile->attachable;
        if ($attachable instanceof Shipment) {
            $attachable->loadMissing('merchant');
            $this->assertShipmentAccess($user, $attachable);

            return;
        }

        if ($attachable instanceof Driver) {
            $attachable->loadMissing('merchant', 'user');
            $this->assertDriverAccess($user, $attachable);

            return;
        }

        if ($attachable instanceof Vehicle) {
            $entityFile->loadMissing('merchant');
            $this->assertMerchantAccess($user, $entityFile->merchant);

            return;
        }

        throw new AccessDeniedHttpException('Unsupported file attachment type.');
    }

    private function resolveEntityTypeForAttachable(Model $attachable): string
    {
        return match ($attachable::class) {
            Shipment::class => FileType::ENTITY_SHIPMENT,
            Driver::class => FileType::ENTITY_DRIVER,
            Vehicle::class => FileType::ENTITY_VEHICLE,
            default => throw new UnprocessableEntityHttpException('Unsupported file attachment type.'),
        };
    }
}
