<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\PricingPlan;
use App\Models\User;
use App\Models\Website\Attachment;
use App\Models\Website\Content;
use App\Models\Website\OutboundMail;
use App\Models\Website\Setting;
use App\Models\Website\Ticket;
use App\Services\Website\DemoService;
use App\Services\Website\MailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WebsitePlatformTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_content_excludes_protected_documentation(): void
    {
        foreach (['docs', 'docs/example', 'platform/integrations', 'platform/integrations/example', 'platform/scheduling'] as $slug) {
            Content::create(['kind' => 'page', 'slug' => $slug, 'draft' => $this->draft(), 'published' => $this->draft(), 'published_at' => now()]);
        }
        $this->getJson('/api/v1/website/content')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', 'platform/scheduling');
        $this->getJson('/api/v1/website/content?q=feature')->assertJsonCount(1, 'data');
    }

    private function authAs(string $role = 'super_admin'): User
    {
        $user = User::factory()->create(['role' => $role]);
        $this->withHeader('Authorization', 'Bearer '.$user->createToken('website-test')->plainTextToken);

        return $user;
    }

    private function draft(): array
    {
        return ['title' => 'A real feature', 'description' => 'A description', 'body' => '<h2 onclick="evil()">Heading</h2><script>alert(1)</script><p>Safe</p>'];
    }

    private function calendar(): void
    {
        $this->travelTo(now()->setDate(2026, 11, 2)->setTime(6, 0));
        Setting::find(1)->update(['data' => ['hours' => ['2' => ['from' => '09:00', 'to' => '12:00']], 'blackouts' => []]]);
    }

    private function booking(string $at = '2026-11-03T07:00:00+00:00'): array
    {
        return ['starts_at' => $at, 'name' => 'Test visitor', 'email' => 'visitor@example.test', 'company' => 'Test company', 'fleet_size' => '11–20'];
    }

    public function test_only_super_admins_can_manage_website(): void
    {
        $this->getJson('/api/v1/website/admin')->assertUnauthorized();
        $this->authAs('user');
        $this->getJson('/api/v1/website/admin')->assertForbidden();
        $this->authAs('driver');
        $this->postJson('/api/v1/website/admin/content', [])->assertForbidden();
        $this->authAs();
        $this->getJson('/api/v1/website/admin')->assertOk();
    }

    public function test_drafts_are_private_and_publication_is_sanitized_and_explicit(): void
    {
        $this->authAs();
        $saved = $this->postJson('/api/v1/website/admin/content', ['kind' => 'page', 'slug' => 'platform/example', 'draft' => $this->draft()])->assertOk()->json('data');
        $this->assertStringNotContainsString('onclick', $saved['draft']['body']);
        $this->assertStringNotContainsString('script', $saved['draft']['body']);
        $this->getJson('/api/v1/website/content?q=feature')->assertJsonCount(0, 'data');
        $this->postJson('/api/v1/website/admin/content/'.$saved['id'].'/publication', ['action' => 'publish'])->assertOk();
        $draft = $this->draft();
        $draft['title'] = 'Secret new title';
        $this->postJson('/api/v1/website/admin/content', ['id' => $saved['id'], 'kind' => 'page', 'slug' => 'platform/example', 'draft' => $draft])->assertOk();
        $this->getJson('/api/v1/website/content')->assertJsonPath('data.0.content.title', 'A real feature');
        $this->postJson('/api/v1/website/admin/content/'.$saved['id'].'/publication', ['action' => 'unpublish'])->assertOk();
        $this->getJson('/api/v1/website/content')->assertJsonCount(0, 'data');
        $this->assertDatabaseHas('activity_logs', ['action' => 'website.publish']);
    }

    public function test_author_and_vacancy_details_are_required_for_publication(): void
    {
        $this->authAs();
        foreach (['blog', 'vacancy'] as $kind) {
            $c = Content::create(['kind' => $kind, 'slug' => $kind.'/test', 'draft' => $this->draft()]);
            $this->postJson('/api/v1/website/admin/content/'.$c->id.'/publication', ['action' => 'publish'])->assertUnprocessable();
        }
    }

    public function test_pricing_changes_invalidate_public_approval(): void
    {
        $this->authAs();
        $p = PricingPlan::create(['title' => 'Paid', 'vehicle_limit' => 20, 'monthly_charge_zar' => 9000, 'monthly_charge_usd' => 499, 'extra_vehicle_price_zar' => 300, 'extra_vehicle_price_usd' => 20, 'is_active' => true, 'is_free' => false]);
        $this->getJson('/api/v1/website/pricing')->assertJsonCount(0, 'data');
        $this->patchJson('/api/v1/website/admin/pricing/'.$p->id, ['public_order' => 1, 'public_vat_wording' => 'Excludes VAT', 'approved' => true])->assertOk();
        $this->getJson('/api/v1/website/pricing')->assertJsonCount(1, 'data');
        $p->update(['monthly_charge_zar' => 9500]);
        $this->getJson('/api/v1/website/pricing')->assertJsonCount(0, 'data');
    }

    public function test_slots_require_hours_and_obey_timezone_and_blackouts(): void
    {
        $this->calendar();
        $this->getJson('/api/v1/website/demo/slots?date=2026-11-03')->assertOk()->assertJsonPath('data.0', '2026-11-03T07:00:00+00:00');
        Setting::find(1)->update(['data' => ['hours' => [], 'blackouts' => []]]);
        $this->getJson('/api/v1/website/demo/slots?date=2026-11-03')->assertJsonCount(0, 'data');
        $this->calendar();
        $s = Setting::find(1);
        $d = $s->data;
        $d['blackouts'] = ['2026-11-03'];
        $s->update(['data' => $d]);
        $this->getJson('/api/v1/website/demo/slots?date=2026-11-03')->assertJsonCount(0, 'data');
    }

    public function test_reservations_exclude_overlaps_and_buffer_and_hide_personal_data(): void
    {
        $this->calendar();
        $this->postJson('/api/v1/website/demo/book', $this->booking())->assertCreated()->assertJsonMissing(['email' => 'visitor@example.test']);
        $this->postJson('/api/v1/website/demo/book', $this->booking())->assertUnprocessable();
        $this->postJson('/api/v1/website/demo/book', $this->booking('2026-11-03T07:30:00+00:00'))->assertUnprocessable();
        $this->postJson('/api/v1/website/demo/book', $this->booking('2026-11-03T07:45:00+00:00'))->assertCreated();
        $response = $this->getJson('/api/v1/website/demo/slots?date=2026-11-03')->assertOk();
        $this->assertStringNotContainsString('visitor@example.test', $response->getContent());
        $this->assertDatabaseCount('website_mail', 2);
    }

    public function test_booking_notice_horizon_and_spam_validation(): void
    {
        $this->calendar();
        $this->postJson('/api/v1/website/demo/book', $this->booking('2026-11-02T07:00:00+00:00'))->assertUnprocessable();
        $this->postJson('/api/v1/website/demo/book', $this->booking('2027-01-05T07:00:00+00:00'))->assertUnprocessable();
        $this->postJson('/api/v1/website/demo/book', array_merge($this->booking(), ['website' => 'spam']))->assertUnprocessable();
    }

    public function test_private_management_links_reschedule_and_cancel_and_expire(): void
    {
        $this->calendar();
        $b = app(DemoService::class)->book($this->booking());
        $mail = OutboundMail::first();
        preg_match('/#token=([a-zA-Z0-9]{64})/', $mail->body, $m);
        $token = $m[1];
        $this->postJson('/api/v1/website/demo/manage', ['token' => $token, 'action' => 'reschedule', 'starts_at' => '2026-11-03T08:00:00+00:00'])->assertOk();
        $this->assertNull($b->fresh()->meeting_url);
        $this->postJson('/api/v1/website/demo/manage', ['token' => $token, 'action' => 'cancel'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->postJson('/api/v1/website/demo/manage', ['token' => $token, 'action' => 'cancel'])->assertConflict();
        $b->update(['token_expires_at' => now()->subDay()]);
        $this->postJson('/api/v1/website/demo/manage', ['token' => $token, 'action' => 'cancel'])->assertNotFound();
    }

    public function test_meeting_updates_queue_calendar_and_cannot_revive_cancelled_booking(): void
    {
        $this->calendar();
        $b = app(DemoService::class)->book($this->booking());
        $this->authAs();
        $this->patchJson('/api/v1/website/admin/bookings/'.$b->id, ['meeting_url' => 'https://example.test/meeting'])->assertOk();
        $this->assertDatabaseCount('website_mail', 2);
        $this->assertStringContainsString('BEGIN:VCALENDAR', OutboundMail::latest()->first()->calendar);
        $this->patchJson('/api/v1/website/admin/bookings/'.$b->id, ['status' => 'cancelled'])->assertOk();
        $this->patchJson('/api/v1/website/admin/bookings/'.$b->id, ['meeting_url' => 'https://example.test/meeting'])->assertConflict();
    }

    public function test_failed_mail_does_not_remove_booking(): void
    {
        $this->calendar();
        $b = app(DemoService::class)->book($this->booking());
        Mail::shouldReceive('raw')->once()->andThrow(new \RuntimeException('Mail offline'));
        app(MailService::class)->deliver(OutboundMail::first()->id);
        $this->assertDatabaseHas('demo_bookings', ['id' => $b->id, 'status' => 'confirmed']);
        $this->assertDatabaseHas('website_mail', ['status' => 'failed', 'attempts' => 1]);
    }

    private function customer(string $role = 'resource_viewer'): array
    {
        $u = $this->authAs('user');
        $m = Merchant::factory()->create();
        $m->users()->attach($u->id, ['role' => ['resource_viewer' => 'read_only', 'biller' => 'billing'][$role] ?? $role]);

        return [$u, $m];
    }

    public function test_viewers_and_billers_can_use_tickets_but_other_merchants_cannot(): void
    {
        foreach (['resource_viewer', 'biller'] as $role) {
            [$u,$m] = $this->customer($role);
            $ticket = $this->postJson('/api/v1/support/tickets', ['merchant_id' => $m->uuid, 'subject' => 'Help', 'category' => 'Billing', 'body' => 'A private question'])->assertCreated()->json('data');
            $this->getJson('/api/v1/support/tickets/'.$ticket['id'])->assertOk();
            $this->patchJson('/api/v1/support/tickets/'.$ticket['id'], ['status' => 'resolved'])->assertOk();
            $this->postJson('/api/v1/support/tickets/'.$ticket['id'].'/replies', ['body' => 'More detail'])->assertOk()->assertJsonPath('data.ticket.status', 'open');
            $this->authAs('user');
            $this->getJson('/api/v1/support/tickets/'.$ticket['id'])->assertForbidden();
        }
    }

    public function test_drivers_and_public_cannot_access_tickets(): void
    {
        $this->getJson('/api/v1/support/tickets')->assertUnauthorized();
        $this->authAs('driver');
        $this->getJson('/api/v1/support/tickets')->assertForbidden();
    }

    public function test_ticket_attachments_are_private_and_validated(): void
    {
        Storage::fake('local');
        [$u,$m] = $this->customer();
        $this->post('/api/v1/support/tickets', ['merchant_id' => $m->uuid, 'subject' => 'Help', 'category' => 'Other', 'body' => 'File', 'attachments' => [UploadedFile::fake()->create('script.html', 1, 'text/html')]], ['Accept' => 'application/json'])->assertUnprocessable();
        $t = $this->post('/api/v1/support/tickets', ['merchant_id' => $m->uuid, 'subject' => 'Help', 'category' => 'Other', 'body' => 'File', 'attachments' => [UploadedFile::fake()->image('photo.png')]], ['Accept' => 'application/json'])->assertCreated()->json('data');
        $a = Attachment::first();
        $this->get('/api/v1/support/attachments/'.$a->id)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->authAs('user');
        $this->getJson('/api/v1/support/attachments/'.$a->id)->assertForbidden();
        $this->getJson('/api/v1/website/content?q=File')->assertJsonCount(0, 'data');
    }

    public function test_customers_cannot_assign_staff_and_super_admins_can_reply(): void
    {
        [$u,$m] = $this->customer();
        $t = Ticket::create(['merchant_id' => $m->id, 'created_by' => $u->id, 'subject' => 'Help', 'category' => 'Other']);
        $this->patchJson('/api/v1/support/tickets/'.$t->id, ['assigned_to' => $u->id])->assertForbidden();
        $admin = $this->authAs();
        $this->patchJson('/api/v1/support/tickets/'.$t->id, ['assigned_to' => $admin->id])->assertOk();
        $this->postJson('/api/v1/support/tickets/'.$t->id.'/replies', ['body' => 'We can help'])->assertOk()->assertJsonPath('data.ticket.status', 'awaiting_customer');
    }

    public function test_reminders_are_queued_once_for_upcoming_confirmed_bookings(): void
    {
        $this->calendar();
        $b = app(DemoService::class)->book($this->booking());
        app(DemoService::class)->remindDue();
        $this->assertDatabaseCount('website_mail', 1);
        $this->travelTo($b->starts_at->subHours(23));
        app(DemoService::class)->remindDue();
        app(DemoService::class)->remindDue();
        $this->assertDatabaseCount('website_mail', 2);
        $this->assertNotNull($b->fresh()->reminded_at);
    }

    public function test_failed_delivery_can_be_retried_only_by_super_admins(): void
    {
        $mail = OutboundMail::create(['recipient' => 'example@example.test', 'subject' => 'Test', 'body' => 'Private test', 'status' => 'failed', 'attempts' => 5]);
        $this->authAs('user');
        $this->postJson('/api/v1/website/admin/mail/'.$mail->id.'/retry')->assertForbidden();
        $this->authAs();
        $this->postJson('/api/v1/website/admin/mail/'.$mail->id.'/retry')->assertOk();
        $this->assertSame(0, $mail->fresh()->attempts);
        Mail::fake();
        app(MailService::class)->deliver($mail->id);
        $this->assertSame('sent', $mail->fresh()->status);
    }

    public function test_admin_booking_list_filters_by_local_day_and_excludes_customers(): void
    {
        $this->calendar();
        app(DemoService::class)->book($this->booking());
        $this->authAs('user');
        $this->getJson('/api/v1/website/admin/bookings')->assertForbidden();
        $this->authAs();
        $this->getJson('/api/v1/website/admin/bookings?date=2026-11-03')->assertOk()->assertJsonCount(1, 'data.data');
        $this->getJson('/api/v1/website/admin/bookings?date=2026-11-04')->assertOk()->assertJsonCount(0, 'data.data');
    }
}
