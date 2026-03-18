<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListRoutesRequest;
use App\Http\Requests\RouteStatsRequest;
use App\Http\Requests\StoreRouteRequest;
use App\Http\Requests\UpdateRouteRequest;
use App\Http\Resources\RouteResource;
use App\Models\DeliveryRoute;
use App\Models\Merchant;
use App\Services\RouteService;
use App\Services\RouteStatsService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class RouteController extends Controller
{
    public function index(ListRoutesRequest $request, RouteService $service)
    {
        try {
            $routes = $service->listRoutes($request->user(), $request->validated());

            return ApiResponse::paginated($routes, RouteResource::collection($routes));
        } catch (Throwable $e) {
            Log::error('Route list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ROUTE_LIST_FAILED', 'Unable to list routes.');
        }
    }

    public function store(StoreRouteRequest $request, RouteService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $request->validated()['merchant_id'])->firstOrFail();
            $this->authorize('create', [DeliveryRoute::class, $merchant]);

            $route = $service->createRoute($request->user(), $request->validated());

            return ApiResponse::success(new RouteResource($route), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Route create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ROUTE_CREATE_FAILED', 'Unable to create route.');
        }
    }

    public function show(Request $request, string $route_uuid, RouteService $service)
    {
        try {
            $route = $service->getRouteForUser($request->user(), $route_uuid);
            $this->authorize('view', $route);

            return ApiResponse::success(new RouteResource($route));
        } catch (Throwable $e) {
            Log::error('Route fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ROUTE_NOT_FOUND', 'Route not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function stats(
        RouteStatsRequest $request,
        string $route_uuid,
        RouteService $routeService,
        RouteStatsService $statsService
    ) {
        try {
            $route = $routeService->getRouteForUser($request->user(), $route_uuid);
            $this->authorize('view', $route);

            $stats = $statsService->build($route, $request->validated());

            return ApiResponse::success($stats);
        } catch (Throwable $e) {
            Log::error('Route stats failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ROUTE_STATS_FAILED', 'Unable to load route stats.');
        }
    }

    public function update(UpdateRouteRequest $request, string $route_uuid, RouteService $service)
    {
        try {
            $route = $service->getRouteForUser($request->user(), $route_uuid);
            $this->authorize('update', $route);

            $route = $service->updateRoute($request->user(), $route, $request->validated());

            return ApiResponse::success(new RouteResource($route));
        } catch (Throwable $e) {
            Log::error('Route update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ROUTE_UPDATE_FAILED', 'Unable to update route.');
        }
    }

    public function destroy(Request $request, string $route_uuid, RouteService $service)
    {
        try {
            $route = $service->getRouteForUser($request->user(), $route_uuid);
            $this->authorize('update', $route);

            $service->deleteRoute($request->user(), $route);

            return ApiResponse::success(['message' => 'Route deleted']);
        } catch (Throwable $e) {
            Log::error('Route delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'ROUTE_DELETE_FAILED', 'Unable to delete route.');
        }
    }
}
