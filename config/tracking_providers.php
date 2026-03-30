<?php

use App\Services\Fleetboard\FleetboardService;
use App\Services\Mixtelematics\MixIntegrateService;

return [
    'services' => [
        'powerfleet' => MixIntegrateService::class,
        'fleetboard' => FleetboardService::class,
    ],
];
