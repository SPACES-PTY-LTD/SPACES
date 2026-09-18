import { ActivityIndicator, View } from "react-native";
import { Text } from "@/component/ui/Text";

/** Upload completion is reported by XHR; server processing remains indeterminate. */
export function DeliveryNoteProgress({
    uploaded = false,
    creating = false,
}: {
    uploaded?: boolean;
    creating?: boolean;
}) {
    const title = creating
        ? "Creating shipments…"
        : uploaded
          ? "Reading delivery note shipments…"
          : "Uploading file…";
    return (
        <View
            accessibilityLiveRegion="polite"
            style={{ gap: 16, paddingVertical: 16, minHeight: 220 }}
        >
            {!creating && (
                <Text style={{ fontSize: 12, color: "#71717a" }}>
                    STEP 2 OF 5 · READING FILE
                </Text>
            )}
            <Text
                style={{
                    minHeight: 60,
                    fontSize: 24,
                    lineHeight: 30,
                    fontWeight: "700",
                    color: "#111",
                }}
            >
                {title}
            </Text>
            <Text
                style={{
                    minHeight: 48,
                    fontSize: 16,
                    lineHeight: 24,
                    color: "#71717a",
                }}
            >
                {creating
                    ? "Saving your reviewed shipments and assigning them to the selected run."
                    : uploaded
                      ? "Processing file. Finding shipment references, collection dates, addresses and parcel details."
                      : "Keep this screen open while we upload your document."}
            </Text>
            <ActivityIndicator
                size={28}
                color="#f54a4a"
                style={{ alignSelf: "flex-start" }}
            />
        </View>
    );
}
