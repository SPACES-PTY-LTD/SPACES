import { Feather } from "@expo/vector-icons";
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
    compact,
}: {
    stop: RunCardStop;
    last: boolean;
    dark: boolean;
    compact: boolean;
}) {
    const rail = stop.current
        ? "current"
        : last
          ? stop.unknown
              ? "unknown"
              : "end"
          : "start";
    const railHeight = compact
        ? last
            ? 38
            : 42
        : rail === "end"
          ? 62
          : rail === "unknown"
            ? 41
            : 110;
    const muted = dark ? "#A1A1AA" : "#87918B";
    const ink = dark ? "#FAFAFA" : "#182420";
    return (
        <View style={[styles.routeRow, { minHeight: railHeight }]}>
            <View
                style={[styles.rail, compact && { overflow: "hidden" }]}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
            >
                <Image
                    source={(dark ? darkRails : rails)[rail]}
                    style={{
                        width: 24,
                        height: compact
                            ? rail === "end"
                                ? 62
                                : rail === "unknown"
                                  ? 41
                                  : 110
                            : railHeight,
                        ...(compact ? { position: "absolute", top: 10 } : {}),
                    }}
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
                    !last &&
                        (compact
                            ? { marginBottom: 14 }
                            : styles.locationSpacing),
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
                    {compact
                        ? stop.label === "Starting point"
                            ? "FROM"
                            : stop.label === "End point"
                              ? "TO"
                              : stop.label.toUpperCase()
                        : stop.label}
                </Text>
                <Text
                    style={[
                        styles.locationName,
                        { color: stop.unknown ? muted : ink },
                    ]}
                >
                    {stop.location?.name || "Unknown"}
                </Text>
                {!compact && !!stop.location?.address && (
                    <Text style={[styles.caption, { color: muted }]}>
                        {stop.location.address}
                    </Text>
                )}
            </View>
        </View>
    );
}

export function RunSummaryCard({
    run,
    compact = false,
}: {
    run: DriverRunSummary;
    compact?: boolean;
}) {
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === "dark";
    const ink = dark ? "#FAFAFA" : "#182420";
    const muted = dark ? "#A1A1AA" : "#87918B";
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
                {
                    backgroundColor: dark ? "#18181B" : "#FFFFFF",
                    borderColor: dark ? "#303A35" : "#E3E9E5",
                },
            ]}
        >
            <View style={styles.heading}>
                <Text style={[styles.reference, { color: ink }]}>
                    {run.reference}
                </Text>
                <View
                    style={[
                        styles.badge,
                        { backgroundColor: dark ? "#163627" : "#E6F4ED" },
                    ]}
                >
                    <Feather
                        name={run.status === "completed" ? "check" : "clock"}
                        size={16}
                        color={dark ? "#70D89C" : "#14814A"}
                    />
                    <Text
                        style={[
                            styles.caption,
                            {
                                color: dark ? "#70D89C" : "#14814A",
                                fontWeight: "600",
                                textAlign: "center",
                            },
                        ]}
                    >
                        {runStatusLabel(run.status)}
                    </Text>
                </View>
            </View>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: -8,
                }}
            >
                <Feather name="truck" size={18} color={muted} />
                <Text style={[styles.vehicle, { color: muted }]}>
                    {run.vehicle?.plate_number ||
                        run.vehicle?.ref_code ||
                        "Not assigned"}
                </Text>
            </View>
            <View
                style={[
                    styles.routePanel,
                    compact
                        ? { padding: 0, marginTop: 2 }
                        : { backgroundColor: panel },
                ]}
            >
                {stops.map((stop, index) => (
                    <RouteStop
                        key={
                            compact
                                ? stop.label === "Starting point"
                                    ? "FROM"
                                    : stop.label === "End point"
                                      ? "TO"
                                      : stop.label.toUpperCase()
                                : stop.label
                        }
                        stop={stop}
                        last={index === stops.length - 1}
                        dark={dark}
                        compact={compact}
                    />
                ))}
            </View>
            <View
                style={[
                    styles.stats,
                    {
                        backgroundColor: dark ? "#222B26" : "#F5F8F6",
                        borderColor: dark ? "#303A35" : "#EDF0EE",
                    },
                ]}
            >
                {[
                    {
                        value: run.shipment_count,
                        label:
                            run.shipment_count === 1 ? "Shipment" : "Shipments",
                    },
                    { value: run.delivered_count, label: "Delivered" },
                    { value: run.remaining_count, label: "Remaining" },
                ].map((stat, index) => (
                    <View
                        key={stat.label}
                        style={[
                            styles.stat,
                            index > 0 && {
                                borderLeftWidth: 1,
                                borderLeftColor: dark ? "#37443C" : "#E2E9E4",
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.statNumber,
                                {
                                    color:
                                        stat.label === "Remaining" &&
                                        run.remaining_count > 0
                                            ? "#B57218"
                                            : ink,
                                },
                            ]}
                        >
                            {stat.value}
                        </Text>
                        <Text
                            style={[
                                styles.caption,
                                {
                                    color:
                                        stat.label === "Remaining" &&
                                        run.remaining_count > 0
                                            ? "#B57218"
                                            : muted,
                                },
                            ]}
                        >
                            {stat.label}
                        </Text>
                    </View>
                ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                <View style={styles.metric}>
                    <Feather name="map-pin" size={16} color={muted} />
                    <Text style={{ color: muted, fontSize: 14 }}>
                        {run.stop_count ?? "—"}{" "}
                        {run.stop_count === 1 ? "stop" : "stops"}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Feather name="activity" size={16} color="#B57218" />
                    <Text style={{ color: "#B57218", fontSize: 14 }}>
                        {run.speeding_event_count ?? "—"} speeding{" "}
                        {run.speeding_event_count === 1 ? "event" : "events"}
                    </Text>
                </View>
            </View>
            <View
                style={[
                    styles.footer,
                    { borderTopColor: dark ? "#303A35" : "#EDF0EE" },
                ]}
            >
                <Text style={[styles.caption, { color: muted, flex: 1 }]}>
                    {dateLabel} {formattedDate}
                </Text>
                {compact && (
                    <Feather name="chevron-right" size={18} color={muted} />
                )}
            </View>
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
    card: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 16 },
    heading: { flexDirection: "row", alignItems: "center", gap: 8 },
    reference: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "700" },
    badge: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        maxWidth: "48%",
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
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
    stats: {
        flexDirection: "row",
        paddingVertical: 10,
        borderWidth: 1,
        borderRadius: 14,
    },
    stat: { flex: 1, minWidth: 0, gap: 3, alignItems: "center" },
    statNumber: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
    metric: { flexDirection: "row", alignItems: "center", gap: 6 },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        paddingTop: 12,
        gap: 8,
    },
});
