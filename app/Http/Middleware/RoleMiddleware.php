<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roleParameters)
    {
        $user = $request->user();

        $roles = array_values(array_filter(array_map(
            'trim',
            explode(',', implode(',', $roleParameters))
        )));
        if (! $user || ($roles && ! in_array($user->role, $roles, true))) {
            return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
