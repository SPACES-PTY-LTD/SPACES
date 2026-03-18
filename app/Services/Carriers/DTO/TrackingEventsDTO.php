<?php

namespace App\Services\Carriers\DTO;

class TrackingEventsDTO
{
    public array $events;

    public function __construct(array $events)
    {
        $this->events = $events;
    }
}
