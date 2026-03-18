<?php

namespace App\Events;

use App\Http\Resources\VehicleActivityResource;
use App\Models\VehicleActivity;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VehicleActivityCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public VehicleActivity $activity)
    {
    }

    public function broadcastOn(): array
    {
        $merchantUuid = (string) optional($this->activity->merchant)->uuid;

        return [
            new PrivateChannel("merchant.{$merchantUuid}.vehicle-activities"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'vehicle.activity.created';
    }

    public function broadcastWith(): array
    {
        return [
            'activity' => (new VehicleActivityResource($this->activity))->resolve(),
        ];
    }
}
