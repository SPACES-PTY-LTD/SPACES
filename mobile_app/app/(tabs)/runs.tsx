import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    AppState,
    FlatList,
    Pressable,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PageHeader } from "@/component/ui/PageHeader";
import { Text } from "@/component/ui/Text";
import {
    RunSummaryCard,
    runStatusLabel,
} from "@/src/components/runs/RunSummaryCard";
import { driverApi, type DriverRunSummary } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

type RunTab = "active" | "completed";

export default function RunsScreen() {
    const insets = useSafeAreaInsets();
    const { session } = useAuth();
    const [tab, setTab] = useState<RunTab>("active");
    return (
        <View
            className="flex-1 bg-white dark:bg-[#111111]"
            style={{ paddingTop: insets.top }}
        >
            <PageHeader title="Runs" />
            <View className="bg-[#F5F5F8] dark:bg-card flex-row rounded-lg p-1 mx-[18px] mt-4 mb-4">
                {(["active", "completed"] as const).map((value) => (
                    <Pressable
                        key={value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === value }}
                        onPress={() => setTab(value)}
                        className={`flex-1 items-center rounded-lg p-3 ${tab === value ? "bg-white dark:bg-muted" : ""}`}
                    >
                        <Text
                            className={
                                tab === value
                                    ? "text-card-foreground font-semibold"
                                    : "text-muted-foreground"
                            }
                        >
                            {value === "active" ? "Active" : "Completed"}
                        </Text>
                    </Pressable>
                ))}
            </View>
            {/* Remount on filter/session changes so previous results never appear in a new context. */}
            {session?.token && (
                <RunList
                    key={`${session.token}:${tab}`}
                    token={session.token}
                    tab={tab}
                />
            )}
        </View>
    );
}

function RunList({ token, tab }: { token: string; tab: RunTab }) {
    const router = useRouter();
    const [runs, setRuns] = useState<DriverRunSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pageError, setPageError] = useState<string | null>(null);
    const [nextPage, setNextPage] = useState<number | null>(null);
    const requestVersion = useRef(0);
    const focused = useRef(false);
    const busy = useRef(false);
    const hasLoaded = useRef(false);

    const load = useCallback(
        async (page = 1) => {
            if (!focused.current || (page > 1 && busy.current)) return;
            const version = ++requestVersion.current;
            busy.current = true;
            if (page > 1) {
                setLoadingMore(true);
                setPageError(null);
            } else if (hasLoaded.current) setRefreshing(true);
            else setLoading(true);
            try {
                const response = await driverApi.listRuns(token, tab, page);
                if (!focused.current || version !== requestVersion.current)
                    return;
                setRuns((current) =>
                    page === 1
                        ? response.data
                        : [
                              ...new Map(
                                  [...current, ...response.data].map((run) => [
                                      run.run_id,
                                      run,
                                  ]),
                              ).values(),
                          ],
                );
                const currentPage = response.meta.current_page ?? page;
                setNextPage(
                    currentPage < (response.meta.last_page ?? currentPage)
                        ? currentPage + 1
                        : null,
                );
                setError(null);
                setPageError(null);
                hasLoaded.current = true;
            } catch (failure) {
                if (!focused.current || version !== requestVersion.current)
                    return;
                const message =
                    failure instanceof Error
                        ? failure.message
                        : "Unable to load runs.";
                if (page > 1) setPageError(message);
                else setError(message);
            } finally {
                if (focused.current && version === requestVersion.current) {
                    busy.current = false;
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [token, tab],
    );

    useFocusEffect(
        useCallback(() => {
            focused.current = true;
            void load();
            const listener = AppState.addEventListener("change", (state) => {
                if (state === "active") void load();
            });
            return () => {
                focused.current = false;
                ++requestVersion.current;
                busy.current = false;
                listener.remove();
            };
        }, [load]),
    );

    return (
        <FlatList
            data={runs}
            keyExtractor={(run) => run.run_id}
            contentContainerStyle={{
                paddingHorizontal: 18,
                paddingBottom: 24,
                gap: 16,
            }}
            refreshing={refreshing}
            onRefresh={() => void load()}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (nextPage && !pageError) void load(nextPage);
            }}
            renderItem={({ item }) => (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.reference}, ${runStatusLabel(item.status)}`}
                    onPress={() => router.push(`/runs/${item.run_id}`)}
                >
                    <RunSummaryCard run={item} />
                </Pressable>
            )}
            ListHeaderComponent={
                error ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => void load()}
                        className="bg-[#F5F5F8] dark:bg-card rounded-xl p-5"
                    >
                        <Text className="text-card-foreground">
                            {runs.length ? "Showing saved runs. " : ""}
                            {error}
                        </Text>
                        <Text className="text-primary mt-2 font-semibold">
                            Retry
                        </Text>
                    </Pressable>
                ) : null
            }
            ListEmptyComponent={
                loading ? (
                    <ActivityIndicator
                        color="#F54A4A"
                        style={{ padding: 48 }}
                    />
                ) : !error ? (
                    <View className="bg-[#F5F5F8] dark:bg-card rounded-xl p-5 gap-2">
                        <Text className="text-card-foreground text-lg font-semibold">
                            No {tab} runs
                        </Text>
                        <Text className="text-muted-foreground">
                            {tab === "active"
                                ? "Your assigned runs will appear here when they are ready to start."
                                : "Runs will appear here after dispatch closes them."}
                        </Text>
                    </View>
                ) : null
            }
            ListFooterComponent={
                loadingMore ? (
                    <ActivityIndicator
                        color="#F54A4A"
                        style={{ padding: 16 }}
                    />
                ) : pageError ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                            if (nextPage) void load(nextPage);
                        }}
                        className="p-4"
                    >
                        <Text className="text-card-foreground">
                            {pageError}
                        </Text>
                        <Text className="text-primary mt-2">
                            Retry loading more
                        </Text>
                    </Pressable>
                ) : nextPage ? (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => void load(nextPage)}
                        className="p-4 items-center"
                    >
                        <Text className="text-primary font-semibold">
                            Load more
                        </Text>
                    </Pressable>
                ) : null
            }
        />
    );
}
