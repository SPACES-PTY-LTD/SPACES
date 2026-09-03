<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListFeedbackRequest;
use App\Http\Requests\StoreFeedbackReplyRequest;
use App\Http\Requests\StoreFeedbackRequest;
use App\Http\Requests\UpdateOwnFeedbackRequest;
use App\Http\Resources\FeedbackResource;
use App\Services\FeedbackService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class FeedbackController extends Controller
{
    public function store(StoreFeedbackRequest $request, FeedbackService $service)
    {
        try {
            $feedback = $service->create($request->user(), $request->validated(), $request->userAgent());

            return ApiResponse::success(new FeedbackResource($feedback), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Feedback submission failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'FEEDBACK_CREATE_FAILED', 'Unable to submit feedback.');
        }
    }

    public function mine(ListFeedbackRequest $request, FeedbackService $service)
    {
        try {
            $feedback = $service->listMine($request->user(), $request->validated());

            return ApiResponse::paginated($feedback, FeedbackResource::collection($feedback));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_LIST_FAILED', 'Unable to list feedback.');
        }
    }

    public function show(string $feedback_uuid, Request $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(new FeedbackResource($service->getMine($request->user(), $feedback_uuid)));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_NOT_FOUND', 'Feedback not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function update(string $feedback_uuid, UpdateOwnFeedbackRequest $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(new FeedbackResource(
                $service->updateMine($request->user(), $feedback_uuid, $request->validated())
            ));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_UPDATE_FAILED', 'Unable to update feedback.');
        }
    }

    public function reply(string $feedback_uuid, StoreFeedbackReplyRequest $request, FeedbackService $service)
    {
        try {
            $feedback = $service->replyAsSubmitter($request->user(), $feedback_uuid, $request->validated('message'));

            return ApiResponse::success(new FeedbackResource($feedback), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_REPLY_FAILED', 'Unable to add feedback reply.');
        }
    }

    public function markRead(string $feedback_uuid, Request $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(new FeedbackResource($service->markMineRead($request->user(), $feedback_uuid)));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_NOT_FOUND', 'Feedback not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function destroy(string $feedback_uuid, Request $request, FeedbackService $service)
    {
        try {
            $service->deleteMine($request->user(), $feedback_uuid);

            return ApiResponse::success(['message' => 'Feedback deleted.']);
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_DELETE_FAILED', 'Unable to delete feedback.');
        }
    }

    public function unreadCount(Request $request, FeedbackService $service)
    {
        return ApiResponse::success(['count' => $service->unreadMineCount($request->user())]);
    }
}
