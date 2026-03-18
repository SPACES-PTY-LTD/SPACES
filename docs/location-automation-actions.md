# Location Automation Actions

| Action Name | Action Description |
| --- | --- |
| Record vehicle entry | Keeps the standard geofence entry visit record. The entry activity is already written before automation runs, so this step is mainly explicit documentation inside the configured flow. |
| Record vehicle exit | Keeps the standard geofence exit visit record. Shipment delivery stage timing is closed on this exit, and matching auto-created shipments are marked delivered from this lifecycle event. |
| End run & start new run | Starts a new run from the current collection point. If an active run already has shipments, it is completed first at the current location (destination and route updated) and a new run is started. If the active run has no shipments, it stays open and is reused. |
| Create shipment | Creates one auto-created shipment per run and dropoff location, links it to the run, ensures a booking exists, sets `collection_date` to at least one second after run start, writes the shipment collection stage at run origin, and opens the shipment delivery stage at the current location. |
