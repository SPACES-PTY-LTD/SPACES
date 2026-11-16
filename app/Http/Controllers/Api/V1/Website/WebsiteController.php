<?php

namespace App\Http\Controllers\Api\V1\Website;

use App\Http\Controllers\Controller;
use App\Models\PricingPlan;
use App\Models\Website\Content;
use App\Models\Website\DemoBooking;
use App\Models\Website\OutboundMail;
use App\Models\Website\Setting;
use App\Services\ActivityLogService;
use App\Services\Website\ContentService;
use App\Services\Website\DemoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WebsiteController extends Controller
{
    public function contents(Request $r)
    {
        // Protected documentation must not leak through the anonymous CMS feed.
        $query = Content::whereNotNull('published')
            ->whereNotIn('slug', ['docs', 'platform/integrations'])
            ->where('slug', 'not like', 'docs/%')
            ->where('slug', 'not like', 'platform/integrations/%');
        if ($r->filled('kind')) {
            $query->where('kind', $r->string('kind')->toString());
        }
        $items = $query->orderByDesc('published_at')->get()->map(fn ($c) => ['id' => $c->id, 'kind' => $c->kind, 'slug' => $c->slug, 'content' => $c->published, 'published_at' => $c->published_at]);
        if ($r->filled('q')) {
            $q = mb_strtolower(mb_substr($r->string('q')->toString(), 0, 150));
            $items = $items->filter(fn ($c) => str_contains(mb_strtolower($c['content']['title'].' '.strip_tags($c['content']['body'])), $q));
        }

        return response()->json(['data' => $items->values()]);
    }

    public function prices()
    {
        $plans = PricingPlan::orderBy('public_order')->get()->filter(fn ($p) => ContentService::publicPrice($p))->map(fn ($p) => $p->only(['uuid', 'title', 'vehicle_limit', 'monthly_charge_zar', 'extra_vehicle_price_zar', 'public_vat_wording']));

        return response()->json(['data' => $plans->values()]);
    }

    public function contact()
    {
        return response()->json(['data' => array_intersect_key(Setting::findOrFail(1)->data, array_flip(['sales_email', 'support_email', 'security_email', 'privacy_email', 'company_name']))]);
    }

    public function adminIndex()
    {
        return response()->json(['data' => [
            'contents' => Content::orderBy('kind')->get(), 'settings' => Setting::findOrFail(1)->data,
            'plans' => PricingPlan::all()->map(fn ($p) => array_merge($p->only(['id', 'uuid', 'title', 'vehicle_limit', 'monthly_charge_zar', 'extra_vehicle_price_zar', 'public_vat_wording', 'public_order', 'is_free', 'is_active']), ['approved' => ContentService::publicPrice($p)])),
            'bookings' => DemoBooking::orderByDesc('starts_at')->limit(200)->get(),
            'mail' => OutboundMail::where('status', '!=', 'sent')->latest()->limit(100)->get(['id', 'recipient', 'subject', 'status', 'attempts', 'error']),
            'staff' => \App\Models\User::where('role', 'super_admin')->get(['id', 'name']),
        ]]);
    }

    public function saveContent(Request $r, ContentService $service)
    {
        $meta = $r->validate(['id' => 'nullable|integer|exists:website_contents,id', 'kind' => ['required', Rule::in(['page', 'blog', 'help', 'update', 'vacancy'])],
            'slug' => ['required', 'regex:#^[a-z0-9]+(?:[-/][a-z0-9]+)*$#', 'max:180', Rule::unique('website_contents', 'slug')->ignore($r->input('id'))], 'draft' => 'required|array']);
        abort_if(preg_match('#^(admin|auth|api|driver|docs|book-demo|pricing|contact|careers)(/|$)#', $meta['slug']), 422, 'This address is reserved. Use a vacancy address under jobs/ for careers.');
        $content = isset($meta['id']) ? Content::findOrFail($meta['id']) : new Content;
        if ($content->exists) {
            abort_if($content->slug !== $meta['slug'] || $content->kind !== $meta['kind'], 422, 'Existing content addresses and types cannot be changed.');
        }
        $content->fill(['kind' => $meta['kind'], 'slug' => $meta['slug'], 'draft' => $service->validate($meta['draft'])])->save();
        app(ActivityLogService::class)->log('website.draft_saved', 'website_content', $content);

        return response()->json(['data' => $content]);
    }

    public function publication(Request $r, Content $content, ContentService $service)
    {
        $data = $r->validate(['action' => ['required', Rule::in(['publish', 'unpublish'])]]);
        DB::transaction(function () use ($content, $service, $data) {
            $content = Content::lockForUpdate()->findOrFail($content->id);
            if ($data['action'] === 'publish') {
                $service->publish($content);
            } else {
                $content->update(['published' => null]);
            }
            app(ActivityLogService::class)->log('website.'.$data['action'], 'website_content', $content);
        });

        return response()->json(['data' => $content->fresh()]);
    }

    public function settings(Request $r)
    {
        $data = $r->validate([
            'hours' => 'present|array', 'hours.*' => 'array:from,to', 'hours.*.from' => 'required|date_format:H:i', 'hours.*.to' => 'required|date_format:H:i',
            'blackouts' => 'present|array', 'blackouts.*' => 'date_format:Y-m-d',
            'sales_email' => 'nullable|email', 'support_email' => 'nullable|email', 'security_email' => 'nullable|email', 'privacy_email' => 'nullable|email', 'company_name' => 'nullable|string|max:150',
        ]);
        foreach ($data['hours'] as $day => $hours) {
            abort_if(! in_array((int) $day, range(1, 7)) || $hours['from'] >= $hours['to'], 422, 'Working hours must use weekdays 1–7 and end after their start.');
        }
        $data['timezone'] = DemoService::ZONE;
        Setting::findOrFail(1)->update(['data' => $data]);
        app(ActivityLogService::class)->log('website.settings_updated', 'website_settings');

        return response()->json(['data' => $data]);
    }

    public function approvePrice(Request $r, PricingPlan $plan)
    {
        $data = $r->validate(['public_vat_wording' => 'required|string|max:200', 'public_order' => 'required|integer|min:0|max:1000', 'approved' => 'required|boolean']);
        $plan->forceFill(['public_vat_wording' => $data['public_vat_wording'], 'public_order' => $data['public_order']]);
        abort_if($data['approved'] && (! $plan->is_active || $plan->is_free), 422, 'Only active paid plans can be approved.');
        $plan->forceFill(['public_approval_hash' => $data['approved'] ? ContentService::priceHash($plan) : null, 'public_approved_at' => $data['approved'] ? now() : null])->save();
        app(ActivityLogService::class)->log('website.pricing_approval', 'pricing_plan', $plan);

        return response()->json(['data' => ['approved' => ContentService::publicPrice($plan)]]);
    }

    public function slots(Request $r, DemoService $demo)
    {
        $data = $r->validate(['date' => 'required|date_format:Y-m-d']);

        return response()->json(['data' => $demo->slots($data['date']), 'timezone' => DemoService::ZONE]);
    }

    public function book(Request $r, DemoService $demo)
    {
        $data = $r->validate(['starts_at' => 'required|date', 'name' => 'required|string|max:120', 'email' => 'required|email|max:254',
            'company' => 'required|string|max:150', 'fleet_size' => ['required', Rule::in(['1–10', '11–20', '21–50', '51–100', '100+'])],
            'phone' => 'nullable|string|max:40', 'message' => 'nullable|string|max:2000', 'website' => 'nullable|size:0']);
        unset($data['website']);
        $b = $demo->book($data);

        return response()->json(['data' => $b->only(['id', 'starts_at', 'status'])], 201);
    }

    public function manageBooking(Request $r, DemoService $demo)
    {
        $data = $r->validate(['token' => 'required|string|size:64', 'action' => ['required', Rule::in(['cancel', 'reschedule'])], 'starts_at' => 'required_if:action,reschedule|date']);
        $b = $demo->manage($data['token'], $data['action'], $data['starts_at'] ?? null);

        return response()->json(['data' => $b->only(['starts_at', 'status'])]);
    }

    public function bookings(Request $r)
    {
        $data = $r->validate(['date' => 'nullable|date_format:Y-m-d', 'page' => 'nullable|integer|min:1']);
        $query = DemoBooking::orderByDesc('starts_at');
        if (! empty($data['date'])) {
            $start = \Carbon\CarbonImmutable::parse($data['date'], DemoService::ZONE)->startOfDay()->utc();
            $query->where('starts_at', '>=', $start)->where('starts_at', '<', $start->addDay());
        }

        return response()->json(['data' => $query->paginate(50)]);
    }

    public function updateBooking(Request $r, DemoBooking $booking, DemoService $demo)
    {
        $data = $r->validate(['meeting_url' => 'nullable|url:https|max:2000', 'status' => ['sometimes', Rule::in(['cancelled'])]]);
        DB::transaction(function () use ($data, $booking, $demo) {
            Setting::whereKey(1)->update(['updated_at' => now()]);
            $b = DemoBooking::lockForUpdate()->findOrFail($booking->id);
            abort_if($b->status !== 'confirmed' || $b->starts_at->isPast(), 409, 'This appointment is no longer active.');
            $b->update($data);
            $demo->notify($b, $b->status === 'cancelled' ? 'Your demo has been cancelled' : 'Your demo meeting details');
        });

        return response()->json(['data' => $booking->fresh()]);
    }

    public function retryMail(OutboundMail $mail)
    {
        abort_unless($mail->status === 'failed', 409, 'Only failed messages can be retried.');
        $mail->update(['status' => 'pending', 'attempts' => 0, 'attempted_at' => null, 'error' => null]);

        return response()->json(['data' => ['status' => 'pending']]);
    }
}
