<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class VehicleHistoryConcurrencyTest extends TestCase
{
    public function test_parallel_deliveries_create_one_stop_and_unique_receipts(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'vehicle-history-');
        $original = config('database.default');
        config(['database.connections.history_concurrency' => array_replace(config('database.connections.sqlite'), ['database' => $path]), 'database.default' => 'history_concurrency']);
        try {
            Artisan::call('migrate', ['--database' => 'history_concurrency', '--force' => true]);
            $user = User::factory()->create();
            $account = Account::create(['owner_user_id' => $user->id]);
            $merchant = Merchant::factory()->create(['account_id' => $account->id]);
            $vehicle = Vehicle::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'plate_number' => 'CONCURRENT']);
            $code = <<<'PHP'
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['database.default'=>'sqlite','database.connections.sqlite.database'=>$argv[1], 'cache.default'=>'array','vehicle_history.recording_enabled'=>true]);
Illuminate\Support\Facades\DB::purge('sqlite');
$v = App\Models\Vehicle::findOrFail($argv[2]);
$i = new App\Models\MerchantIntegration();
$i->forceFill(['id'=>17,'merchant_id'=>$v->merchant_id]);
app(App\Services\VehicleLocationHistoryService::class)->record($v,$i,Carbon\Carbon::parse($argv[3]),-30,30,0,null);
PHP;
            foreach (['2026-09-18 08:00:00', '2026-09-18 08:01:00'] as $at) {
                $workers = [];
                for ($n = 0; $n < 4; $n++) {
                    $worker = new Process([PHP_BINARY, '-r', $code, $path, (string) $vehicle->id, $at], base_path(), ['APP_ENV' => 'testing']);
                    $worker->start();
                    $workers[] = $worker;
                }
                foreach ($workers as $worker) {
                    $worker->wait();
                    $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput().$worker->getOutput());
                }
            }
            $this->assertSame(1, DB::table('vehicle_location_history')->count());
            $this->assertSame(2, DB::table('vehicle_location_history')->value('sample_count'));
            $this->assertSame(2, DB::table('vehicle_location_receipts')->count());
            config(['vehicle_history.recording_enabled' => true, 'vehicle_history.display_enabled' => true]);
            $run = \App\Models\Run::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'started_at' => '2026-09-18 08:00:00', 'completed_at' => '2026-09-18 09:00:00', 'status' => 'completed']);
            $integration = new \App\Models\MerchantIntegration;
            $integration->forceFill(['id' => 17, 'merchant_id' => $merchant->id]);
            $recorder = app(\App\Services\VehicleLocationHistoryService::class);
            $tracks = app(\App\Services\RunTrackService::class);
            $recorder->record($vehicle, $integration, \Carbon\Carbon::parse('2026-09-18 08:02:00'), -30, 30, 40, null);
            $this->assertSame(1, $tracks->get($run)['coverage']['displayed_coordinates']);
            $recorder->record($vehicle, $integration, \Carbon\Carbon::parse('2026-09-18 08:01:30'), -30.01, 30, 40, null);
            $this->assertSame(2, $tracks->get($run)['coverage']['displayed_coordinates']);

        } finally {
            DB::disconnect('history_concurrency');
            config(['database.default' => $original]);
            unlink($path);
        }
    }
}
