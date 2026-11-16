<?php

namespace App\Services\Website;

use App\Models\Website\DemoBooking;
use App\Models\Website\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DemoService
{
    public const ZONE = 'Africa/Johannesburg';

    public function settings(): array
    {
        return Setting::findOrFail(1)->data;
    }

    public function slots(string $date, ?string $exclude = null): array
    {
        $day = CarbonImmutable::parse($date, self::ZONE)->startOfDay();
        $settings = $this->settings();
        if (in_array($date, $settings['blackouts'] ?? [])) {
            return [];
        }
        $hours = $settings['hours'][(string) $day->isoWeekday()] ?? null;
        if (! $hours) {
            return [];
        }
        $start = $day->setTimeFromTimeString($hours['from']);
        $end = $day->setTimeFromTimeString($hours['to']);
        $existing = DemoBooking::where('status', 'confirmed')
            ->where('starts_at', '>=', $day->utc()->subDay())->where('starts_at', '<', $day->utc()->addDays(2))
            ->when($exclude, fn ($q) => $q->where('id', '!=', $exclude))->get();
        $slots = [];
        for ($at = $start; $at->addMinutes(30)->lte($end); $at = $at->addMinutes(15)) {
            if ($at->lt(now()->addHours(24)) || $at->gt(now()->addDays(30))) {
                continue;
            }
            if ($existing->contains(fn ($b) => abs($b->starts_at->getTimestamp() - $at->getTimestamp()) < 45 * 60)) {
                continue;
            }
            $slots[] = $at->utc()->toIso8601String();
        }

        return $slots;
    }

    private function reserveLock(): void
    {
        // A durable shared row serialises reservation decisions on MySQL and SQLite.
        Setting::whereKey(1)->update(['updated_at' => now()]);
        Setting::whereKey(1)->lockForUpdate()->firstOrFail();
    }

    private function verifySlot(string $value, ?string $exclude = null): CarbonImmutable
    {
        $at = CarbonImmutable::parse($value)->utc();
        $date = $at->setTimezone(self::ZONE)->toDateString();
        if (! in_array($at->toIso8601String(), $this->slots($date, $exclude))) {
            throw ValidationException::withMessages(['starts_at' => 'This time is no longer available. Please choose another slot.']);
        }

        return $at;
    }

    public function book(array $data): DemoBooking
    {
        return DB::transaction(function () use ($data) {
            $this->reserveLock();
            $at = $this->verifySlot($data['starts_at']);
            $token = Str::random(64);
            $booking = DemoBooking::create(array_merge($data, ['starts_at' => $at, 'token_hash' => hash('sha256', $token), 'token_expires_at' => $at->addDay()]));
            $this->notify($booking, 'Your demo is booked', $token);

            return $booking;
        }, 3);
    }

    public function manage(string $token, string $action, ?string $startsAt = null): DemoBooking
    {
        return DB::transaction(function () use ($token, $action, $startsAt) {
            $this->reserveLock();
            $booking = DemoBooking::where('token_hash', hash('sha256', $token))->where('token_expires_at', '>', now())->firstOrFail();
            abort_if($booking->status !== 'confirmed' || $booking->starts_at->isPast(), 409, 'This appointment cannot be changed.');
            if ($action === 'reschedule') {
                $at = $this->verifySlot($startsAt, $booking->id);
                $booking->update(['starts_at' => $at, 'token_expires_at' => $at->addDay(), 'reminded_at' => null, 'meeting_url' => null]);
            } else {
                $booking->update(['status' => 'cancelled']);
            }
            $this->notify($booking, $action === 'reschedule' ? 'Your demo has been rescheduled' : 'Your demo has been cancelled', $token);

            return $booking;
        }, 3);
    }

    public function remindDue(): void
    {
        DB::transaction(function () {
            $bookings = DemoBooking::where('status', 'confirmed')->whereNull('reminded_at')
                ->where('starts_at', '>', now())->where('starts_at', '<=', now()->addHours(24))->lockForUpdate()->get();
            foreach ($bookings as $booking) {
                $this->notify($booking, 'Reminder: your upcoming demo');
                $booking->update(['reminded_at' => now()]);
            }
        });
    }

    public function notify(DemoBooking $booking, string $subject, ?string $token = null): void
    {
        $at = $booking->starts_at->setTimezone(self::ZONE)->format('j M Y, H:i');
        $body = "Hello {$booking->name},\n\n{$subject}.\nTime: {$at} (Africa/Johannesburg)\nDuration: 30 minutes.\n";
        if ($booking->status === 'confirmed') {
            $body .= $booking->meeting_url ? "Join: {$booking->meeting_url}\n" : "Our team will send your meeting link separately.\n";
        }
        if ($token && $booking->status === 'confirmed') {
            $body .= "\nManage your appointment: ".rtrim(config('website.public_url'), '/').'/book-demo/manage#token='.$token;
        }
        $start = $booking->starts_at->utc();
        $calendar = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Spaces Digital//Demo//EN\r\nBEGIN:VEVENT\r\nUID:{$booking->id}@spaces-demo\r\nDTSTAMP:".now()->utc()->format('Ymd\THis\Z')."\r\nDTSTART:".$start->format('Ymd\THis\Z')."\r\nDTEND:".$start->addMinutes(30)->format('Ymd\THis\Z')."\r\nSUMMARY:Spaces Digital demo\r\n".($booking->meeting_url ? 'URL:'.str_replace(["\r", "\n"], '', $booking->meeting_url)."\r\n" : '').'SEQUENCE:'.$booking->updated_at->timestamp."\r\nSTATUS:".($booking->status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED')."\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        app(MailService::class)->queue($booking->email, $subject, $body, $calendar);
    }
}
