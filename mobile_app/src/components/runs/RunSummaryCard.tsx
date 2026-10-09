import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { Text } from "@/component/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DriverRunSummary } from "@/src/lib/api";
import { runCardRoute, type RunCardStop } from "./run-card-route";

const rails = {
    start: require("@/assets/images/runs/start-rail.svg"),
    current: require("@/assets/images/runs/current-rail.svg"),
    end: require("@/assets/images/runs/end-marker.svg"),
    unknown: require("@/assets/images/runs/unknown-marker.svg"),
};
const darkRails = {
    start: require("@/assets/images/runs/start-rail-dark.svg"),
    current: require("@/assets/images/runs/current-rail-dark.svg"),
    end: require("@/assets/images/runs/end-marker-dark.svg"),
    unknown: require("@/assets/images/runs/unknown-marker-dark.svg"),
};

export function runStatusLabel(status: DriverRunSummary["status"]) {
    return status === "completed"
        ? "Completed"
        : status === "in_progress"
          ? "In progress"
          : "Ready to start";
}

function RouteStop({
    stop,
    last,
    dark,
}: {
    stop: RunCardStop;
    last: boolean;
    dark: boolean;
}) {
    const rail = stop.current
        ? "current"
        : last
          ? stop.unknown
              ? "unknown"
              : "end"
          : "start";
    const railHeight = rail === "end" ? 62 : rail === "unknown" ? 41 : 110;
    const muted = dark ? "#A1A1AA" : "#71717A";
    const ink = dark ? "#FAFAFA" : "#111111";
    return (
        <View style={[styles.routeRow, { minHeight: railHeight }]}>
            <View
                style={styles.rail}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
            >
                <Image
                    source={(dark ? darkRails : rails)[rail]}
                    style={{ width: 24, height: railHeight }}
                    contentFit="contain"
                    accessibilityElementsHidden
                />
                {!last && (
                    <View
                        style={[
                            styles.railExtension,
                            {
                                top: railHeight,
                                borderColor: stop.current
                                    ? dark
                                        ? "#52525B"
                                        : "#CFCFD7"
                                    : "#15803d",
                                borderStyle: stop.current ? "dashed" : "solid",
                            },
                        ]}
                    />
                )}
            </View>
            <View
                style={[
                    styles.location,
                    !last && styles.locationSpacing,
                    stop.current && {
                        backgroundColor: dark ? "#142e20" : "#f0fdf4",
                        padding: 8,
                        borderRadius: 8,
                    },
                ]}
            >
                <Text
                    style={[
                        styles.caption,
                        { color: stop.current ? "#15803d" : muted },
                    ]}
                >
                    {stop.label}
                </Text>
                <Text
                    style={[
                        styles.locationName,
                        { color: stop.unknown ? muted : ink },
                    ]}
                >
                    {stop.location?.name || "Unknown"}
                </Text>
                {!!stop.location?.address && (
                    <Text style={[styles.caption, { color: muted }]}>
                        {stop.location.address}
                    </Text>
                )}
            </View>
        </View>
    );
}

export function RunSummaryCard({ run }: { run: DriverRunSummary }) {
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === "dark";
    const ink = dark ? "#FAFAFA" : "#111111";
    const muted = dark ? "#A1A1AA" : "#71717A";
    const panel = dark ? "#27272A" : "#FFFFFF";
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
    const parsedDate = date ? new Date(date) : null;
    const formattedDate =
        parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleString("en-GB", {
                  timeZone: run.timezone,
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
              })
            : run.status === "completed"
              ? "Not recorded"
              : "Not scheduled";
    const stops = runCardRoute(run);
    return (
        <View
            style={[
                styles.card,
                { backgroundColor: dark ? "#18181B" : "#F5F5F8" },
            ]}
        >
            <View style={styles.heading}>
                <Text style={[styles.reference, { color: ink }]}>
                    {run.reference}
                </Text>
                <View style={[styles.badge, { backgroundColor: panel }]}>
                    <Text
                        style={[
                            styles.caption,
                            { color: ink, textAlign: "center" },
                        ]}
                    >
                        {runStatusLabel(run.status)}
                    </Text>
                </View>
            </View>
            <Text style={[styles.vehicle, { color: muted }]}>
                Vehicle:{" "}
                {run.vehicle?.plate_number ||
                    run.vehicle?.ref_code ||
                    "Not assigned"}
            </Text>
            <View style={[styles.routePanel, { backgroundColor: panel }]}>
                {stops.map((stop, index) => (
                    <RouteStop
                        key={stop.label}
                        stop={stop}
                        last={index === stops.length - 1}
                        dark={dark}
                    />
                ))}
            </View>
            <View style={styles.stats}>
                {[
                    {
                        value: run.shipment_count,
                        label:
                            run.shipment_count === 1 ? "shipment" : "shipments",
                    },
                    { value: run.delivered_count, label: "delivered" },
                    { value: run.remaining_count, label: "remaining" },
                ].map((stat) => (
                    <View key={stat.label} style={styles.stat}>
                        <Text style={[styles.locationName, { color: ink }]}>
                            {stat.value}
                        </Text>
                        <Text style={[styles.caption, { color: muted }]}>
                            {stat.label}
                        </Text>
                    </View>
                ))}
            </View>
            <Text style={[styles.caption, { color: muted }]}>
                {dateLabel} {formattedDate}
            </Text>
            {run.end_request?.status === "pending" && (
                <Text style={[styles.caption, { color: ink }]}>
                    End run requested — awaiting dispatch approval
                </Text>
            )}
            {run.status === "in_progress" &&
                run.shipment_count > 0 &&
                run.delivered_count === run.shipment_count && (
                    <Text style={[styles.caption, { color: ink }]}>
                        Deliveries completed — awaiting dispatch closure.
                    </Text>
                )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: 20, padding: 20, gap: 16 },
    heading: { flexDirection: "row", alignItems: "center", gap: 8 },
    reference: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: "600" },
    badge: { padding: 8, minWidth: 106, maxWidth: "48%", borderRadius: 8 },
    vehicle: { fontSize: 15, lineHeight: 21 },
    caption: { fontSize: 12, lineHeight: 17 },
    routePanel: { borderRadius: 12, padding: 16 },
    routeRow: { flexDirection: "row", alignItems: "stretch", gap: 12 },
    rail: { width: 24 },
    railExtension: {
        position: "absolute",
        bottom: -7,
        left: 10.5,
        borderLeftWidth: 3,
    },
    location: { flex: 1, minWidth: 0, gap: 4, alignSelf: "flex-start" },
    locationSpacing: { marginBottom: 24 },
    locationName: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
    stats: { flexDirection: "row", gap: 8 },
    stat: { flex: 1, minWidth: 0, gap: 4 },
});
