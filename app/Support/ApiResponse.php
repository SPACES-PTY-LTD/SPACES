<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Response;

class ApiResponse
{
    public static function success($data = null, array $meta = [], int $status = Response::HTTP_OK)
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => array_merge(self::requestMeta(), $meta),
            'error' => null,
        ], $status);
    }

    public static function error(string $code, string $message, array $details = [], int $status = Response::HTTP_BAD_REQUEST)
    {
        $requestId = self::requestId();

        return response()->json([
            'success' => false,
            'data' => null,
            'meta' => self::requestMeta(),
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
                'request_id' => $requestId,
            ],
        ], $status);
    }

    public static function paginated(LengthAwarePaginator $paginator, JsonResource $collectionResource, array $meta = [])
    {
        $pagination = [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];

        return self::success($collectionResource, array_merge($meta, $pagination));
    }

    public static function requestId(): string
    {
        return (string) request()->attributes->get('request_id', '');
    }

    private static function requestMeta(): array
    {
        return [
            'request_id' => self::requestId(),
        ];
    }
}
