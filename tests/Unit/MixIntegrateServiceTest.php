<?php

namespace Tests\Unit;

use App\Services\Mixtelematics\MixIntegrateService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
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
}
