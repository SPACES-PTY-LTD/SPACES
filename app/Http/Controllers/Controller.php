<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use App\Support\ApiResponse;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

abstract class Controller
{
    use AuthorizesRequests, ValidatesRequests;

    protected function apiError(Throwable $e, string $code, string $message, int $status = Response::HTTP_BAD_REQUEST)
    {
        if ($e instanceof AuthorizationException) {
            return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
        }

        if ($e instanceof ModelNotFoundException) {
            return ApiResponse::error('NOT_FOUND', 'Resource not found.', [], Response::HTTP_NOT_FOUND);
        }

        if ($e instanceof ValidationException) {
            return ApiResponse::error('VALIDATION_ERROR', 'Validation failed.', $e->errors(), Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return ApiResponse::error($code, $message, [], $status);
    }
}
