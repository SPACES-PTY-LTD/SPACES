<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListTagsRequest;
use App\Http\Resources\TagResource;
use App\Services\TagService;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class TagController extends Controller
{
    public function index(ListTagsRequest $request, TagService $service)
    {
        try {
            $tags = $service->listTags($request->user(), $request->validated());

            return ApiResponse::paginated($tags, TagResource::collection($tags));
        } catch (Throwable $e) {
            Log::error('Tag list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'TAGS_FAILED', 'Unable to list tags.');
        }
    }
}
