

- Routes Stats
lets plan add discuss, on the routes detailed page i want to show some stats so we need a new stats endpoint for a route but lets plan what we are going to show. We are insterested in improving efeciency so we need to talk about distance travelled and the time spent drivng/ avergages and anything you can. think of that might be usefull

On the frontend rember to add tooltips to explain what each stats is

Example JSON
{
  // Unique route identifier
  "route_id": "route_9f3c2a10",

  // Timestamp when stats were generated (UTC)
  "generated_at": "2026-03-05T10:15:00Z",

  // Display helpers for frontend formatting
  "currency": "ZAR",
  "units": {
    "distance": "km",
    "duration": "minutes",
    "speed": "km/h",
    "percent": "%"
  },

  "summary": {
    // Planned route distance from route definition
    "planned_distance_km": 128.4,

    // Actual GPS-derived total distance
    "actual_distance_km": 141.2,

    // Difference between actual and planned distance
    "distance_variance_km": 12.8,
    "distance_variance_pct": 9.97,

    // Total elapsed route time (start -> finish)
    "total_route_duration_min": 525,

    // Time moving above movement threshold (e.g. >5 km/h)
    "driving_time_min": 312,

    // Engine on / route active but not moving
    "idle_time_min": 96,

    // Time spent at stops (deliveries, waiting, etc.)
    "stop_time_min": 117,

    // Route efficiency-style KPIs
    "utilization_pct": 59.43,
    "idle_ratio_pct": 18.29,
    "avg_moving_speed_kmh": 27.2,

    // Stop completion performance
    "on_time_stops": 18,
    "late_stops": 4,
    "completed_stops": 22,
    "planned_stops": 24
  },

  "return_to_collection": {
    // Collection/depot hub this route should return to
    "collection_point_id": "hub_jhb_01",
    "collection_point_name": "JHB Main Depot",

    // Whether return leg was detected
    "returned_to_collection": true,

    // Key metric you requested: km travelled back to collection point
    "return_leg_distance_km": 17.6,

    // Return leg duration and driving quality
    "return_leg_duration_min": 41,
    "return_leg_avg_speed_kmh": 25.8,
    "return_leg_idle_min": 7
  },

  "averages": {
    // Driver baseline to compare this route against
    "driver_last_10_routes": {
      "avg_total_distance_km": 136.9,
      "avg_return_distance_km": 14.2,
      "avg_return_duration_min": 34,
      "avg_idle_ratio_pct": 15.8
    },

    // Historical baseline for this same route pattern/template
    "same_route_last_30_days": {
      "avg_total_distance_km": 133.1,
      "avg_return_distance_km": 15.4,
      "avg_return_duration_min": 36,
      "avg_idle_ratio_pct": 16.6
    },

    // Fleet-wide benchmark baseline
    "fleet_last_30_days": {
      "avg_total_distance_km": 129.7,
      "avg_return_distance_km": 12.9,
      "avg_return_duration_min": 31,
      "avg_idle_ratio_pct": 14.9
    }
  },

  "deltas": {
    // Positive means this route is higher than benchmark
    "vs_driver_avg_return_distance_km": 3.4,
    "vs_route_avg_return_distance_km": 2.2,
    "vs_fleet_avg_return_distance_km": 4.7,

    // Idle ratio gap vs driver average
    "vs_driver_avg_idle_ratio_pct": 2.49
  },

  "time_breakdown": {
    // Useful for stacked bars or donut chart
    "driving_pct": 59.43,
    "idle_pct": 18.29,
    "stopped_pct": 22.29
  },

  "timeline": [
    {
      // Segment-level breakdown for charting
      "segment": "depot_to_first_stop",
      "distance_km": 12.3,
      "duration_min": 28,
      "idle_min": 4
    },
    {
      "segment": "delivery_run",
      "distance_km": 111.3,
      "duration_min": 456,
      "idle_min": 85
    },
    {
      // Explicit return leg segment
      "segment": "return_to_collection",
      "distance_km": 17.6,
      "duration_min": 41,
      "idle_min": 7
    }
  ]
}


===========
lets plan and discuss, the users on the systm must be merchant specific, so we want to be able to invite users on the system, so each merchant must be able to invite users. Account holders will obviously have access to create more merchants and invite more users to specific merchant. So when logged to an organisation if you are the account holder youcan see all users however if you are an invite user you will not be able to see the users. Users can be invited to multiple merchants.


1. The member_user needs to have permissions. The permissions could be
- Member: Full access 
- Modifer: can read,create, update but cannot delete.
- Biller: Can access billing information. Cannot access any other resourcer. (we currently don't have billing but we will be adding it under settings)
- Resource Viewer: Read only access to resources
2. The account holder will automatically be a member of all merchants


What do we need to make this work?