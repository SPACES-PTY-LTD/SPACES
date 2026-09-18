<?php

return [
    'recording_enabled' => env('VEHICLE_HISTORY_RECORDING_ENABLED', false),
    'display_enabled' => env('VEHICLE_HISTORY_DISPLAY_ENABLED', false),
    'stationary_speed_kph' => (float) env('VEHICLE_HISTORY_STATIONARY_SPEED_KPH', 3),
    'stationary_radius_metres' => (float) env('VEHICLE_HISTORY_STATIONARY_RADIUS_METRES', 25),
    'gap_seconds' => 300,
    'max_coordinates' => 2000,
    'read_batch' => 10000,
];
