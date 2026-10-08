import type { DriverRunSummary } from "../../lib/api";

export type RunCardLocation = { name: string; address: string | null };
export type RunCardStop = {
    label: string;
    location: RunCardLocation | null;
    current?: boolean;
    unknown?: boolean;
};

export function runCardRoute(run: DriverRunSummary): RunCardStop[] {
    const stops: RunCardStop[] = [
        { label: "Starting point", location: run.origin },
    ];
    if (run.status === "completed") {
        stops.push(
            run.recorded_end
                ? { label: "End point", location: run.recorded_end }
                : run.destination
                  ? { label: "Planned end", location: run.destination }
                  : { label: "End point", location: null, unknown: true },
        );
    } else {
        if (!run.destination) {
            stops.push({
                label: "Current location",
                location: run.current_location ?? null,
                current: true,
            });
        }
        stops.push({
            label: "Planned end",
            location: run.destination,
            unknown: !run.destination,
        });
    }
    return stops;
}
