<?php

namespace App\Exceptions;

use App\Support\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    public function register(): void
    {
        $this->renderable(function (Throwable $e, $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                return ApiResponse::error('VALIDATION_ERROR', 'Validation failed.', $e->errors(), Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if ($e instanceof AuthenticationException) {
                return ApiResponse::error('UNAUTHENTICATED', 'Authentication required.', [], Response::HTTP_UNAUTHORIZED);
            }

            if ($e instanceof AccessDeniedHttpException) {
                return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
            }

            if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
                return ApiResponse::error('NOT_FOUND', 'Resource not found.', [], Response::HTTP_NOT_FOUND);
            }

            return ApiResponse::error('SERVER_ERROR', 'An unexpected error occurred.', [], Response::HTTP_INTERNAL_SERVER_ERROR);
        });
    }
}
