<?php

namespace Tests\Support;

trait DrawnGeofence
{
    private function squareGeofence(float $lat, float $lng): string
    {
        $south = $lat - 0.001;
        $north = $lat + 0.001;
        $west = $lng - 0.001;
        $east = $lng + 0.001;

        return "POLYGON(($west $south, $east $south, $east $north, $west $north, $west $south))";
    }
}
