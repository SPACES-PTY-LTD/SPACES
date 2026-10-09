import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Href, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, View } from "react-native";
import { Text } from "@/component/ui/Text";
import { CollectionDateCalendar } from "@/src/components/CollectionDateCalendar";
import { ActionSheet, ActionSheetRef } from "@/component/ui/ActionSheet";
import {
    ApiRequestError,
    ImportContext,
    ImportDraft,
    ImportLine,
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
import { LocationSearchPicker, type LocationSearchPickerHandle } from "@/src/components/LocationSearchPicker";
import { ImportStepIndicator } from "@/src/components/ImportStepIndicator";
import { canReturnToImportStep, type ImportStep } from "@/src/components/import-steps";
import { TripLocationStep } from "@/src/components/TripLocationStep";
import { shipmentAddressDraft, collectionFromRunStart } from "@/src/lib/import-addresses";
import { ImportRunChoice } from "@/src/components/ImportRunChoice";
import { DeliveryNoteProgress } from "@/src/components/delivery-note-progress";

const quantityUnits = ["Bags", "Boxes", "Crates", "Cubic metres", "Drums", "Kilograms", "Liters", "Pallets", "Rolls", "Tonnes", "Units"];
const unitValue = (label: string) => label.toLowerCase().replaceAll(" ", "_");

const statusLabel = (value: string) => {
    if (value === "at_delivery_location") return "At delivery location";
    if (value === "failed") return "Failed Delivery";
    if (value === "in_transit") return "In transit";
    if (value === "delivered") return "Delivered";
    return "Booked";
};
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

export default function ReviewImport() {
    const { import_id } = useLocalSearchParams<{ import_id: string }>();
    const { session } = useAuth();
    const [context, setContext] = useState<ImportContext>();
    const [draft, setDraft] = useState<ImportDraft>();
    const [stage, setStage] = useState<ImportStep>(3);
    const [filename, setFilename] = useState("");
    const [review, setReview] = useState<ImportReview>();
    const [result, setResult] = useState<ImportResult | null>(null);
    const [destination, setDestination] = useState<Href>();
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<ImportLine>();
    const [quantityText, setQuantityText] = useState("");
    const [choosingDate, setChoosingDate] = useState(false);
    const [failureIndex, setFailureIndex] = useState<number | null>(null);
    const [failureReason, setFailureReason] = useState("");
    const [locationKind, setLocationKind] = useState<
        "origin_location_id" | "destination_location_id" | "pickup_location_id" | "dropoff_location_id" | null
    >(null);
    const [locationItemIndex, setLocationItemIndex] = useState<number | null>(null);
    const locationPicker = useRef<LocationSearchPickerHandle>(null);
    const [choiceReady, setChoiceReady] = useState(false);
    const actions = useRef<ActionSheetRef>(null);
    const shipmentOptions = useRef<ActionSheetRef>(null);
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
            setFilename(item.filename);
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
                    available.today,
                pickup_address: extracted.pickup_address || {},
                dropoff_address: extracted.dropoff_address || {},
                line_items: (extracted.line_items || []).map((row) => ({
                    ...row,
                    ...shipmentAddressDraft(row),
                    collection_date:
                        row.collection_date || extracted.collection_date || available.today,
                })),
            };
            const restored: ImportDraft = saved && !item.confirmation_result ? JSON.parse(saved) : initial;
            setDraft(applyRunStart({
                ...restored,
                collection_date: restored.collection_date || available.today,
                line_items: restored.line_items.map(row => ({
                    ...row, type: "standard",
                    collection_date: row.collection_date || restored.collection_date || available.today,
                })),
            }, available.locations));
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
    function returnToStep(target: ImportStep) {
        if (!canReturnToImportStep(stage, target, busy || creating || !!result)) return;
        setError("");
        setChoiceReady(false);
        setStage(target);
    }
    function applyRunStart(value: ImportDraft, locations = context?.locations ?? []): ImportDraft {
        const start = [...locations, ...(value.trip_locations ?? [])].find(l => l.location_id === value.origin_location_id);
        return { ...value, line_items: value.line_items.map(row => collectionFromRunStart(row, start)) };
    }
    function update(patch: Partial<ImportDraft>) {
        setDraft((d) => (d ? applyRunStart({ ...d, ...patch }) : d));
        setChoiceReady(false);
    }
    function updateItem(index: number, patch: Partial<ImportLine>) {
        if (!draft) return;
        const next = applyRunStart({
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
                i === index ? { ...r, ...patch, ...(patch.pickup_location_id ? { pickup_from_run_start: patch.pickup_from_run_start ?? false } : {}) } : r,
            ),
        });
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
    const locationLabel = (address?: Record<string, any>, locationId?: string | null) =>
        context?.locations.find(location => location.location_id === locationId)?.name?.trim()
        || address?.name?.trim()
        || address?.company?.trim()
        || (fullAddress(address) ? "Location name unavailable" : "Address missing");
    function chooseStatus(index: number) {
        actions.current?.present({
            title: "Change delivery status",
            stackBehavior: "push",
            actions: ["booked", "delivered", "in_transit", "failed"].map((value) => ({
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
    function showShipmentOptions(index: number) {
        const item = draft?.line_items[index];
        if (!item) return;
        const eligible = review?.rows[index]?.eligibility === "new";
        shipmentOptions.current?.present({
            title: "Shipment options",
            stackBehavior: "push",
            accessibilityLabel: `Options for shipment ${item.merchant_order_ref || index + 1}`,
            actions: [
                {
                    id: "edit",
                    label: "Edit Shipment",
                    onPress: () => {
                        setEditing(index);
                        setEditValue(JSON.parse(JSON.stringify(item)));
                        setQuantityText(item.quantity == null ? "" : String(item.quantity));
                    },
                },
                {
                    id: "exclude",
                    label: item.excluded ? "Include shipment in run" : "Exclude shipment from run",
                    onPress: () => updateItem(index, { excluded: !item.excluded }),
                },
                {
                    id: "status",
                    label: "Change shipment status",
                    disabled: !eligible,
                    accessibilityHint: eligible ? undefined : "Only new included shipments can change status during import review.",
                    onPress: () => chooseStatus(index),
                },
            ],
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
          : locationKind === "pickup_location_id" || locationKind === "dropoff_location_id"
            ? locationKind === "pickup_location_id" ? "Choose collection location" : "Choose delivery location"
            : choosingDate
            ? "Collection date"
            : editing !== null
            ? "Edit shipment"
            : failureIndex !== null
              ? "Failed Delivery"
              : locationKind
                ? locationKind === "origin_location_id" ? "Choose starting point" : "Choose planned end"
                : stage === 1
                  ? "Upload a delivery note"
                  : stage === 2
                    ? "Reading file"
                    : stage === 3
                  ? "Confirm trip locations"
                  : stage === 4
                    ? "Confirm shipments found"
                    : "Choose run";
    return (
        <>
            <ImportSheetPage
                title={title}
                footer={!result && !creating && stage === 5 && editing === null && !locationKind && !choosingDate && failureIndex === null ? <View style={{ gap: 8 }}>
                    <ImportButton label="Confirm & upload" disabled={!choiceReady || busy || (draft?.create_new_run && !draft.vehicle_id) || !draft}
                        onPress={() => void confirm()} />
                    <Text style={s.note}>{draft?.create_new_run && !draft.vehicle_id ? "Choose an assigned vehicle to continue." : "Uses the starting point and planned end above."}</Text>
                </View> : undefined}
                destination={destination}
                backDisabled={busy || creating}
                keyboardBehavior={editing !== null ? "fillParent" : undefined}
                onBack={choosingDate ? () => setChoosingDate(false) : locationKind ? () => { setLocationKind(null); setLocationItemIndex(null); } : editing !== null ? () => { Keyboard.dismiss(); setEditing(null); setEditValue(undefined); setError(""); } : !result && stage > 1 ? () => returnToStep((stage - 1) as ImportStep) : undefined}
                showsVerticalScrollIndicator={stage === 4 ? false : undefined}
                plainScroll={!!locationKind}
                onScroll={event => locationPicker.current?.onScroll(event)}
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
                        <LocationSearchPicker
                            key={locationKind}
                            ref={locationPicker}
                            token={session!.token}
                            confirmOnSelect
                            savedOnly={locationKind === "pickup_location_id" || locationKind === "dropoff_location_id"}
                            selectionIcon={locationKind === "origin_location_id" ? "map-pin" : "flag"}
                            selectedLabel={locationKind === "origin_location_id" ? "SELECTED STARTING POINT" : "SELECTED PLANNED END"}
                            confirmLabel={locationKind === "origin_location_id" ? "Use starting point" : "Use planned end location"}
                            onConfirm={location => {
                                if (locationKind === "pickup_location_id" || locationKind === "dropoff_location_id") {
                                    const addressKey = locationKind === "pickup_location_id" ? "pickup_address" : "dropoff_address";
                                    const patch = { [locationKind]: location.location_id, [addressKey]: location, ...(locationKind === "pickup_location_id" ? { pickup_from_run_start: false } : {}) };
                                    if (locationItemIndex !== null) {
                                        updateItem(locationItemIndex, patch);
                                        setLocationItemIndex(null);
                                    } else {
                                        setEditValue(current => current ? { ...current, ...patch } : current);
                                    }
                                    setLocationKind(null);
                                    setError("");
                                    return;
                                }
                                setContext(current => current ? { ...current, locations: [...current.locations.filter(l => l.location_id !== location.location_id), location] } : current);
                                update({
                                    [locationKind]: location.location_id,
                                    trip_locations: [...(draft.trip_locations || []).filter(l => l.location_id !== location.location_id), location],
                                });
                                setLocationKind(null);
                            }}
                        />
                    </>
                ) : choosingDate && editValue ? (
                    <CollectionDateCalendar value={editValue.collection_date || ""} onConfirm={collection_date => { setEditValue(current => current ? { ...current, collection_date } : current); setChoosingDate(false); }} />
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
                        <View style={{ gap: 6 }}>
                            <Text style={s.label}>Collection date</Text>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Choose collection date, ${editValue.collection_date || "not selected"}`} onPress={() => { Keyboard.dismiss(); setChoosingDate(true); }} style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}><Text style={s.body}>{editValue.collection_date || "Choose date"}</Text><Feather name="calendar" size={18} color="#666" /></Pressable>
                        </View>
                        <ImportField
                            label="Description"
                            value={editValue.description}
                            onChange={(v) =>
                                setEditValue({ ...editValue, description: v })
                            }
                        />
                        <ImportField
                            label="Quantity"
                            trailing={<Pressable accessibilityRole="button" accessibilityLabel="Unit of measure" onPress={() => { Keyboard.dismiss(); actions.current?.present({ title: "Unit of measure", actions: quantityUnits.map(label => ({ id: unitValue(label), label, onPress: () => setEditValue(current => current ? { ...current, quantity_unit: unitValue(label) } : current) })) }); }} style={{ borderLeftWidth: 1, borderLeftColor: "#d4d4d8", paddingHorizontal: 12, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={s.body}>{quantityUnits.find(unit => unitValue(unit) === editValue.quantity_unit) || "Units"}</Text><Feather name="chevron-down" size={16} color="#666" /></Pressable>}
                            numeric
                            value={quantityText}
                            onChange={(v) => {
                                setQuantityText(v);
                                setEditValue({ ...editValue, quantity: v ? Number(v) : null });
                            }}
                        />
                        {([['pickup_location_id', 'pickup_address', 'Collection'], ['dropoff_location_id', 'dropoff_address', 'Deliver to']] as const).map(([kind, addressKey, label]) => (
                            <View key={kind} style={{ gap: 16 }}>
                                <Text style={s.heading}>{label}</Text>
                                <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${label === 'Collection' ? 'collection' : 'delivery'} location`} onPress={() => setLocationKind(kind)} style={[s.choice, { gap: 6 }]}>
                                    <Text style={s.body}>{editValue[addressKey]?.name || (fullAddress(editValue[addressKey]) ? label : `Choose saved ${label === 'Collection' ? 'collection' : 'delivery'} location`)}</Text>
                                    {!!fullAddress(editValue[addressKey]) && <Text style={s.note}>{fullAddress(editValue[addressKey])}</Text>}
                                    <Text style={s.note}>Change location ›</Text>
                                </Pressable>
                                <Text style={s.note}>Only saved locations can be selected. If your location is missing, contact dispatch.</Text>
                            </View>
                        ))}
                        {(
                            [
                                "weight",
                                "length_cm",
                                "width_cm",
                                "height_cm",
                            ] as const
                        ).filter(key => key === "weight"
                            ? ["bags", "boxes", "crates", "cubic_metres", "drums", "liters", "pallets", "rolls"].includes(editValue.quantity_unit || "units")
                            : ["boxes", "pallets", "crates"].includes(editValue.quantity_unit || "units")
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
                                if (!editValue.pickup_location_id || !editValue.dropoff_location_id) { setError("Choose saved collection and delivery locations. If a location is missing, contact dispatch."); return; }
                                Keyboard.dismiss();
                                updateItem(editing, { ...editValue, quantity_unit: editValue.quantity_unit || "units" });
                                setEditing(null);
                            }}
                        />
                        <ImportButton
                            secondary
                            label="Cancel"
                            onPress={() => { Keyboard.dismiss(); setEditing(null); }}
                        />
                    </>
                ) : (
                    <>
                        <ImportStepIndicator step={stage} onBack={returnToStep} locked={busy || creating} />
                        {stage === 1 ? (
                            <>
                                <Text style={s.heading}>{filename || "Selected delivery note"}</Text>
                                <Text style={s.subtitle}>This document has already been read. Your locations and shipment edits are saved in this draft.</Text>
                                <ImportButton label="Continue" onPress={() => setStage(2)} />
                                <ImportButton secondary label="Change document" onPress={() => setDestination({ pathname: "/shipments/load", params: { resume_import_id: import_id, run_id: draft.run_id || undefined } })} />
                            </>
                        ) : stage === 2 ? (
                            <>
                                <Feather name="check-circle" size={28} color="#24753a" />
                                <Text style={s.heading}>File read successfully</Text>
                                <Text style={s.subtitle}>{draft.line_items.length} shipments found. Continue to review your trip locations.</Text>
                                <ImportButton label="Continue" onPress={() => setStage(3)} />
                            </>
                        ) : stage === 3 ? (
                            <TripLocationStep origin={origin} end={end} busy={busy}
                                onChoose={setLocationKind}
                                onContinue={async () => {
                                    if (await refreshReview(draft)) setStage(4);
                                }}
                            />
                        ) : stage === 4 ? (
                            <>
                                <Text style={s.subtitle}>
                                    {draft.line_items.length} shipments ·{" "}
                                    {review?.rows.filter(
                                        (r) =>
                                            r.eligibility === "new" &&
                                            (!draft.line_items[r.index]?.pickup_location_id ||
                                                !draft.line_items[r.index]?.dropoff_location_id ||
                                                r.collection_comparison !==
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
                                                <View style={{ flex: 1, gap: 2 }}>
                                                    <Text style={s.note}>Shipment number</Text>
                                                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                                                        <Text style={{ ...s.body, fontWeight: "700", flexShrink: 1 }}>
                                                            {item.merchant_order_ref || "Reference missing"}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: "#24753a",
                                                                backgroundColor: "#e8f7ed",
                                                                padding: 5,
                                                                borderRadius: 8,
                                                            }}
                                                        >
                                                            {state?.eligibility === "existing"
                                                                ? "Existing · skipped"
                                                                : state?.eligibility === "excluded"
                                                                  ? "Excluded"
                                                                  : "New"}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Options for shipment ${item.merchant_order_ref || index + 1}`}
                                                    accessibilityState={{ disabled: busy }}
                                                    disabled={busy}
                                                    onPress={() => showShipmentOptions(index)}
                                                    style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center", opacity: busy ? 0.45 : 1 }}
                                                >
                                                    <View style={{ minHeight: 30, paddingHorizontal: 8, borderWidth: 1, borderColor: "#e0e3e8", borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
                                                        <Text style={[s.body, { fontSize: 13, fontWeight: "600" }]}>Options</Text>
                                                        <Feather name="chevron-down" size={12} color="#666" />
                                                    </View>
                                                </Pressable>
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
                                                            ...s.body,
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        {item.quantity ?? 1} {(item.quantity_unit || "units").replaceAll("_", " ")}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.note}>
                                                        Shipment type
                                                    </Text>
                                                    <Text
                                                        style={{
                                                            ...s.body,
                                                            fontWeight: "700",
                                                        }}
                                                    >
                                                        Standard
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: "row", gap: 24 }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.note}>Collection date</Text>
                                                    <Text style={[s.body, { fontWeight: "700" }]}>
                                                        {item.collection_date || "Not found"}
                                                    </Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.note}>Delivery status</Text>
                                                    <Text style={[s.body, { fontWeight: "700" }]}>
                                                        {statusLabel(item.status || state?.status || "booked")}
                                                    </Text>
                                                </View>
                                            </View>
                                            {([
                                                ["pickup_location_id", "pickup_address", "Collection"],
                                                ["dropoff_location_id", "dropoff_address", "Deliver to"],
                                            ] as const).map(([kind, addressKey, label]) => (
                                                <Pressable
                                                    key={kind}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Change ${label === "Collection" ? "collection" : "delivery"} location for shipment ${item.merchant_order_ref || index + 1}`}
                                                    accessibilityState={{ disabled: busy }}
                                                    disabled={busy}
                                                    onPress={() => {
                                                        setLocationItemIndex(index);
                                                        setLocationKind(kind);
                                                    }}
                                                    style={{ minHeight: 44, gap: 2, opacity: busy ? 0.45 : 1 }}
                                                >
                                                    <Text style={s.note}>{label}</Text>
                                                    <Text style={[s.body, { fontWeight: "700", textDecorationLine: "underline" }, !item[kind] && { color: s.error.color }]}>
                                                        {item[kind] ? locationLabel(item[addressKey], item[kind]) : `Choose ${label === "Collection" ? "collection" : "delivery"} location`}
                                                    </Text>
                                                    {!item[kind] && locationLabel(item[addressKey]) !== "Address missing" && <Text style={s.note}>From document: {locationLabel(item[addressKey])}</Text>}
                                                </Pressable>
                                            ))}
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
                                                                ? "We noticed that the shipment collection location is different from the run starting location."
                                                                : "Check the shipment collection location"}
                                                        </Text>
                                                        <Text style={s.note}>
                                                            {state?.collection_comparison === "mismatch"
                                                                ? "If this is correct, ignore this message. Otherwise, change the shipment collection location or the run starting location."
                                                                : "We couldn’t verify whether these locations match. Select a saved collection location or check the run starting location."}
                                                        </Text>
                                                        <Text style={s.note}>
                                                            Shipment collection:{" "}
                                                            {locationLabel(item.pickup_address, item.pickup_location_id)}{"\n"}
                                                            {fullAddress(
                                                                item.pickup_address,
                                                            ) || "Missing"}
                                                            {"\n"}Run start:{" "}
                                                            {locationLabel(origin, draft.origin_location_id)}{"\n"}
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
                                                        {state.validation_warnings.map(warning => warning
                                                            .replace("Complete the delivery address.", "Choose a delivery location.")
                                                            .replace("Complete the collection address.", "Choose a collection location.")
                                                        ).join("\n")}
                                                    </Text>
                                                )}
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
                                            {item.status && item.status !== "booked" && (
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
                                        ) || review.rows.some(r => r.eligibility === "new" &&
                                            (!draft.line_items[r.index]?.pickup_location_id || !draft.line_items[r.index]?.dropoff_location_id))
                                    }
                                    onPress={() => {
                                        setStage(5);
                                        void selectRun(draft.create_new_run ? null : draft.run_id || null);
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <ImportRunChoice
                                    context={context} draft={draft} review={review} ready={choiceReady} busy={busy || creating}
                                    start={fullAddress(origin)} end={fullAddress(end)} statusLabel={statusLabel}
                                    onSelectRun={id => void selectRun(id)}
                                    onChooseVehicle={() => actions.current?.present({ title: "Choose assigned vehicle", actions: context.vehicles.map(vehicle => ({
                                        id: vehicle.vehicle_id, label: vehicle.label, selected: draft.vehicle_id === vehicle.vehicle_id,
                                        onPress: () => setDraft(current => current ? { ...current, vehicle_id: vehicle.vehicle_id } : current),
                                    })) })}
                                />

                            </>
                        )}
                    </>
                )}
            </ImportSheetPage>
            <ActionSheet ref={shipmentOptions} />
            <ActionSheet ref={actions} />
        </>
    );
}
