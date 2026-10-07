<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ConversationApiErrors
{
    public function handle(Request $request, Closure $next)
    {
        try {
            $response = $next($request);
            if ($response instanceof \Illuminate\Http\JsonResponse && $response->getStatusCode() >= 400) {
                $data = $response->getData(true);
                if (! array_key_exists('success', $data)) {
                    return ApiResponse::error('CONVERSATION_ERROR', $data['message'] ?? 'Request failed.', $data['errors'] ?? [], $response->getStatusCode());
                }
            }

            return $response;
        } catch (ValidationException $error) {
            return ApiResponse::error('VALIDATION', $error->getMessage(), $error->errors(), 422);
        } catch (ModelNotFoundException $error) {
            return ApiResponse::error('NOT_FOUND', 'Conversation resource not found.', [], 404);
        } catch (HttpExceptionInterface $error) {
            return ApiResponse::error('CONVERSATION_ERROR', $error->getMessage() ?: 'Unable to access this conversation.', [], $error->getStatusCode());
        }
    }
}
