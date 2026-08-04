<?php

namespace Database\Seeders;

use App\Models\FileType;
use App\Models\Merchant;
use Illuminate\Database\Seeder;

class MerchantFileTypeSeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     entity_type: string,
     *     name: string,
     *     slug: string,
     *     description: string,
     *     requires_expiry: bool,
     *     driver_can_upload: bool,
     *     sort_order: int
     * }>
     */
    private const DEFAULT_FILE_TYPES = [
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Vehicle Licence Disc',
            'slug' => 'vehicle-licence-disc',
            'description' => 'The current licence disc for the vehicle.',
            'requires_expiry' => true,
            'driver_can_upload' => false,
            'sort_order' => 10,
        ],
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Service/Maintenance Record',
            'slug' => 'service-maintenance-record',
            'description' => 'The most recent service or maintenance record for the vehicle.',
            'requires_expiry' => false,
            'driver_can_upload' => false,
            'sort_order' => 20,
        ],
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Brake Test Certificate',
            'slug' => 'brake-test-certificate',
            'description' => 'The current brake test certificate or report for the vehicle.',
            'requires_expiry' => true,
            'driver_can_upload' => false,
            'sort_order' => 30,
        ],
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Certificate of Registration',
            'slug' => 'certificate-of-registration',
            'description' => 'The official certificate of registration for the vehicle.',
            'requires_expiry' => false,
            'driver_can_upload' => false,
            'sort_order' => 40,
        ],
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Certificate of Fitness / Roadworthy Certificate',
            'slug' => 'certificate-of-fitness-roadworthy-certificate',
            'description' => 'The current certificate of fitness or roadworthy certificate for the vehicle.',
            'requires_expiry' => true,
            'driver_can_upload' => false,
            'sort_order' => 50,
        ],
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Insurance Certificate',
            'slug' => 'insurance-certificate',
            'description' => 'The current insurance certificate for the vehicle.',
            'requires_expiry' => true,
            'driver_can_upload' => false,
            'sort_order' => 60,
        ],
        [
            'entity_type' => FileType::ENTITY_VEHICLE,
            'name' => 'Operator Card / Operating Licence',
            'slug' => 'operator-card-operating-licence',
            'description' => 'The current operator card or operating licence for the vehicle.',
            'requires_expiry' => true,
            'driver_can_upload' => false,
            'sort_order' => 70,
        ],
        [
            'entity_type' => FileType::ENTITY_DRIVER,
            'name' => 'Driver\'s Licence',
            'slug' => 'drivers-licence',
            'description' => 'The driver\'s current driving licence.',
            'requires_expiry' => true,
            'driver_can_upload' => true,
            'sort_order' => 10,
        ],
        [
            'entity_type' => FileType::ENTITY_DRIVER,
            'name' => 'Professional Driving Permit (PrDP)',
            'slug' => 'professional-driving-permit-prdp',
            'description' => 'The driver\'s current professional driving permit.',
            'requires_expiry' => true,
            'driver_can_upload' => true,
            'sort_order' => 20,
        ],
        [
            'entity_type' => FileType::ENTITY_DRIVER,
            'name' => 'Identity Document',
            'slug' => 'identity-document',
            'description' => 'The driver\'s national identity document.',
            'requires_expiry' => false,
            'driver_can_upload' => true,
            'sort_order' => 30,
        ],
        [
            'entity_type' => FileType::ENTITY_DRIVER,
            'name' => 'Passport',
            'slug' => 'passport',
            'description' => 'The driver\'s current passport.',
            'requires_expiry' => true,
            'driver_can_upload' => true,
            'sort_order' => 40,
        ],
        [
            'entity_type' => FileType::ENTITY_DRIVER,
            'name' => 'Medical Fitness Certificate',
            'slug' => 'medical-fitness-certificate',
            'description' => 'The driver\'s current medical fitness certificate.',
            'requires_expiry' => true,
            'driver_can_upload' => true,
            'sort_order' => 50,
        ],
        [
            'entity_type' => FileType::ENTITY_SHIPMENT,
            'name' => 'Delivery Note',
            'slug' => 'delivery-note',
            'description' => 'The delivery note associated with the shipment.',
            'requires_expiry' => false,
            'driver_can_upload' => true,
            'sort_order' => 10,
        ],
        [
            'entity_type' => FileType::ENTITY_SHIPMENT,
            'name' => 'Invoice',
            'slug' => 'invoice',
            'description' => 'The invoice associated with the shipment.',
            'requires_expiry' => false,
            'driver_can_upload' => false,
            'sort_order' => 20,
        ],
        [
            'entity_type' => FileType::ENTITY_SHIPMENT,
            'name' => 'Waybill / Consignment Note',
            'slug' => 'waybill-consignment-note',
            'description' => 'The waybill or consignment note associated with the shipment.',
            'requires_expiry' => false,
            'driver_can_upload' => true,
            'sort_order' => 30,
        ],
        [
            'entity_type' => FileType::ENTITY_SHIPMENT,
            'name' => 'Packing List',
            'slug' => 'packing-list',
            'description' => 'The packing list associated with the shipment.',
            'requires_expiry' => false,
            'driver_can_upload' => false,
            'sort_order' => 40,
        ],
    ];

    public function run(): void
    {
        Merchant::query()
            ->select(['id', 'account_id'])
            ->orderBy('id')
            ->chunkById(100, function ($merchants): void {
                foreach ($merchants as $merchant) {
                    foreach (self::DEFAULT_FILE_TYPES as $definition) {
                        FileType::withTrashed()->firstOrCreate(
                            [
                                'merchant_id' => $merchant->id,
                                'entity_type' => $definition['entity_type'],
                                'slug' => $definition['slug'],
                            ],
                            [
                                'account_id' => $merchant->account_id,
                                'name' => $definition['name'],
                                'description' => $definition['description'],
                                'requires_expiry' => $definition['requires_expiry'],
                                'driver_can_upload' => $definition['driver_can_upload'],
                                'is_active' => true,
                                'sort_order' => $definition['sort_order'],
                            ]
                        );
                    }
                }
            });
    }
}
