import { Feather } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "@/component/ui/Text";
import type { DriverRunSummary } from "@/src/lib/api";

export function runStatusLabel(status: DriverRunSummary["status"]) {
    return status === "completed"
        ? "Completed"
        : status === "in_progress"
          ? "In progress"
          : "Ready to start";
}

export function RunSummaryCard({ run }: { run: DriverRunSummary }) {
    const date =
        run.status === "completed"
            ? run.completed_at
            : run.started_at || run.planned_start_at;
    const dateLabel =
        run.status === "completed"
            ? "Completed"
            : run.started_at
              ? "Started"
              : "Planned start";
    return (
        <View className="bg-[#F5F5F8] dark:bg-card rounded-xl p-5 gap-3">
            <View className="flex-row items-start justify-between gap-3">
                <Text className="text-card-foreground text-xl font-semibold flex-1">
                    {run.reference}
                </Text>
                <View className="bg-white dark:bg-muted rounded-lg px-3 py-2">
                    <Text className="text-card-foreground text-xs font-semibold">
                        {runStatusLabel(run.status)}
                    </Text>
                </View>
            </View>
            <Text className="text-muted-foreground text-sm">
                Vehicle:{" "}
                {run.vehicle?.plate_number ||
                    run.vehicle?.ref_code ||
                    "Not assigned"}
            </Text>
            <View className="bg-white dark:bg-muted rounded-xl p-4 gap-3">
                {[
                    { label: "Starting point", location: run.origin },
                    { label: "Planned end", location: run.destination },
                ].map(({ label, location }) => (
                    <View key={label} className="flex-row gap-3">
                        <Feather
                            name={
                                label === "Starting point" ? "map-pin" : "flag"
                            }
                            size={18}
                            color="#F54A4A"
                        />
                        <View className="flex-1 gap-1">
                            <Text className="text-muted-foreground text-xs">
                                {label}
                            </Text>
                            <Text className="text-card-foreground font-medium">
                                {location?.name || "Not chosen"}
                            </Text>
                            {!!location?.address && (
                                <Text className="text-muted-foreground text-sm">
                                    {location.address}
                                </Text>
                            )}
                        </View>
                    </View>
                ))}
            </View>
            <Text className="text-muted-foreground text-sm">
                {run.shipment_count} shipments · {run.delivered_count} delivered
                · {run.remaining_count} remaining
            </Text>
            <Text className="text-muted-foreground text-sm">
                {dateLabel}:{" "}
                {date
                    ? new Date(date).toLocaleString()
                    : run.status === "completed"
                      ? "Not recorded"
                      : "Not scheduled"}
            </Text>
            {run.end_request?.status === "pending" && (
                <Text className="text-card-foreground text-sm">
                    End run requested — awaiting dispatch approval
                </Text>
            )}
            {run.status === "in_progress" &&
                run.shipment_count > 0 &&
                run.delivered_count === run.shipment_count && (
                    <Text className="text-card-foreground text-sm">
                        Deliveries completed — awaiting dispatch closure.
                    </Text>
                )}
        </View>
    );
}
