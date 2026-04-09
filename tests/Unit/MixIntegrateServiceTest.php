<?php

namespace Tests\Unit;

use App\Services\Mixtelematics\MixIntegrateService;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Facades\Http;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

class MixIntegrateServiceTest extends TestCase
{
    public function test_extract_polygon_centroid_preserves_longitude_and_latitude_axes(): void
    {
        $service = new MixIntegrateService();

        $method = new ReflectionMethod($service, 'extractPolygonCentroid');
        $method->setAccessible(true);

        $centroid = $method->invoke(
            $service,
            'POLYGON ((30 -10, 32 -10, 32 -8, 30 -8, 30 -10))'
        );

        $this->assertSame(-9.0, $centroid['latitude']);
        $this->assertSame(31.0, $centroid['longitude']);
    }

    public function test_inspect_token_response_decodes_jwt_and_computes_timing(): void
    {
        CarbonImmutable::setTestNow('2026-04-09T10:00:00Z');
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => $this->buildJwt([
                    'sub' => 'mix-user',
                    'iat' => 1775728800,
                    'exp' => 1775732400,
                ]),
                'refresh_token' => $this->buildJwt([
                    'sub' => 'mix-refresh',
                    'iat' => 1775728800,
                    'exp' => 1775815200,
                ]),
                'token_type' => 'Bearer',
                'expires_in' => 3600,
                'scope' => 'offline_access MiX.Integrate',
            ]),
        ]);

        $service = new MixIntegrateService();
        $analysis = $service->inspectTokenResponse();

        $this->assertSame('Bearer', $analysis['token_type']);
        $this->assertSame(3600, $analysis['expires_in']);
        $this->assertTrue($analysis['access_token_decoded']['decodable']);
        $this->assertSame('mix-user', $analysis['access_token_decoded']['claims']['sub']);
        $this->assertSame('2026-04-09T11:00:00+00:00', $analysis['timing']['expires_at']);
        $this->assertEquals(3600, $analysis['timing']['seconds_until_expiry']);
        $this->assertFalse($analysis['timing']['is_expired']);
        $this->assertStringContainsString('Expires in 1h 0m 0s', $analysis['summary']);

        CarbonImmutable::setTestNow();
    }

    public function test_inspect_token_response_reports_opaque_tokens_without_failing(): void
    {
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => 'opaque-access-token',
                'refresh_token' => 'opaque-refresh-token',
                'token_type' => 'Bearer',
                'expires_in' => 120,
            ]),
        ]);

        $service = new MixIntegrateService();
        $analysis = $service->inspectTokenResponse();

        $this->assertFalse($analysis['access_token_decoded']['decodable']);
        $this->assertSame('opaque', $analysis['access_token_decoded']['format']);
        $this->assertSame('Token is not JWT-shaped.', $analysis['access_token_decoded']['decode_error']);
        $this->assertSame(120, $analysis['timing']['expires_in_seconds']);
        $this->assertNull($analysis['timing']['expires_at']);
        $this->assertStringContainsString('Expiry could not be determined.', $analysis['summary']);
    }

    public function test_get_bearer_token_still_returns_access_token_from_inspection_flow(): void
    {
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => $this->buildJwt([
                    'sub' => 'mix-user',
                    'iat' => 1775728800,
                    'exp' => 1775732400,
                ]),
                'token_type' => 'Bearer',
                'expires_in' => 3600,
            ]),
        ]);

        $service = new MixIntegrateService();
        $method = new ReflectionMethod($service, 'getBearerToken');
        $method->setAccessible(true);
        $token = $method->invoke($service, []);

        $this->assertIsString($token);
        $this->assertStringContainsString('.', $token);
    }

    public function test_get_bearer_token_uses_cached_redis_token_when_still_valid(): void
    {
        CarbonImmutable::setTestNow('2026-04-09T10:00:00Z');

        $store = Mockery::mock(CacheRepository::class);
        $store->shouldNotReceive('put');
        $store->shouldReceive('get')
            ->once()
            ->with('mix:token:integration-123')
            ->andReturn([
                'access_token' => 'cached-access-token',
                'refresh_token' => 'cached-refresh-token',
                'token_type' => 'Bearer',
                'expires_in' => 3600,
                'scope' => 'offline_access MiX.Integrate',
                'expires_at' => '2026-04-09T11:00:00+00:00',
                'raw_response' => [
                    'access_token' => 'cached-access-token',
                    'token_type' => 'Bearer',
                ],
            ]);

        Http::fake();

        $service = $this->serviceWithCacheStore($store);
        $analysis = $service->inspectTokenResponse([
            'integration_uuid' => 'integration-123',
        ], [
            'use_cache' => true,
        ]);

        $this->assertSame('cached-access-token', $analysis['access_token']);
        $this->assertSame('redis_cache', $analysis['auth_mode']);
        Http::assertNothingSent();
        CarbonImmutable::setTestNow();
    }

    public function test_get_bearer_token_refreshes_when_cached_token_is_within_expiry_buffer(): void
    {
        CarbonImmutable::setTestNow('2026-04-09T10:00:00Z');
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        $store = Mockery::mock(CacheRepository::class);
        $store->shouldReceive('get')
            ->once()
            ->with('mix:token:integration-123')
            ->andReturn([
                'access_token' => 'cached-access-token',
                'expires_in' => 3600,
                'expires_at' => '2026-04-09T10:00:30+00:00',
            ]);
        $store->shouldReceive('put')
            ->once()
            ->withArgs(function (string $key, array $payload, mixed $ttl) {
                return $key === 'mix:token:integration-123'
                    && ($payload['access_token'] ?? null) !== null;
            });

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => $this->buildJwt([
                    'sub' => 'mix-user',
                    'iat' => 1775728800,
                    'exp' => 1775732400,
                ]),
                'token_type' => 'Bearer',
                'expires_in' => 3600,
            ]),
        ]);

        $service = $this->serviceWithCacheStore($store);
        $analysis = $service->inspectTokenResponse([
            'integration_uuid' => 'integration-123',
        ], [
            'use_cache' => true,
        ]);

        $this->assertIsString($analysis['access_token']);
        $this->assertSame('fresh_login', $analysis['auth_mode']);
        Http::assertSentCount(1);
        CarbonImmutable::setTestNow();
    }

    public function test_get_bearer_token_falls_back_to_fresh_login_when_redis_read_fails(): void
    {
        CarbonImmutable::setTestNow('2026-04-09T10:00:00Z');
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        $store = Mockery::mock(CacheRepository::class);
        $store->shouldReceive('get')
            ->once()
            ->andThrow(new \RuntimeException('Redis unavailable'));
        $store->shouldReceive('put')
            ->once();

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => $this->buildJwt([
                    'sub' => 'mix-user',
                    'iat' => 1775728800,
                    'exp' => 1775732400,
                ]),
                'token_type' => 'Bearer',
                'expires_in' => 3600,
            ]),
        ]);

        $service = $this->serviceWithCacheStore($store);
        $analysis = $service->inspectTokenResponse([
            'integration_uuid' => 'integration-123',
        ], [
            'use_cache' => true,
        ]);

        $this->assertIsString($analysis['access_token']);
        Http::assertSentCount(1);
        CarbonImmutable::setTestNow();
    }

    public function test_get_bearer_token_falls_back_when_redis_write_fails(): void
    {
        CarbonImmutable::setTestNow('2026-04-09T10:00:00Z');
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        $store = Mockery::mock(CacheRepository::class);
        $store->shouldReceive('get')
            ->once()
            ->andReturn(null);
        $store->shouldReceive('put')
            ->once()
            ->andThrow(new \RuntimeException('Redis write failed'));

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => $this->buildJwt([
                    'sub' => 'mix-user',
                    'iat' => 1775728800,
                    'exp' => 1775732400,
                ]),
                'token_type' => 'Bearer',
                'expires_in' => 3600,
            ]),
        ]);

        $service = $this->serviceWithCacheStore($store);
        $analysis = $service->inspectTokenResponse([
            'integration_uuid' => 'integration-123',
        ], [
            'use_cache' => true,
        ]);

        $this->assertIsString($analysis['access_token']);
        Http::assertSentCount(1);
        CarbonImmutable::setTestNow();
    }

    public function test_inspect_token_response_bypasses_redis_cache_and_forces_fresh_login(): void
    {
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        $store = Mockery::mock(CacheRepository::class);

        Http::fake([
            'https://identity.example.test/connect/token' => Http::response([
                'access_token' => $this->buildJwt([
                    'sub' => 'mix-user',
                    'iat' => 1775728800,
                    'exp' => 1775732400,
                ]),
                'token_type' => 'Bearer',
                'expires_in' => 3600,
            ]),
        ]);

        $service = $this->serviceWithCacheStore($store);
        $analysis = $service->inspectTokenResponse([
            'integration_uuid' => 'integration-123',
        ]);

        $this->assertSame('fresh_login', $analysis['auth_mode']);
        Http::assertSentCount(1);
    }

    public function test_inspect_token_response_retries_token_request_once_before_succeeding(): void
    {
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        Http::fake([
            'https://identity.example.test/connect/token' => Http::sequence()
                ->push(['error' => 'temporary'], 500)
                ->push([
                    'access_token' => $this->buildJwt([
                        'sub' => 'mix-user',
                        'iat' => 1775728800,
                        'exp' => 1775732400,
                    ]),
                    'token_type' => 'Bearer',
                    'expires_in' => 3600,
                ], 200),
        ]);

        $service = $this->serviceWithCacheStore(Mockery::mock(CacheRepository::class));
        $analysis = $service->inspectTokenResponse();

        $this->assertIsString($analysis['access_token']);
        Http::assertSentCount(2);
    }

    public function test_inspect_token_response_throws_after_second_failed_token_request(): void
    {
        config([
            'services.mix.identity_url' => 'https://identity.example.test',
            'services.mix.client_id' => 'client-id',
            'services.mix.client_secret' => 'client-secret',
            'services.mix.username' => 'username',
            'services.mix.password' => 'password',
        ]);

        Http::fake([
            'https://identity.example.test/connect/token' => Http::sequence()
                ->push(['error' => 'temporary'], 500)
                ->push(['error' => 'still failing'], 500),
        ]);

        $this->expectException(\Illuminate\Http\Client\RequestException::class);

        $service = $this->serviceWithCacheStore(Mockery::mock(CacheRepository::class));
        $service->inspectTokenResponse();
    }

    private function buildJwt(array $payload): string
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];

        return $this->base64UrlEncode(json_encode($header, JSON_THROW_ON_ERROR))
            . '.'
            . $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR))
            . '.signature';
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function serviceWithCacheStore(CacheRepository $store): MixIntegrateService
    {
        return new class($store) extends MixIntegrateService {
            public function __construct(private CacheRepository $store)
            {
            }

            protected function cacheStore(): CacheRepository
            {
                return $this->store;
            }
        };
    }
}
