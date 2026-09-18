import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Href, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { Text } from "@/component/ui/Text";
import { ActionSheet, ActionSheetRef } from "@/component/ui/ActionSheet";
import {
    ApiRequestError,
    ImportContext,
    ImportDraft,
    ImportLine,
    ImportLocation,
    ImportResult,
    ImportReview,
    documentImportApi,
} from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";
import {
    ImportButton,
    ImportField,
    ImportSheetPage,
    importStyles as s,
} from "@/src/components/document-import-ui";
import { DeliveryNoteProgress } from "@/src/components/delivery-note-progress";

const addressFields = [
    ["name", "Location name"],
    ["address_line_1", "Street address"],
    ["city", "City"],
    ["province", "Province"],
    ["post_code", "Postal code"],
    ["country", "Country"],
];
const statusLabel = (value: string) =>
    value === "failed"
        ? "Failed Delivery"
        : value === "in_transit"
          ? "In transit"
          : value === "delivered"
            ? "Delivered"
            : "Booked";
const fullAddress = (a?: Record<string, any>) =>
    a?.full_address ||
    [
        "address_line_1",
        "address_line_2",
        "city",
        "province",
        "post_code",
        "country",
    ]
        .map((k) => a?.[k])
        .filter(Boolean)
        .join(", ");
const hasAddress = (a?: Record<string, any>) => !!a?.address_line_1;

export default function ReviewImport() {
    const { import_id } = useLocalSearchParams<{ import_id: string }>();
    const { session } = useAuth();
    const [context, setContext] = useState<ImportContext>();
    const [draft, setDraft] = useState<ImportDraft>();
    const [stage, setStage] = useState<3 | 4 | 5>(3);
    const [review, setReview] = useState<ImportReview>();
    const [result, setResult] = useState<ImportResult | null>(null);
    const [destination, setDestination] = useState<Href>();
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<ImportLine>();
    const [failureIndex, setFailureIndex] = useState<number | null>(null);
    const [failureReason, setFailureReason] = useState("");
    const [locationKind, setLocationKind] = useState<
        "origin_location_id" | "destination_location_id" | null
    >(null);
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState<ImportLocation[]>([]);
    const [choiceReady, setChoiceReady] = useState(false);
    const actions = useRef<ActionSheetRef>(null);
    const inFlight = useRef(false);
    const previewRequest = useRef(0);
    const storageKey = `delivery-note-draft:${session?.user?.user_id || session?.token?.slice(-12)}:${import_id}`;
    const message = (e: unknown) => {
        const err = e as ApiRequestError;
        return (
            Object.values(err.details || {})
                .flat()
                .join("\n") ||
            err.message ||
            "Please try again."
        );
    };
    async function load() {
        if (!session) return;
        try {
            const [item, available, saved] = await Promise.all([
                documentImportApi.show(session.token, import_id),
                documentImportApi.context(session.token),
                AsyncStorage.getItem(storageKey),
            ]);
            setContext(available);
            setResult(item.confirmation_result);
            const run =
                available.runs.find((r) => r.run_id === item.run_id) ||
                available.runs.find((r) => r.status === "in_progress") ||
                available.runs[0];
            const extracted = item.extracted_data;
            const initial: ImportDraft = {
                ...extracted,
                grouping_mode: "separate_shipments",
                run_id: run?.run_id || null,
                create_new_run: !run,
                vehicle_id:
                    run?.vehicle_id || available.vehicles[0]?.vehicle_id,
                origin_location_id: run?.origin_location_id,
                destination_location_id: run?.destination_location_id,
                collection_date:
                    extracted.collection_date ||
                    extracted.line_items?.[0]?.collection_date ||
                    null,
                pickup_address: extracted.pickup_address || {},
                dropoff_address: extracted.dropoff_address || {},
                line_items: (extracted.line_items || []).map((row) => ({
                    ...row,
                    pickup_address: hasAddress(row.pickup_address)
                        ? row.pickup_address
                        : extracted.pickup_address || {},
                    dropoff_address: hasAddress(row.dropoff_address)
                        ? row.dropoff_address
                        : extracted.dropoff_address || {},
                    collection_date:
                        row.collection_date || extracted.collection_date,
                })),
            };
            const restored: ImportDraft = saved && !item.confirmation_result ? JSON.parse(saved) : initial;
            setDraft(restored);
            if (restored.trip_locations?.length) setContext({ ...available, locations: [...available.locations, ...restored.trip_locations.filter(l => !available.locations.some(existing => existing.location_id === l.location_id))] });
            setError("");
        } catch (e) {
            setError(message(e));
        }
    }
    useEffect(() => {
        void load();
    }, [session?.token, import_id]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (draft && !result)
            void AsyncStorage.setItem(storageKey, JSON.stringify(draft));
    }, [draft, result, storageKey]);
    function update(patch: Partial<ImportDraft>) {
        setDraft((d) => (d ? { ...d, ...patch } : d));
        setChoiceReady(false);
    }
    function updateItem(index: number, patch: Partial<ImportLine>) {
        if (!draft) return;
        const next = {
            ...draft,
            ...(index === 0
                ? {
                      pickup_address:
                          patch.pickup_address || draft.pickup_address,
                      dropoff_address:
                          patch.dropoff_address || draft.dropoff_address,
                      collection_date:
                          patch.collection_date || draft.collection_date,
                  }
                : {}),
            line_items: draft.line_items.map((r, i) =>
                i === index ? { ...r, ...patch } : r,
            ),
        };
        setDraft(next);
        setChoiceReady(false);
        void refreshReview(next);
    }
    async function refreshReview(value: ImportDraft) {
        if (!session) return;
        const request = ++previewRequest.current;
        setBusy(true);
        setError("");
        try {
            const next = await documentImportApi.preview(
                session.token,
                import_id,
                value,
            );
            if (request !== previewRequest.current) return undefined;
            setReview(next);
            return next;
        } catch (e) {
            if (request === previewRequest.current) setError(message(e));
            return undefined;
        } finally {
            if (request === previewRequest.current) setBusy(false);
        }
    }
    const origin = context?.locations.find(
        (l) => l.location_id === draft?.origin_location_id,
    );
    const end = context?.locations.find(
        (l) => l.location_id === draft?.destination_location_id,
    );
    function chooseStatus(index: number) {
        actions.current?.present({
            title: "Change delivery status",
            actions: ["delivered", "in_transit", "failed"].map((value) => ({
                id: value,
                label: statusLabel(value),
                onPress: () => {
                    if (value === "failed") {
                        setFailureIndex(index);
                        setFailureReason(
                            draft?.line_items[index].failure_reason || "",
                        );
                    } else
                        updateItem(index, {
                            status: value as ImportLine["status"],
                        });
                },
            })),
        });
    }
    async function selectRun(runId: string | null) {
        if (!draft) return;
        const next = { ...draft, run_id: runId, create_new_run: !runId };
        setDraft(next);
        setChoiceReady(false);
        const checked = await refreshReview(next);
        if (checked) setChoiceReady(true);
    }
    async function confirm() {
        if (!draft || !review || !session || inFlight.current) return;
        inFlight.current = true;
        setCreating(true);
        setError("");
        try {
            const output = await documentImportApi.confirm(
                session.token,
                import_id,
                { ...draft, review_token: review.review_token },
            );
            setResult(output);
            await AsyncStorage.removeItem(storageKey);
        } catch (e) {
            setError(message(e));
            setChoiceReady(false);
        } finally {
            setCreating(false);
            inFlight.current = false;
        }
    }
    const title = result
        ? "Upload completed"
        : creating
          ? "Processing delivery note"
          : editing !== null
            ? "Edit shipment"
            : failureIndex !== null
              ? "Failed Delivery"
              : locationKind
                ? "Choose location"
                : stage === 3
                  ? "Confirm collection & end"
                  : stage === 4
                    ? "Confirm shipments found"
                    : "Current run or new run?";
    return (
        <>
            <ImportSheetPage
                title={title}
                destination={destination}
                backDisabled={creating}
            >
                {!!error && (
                    <Text accessibilityRole="alert" style={s.error}>
                        {error}
                    </Text>
                )}
                {result ? (
                    <>
                        <View
                            style={{
                                alignItems: "center",
                                gap: 16,
                                padding: 20,
                            }}
                        >
                            <Feather
                                name="check-circle"
                                color="#24753a"
                                size={64}
                            />
                            <Text style={s.heading}>
                                Delivery note upload completed and processed
                            </Text>
                        </View>
                        <Text style={s.body}>
                            {result.created.length} created ·{" "}
                            {result.attached.length} assigned ·{" "}
                            {result.skipped.length} skipped
                        </Text>
                        <Text style={s.note}>
                            {result.delivered?.length || 0} already delivered
                        </Text>
                        <ImportButton
                            label="Continue"
                            onPress={() =>
                                setDestination(
                                    result.run_id
                                        ? {
                                              pathname: "/(tabs)",
                                              params: { run_id: result.run_id },
                                          }
                                        : "/(tabs)",
                                )
                            }
                        />
                    </>
                ) : creating ? (
                    <DeliveryNoteProgress creating />
                ) : !draft || !context ? (
                    <>
                        <ActivityIndicator color="#f54a4a" />
                        <ImportButton
                            secondary
                            label="Retry"
                            onPress={() => void load()}
                        />
                    </>
                ) : failureIndex !== null ? (
                    <>
                        <Text style={s.heading}>Why did delivery fail?</Text>
                        <ImportField
                            multiline
                            label="Failure reason · Required"
                            value={failureReason}
                            onChange={setFailureReason}
                        />
                        <ImportButton
                            label="Save Failed Delivery"
                            disabled={!failureReason.trim()}
                            onPress={() => {
                                updateItem(failureIndex, {
                                    status: "failed",
                                    failure_reason: failureReason.trim(),
                                });
                                setFailureIndex(null);
                            }}
                        />
                        <ImportButton
                            secondary
                            label="Cancel"
                            onPress={() => setFailureIndex(null)}
                        />
                    </>
                ) : locationKind ? (
                    <>
                        <ImportField
                            label="Search saved locations or addresses"
                            value={search}
                            onChange={setSearch}
                        />
                        <ImportButton
                            secondary
                            label={busy ? "Searching…" : "Search address"}
                            disabled={busy || search.trim().length < 3}
                            onPress={async () => {
                                if (!session) return;
                                setBusy(true);
                                setError("");
                                try {
                                    const found =
                                        await documentImportApi.searchLocations(
                                            session.token,
                                            search.trim(),
                                        );
                                    setSearchResults(found);
                                    if (!found.length)
                                        setError(
                                            "No exact address found. Include the street, city and postal code.",
                                        );
                                } catch (e) {
                                    setError(message(e));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        />
                        {searchResults.map((l) => (
                            <View style={s.card} key={l.location_id}>
                                <Text style={s.body}>{fullAddress(l)}</Text>
                                <ImportButton
                                    secondary
                                    label="View map position"
                                    onPress={() =>
                                        void Linking.openURL(
                                            `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`,
                                        )
                                    }
                                />
                                <ImportButton
                                    label="Use this location"
                                    onPress={() => {
                                        setContext({
                                            ...context,
                                            locations: [
                                                ...context.locations,
                                                l,
                                            ],
                                        });
                                        update({
                                            [locationKind]: l.location_id,
                                            trip_locations: [...(draft.trip_locations || []), l],
                                        });
                                        setLocationKind(null);
                                        setSearchResults([]);
                                        setSearch("");
                                    }}
                                />
                            </View>
                        ))}

                        {context.locations
                            .filter((l) =>
                                `${l.name} ${fullAddress(l)}`
                                    .toLowerCase()
                                    .includes(search.toLowerCase()),
                            )
                            .map((l) => (
                                <ImportButton
                                    key={l.location_id}
                                    secondary
                                    label={`${l.name}\n${fullAddress(l) || "Address unavailable"}${l.latitude == null || l.longitude == null ? "\nMap position unavailable" : ""}`}
                                    disabled={
                                        l.latitude == null ||
                                        l.longitude == null
                                    }
                                    onPress={() => {
                                        update({
                                            [locationKind]: l.location_id,
                                        });
                                        setLocationKind(null);
                                        setSearch("");
                                    }}
                                />
                            ))}
                        {!context.locations.length && (
                            <Text style={s.note}>
                                No saved locations. Ask dispatch to add the
                                location and map position.
                            </Text>
                        )}
                        <ImportButton
                            secondary
                            label="Back"
                            onPress={() => setLocationKind(null)}
                        />
                    </>
                ) : editing !== null && editValue ? (
                    <>
                        <ImportField
                            label="Shipment reference"
                            value={editValue.merchant_order_ref}
                            onChange={(v) =>
                                setEditValue({
                                    ...editValue,
                                    merchant_order_ref: v,
                                })
                            }
                        />
                        <ImportField
                            label="Collection date (YYYY-MM-DD)"
                            value={editValue.collection_date}
                            onChange={(v) =>
                                setEditValue({
                                    ...editValue,
                                    collection_date: v,
                                })
                            }
                        />
                        <ImportField
                            label="Description"
                            value={editValue.description}
                            onChange={(v) =>
                                setEditValue({ ...editValue, description: v })
                            }
                        />
                        <ImportField
                            label="Quantity"
                            numeric
                            value={editValue.quantity}
                            onChange={(v) =>
                                setEditValue({
                                    ...editValue,
                                    quantity: v ? Number(v) : null,
                                })
                            }
                        />
                        <ImportField
                            label="Shipment type"
                            value={editValue.type}
                            onChange={(v) =>
                                setEditValue({ ...editValue, type: v })
                            }
                        />
                        {(["pickup_address", "dropoff_address"] as const).map(
                            (kind) => (
                                <View style={s.card} key={kind}>
                                    <Text style={s.heading}>
                                        {kind === "pickup_address"
                                            ? "Collection"
                                            : "Deliver to"}
                                    </Text>
                                    {addressFields.map(([key, label]) => (
                                        <ImportField
                                            key={key}
                                            label={label}
                                            value={editValue[kind]?.[key]}
                                            onChange={(v) =>
                                                setEditValue({
                                                    ...editValue,
                                                    [kind]: {
                                                        ...editValue[kind],
                                                        [key]: v,
                                                    },
                                                })
                                            }
                                        />
                                    ))}
                                </View>
                            ),
                        )}
                        {(
                            [
                                "weight",
                                "length_cm",
                                "width_cm",
                                "height_cm",
                            ] as const
                        ).map((key) => (
                            <ImportField
                                key={key}
                                label={key.replaceAll("_", " ")}
                                numeric
                                value={editValue[key]}
                                onChange={(v) =>
                                    setEditValue({
                                        ...editValue,
                                        [key]: v ? Number(v) : null,
                                    })
                                }
                            />
                        ))}
                        <ImportButton
                            label="Save changes"
                            onPress={() => {
                                updateItem(editing, editValue);
                                setEditing(null);
                            }}
                        />
                        <ImportButton
                            secondary
                            label="Cancel"
                            onPress={() => setEditing(null)}
                        />
                    </>
                ) : (
                    <>
                        <Text style={s.note}>
                            STEP {stage} OF 5 ·{" "}
                            {stage === 3
                                ? "TRIP LOCATIONS"
                                : stage === 4
                                  ? "SHIPMENTS FOUND"
                                  : "CHOOSE RUN"}
                        </Text>
                        {stage === 3 ? (
                            <>
                                <Text style={s.subtitle}>
                                    Choose where the trip starts and where it
                                    will end. Next, check the shipments against
                                    this starting point.
                                </Text>
                                {(
                                    [
                                        [
                                            "origin_location_id",
                                            "Run starting point",
                                            origin,
                                        ],
                                        [
                                            "destination_location_id",
                                            "Planned end location",
                                            end,
                                        ],
                                    ] as const
                                ).map(([key, label, location]) => (
                                    <View
                                        key={key}
                                        style={[
                                            s.card,
                                            { backgroundColor: "#f7f7f9" },
                                        ]}
                                    >
                                        <Text style={s.note}>{label}</Text>
                                        <ImportButton
                                            secondary
                                            label={
                                                location
                                                    ? `${location.name}\n${fullAddress(location)}`
                                                    : "Choose location"
                                            }
                                            onPress={() => setLocationKind(key)}
                                        />
                                    </View>
                                ))}
                                <Text style={s.note}>
                                    Collection → shipment stops → planned end.
                                    The end may differ from your last delivery.
                                </Text>
                                <ImportButton
                                    label="Continue"
                                    disabled={!origin || !end || busy}
                                    onPress={async () => {
                                        if (await refreshReview(draft))
                                            setStage(4);
                                    }}
                                />
                            </>
                        ) : stage === 4 ? (
                            <>
                                <Text style={s.subtitle}>
                                    {draft.line_items.length} shipments ·{" "}
                                    {review?.rows.filter(
                                        (r) =>
                                            r.eligibility === "new" &&
                                            (r.collection_comparison !==
                                                "match" ||
                                                r.ambiguous_match ||
                                                !!r.validation_warnings
                                                    ?.length),
                                    ).length || 0}{" "}
                                    needs attention.
                                </Text>
                                {!draft.line_items.length && (
                                    <>
                                        <Text style={s.note}>
                                            No shipments found. Choose another
                                            document.
                                        </Text>
                                        <ImportButton
                                            label="Choose document"
                                            onPress={() =>
                                                setDestination(
                                                    "/shipments/load",
                                                )
                                            }
                                        />
                                    </>
                                )}
                                {draft.line_items.map((item, index) => {
                                    const state = review?.rows[index];
                                    const eligible =
                                        state?.eligibility === "new";
                                    return (
                                        <View
                                            key={index}
                                            style={[
                                                s.card,
                                                {
                                                    borderWidth: 1,
                                                    borderColor: "#e0e3e8",
                                                    padding: 16,
                                                    gap: 10,
                                                },
                                            ]}
                                        >
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 8,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        ...s.body,
                                                        fontWeight: "700",
                                                        flex: 1,
                                                    }}
                                                >
                                                    {item.merchant_order_ref ||
                                                        "Reference missing"}
                                                </Text>
                                                <Text
                                                    style={{
                                                        color: "#24753a",
                                                        backgroundColor:
                                                            "#e8f7ed",
                                                        padding: 5,
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    {state?.eligibility ===
                                                    "existing"
                                                        ? "Existing · skipped"
                                                        : state?.eligibility ===
                                                            "excluded"
                                                          ? "Excluded"
                                                          : "New"}
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    gap: 24,
                                                }}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.note}>
                                                        Quantity
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            ...s.heading,
                                                            fontSize: 22,
                                                        }}
                                                    >
                                                        {item.quantity ?? 1}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.note}>
                                                        Shipment type
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            ...s.heading,
                                                            fontSize: 22,
                                                        }}
                                                    >
                                                        {item.type ||
                                                            "Not found"}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={{ color: "#2563eb" }}>
                                                Collection
                                            </Text>
                                            <Text style={s.body}>
                                                {fullAddress(
                                                    item.pickup_address,
                                                ) || "Address missing"}
                                            </Text>
                                            <Text style={{ color: "#24753a" }}>
                                                Deliver to
                                            </Text>
                                            <Text style={s.body}>
                                                {fullAddress(
                                                    item.dropoff_address,
                                                ) || "Address missing"}
                                            </Text>
                                            {eligible &&
                                                state?.collection_comparison !==
                                                    "match" && (
                                                    <View
                                                        style={{
                                                            backgroundColor:
                                                                "#fff5d6",
                                                            padding: 16,
                                                            borderRadius: 16,
                                                            gap: 10,
                                                        }}
                                                    >
                                                        <Text style={s.body}>
                                                            {state?.collection_comparison ===
                                                            "mismatch"
                                                                ? "Collection point doesn’t match run start"
                                                                : "Unable to compare collection point"}
                                                        </Text>
                                                        <Text style={s.note}>
                                                            Shipment collection:{" "}
                                                            {fullAddress(
                                                                item.pickup_address,
                                                            ) || "Missing"}
                                                            {"\n"}Run start:{" "}
                                                            {fullAddress(
                                                                origin,
                                                            )}
                                                        </Text>
                                                        <ImportButton
                                                            secondary
                                                            label="Change run start"
                                                            onPress={() =>
                                                                setStage(3)
                                                            }
                                                        />
                                                    </View>
                                                )}
                                            {eligible &&
                                                !!state?.validation_warnings
                                                    ?.length && (
                                                    <Text style={s.error}>
                                                        {state.validation_warnings.join(
                                                            "\n",
                                                        )}
                                                    </Text>
                                                )}
                                            <Text style={s.body}>
                                                Delivery status ·{" "}
                                                {statusLabel(
                                                    item.status ||
                                                        state?.status ||
                                                        "booked",
                                                )}
                                            </Text>
                                            {state?.matched_stop && (
                                                <Text style={s.note}>
                                                    Matched visit ·{" "}
                                                    {state.matched_stop.name} ·{" "}
                                                    {new Date(
                                                        state.matched_stop
                                                            .occurred_at,
                                                    ).toLocaleString()}
                                                </Text>
                                            )}
                                            {state?.ambiguous_match && (
                                                <Text style={s.note}>
                                                    Multiple visits match.
                                                    Review the delivery status;
                                                    no visit will be selected
                                                    automatically.
                                                </Text>
                                            )}
                                            {!!item.failure_reason && (
                                                <Text style={s.note}>
                                                    Failure reason:{" "}
                                                    {item.failure_reason}
                                                </Text>
                                            )}
                                            {eligible && (
                                                <ImportButton
                                                    secondary
                                                    label="Change delivery status  ›"
                                                    disabled={busy}
                                                    onPress={() =>
                                                        chooseStatus(index)
                                                    }
                                                />
                                            )}
                                            {item.status && (
                                                <ImportField
                                                    label="Pickup odometer (km) · Required"
                                                    numeric
                                                    value={
                                                        item.odometer_at_collection
                                                    }
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            odometer_at_collection:
                                                                v
                                                                    ? Number(v)
                                                                    : null,
                                                        })
                                                    }
                                                />
                                            )}
                                            {item.status === "delivered" && (
                                                <ImportField
                                                    label="Delivery odometer (km) · Required"
                                                    numeric
                                                    value={
                                                        item.odometer_at_delivery
                                                    }
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            odometer_at_delivery:
                                                                v
                                                                    ? Number(v)
                                                                    : null,
                                                        })
                                                    }
                                                />
                                            )}
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    justifyContent:
                                                        "space-between",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <View>
                                                    <Text style={s.note}>
                                                        Collection date
                                                    </Text>
                                                    <Text style={s.note}>
                                                        {item.collection_date ||
                                                            "Not found"}
                                                    </Text>
                                                </View>
                                                <ImportButton
                                                    secondary
                                                    label="Edit"
                                                    onPress={() => {
                                                        setEditing(index);
                                                        setEditValue(
                                                            JSON.parse(
                                                                JSON.stringify(
                                                                    item,
                                                                ),
                                                            ),
                                                        );
                                                    }}
                                                />
                                            </View>
                                            <ImportButton
                                                secondary
                                                label={
                                                    item.excluded
                                                        ? "Include shipment"
                                                        : "Exclude shipment"
                                                }
                                                onPress={() =>
                                                    updateItem(index, {
                                                        excluded:
                                                            !item.excluded,
                                                    })
                                                }
                                            />
                                        </View>
                                    );
                                })}
                                {review &&
                                    !review.rows.some(
                                        (r) => r.eligibility === "new",
                                    ) && (
                                        <Text style={s.note}>
                                            All shipments are existing or
                                            excluded. No new run will be
                                            created. You can include a shipment
                                            or choose another document.
                                        </Text>
                                    )}
                                <ImportButton
                                    label="Continue"
                                    disabled={
                                        busy ||
                                        !review?.rows.some(
                                            (r) => r.eligibility === "new",
                                        )
                                    }
                                    onPress={() => {
                                        setStage(5);
                                        setChoiceReady(false);
                                    }}
                                />
                                <ImportButton
                                    secondary
                                    label="Back to locations"
                                    onPress={() => setStage(3)}
                                />
                            </>
                        ) : (
                            <>
                                <Text style={s.subtitle}>
                                    Is this delivery note for your current run
                                    or a new run?
                                </Text>
                                {context.runs.map((run) => (
                                    <ImportButton
                                        key={run.run_id}
                                        secondary
                                        label={`${run.label} · ${run.status.replaceAll("_", " ")}${draft.run_id === run.run_id && !draft.create_new_run ? " ✓" : ""}`}
                                        disabled={busy}
                                        onPress={() =>
                                            void selectRun(run.run_id)
                                        }
                                    />
                                ))}
                                <ImportButton
                                    secondary
                                    label={`Create new run${draft.create_new_run ? " ✓" : ""}`}
                                    disabled={busy}
                                    onPress={() => void selectRun(null)}
                                />
                                {draft.create_new_run && (
                                    <>
                                        <Text style={s.note}>
                                            Ready to start · Choose your
                                            assigned vehicle
                                        </Text>
                                        {context.vehicles.map((v) => (
                                            <ImportButton
                                                key={v.vehicle_id}
                                                secondary
                                                label={`${v.label}${draft.vehicle_id === v.vehicle_id ? " ✓" : ""}`}
                                                onPress={() => {
                                                    setDraft({
                                                        ...draft,
                                                        vehicle_id:
                                                            v.vehicle_id,
                                                    });
                                                }}
                                            />
                                        ))}
                                        {!context.vehicles.length && (
                                            <Text style={s.error}>
                                                Ask dispatch to assign a vehicle
                                                before creating a run.
                                            </Text>
                                        )}
                                    </>
                                )}
                                {choiceReady && !draft.create_new_run && (
                                    <Text style={s.note}>
                                        Confirming will use the starting point
                                        and planned end shown below for this
                                        run. Recorded stops are kept.
                                    </Text>
                                )}
                                {choiceReady && (
                                    <View style={s.card}>
                                        <Text style={s.body}>
                                            {
                                                review?.rows.filter(
                                                    (r) =>
                                                        r.eligibility === "new",
                                                ).length
                                            }{" "}
                                            new shipments ·{" "}
                                            {
                                                review?.rows.filter(
                                                    (r) =>
                                                        r.eligibility ===
                                                            "new" &&
                                                        r.status ===
                                                            "delivered",
                                                ).length
                                            }{" "}
                                            delivered
                                        </Text>
                                        <Text style={s.note}>
                                            Run start: {fullAddress(origin)}
                                            {"\n"}Planned end:{" "}
                                            {fullAddress(end)}
                                        </Text>
                                        {review?.rows
                                            .filter(
                                                (r) => r.eligibility === "new",
                                            )
                                            .map((r) => (
                                                <Text
                                                    key={r.index}
                                                    style={s.note}
                                                >
                                                    {r.reference} ·{" "}
                                                    {statusLabel(r.status)}
                                                    {r.matched_stop
                                                        ? ` · ${r.matched_stop.name}`
                                                        : ""}
                                                </Text>
                                            ))}
                                        <Text style={s.note}>
                                            {draft.create_new_run
                                                ? "Previous-run matches have been removed. Your manual status changes are kept."
                                                : "Matched visits on this run will be linked. Review any status changes before confirming."}
                                        </Text>
                                    </View>
                                )}
                                <ImportButton
                                    label="Confirm & upload"
                                    disabled={
                                        !choiceReady ||
                                        busy ||
                                        (draft.create_new_run &&
                                            !draft.vehicle_id)
                                    }
                                    onPress={() => void confirm()}
                                />
                                <ImportButton
                                    secondary
                                    label="Back to shipments"
                                    onPress={() => setStage(4)}
                                />
                            </>
                        )}
                    </>
                )}
            </ImportSheetPage>
            <ActionSheet ref={actions} />
        </>
    );
}
