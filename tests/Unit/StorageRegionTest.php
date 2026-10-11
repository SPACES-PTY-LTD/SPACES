<?php

namespace Tests\Unit;

use App\Support\StorageRegion;
use PHPUnit\Framework\TestCase;

class StorageRegionTest extends TestCase
{
    public function test_explicit_region_takes_precedence(): void
    {
        $this->assertSame('af-south-1', StorageRegion::resolve(' af-south-1 ', 'eu-west-1', 'https://account.r2.cloudflarestorage.com'));
    }

    public function test_standard_aws_region_is_supported_when_default_is_empty(): void
    {
        $this->assertSame('eu-west-1', StorageRegion::resolve('', 'eu-west-1', null));
    }

    public function test_r2_endpoints_work_without_an_explicit_region(): void
    {
        $this->assertSame('auto', StorageRegion::resolve(null, null, 'https://account.r2.cloudflarestorage.com'));
        $this->assertSame('auto', StorageRegion::resolve('', '', 'https://account.eu.r2.cloudflarestorage.com'));
    }

    public function test_other_storage_providers_require_an_explicit_region(): void
    {
        $this->assertNull(StorageRegion::resolve(null, null, null));
        $this->assertNull(StorageRegion::resolve(null, null, 'https://s3.amazonaws.com'));
        $this->assertNull(StorageRegion::resolve(null, null, 'https://account.r2.cloudflarestorage.com.example.test'));
    }
}
