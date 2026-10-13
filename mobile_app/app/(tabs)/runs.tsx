import { LoadingSkeleton } from "@/component/ui/LoadingSkeleton";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    AppState,
    FlatList,
    Pressable,
    View,
    TextInput,
    Platform,
    Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RunDatePicker } from "@/src/components/runs/RunDatePicker";
import { ActionSheet, type ActionSheetRef } from "@/component/ui/ActionSheet";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === "dark";
    const ink = dark ? "#FAFAFA" : "#182420";
    const muted = dark ? "#A1A1AA" : "#87918B";
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<"default" | "newest" | "oldest">(
        "default",
    );
    const [date, setDate] = useState<Date | null>(null);
    const [calendar, setCalendar] = useState(false);
    const filters = useRef<ActionSheetRef>(null);
    const day = date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : "";
    const openFilters = () =>
        filters.current?.present({
            title: "Sort runs",
            actions: [
                {
                    id: "default",
                    label:
                        tab === "active" ? "In progress first" : "Newest first",
                    selected: sort === "default",
                    onPress: () => setSort("default"),
                },
                {
                    id: "newest",
                    label: "Newest first",
                    selected: sort === "newest",
                    onPress: () => setSort("newest"),
                },
                {
                    id: "oldest",
                    label: "Oldest first",
                    selected: sort === "oldest",
                    onPress: () => setSort("oldest"),
                },
                {
                    id: "clear",
                    label: "Clear all filters",
                    onPress: () => {
                        setSearch("");
                        setQuery("");
                        setDate(null);
                        setSort("default");
                    },
                },
            ],
        });
    const button = {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: dark ? "#18181B" : "#FFFFFF",
        borderWidth: 1,
        borderColor: dark ? "#303A35" : "#E1E7E3",
        alignItems: "center" as const,
        justifyContent: "center" as const,
    };
    const picker = (
        <RunDatePicker
            value={date ?? new Date()}
            onChange={(value) => {
                setDate(value);
                if (Platform.OS === "android") setCalendar(false);
            }}
            onDismiss={() => setCalendar(false)}
        />
    );
    return (
        <View
            style={{
                flex: 1,
                paddingTop: insets.top,
                backgroundColor: dark ? "#111111" : "#F4F6F7",
            }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: 16,
                }}
            >
                <Text
                    accessibilityRole="header"
                    style={{
                        flex: 1,
                        fontSize: 34,
                        lineHeight: 44,
                        fontWeight: "700",
                        color: ink,
                    }}
                >
                    Runs
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Filter runs by date"
                    accessibilityState={{ selected: !!date }}
                    onPress={() => setCalendar(true)}
                    style={button}
                >
                    <Feather
                        name="calendar"
                        size={22}
                        color={date ? "#15803d" : ink}
                    />
                </Pressable>
            </View>
            <View
                style={{
                    flexDirection: "row",
                    borderRadius: 16,
                    padding: 4,
                    marginHorizontal: 20,
                    marginBottom: 12,
                    backgroundColor: dark ? "#222B26" : "#E8EEEA",
                }}
            >
                {(["active", "completed"] as const).map((value) => (
                    <Pressable
                        key={value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === value }}
                        onPress={() => setTab(value)}
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 11,
                            borderRadius: 13,
                            backgroundColor:
                                tab === value
                                    ? dark
                                        ? "#343E37"
                                        : "#FFFFFF"
                                    : "transparent",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: tab === value ? "700" : "500",
                                color:
                                    tab === value
                                        ? dark
                                            ? "#70D89C"
                                            : "#14814A"
                                        : muted,
                            }}
                        >
                            {value === "active" ? "Active" : "Completed"}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <View
                style={{
                    flexDirection: "row",
                    gap: 10,
                    marginHorizontal: 20,
                    marginBottom: 14,
                }}
            >
                <View
                    style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        borderWidth: 1,
                        borderColor: button.borderColor,
                        borderRadius: 14,
                        backgroundColor: button.backgroundColor,
                        paddingHorizontal: 13,
                    }}
                >
                    <Feather name="search" size={19} color={muted} />
                    <TextInput
                        accessibilityLabel="Search run, vehicle or depot"
                        placeholder="Search run, vehicle or depot"
                        placeholderTextColor={muted}
                        value={search}
                        maxLength={200}
                        onChangeText={(value) => {
                            setSearch(value);
                            if (!value.trim()) setQuery("");
                        }}
                        onSubmitEditing={() => setQuery(search.trim())}
                        returnKeyType="search"
                        style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 44,
                            fontSize: 14,
                            color: ink,
                            paddingVertical: 10,
                        }}
                    />
                    {!!search && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Clear search"
                            onPress={() => {
                                setSearch("");
                                setQuery("");
                            }}
                            hitSlop={10}
                        >
                            <Feather name="x" size={18} color={muted} />
                        </Pressable>
                    )}
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Filter and sort runs"
                    onPress={openFilters}
                    style={button}
                >
                    <Feather
                        name="filter"
                        size={20}
                        color={sort !== "default" ? "#15803d" : ink}
                    />
                </Pressable>
            </View>
            {!!date && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear date filter"
                    onPress={() => setDate(null)}
                    style={{
                        marginHorizontal: 20,
                        marginBottom: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <Text style={{ color: "#15803d" }}>
                        {day} ·{" "}
                        {tab === "completed" ? "Completion date" : "Start date"}
                    </Text>
                    <Feather name="x" size={16} color="#15803d" />
                </Pressable>
            )}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginHorizontal: 20,
                    marginBottom: 12,
                }}
            >
                <Text
                    style={{
                        flex: 1,
                        color: dark ? "#CAD2CD" : "#59685F",
                        fontSize: 14,
                        fontWeight: "600",
                    }}
                >
                    {query || day
                        ? "Matching runs"
                        : tab === "completed"
                          ? "Recent completed runs"
                          : "Active runs"}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Change run sorting"
                    onPress={openFilters}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        minHeight: 32,
                    }}
                >
                    <Feather name="shuffle" size={15} color={muted} />
                    <Text style={{ color: muted, fontSize: 13 }}>
                        {sort === "oldest"
                            ? "Oldest first"
                            : tab === "active" && sort === "default"
                              ? "In progress first"
                              : "Newest first"}
                    </Text>
                </Pressable>
            </View>
            {session?.token && (
                <RunList
                    key={`${session.token}:${tab}:${query}:${sort}:${day}`}
                    token={session.token}
                    tab={tab}
                    query={query}
                    sort={sort}
                    day={day}
                />
            )}
            <ActionSheet ref={filters} />
            {calendar &&
                (Platform.OS !== "android" ? (
                    <Modal
                        transparent
                        animationType="fade"
                        onRequestClose={() => setCalendar(false)}
                    >
                        <View
                            style={{
                                flex: 1,
                                justifyContent: "center",
                                padding: 20,
                                backgroundColor: "rgba(0,0,0,0.35)",
                            }}
                        >
                            <View
                                style={{
                                    backgroundColor: button.backgroundColor,
                                    borderRadius: 20,
                                    padding: 16,
                                }}
                            >
                                <Text
                                    style={{
                                        color: ink,
                                        fontWeight: "600",
                                        fontSize: 18,
                                    }}
                                >
                                    Filter by{" "}
                                    {tab === "completed"
                                        ? "completion"
                                        : "start"}{" "}
                                    date
                                </Text>
                                {picker}
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setCalendar(false)}
                                    style={{
                                        padding: 14,
                                        alignItems: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: "#15803d",
                                            fontWeight: "600",
                                        }}
                                    >
                                        Done
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </Modal>
                ) : (
                    picker
                ))}
        </View>
    );
}

function RunList({
    token,
    tab,
    query,
    sort,
    day,
}: {
    token: string;
    tab: RunTab;
    query: string;
    sort: "default" | "newest" | "oldest";
    day: string;
}) {
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
        async (page = 1, pullToRefresh = false) => {
            if (!focused.current || (page > 1 && busy.current)) return;
            const version = ++requestVersion.current;
            busy.current = true;
            if (page > 1) {
                setLoadingMore(true);
                setPageError(null);
            } else if (hasLoaded.current) {
                if (pullToRefresh) setRefreshing(true);
            } else setLoading(true);
            try {
                const response = await driverApi.listRuns(token, tab, page, {
                    search: query,
                    sort,
                    date: day,
                });
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
        [token, tab, query, sort, day],
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
                setRefreshing(false);
                listener.remove();
            };
        }, [load]),
    );

    return (
        <FlatList
            style={{ flex: 1 }}
            data={runs}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            keyExtractor={(run) => run.run_id}
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 24,
                gap: 16,
                ...(!runs.length && !loading && !error
                    ? {
                          flexGrow: 1,
                          justifyContent: "center" as const,
                          paddingTop: 24,
                      }
                    : {}),
            }}
            refreshing={refreshing}
            onRefresh={() => void load(1, true)}
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
                    <RunSummaryCard run={item} compact />
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
                    <LoadingSkeleton kind="runs" label="Loading runs" />
                ) : !error ? (
                    <View className="items-center px-6 gap-2">
                        <View
                            accessible={false}
                            className="bg-[#ecfdf3] rounded-full items-center justify-center mb-3"
                            style={{ width: 80, height: 80 }}
                        >
                            <Feather
                                name={
                                    tab === "active"
                                        ? "git-branch"
                                        : "check-circle"
                                }
                                size={36}
                                color="#24753a"
                            />
                        </View>
                        <Text className="text-card-foreground text-lg font-semibold text-center">
                            {query || day
                                ? "No matching runs"
                                : `No ${tab} runs`}
                        </Text>
                        <Text
                            className="text-muted-foreground text-center"
                            style={{ maxWidth: 300, lineHeight: 22 }}
                        >
                            {query || day
                                ? "Try another search or clear your filters."
                                : tab === "active"
                                  ? "Your assigned runs will appear here when they are ready to start."
                                  : "Runs will appear here after dispatch closes them."}
                        </Text>
                    </View>
                ) : null
            }
            ListFooterComponent={
                loadingMore ? (
                    <ActivityIndicator
                        color="#15803d"
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
