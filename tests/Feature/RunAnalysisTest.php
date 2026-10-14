<?php

namespace Tests\Feature;

use App\Jobs\AnalyzeRun;
use App\Models\Account;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunAnalysis;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\Integrations\OpenAIService;
use App\Services\RunAnalysisService;
use App\Services\RunAnalysisSnapshot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class RunAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id, 'timezone' => 'Africa/Johannesburg']);
        $merchant->users()->attach($user->id, ['role' => 'owner']);
        $vehicle = Vehicle::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'plate_number' => 'AI-RUN-1']);
        $run = Run::create(['vehicle_id' => $vehicle->id, 'account_id' => $account->id, 'merchant_id' => $merchant->id, 'status' => 'in_progress', 'started_at' => now()->subHours(4), 'driver_workflow' => true]);
        $headers = ['Authorization' => 'Bearer '.$user->createToken('analysis')->plainTextToken, 'X-Merchant-Id' => $merchant->uuid];
        config(['services.openai.api_key' => 'fake-test-key']);
        Queue::fake();

        return compact('user', 'account', 'merchant', 'run', 'headers', 'vehicle');
    }

    private function report(): array
    {
        return ['conclusion' => 'Awaiting dispatch closure.', 'expected_ending' => 'Dispatch approval is required.', 'observed_ending' => 'Run remains active.', 'limitations' => ['No expected total duration is configured.'], 'red_flags' => [], 'missing_locations' => []];
    }

    private function submit(array $c, ?string $key = null)
    {
        return $this->postJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', ['request_key' => $key ?? (string) Str::uuid()], $c['headers']);
    }

    private function job(RunAnalysis $analysis): void
    {
        (new AnalyzeRun($analysis->id))->handle(app(RunAnalysisSnapshot::class), app(OpenAIService::class), app(RunAnalysisService::class));
    }

    private function fakeAi(array $report): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        Http::fake(['*/v1/responses' => Http::response(['status' => 'completed', 'model' => 'test-model', 'output' => [['content' => [['type' => 'output_text', 'text' => json_encode($report)]]]]])]);
    }

    public function test_analysis_is_queued_once_and_saved_report_reopens_with_prior_result_during_reanalysis(): void
    {
        $c = $this->context();
        $key = (string) Str::uuid();
        $first = $this->submit($c, $key)->assertStatus(202)->json('data.analysis_id');
        $this->submit($c, $key)->assertStatus(202)->assertJsonPath('data.analysis_id', $first);
        $this->submit($c)->assertStatus(202)->assertJsonPath('data.analysis_id', $first);
        Queue::assertPushed(AnalyzeRun::class, 1);
        $this->fakeAi($this->report());
        $analysis = RunAnalysis::firstOrFail();
        $this->job($analysis);
        $this->assertSame('completed', $analysis->refresh()->status);
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $c['headers'])->assertOk()->assertJsonPath('data.saved.report.conclusion', 'Awaiting dispatch closure.')->assertJsonPath('data.stale', false);
        $second = $this->submit($c)->assertStatus(202)->json('data.analysis_id');
        $this->assertNotSame($first, $second);
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $c['headers'])->assertOk()->assertJsonPath('data.latest.status', 'queued')->assertJsonPath('data.saved.analysis_id', $first);
        $c['merchant']->update(['location_automation_settings' => ['location_types' => [['changed' => true]]]]);
        $this->travel(31)->seconds();
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $c['headers'])->assertOk()->assertJsonPath('data.stale', true);
    }

    public function test_input_contains_effective_rules_types_and_only_scoped_evidence(): void
    {
        $c = $this->context();
        $other = $this->context();
        $type = LocationType::create(['account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'title' => 'Depot', 'slug' => 'depot', 'collection_point' => true]);
        $c['merchant']->update(['location_automation_settings' => ['location_types' => [['location_type_id' => $type->uuid, 'exit' => [['id' => 'rule', 'action' => 'record_vehicle_exit', 'conditions' => [['field' => 'run_status', 'value' => 'in_progress']]]]]]]]);
        $event = VehicleActivity::create(['vehicle_id' => $c['vehicle']->id, 'account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'run_id' => $c['run']->id, 'event_type' => 'run_ended', 'occurred_at' => now(), 'metadata' => ['reason' => 'collection_point_entry', 'automation_action' => ['action' => 'start_run']]]);
        VehicleActivity::create(['vehicle_id' => $other['vehicle']->id, 'account_id' => $other['account']->id, 'merchant_id' => $other['merchant']->id, 'run_id' => $c['run']->id, 'event_type' => 'stopped', 'occurred_at' => now()]);
        $input = app(RunAnalysisSnapshot::class)->build($c['run']);
        $this->assertCount(1, $input['events']);
        $this->assertSame($event->uuid, $input['events'][0]['evidence_id']);
        $this->assertSame('start_run', $input['events'][0]['execution']['automation_action']['action']);
        $this->assertSame('fallback', $input['location_types'][0]['effective_rules_now']['entry_source']);
        $this->assertSame('configured', $input['location_types'][0]['effective_rules_now']['exit_source']);
        $this->assertSame('start_run', $input['location_types'][0]['effective_rules_now']['entry'][1]['action']);
        $this->assertTrue($input['lifecycle_contract']['driver_workflow_requires_dispatch_closure']);
        $this->assertNull($input['lifecycle_contract']['expected_total_duration']);
    }

    public function test_unknown_location_prefill_creates_nothing_and_rechecks_new_saved_locations(): void
    {
        $c = $this->context();
        $event = VehicleActivity::create(['vehicle_id' => $c['vehicle']->id, 'account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'run_id' => $c['run']->id, 'event_type' => 'stopped', 'latitude' => -26, 'longitude' => 28, 'occurred_at' => now()]);
        $report = $this->report();
        $report['missing_locations'][] = ['candidate_id' => $event->uuid, 'reason' => 'Important terminal stop is not saved.', 'suggested_name' => 'Review terminal', 'location_type_id' => null];
        $this->submit($c)->assertStatus(202);
        $this->fakeAi($report);
        $analysis = RunAnalysis::firstOrFail();
        $this->job($analysis);
        $url = '/api/v1/runs/'.$c['run']->uuid.'/analysis/'.$analysis->uuid.'/locations/'.$event->uuid.'/prefill';
        $this->getJson($url, $c['headers'])->assertOk()->assertJsonPath('data.initial_values.name', 'Review terminal')->assertJsonPath('data.initial_values.latitude', -26);
        $this->assertDatabaseCount('locations', 0);
        $saved = Location::create(['account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'name' => 'Terminal', 'address_line_1' => '1 Main', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000', 'latitude' => -26, 'longitude' => 28]);
        $this->getJson($url, $c['headers'])->assertOk()->assertJsonPath('data.existing_location_id', $saved->uuid)->assertJsonPath('data.initial_values', null);
    }

    public function test_recorded_provider_description_enriches_snapshot_saved_report_and_review_form(): void
    {
        $c = $this->context();
        $event = VehicleActivity::create(['vehicle_id' => $c['vehicle']->id, 'account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'run_id' => $c['run']->id, 'event_type' => 'stopped', 'latitude' => -26, 'longitude' => 28, 'occurred_at' => now(), 'metadata' => ['provider_position' => ['latitude' => -26, 'longitude' => 28, 'formatted_address' => '12 Depot Road, Johannesburg', 'location_name' => 'MiX Terminal']]]);
        $report = $this->report();
        $report['missing_locations'][] = ['candidate_id' => $event->uuid, 'reason' => 'Important unmatched stop.', 'suggested_name' => 'AI guessed name', 'location_type_id' => null];
        $this->submit($c);
        $this->fakeAi($report);
        $analysis = RunAnalysis::firstOrFail();
        $this->job($analysis);
        $this->assertSame('MiX Terminal', $analysis->refresh()->input_snapshot['missing_location_candidates'][0]['provider_name']);
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $c['headers'])->assertOk()->assertJsonPath('data.saved.report.missing_locations.0.provider_address', '12 Depot Road, Johannesburg');
        $url = '/api/v1/runs/'.$c['run']->uuid.'/analysis/'.$analysis->uuid.'/locations/'.$event->uuid.'/prefill';
        $this->getJson($url, $c['headers'])->assertOk()->assertJsonPath('data.initial_values.name', 'MiX Terminal')->assertJsonPath('data.initial_values.address_line_1', '12 Depot Road, Johannesburg');
        // Old reports recover the recorded address, but never from a different coordinate.
        $snapshot = $analysis->input_snapshot;
        unset($snapshot['missing_location_candidates'][0]['provider_name'], $snapshot['missing_location_candidates'][0]['provider_address'], $snapshot['missing_location_candidates'][0]['description_source']);
        $analysis->update(['input_snapshot' => $snapshot]);
        $this->getJson($url, $c['headers'])->assertOk()->assertJsonPath('data.initial_values.name', 'MiX Terminal');
        $event->update(['metadata' => ['provider_position' => ['latitude' => -27, 'longitude' => 29, 'formatted_address' => 'Wrong current address']]]);
        $c['vehicle']->update(['metadata' => ['tracking_position' => ['latitude' => -26, 'longitude' => 28, 'formatted_address' => 'Latest vehicle address']]]);
        $this->getJson($url, $c['headers'])->assertOk()->assertJsonPath('data.initial_values.name', 'AI guessed name')->assertJsonPath('data.initial_values.address_line_1', null);
        $this->assertDatabaseCount('locations', 0);
    }

    public function test_other_merchant_viewer_and_missing_configuration_cannot_generate(): void
    {
        $c = $this->context();
        $other = $this->context();
        $this->submit(['run' => $c['run'], 'headers' => $other['headers']])->assertNotFound();
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $other['headers'])->assertNotFound();
        $viewer = User::factory()->create(['role' => 'user', 'account_id' => $c['account']->id]);
        $c['merchant']->users()->attach($viewer->id, ['role' => 'read_only']);
        $headers = ['Authorization' => 'Bearer '.$viewer->createToken('viewer')->plainTextToken, 'X-Merchant-Id' => $c['merchant']->uuid];
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $headers)->assertOk()->assertJsonPath('data.can_analyze', false);
        $this->submit(['run' => $c['run'], 'headers' => $headers])->assertForbidden();
        config(['services.openai.api_key' => '']);
        $this->submit($c)->assertStatus(503);
        $this->assertDatabaseCount('run_analyses', 0);
    }

    public function test_invalid_ai_output_fails_safely_and_preserves_successful_report(): void
    {
        $c = $this->context();
        $this->submit($c);
        $this->fakeAi($this->report());
        $first = RunAnalysis::first();
        $this->job($first);
        $this->submit($c);
        $second = RunAnalysis::latest('id')->first();
        $bad = $this->report();
        $bad['missing_locations'][] = ['candidate_id' => 'invented', 'reason' => 'x', 'suggested_name' => 'x', 'location_type_id' => null];
        $this->fakeAi($bad);
        try {
            $this->job($second);
            $this->fail('Expected report rejection');
        } catch (\RuntimeException $e) {
            $this->assertSame('Run analysis failed.', $e->getMessage());
        }
        $this->assertSame('failed', $second->refresh()->status);
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $c['headers'])->assertOk()->assertJsonPath('data.saved.analysis_id', $first->uuid)->assertJsonPath('data.latest.error', 'Analysis could not be completed. Please try again.');
    }

    public function test_job_duplicate_delivery_and_expired_work_do_not_overwrite_results(): void
    {
        $c = $this->context();
        $this->submit($c);
        $this->fakeAi($this->report());
        $analysis = RunAnalysis::first();
        $this->job($analysis);
        $this->job($analysis);
        Http::assertSentCount(1);
        $this->submit($c);
        $pending = RunAnalysis::latest('id')->first();
        $pending->update(['created_at' => now()->subMinutes(20)]);
        $this->getJson('/api/v1/runs/'.$c['run']->uuid.'/analysis', $c['headers'])->assertOk()->assertJsonPath('data.latest.status', 'failed');
        $this->job($pending);
        Http::assertSentCount(1);
        $this->submit($c)->assertStatus(202);
        $this->assertDatabaseCount('run_analyses', 3);
    }

    public function test_waiting_facts_are_bounded_and_completed_runs_remain_analyzable(): void
    {
        $c = $this->context();
        $location = Location::create(['account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'name' => 'Depot', 'address_line_1' => '1 Main', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000', 'expected_waiting_time' => 30]);
        $c['run']->update(['status' => 'completed', 'started_at' => '2026-10-14 00:00:00', 'completed_at' => '2026-10-14 03:00:00']);
        VehicleActivity::create(['vehicle_id' => $c['vehicle']->id, 'account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'run_id' => $c['run']->id, 'location_id' => $location->id, 'event_type' => 'entered_location', 'occurred_at' => '2026-10-14 00:00:00', 'entered_at' => '2026-10-13 23:00:00', 'exited_at' => '2026-10-14 04:00:00']);
        $snapshot = app(RunAnalysisSnapshot::class)->build($c['run']);
        $this->assertEquals(10800, $snapshot['events'][0]['duration_seconds']);
        $this->assertEquals(9000, $snapshot['events'][0]['exceeded_wait_seconds']);
        $this->submit($c)->assertStatus(202);
    }

    public function test_location_recommendations_and_types_are_environment_scoped_and_reject_invented_evidence(): void
    {
        $c = $this->context();
        $env = \App\Models\MerchantEnvironment::create(['account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'name' => 'Test', 'color' => '#2563eb', 'url' => 'https://environment.example.test', 'token_hash' => hash('sha256', 'test-environment')]);
        Location::create(['account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'environment_id' => $env->id, 'name' => 'Other environment stop', 'address_line_1' => '1 Main', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000', 'latitude' => -26, 'longitude' => 28]);
        VehicleActivity::create(['vehicle_id' => $c['vehicle']->id, 'account_id' => $c['account']->id, 'merchant_id' => $c['merchant']->id, 'run_id' => $c['run']->id, 'event_type' => 'stopped', 'latitude' => -26, 'longitude' => 28, 'occurred_at' => now()]);
        $snapshot = app(RunAnalysisSnapshot::class)->build($c['run']);
        $this->assertCount(1, $snapshot['missing_location_candidates']);
        $this->assertCount(0, $snapshot['locations']);
        $bad = $this->report();
        $bad['red_flags'][] = ['severity' => 'high', 'certainty' => 'confirmed', 'title' => 'x', 'finding' => 'x', 'action' => 'x', 'details' => 'x', 'evidence_ids' => ['invented']];
        $this->expectException(\RuntimeException::class);
        app(RunAnalysisService::class)->validateReport($bad, $snapshot);
    }
}
