<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListFeedbackRequest;
use App\Http\Requests\StoreFeedbackReplyRequest;
use App\Http\Requests\UpdateFeedbackRequest;
use App\Http\Resources\FeedbackResource;
use App\Services\FeedbackService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminFeedbackController extends Controller
{
    public function index(ListFeedbackRequest $request, FeedbackService $service)
    {
        try {
            $feedback = $service->listForReview($request->user(), $request->validated());

            return ApiResponse::paginated($feedback, FeedbackResource::collection($feedback));
        } catch (Throwable $e) {
            return $this->apiError($e, 'ADMIN_FEEDBACK_LIST_FAILED', 'Unable to list feedback.');
        }
    }

    public function show(string $feedback_uuid, Request $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(new FeedbackResource($service->getForReview($request->user(), $feedback_uuid)));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_NOT_FOUND', 'Feedback not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function update(string $feedback_uuid, UpdateFeedbackRequest $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(new FeedbackResource(
                $service->updateForReview($request->user(), $feedback_uuid, $request->validated())
            ));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_UPDATE_FAILED', 'Unable to update feedback.');
        }
    }

    public function reply(string $feedback_uuid, StoreFeedbackReplyRequest $request, FeedbackService $service)
    {
        try {
            $feedback = $service->replyAsReviewer(
                $request->user(),
                $feedback_uuid,
                $request->validated('message'),
                $request->validated('status')
            );

            return ApiResponse::success(new FeedbackResource($feedback), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_REPLY_FAILED', 'Unable to add feedback reply.');
        }
    }

    public function markRead(string $feedback_uuid, Request $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(new FeedbackResource($service->markReviewerRead($request->user(), $feedback_uuid)));
        } catch (Throwable $e) {
            return $this->apiError($e, 'FEEDBACK_NOT_FOUND', 'Feedback not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function unreadCount(Request $request, FeedbackService $service)
    {
        try {
            return ApiResponse::success(['count' => $service->unreadReviewerCount($request->user())]);
        } catch (Throwable $e) {
            return $this->apiError($e, 'ADMIN_FEEDBACK_COUNT_FAILED', 'Unable to load unread feedback count.');
        }
    }
}
