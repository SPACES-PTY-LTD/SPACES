<?php

namespace App\Services\Website;

use App\Models\PricingPlan;
use App\Models\Website\Content;
use Illuminate\Validation\ValidationException;

class ContentService
{
    // A small HTML vocabulary: no attributes, scripts, remote embeds or executable links.
    public function sanitize(string $html): string
    {
        $html = preg_replace('#<(script|style|iframe|object)[^>]*>.*?</\1\s*>#is', '', $html);
        $html = strip_tags($html, '<p><br><strong><em><ul><ol><li><h2><h3><blockquote>');

        return preg_replace('/<(\w+)\b[^>]*>/u', '<$1>', $html);
    }

    public function validate(array $input): array
    {
        $data = validator($input, [
            'title' => 'required|string|max:180', 'description' => 'required|string|max:500',
            'body' => 'required|string|max:100000', 'author' => 'nullable|string|max:120',
            'category' => 'nullable|string|max:80', 'image' => 'nullable|url:https|max:2000', 'image_alt' => 'nullable|string|max:200',
            'seo_title' => 'nullable|string|max:180', 'seo_description' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:120', 'employment_type' => 'nullable|string|max:80',
            'application_email' => 'nullable|email|max:254',
        ])->validate();
        if (! empty($data['image']) && empty($data['image_alt'])) {
            throw ValidationException::withMessages(['image_alt' => 'Describe the image for visitors using assistive technology.']);
        }
        $data['body'] = $this->sanitize($data['body']);

        return $data;
    }

    public function publish(Content $content): void
    {
        $data = $this->validate($content->draft);
        if (in_array($content->kind, ['blog', 'update']) && empty($data['author'])) {
            throw ValidationException::withMessages(['author' => 'A named author is required before publication.']);
        }
        if ($content->kind === 'vacancy' && (empty($data['application_email']) || empty($data['location']) || empty($data['employment_type']))) {
            throw ValidationException::withMessages(['application_email' => 'Provide an application email, location and employment type.']);
        }
        $content->update(['published' => $data, 'published_at' => $content->published_at ?? now()]);
    }

    public static function priceHash(PricingPlan $plan): string
    {
        return hash('sha256', json_encode(array_map(fn ($v) => (string) $v, $plan->only([
            'title', 'vehicle_limit', 'monthly_charge_zar', 'monthly_charge_usd', 'extra_vehicle_price_zar',
            'extra_vehicle_price_usd', 'is_free', 'is_active', 'public_vat_wording',
        ]))));
    }

    public static function publicPrice(PricingPlan $plan): bool
    {
        return $plan->is_active && ! $plan->is_free && $plan->public_approved_at && $plan->public_vat_wording
            && hash_equals(self::priceHash($plan), (string) $plan->public_approval_hash);
    }
}
