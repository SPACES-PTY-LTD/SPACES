<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AttachRunShipmentsRequest;
use App\Http\Requests\StoreRunRequest;
use App\Http\Requests\UpdateRunRequest;
use App\Http\Resources\RunResource;
use App\Models\Merchant;
use App\Models\Run;
use App\Services\RunService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Throwable;

class RunController extends Controller
{
    public function index(Request $request, RunService $service)
    {
        try {
            $runs = $service->listRuns(
                $request->user(),
                $request->all(),
                $request->attributes->get('merchant_environment')
            );

            return ApiResponse::paginated($runs, RunResource::collection($runs));
        } catch (Throwable $e) {
            Log::error('Run list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_LIST_FAILED', 'Unable to list runs.');
        }
    }

    public function store(StoreRunRequest $request, RunService $service)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            if (!$environment) {
                $merchant = Merchant::where('uuid', $request->validated()['merchant_id'])->firstOrFail();
                $this->authorize('create', [Run::class, $merchant]);
            }

            $run = $service->createRun($request->validated(), $environment);

            return ApiResponse::success(new RunResource($run), [], Response::HTTP_CREATED);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_CREATE_FAILED', 'Unable to create run.');
        }
    }

    public function show(string $run_uuid, Request $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('view', $run);

            return ApiResponse::success(new RunResource($run));
        } catch (Throwable $e) {
            Log::error('Run fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_NOT_FOUND', 'Run not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function update(string $run_uuid, UpdateRunRequest $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);

            $run = $service->updateRun($run, $request->validated());

            return ApiResponse::success(new RunResource($run));
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_LOCKED', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_UPDATE_FAILED', 'Unable to update run.');
        }
    }

    public function attachShipments(string $run_uuid, AttachRunShipmentsRequest $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);

            $run = $service->attachShipments($run, $request->validated()['shipment_ids']);

            return ApiResponse::success(new RunResource($run));
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run attach shipments failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_ATTACH_FAILED', 'Unable to attach shipments to run.');
        }
    }

    public function detachShipment(string $run_uuid, string $shipment_uuid, Request $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);

            $run = $service->detachShipment($run, $shipment_uuid);

            return ApiResponse::success(new RunResource($run));
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run detach shipment failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_DETACH_FAILED', 'Unable to detach shipment from run.');
        }
    }

    public function dispatch(string $run_uuid, Request $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);

            $run = $service->dispatchRun($run);

            return ApiResponse::success(new RunResource($run));
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run dispatch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_DISPATCH_FAILED', 'Unable to dispatch run.');
        }
    }

    public function start(string $run_uuid, Request $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);

            $run = $service->startRun($run);

            return ApiResponse::success(new RunResource($run));
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run start failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_START_FAILED', 'Unable to start run.');
        }
    }

    public function complete(string $run_uuid, Request $request, RunService $service)
    {
        try {
            $run = $service->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);

            $run = $service->completeRun($run);

            return ApiResponse::success(new RunResource($run));
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Run completion failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'RUN_COMPLETE_FAILED', 'Unable to complete run.');
        }
    }
}
