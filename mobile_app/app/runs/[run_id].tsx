import { StopDetailsSheet } from '@/src/components/dashboard/StopDetailsSheet';
import { Feather } from "@expo/vector-icons";
import {
    Stack,
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    AppState,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "@/component/ui/PageHeader";
import {
    MessageSheet,
    type MessageSheetRef,
} from "@/component/ui/MessageSheet";
import { Text } from "@/component/ui/Text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    RunTimeline,
    type RunStop,
} from "@/src/components/dashboard/RunTimeline";
import { RunSummaryCard } from "@/src/components/runs/RunSummaryCard";
import { driverApi, type DriverRunDetail } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

export default function RunDetailScreen() {
    const { run_id } = useLocalSearchParams<{ run_id: string }>();
    const { session } = useAuth();
    return session?.token ? (
        <RunDetail
            key={`${session.token}:${run_id}`}
            token={session.token}
            runId={run_id}
        />
    ) : null;
}

function RunDetail({ token, runId }: { token: string; runId: string }) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === "dark";
    const [selectedStop, setSelectedStop] = useState<RunStop | null>(null);
    const sheet = useRef<MessageSheetRef>(null);
    const version = useRef(0);
    const [run, setRun] = useState<DriverRunDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const focused = useRef(false);
    const load = useCallback(async () => {
        const request = ++version.current;
        setLoading(true);
        try {
            const result = await driverApi.getRun(token, runId);
            if (focused.current && request === version.current) {
                setRun(result);
                setError(null);
            }
        } catch (failure) {
            if (focused.current && request === version.current) {
                // Never retain actionable details after access is revoked or a run disappears.
                if (
                    (failure as { status?: number }).status === 404 ||
                    (failure as { status?: number }).status === 403
                )
                    setRun(null);
                setError(
                    failure instanceof Error
                        ? failure.message
                        : "Unable to load run.",
                );
            }
        } finally {
            if (focused.current && request === version.current)
                setLoading(false);
        }
    }, [token, runId]);
    useFocusEffect(
        useCallback(() => {
            focused.current = true;
            void load();
            const listener = AppState.addEventListener("change", (state) => {
                if (state === "active") void load();
            });
            return () => {
                focused.current = false;
                ++version.current;
                listener.remove();
            };
        }, [load]),
    );
    const openShipment = (id: string) =>
        router.push({
            pathname: "/shipments/[shipment_id]",
            params: {
                shipment_id: id,
                ...(run?.status === "completed" ? { run_id: runId } : {}),
            },
        });
    return (
        <View
            className="flex-1 bg-white dark:bg-[#111111]"
            style={{ paddingTop: insets.top }}
        >
            <Stack.Screen options={{ headerShown: false }} />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to runs"
                onPress={() =>
                    router.canGoBack()
                        ? router.back()
                        : router.replace("/(tabs)/runs")
                }
                className="ml-5 h-11 justify-center"
            >
                <Feather
                    name="chevron-left"
                    size={24}
                    color={dark ? "#fff" : "#111"}
                />
            </Pressable>
            <PageHeader
                title={run?.reference || "Run details"}
                status={
                    run?.status === "completed"
                        ? "Completed · Read-only"
                        : undefined
                }
            />
            <ScrollView
                contentContainerStyle={{
                    padding: 18,
                    paddingBottom: insets.bottom + 24,
                    gap: 20,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={loading && !!run}
                        onRefresh={() => void load()}
                    />
                }
            >
                {error && (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => void load()}
                        className="bg-[#F5F5F8] dark:bg-card rounded-xl p-5 gap-2"
                    >
                        <Text className="text-card-foreground">
                            {run ? "Showing saved run details. " : ""}
                            {error}
                        </Text>
                        <Text className="text-primary font-semibold">
                            Retry
                        </Text>
                    </Pressable>
                )}
                {loading && !run && (
                    <ActivityIndicator
                        color="#F54A4A"
                        style={{ padding: 48 }}
                    />
                )}
                {run && (
                    <>
                        <RunSummaryCard run={run} />
                        {run.status !== "completed" && (
                            <Pressable
                                accessibilityRole="button"
                                disabled={!!error || loading}
                                onPress={() =>
                                    router.push({
                                        pathname: "/(tabs)",
                                        params: { run_id: runId },
                                    })
                                }
                                className="bg-primary rounded-xl p-4 items-center"
                            >
                                <Text className="text-primary-foreground font-semibold">
                                    Open dashboard
                                </Text>
                            </Pressable>
                        )}
                        <View className="gap-3">
                            <Text
                                accessibilityRole="header"
                                className="text-card-foreground text-lg font-semibold"
                            >
                                Shipments
                            </Text>
                            {run.shipments.length ? (
                                run.shipments.map((shipment) => (
                                    <Pressable
                                        key={shipment.shipment_id}
                                        accessibilityRole="button"
                                        onPress={() =>
                                            openShipment(shipment.shipment_id)
                                        }
                                        className="bg-[#F5F5F8] dark:bg-card rounded-xl p-4 gap-2"
                                    >
                                        <Text className="text-card-foreground font-semibold">
                                            {shipment.merchant_order_ref ||
                                                shipment.delivery_note_number ||
                                                shipment.shipment_id}
                                        </Text>
                                        <Text className="text-muted-foreground">
                                            {shipment.status.replaceAll(
                                                "_",
                                                " ",
                                            )}{" "}
                                            ·{" "}
                                            {shipment.dropoff_location
                                                ?.full_address ||
                                                "No delivery address"}
                                        </Text>
                                        <Text className="text-primary text-sm">
                                            View shipment
                                        </Text>
                                    </Pressable>
                                ))
                            ) : (
                                <Text className="text-muted-foreground">
                                    No shipments attached to this run.
                                </Text>
                            )}
                        </View>
                        <View className="gap-4">
                            <Text
                                accessibilityRole="header"
                                className="text-card-foreground text-lg font-semibold"
                            >
                                Recorded timeline
                            </Text>
                            {run.recorded_stops.length ? (
                                <RunTimeline
                                    stops={run.recorded_stops}
                                    ink={dark ? "#fff" : "#111"}
                                    muted={dark ? "#a1a1aa" : "#71717a"}
                                    line={dark ? "#303036" : "#dedee1"}
                                    onOpenShipment={openShipment}
                                    onOpenStop={setSelectedStop}
                                />
                            ) : (
                                <Text className="text-muted-foreground">
                                    No stops recorded yet.
                                </Text>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
            <MessageSheet ref={sheet} />
            <StopDetailsSheet shipments={run?.shipments} stop={selectedStop} onDismiss={() => setSelectedStop(null)} />
        </View>
    );
}
