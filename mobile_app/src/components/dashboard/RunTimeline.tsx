import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/component/ui/Text";
import type { DriverDashboard } from "@/src/lib/api";

export type RunStop = NonNullable<DriverDashboard["recorded_stops"]>[number];

export function runStopDescription(stop: RunStop) {
    return [
        stop.address,
        stop.planned
            ? "Planned endpoint"
            : stop.occurred_at
              ? new Date(stop.occurred_at).toLocaleString()
              : "Time unavailable",
        stop.exited_at
            ? `Left ${new Date(stop.exited_at).toLocaleString()}`
            : null,
        stop.kind === "Speeding"
            ? `Speed: ${stop.speed_kph ?? "unavailable"} km/h · Limit: ${stop.speed_limit_kph ?? "unavailable"} km/h`
            : null,
    ]
        .filter(Boolean)
        .join("\n");
}

export function RunTimeline({
    stops,
    ink,
    muted,
    line,
    hasTrailingEntry = false,
    onOpenShipment,
    onOpenStop,
}: {
    stops: RunStop[];
    ink: string;
    muted: string;
    line: string;
    hasTrailingEntry?: boolean;
    onOpenShipment: (id: string) => void;
    onOpenStop: (stop: RunStop) => void;
}) {
    return (
        <>
            {stops.map((stop, index, stops) => (
                <View key={stop.stop_id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                        <View
                            style={[
                                styles.timelineMarker,
                                {
                                    backgroundColor:
                                        stop.kind === "Speeding"
                                            ? "#dc2626"
                                            : stop.kind
                                                    ?.toLowerCase()
                                                    .includes("delivery")
                                              ? "#24753a"
                                              : stop.kind === "Collection"
                                                ? "#2563eb"
                                                : "#71717a",
                                },
                            ]}
                        >
                            <Feather
                                name={
                                    stop.kind === "Speeding"
                                        ? "alert-triangle"
                                        : "map-pin"
                                }
                                size={14}
                                color="#ffffff"
                            />
                        </View>
                        {index < stops.length - 1 ||
                        hasTrailingEntry ||
                        !!stop.shipments?.length ? (
                            <View
                                style={[
                                    styles.timelineConnector,
                                    { backgroundColor: line },
                                ]}
                            />
                        ) : null}
                    </View>
                    <View
                        style={[styles.timelineContent, { paddingBottom: 20 }]}
                    >
                        <Text
                            style={{
                                color: muted,
                                fontSize: 11,
                                fontWeight: "600",
                                marginBottom: 4,
                            }}
                        >
                            {stop.planned
                                ? stop.kind === "Planned end"
                                    ? "Planned end location"
                                    : "Planned delivery"
                                : stop.kind || "Stop"}
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`View ${stop.kind} details: ${stop.name}`}
                            onPress={() => onOpenStop(stop)}
                        >
                            <Text
                                style={[styles.shipmentTitle, { color: ink }]}
                            >
                                {stop.name}{" "}
                                <Feather
                                    name="chevron-right"
                                    size={14}
                                    color={muted}
                                />
                            </Text>
                        </Pressable>
                        {stop.kind === "Speeding" ? (
                            <Text
                                style={{
                                    color: "#b91c1c",
                                    fontSize: 13,
                                    marginTop: 6,
                                }}
                            >
                                {stop.speed_kph != null
                                    ? `${stop.speed_kph} km/h`
                                    : "Speed not recorded"}
                                {stop.speed_limit_kph != null
                                    ? ` · Limit ${stop.speed_limit_kph} km/h`
                                    : " · Speed limit not recorded"}
                            </Text>
                        ) : null}
                        {stop.address ? (
                            <Text
                                style={[styles.shipmentRoute, { color: muted }]}
                            >
                                {stop.address}
                            </Text>
                        ) : null}
                        <Text
                            style={{ fontSize: 12, color: muted, marginTop: 6 }}
                        >
                            {stop.planned
                                ? "Not visited yet"
                                : stop.occurred_at
                                  ? new Date(stop.occurred_at).toLocaleString()
                                  : "Time not recorded"}
                            {stop.exited_at
                                ? ` · Left ${new Date(stop.exited_at).toLocaleTimeString()}`
                                : ""}
                        </Text>
                        {!!stop.shipments?.length && (
                            <View>
                                {stop.shipments.map((shipment) => (
                                    <Pressable
                                        key={shipment.shipment_id}
                                        onPress={() =>
                                            onOpenShipment(shipment.shipment_id)
                                        }
                                        accessibilityRole="button"
                                        style={styles.timelineShipmentLink}
                                    >
                                        <View
                                            pointerEvents="none"
                                            accessible={false}
                                            style={[
                                                styles.timelineShipmentBranch,
                                                { borderColor: line },
                                            ]}
                                        />
                                        <Text
                                            style={{
                                                color: "#e43e3e",
                                                fontSize: 12,
                                            }}
                                        >
                                            Open shipment ·{" "}
                                            {shipment.reference ||
                                                shipment.shipment_id}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            ))}
        </>
    );
}

const styles = StyleSheet.create({
    timelineRow: { flexDirection: "row", gap: 12 },
    timelineRail: { width: 24, alignItems: "center" },
    timelineMarker: {
        width: 24,
        minHeight: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    timelineConnector: { width: 2, flex: 1 },
    timelineContent: { flex: 1, gap: 8 },
    timelineShipmentLink: {
        minHeight: 36,
        paddingVertical: 8,
        paddingLeft: 8,
        justifyContent: "center",
        position: "relative",
    },
    timelineShipmentBranch: {
        position: "absolute",
        left: -25,
        top: 4,
        width: 25,
        height: 15,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderBottomLeftRadius: 14,
    },
    shipmentTitle: { fontSize: 18, lineHeight: 25, fontWeight: "700" },
    shipmentRoute: { fontSize: 13, lineHeight: 19 },
});
