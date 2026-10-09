import { Image } from "expo-image";
import {
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetView,
    BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useState,
    type ReactNode,
    type RefObject,
} from "react";
import {
    ActivityIndicator,
    BackHandler,
    AppState,
    useWindowDimensions,
    Linking,
    KeyboardAvoidingView,
    Platform,
    Modal,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { StopLocationMap } from "@/src/components/dashboard/StopLocationMap";
import { locationCoordinate } from "@/src/components/dashboard/run-map-data";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PageHeader } from "@/component/ui/PageHeader";
import { Text } from "@/component/ui/Text";
import { DateInput } from "@/component/ui/DateInput";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    ApiRequestError,
    CancelReason,
    DriverEntityFile,
    DriverFileType,
    DriverShipment,
    driverApi,
} from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";

const STATUS_FLOW = ["booked", "delivered", "in_transit", "failed"];

export type ShipmentDetailsProps = {
    shipmentId: string;
    /** Host increments this when a standalone route regains focus. */
    refreshKey?: number;
    /** Passing an owned completed run grants scoped, read-only access. */
    runId?: string;
    onClose?: () => void;
    /** Sheet mode uses Gorhom scrolling and leaves safe-area ownership to its host. */
    presentation?: "page" | "sheet";
};

/** Shared destination-first screen, usable in a page or a bounded bottom sheet. */
export function ShipmentDetails(props: ShipmentDetailsProps) {
    const { session } = useAuth();
    return (
        <ShipmentDetailsContent
            key={`${session?.token}:${props.shipmentId}:${props.runId ?? ""}`}
            {...props}
        />
    );
}

export function ShipmentDetailsSheet({
    modalRef,
    onDismiss,
    autoPresent = false,
    ...props
}: Omit<ShipmentDetailsProps, "presentation" | "onClose"> & {
    modalRef: RefObject<BottomSheetModal | null>;
    onDismiss?: () => void;
    /** Present after conditional mounting, once the selected shipment props are committed. */
    autoPresent?: boolean;
}) {
    const { colorScheme } = useColorScheme();
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const { height } = useWindowDimensions();
    const bottomInset = 0;
    const contentHeight = Math.max(
        200,
        (height - insets.top - 12 - bottomInset) * 0.9 - 24,
    );
    useEffect(() => {
        if (!autoPresent) return;
        const frame = requestAnimationFrame(() => modalRef.current?.present());
        return () => cancelAnimationFrame(frame);
    }, [autoPresent, modalRef]);
    useEffect(() => {
        if (!visible) return;
        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                modalRef.current?.dismiss();
                return true;
            },
        );
        return () => subscription.remove();
    }, [visible, modalRef]);
    return (
        <BottomSheetModal
            ref={modalRef}
            accessible={false}
            snapPoints={["90%"]}
            enableDynamicSizing={false}
            topInset={insets.top + 12}
            bottomInset={bottomInset}
            style={{ marginHorizontal: 12 }}
            containerComponent={ShipmentSheetContainer}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            onChange={(index) => setVisible(index >= 0)}
            onDismiss={() => {
                setVisible(false);
                onDismiss?.();
            }}
            backgroundStyle={{
                backgroundColor: colorScheme === "dark" ? "#1C1C1F" : "#FFFEFA",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
            }}
            backdropComponent={(p) => (
                <BottomSheetBackdrop
                    {...p}
                    appearsOnIndex={0}
                    disappearsOnIndex={-1}
                />
            )}
        >
            <BottomSheetView style={{ height: contentHeight }}>
                <ShipmentDetails
                    {...props}
                    presentation="sheet"
                    onClose={() => modalRef.current?.dismiss()}
                />
            </BottomSheetView>
        </BottomSheetModal>
    );
}

function ShipmentPanel({
    visible,
    presentation,
    children,
    onRequestClose,
}: {
    visible: boolean;
    presentation: "page" | "sheet";
    children: ReactNode;
    onRequestClose: () => void;
}) {
    if (presentation === "sheet")
        return visible ? (
            <View
                accessibilityViewIsModal
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                }}
            >
                {children}
            </View>
        ) : null;
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onRequestClose}
        >
            {children}
        </Modal>
    );
}

function ShipmentSheetContainer({ children }: { children?: ReactNode }) {
    return Platform.OS === "ios" ? (
        <FullWindowOverlay>{children}</FullWindowOverlay>
    ) : (
        <>{children}</>
    );
}

function ShipmentDetailsContent({
    shipmentId: shipment_id,
    runId: run_id,
    onClose,
    presentation = "page",
    refreshKey,
}: ShipmentDetailsProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const readOnly = !!run_id;
    const { session } = useAuth();
    const { colorScheme } = useColorScheme();
    const isDarkMode = colorScheme === "dark";
    const [shipment, setShipment] = useState<DriverShipment | null>(null);
    const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [detailPanel, setDetailPanel] = useState<
        "files" | "history" | "more" | null
    >(null);
    const [activeAction, setActiveAction] = useState<
        "cancel" | "pod" | "status" | null
    >(null);
    const [statusValue, setStatusValue] = useState("in_transit");
    const [statusNote, setStatusNote] = useState("");
    const [pickupOdometer, setPickupOdometer] = useState("");
    const [deliveryOdometer, setDeliveryOdometer] = useState("");
    const [podFileKey, setPodFileKey] = useState("");
    const [podFileType, setPodFileType] = useState("image/jpeg");
    const [podSignedBy, setPodSignedBy] = useState("");
    const [podDeliveryOdometer, setPodDeliveryOdometer] = useState("");
    const [cancelReasonCode, setCancelReasonCode] = useState("");
    const [cancelReasonText, setCancelReasonText] = useState("");
    const [cancelNote, setCancelNote] = useState("");
    const [shipmentFiles, setShipmentFiles] = useState<DriverEntityFile[]>([]);
    const [shipmentFileTypes, setShipmentFileTypes] = useState<
        DriverFileType[]
    >([]);
    const [shipmentFilesError, setShipmentFilesError] = useState<string | null>(
        null,
    );
    const [fileModalVisible, setFileModalVisible] = useState(false);
    const [selectedFileTypeId, setSelectedFileTypeId] = useState("");
    const [selectedDocument, setSelectedDocument] =
        useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [fileExpiresAt, setFileExpiresAt] = useState("");
    const [fileFormError, setFileFormError] = useState<string | null>(null);

    const selectedShipmentFileType =
        shipmentFileTypes.find(
            (item) => item.file_type_id === selectedFileTypeId,
        ) ?? null;

    const loadShipment = useCallback(async () => {
        if (!session?.token || !shipment_id) {
            setIsLoading(false);
            return;
        }

        try {
            const response = await driverApi.getShipment(
                session.token,
                shipment_id,
                run_id,
            );
            setShipment(response);
            const currentStatus = response?.booking?.status || response?.status;

            const availableStatuses = getAvailableStatuses(currentStatus);
            setStatusValue((current) =>
                availableStatuses.includes(current)
                    ? current
                    : (availableStatuses[0] ?? currentStatus),
            );
            setPodSignedBy(
                (current) => current || response?.dropoff_location?.name || "",
            );
            setPickupOdometer(
                (current) =>
                    current ||
                    formatOdometerInput(
                        response?.booking?.odometer_at_collection,
                    ),
            );
            setDeliveryOdometer(
                (current) =>
                    current ||
                    formatOdometerInput(
                        response?.booking?.odometer_at_delivery,
                    ),
            );
            setPodDeliveryOdometer(
                (current) =>
                    current ||
                    formatOdometerInput(
                        response?.booking?.odometer_at_delivery,
                    ),
            );
            setErrorMessage(null);
        } catch (error) {
            const requestError = error as ApiRequestError;
            setErrorMessage(requestError.message || "Unable to load shipment.");
        } finally {
            setIsLoading(false);
        }
    }, [session, shipment_id, run_id]);

    const loadShipmentFiles = useCallback(async () => {
        if (!session?.token || !shipment_id) {
            setShipmentFiles([]);
            setShipmentFileTypes([]);
            return;
        }

        try {
            const [filesResponse, typesResponse] = await Promise.all([
                driverApi.listShipmentFiles(session.token, shipment_id, run_id),
                readOnly
                    ? Promise.resolve({ data: [] as DriverFileType[] })
                    : driverApi.listFileTypes(session.token, "shipment"),
            ]);

            setShipmentFiles(filesResponse.data);
            setShipmentFileTypes(typesResponse.data);
            setShipmentFilesError(null);
        } catch (error) {
            const requestError = error as ApiRequestError;
            setShipmentFilesError(
                requestError.message || "Unable to load shipment files.",
            );
            setShipmentFiles([]);
        }
    }, [session, shipment_id, run_id, readOnly]);

    useEffect(() => {
        let mounted = true;
        const refresh = () => {
            if (!mounted) return;
            void loadShipment();
            void loadShipmentFiles();
        };
        // Modal content lives in a portal outside screen navigation context.
        void Promise.resolve().then(refresh);
        const listener = AppState.addEventListener("change", (state) => {
            if (state === "active") refresh();
        });
        return () => {
            mounted = false;
            listener.remove();
        };
    }, [loadShipment, loadShipmentFiles, refreshKey]);

    useEffect(() => {
        async function loadCancelReasons() {
            if (!session?.token) {
                return;
            }

            try {
                const response = await driverApi.listCancelReasons(
                    session.token,
                );
                setCancelReasons(response.data);
                setCancelReasonCode(
                    (current) => current || response.data[0]?.code || "",
                );
            } catch {
                setCancelReasons([]);
            }
        }

        loadCancelReasons();
    }, [session?.token]);

    async function runAction(
        action: (token: string) => Promise<DriverShipment>,
        successMessage: string,
    ) {
        if (readOnly || !session?.token || !shipment_id) {
            return;
        }

        setIsMutating(true);
        setErrorMessage(null);
        setActionMessage(null);

        try {
            const response = await action(session.token);
            setShipment(response);
            setActionMessage(successMessage);
            setActiveAction(null);
        } catch (error) {
            const requestError = error as ApiRequestError;
            setErrorMessage(
                requestError.message || "Unable to complete driver action.",
            );
        } finally {
            setIsMutating(false);
        }
    }

    async function pickShipmentFile() {
        const result = await DocumentPicker.getDocumentAsync({
            multiple: false,
            copyToCacheDirectory: true,
        });

        if (result.canceled) {
            return;
        }

        setSelectedDocument(result.assets[0] ?? null);
    }

    function resetShipmentFileForm() {
        setSelectedFileTypeId("");
        setSelectedDocument(null);
        setFileExpiresAt("");
        setFileFormError(null);
    }

    async function uploadShipmentFile() {
        if (readOnly || !session?.token || !shipment_id) {
            return;
        }

        if (!selectedFileTypeId) {
            setFileFormError("Select a file type.");
            return;
        }

        if (!selectedDocument) {
            setFileFormError("Choose a file to upload.");
            return;
        }

        if (
            selectedShipmentFileType?.requires_expiry &&
            !fileExpiresAt.trim()
        ) {
            setFileFormError("Expiry date is required for this file type.");
            return;
        }

        setIsMutating(true);
        setFileFormError(null);

        try {
            await driverApi.uploadShipmentFile(session.token, shipment_id, {
                file_type_id: selectedFileTypeId,
                file: {
                    uri: selectedDocument.uri,
                    name: selectedDocument.name,
                    type: selectedDocument.mimeType,
                },
                expires_at: fileExpiresAt.trim() || undefined,
            });

            resetShipmentFileForm();
            setFileModalVisible(false);
            await loadShipmentFiles();
            setActionMessage("Shipment file uploaded.");
        } catch (error) {
            const requestError = error as ApiRequestError;
            setFileFormError(
                requestError.message || "Unable to upload shipment file.",
            );
        } finally {
            setIsMutating(false);
        }
    }

    async function openShipmentFile(fileId: string) {
        if (!session?.token) {
            return;
        }

        try {
            const response = await driverApi.getFileDownloadUrl(
                session.token,
                fileId,
                run_id,
            );
            await WebBrowser.openBrowserAsync(response.url);
        } catch (error) {
            const requestError = error as ApiRequestError;
            setShipmentFilesError(
                requestError.message || "Unable to open shipment file.",
            );
        }
    }

    const statusRequiresPickupOdometer = requiresPickupOdometer(statusValue);
    const statusRequiresDeliveryOdometer =
        requiresDeliveryOdometer(statusValue);
    const parsedPickupOdometer = parseOdometer(pickupOdometer);
    const parsedDeliveryOdometer = parseOdometer(deliveryOdometer);
    const parsedPodDeliveryOdometer = parseOdometer(podDeliveryOdometer);
    const needsPickupOdometer =
        statusRequiresPickupOdometer &&
        shipment?.booking?.odometer_at_collection == null &&
        parsedPickupOdometer === null;
    const needsDeliveryOdometer =
        statusRequiresDeliveryOdometer &&
        shipment?.booking?.odometer_at_delivery == null &&
        parsedDeliveryOdometer === null;

    const BodyScroll =
        presentation === "sheet" ? BottomSheetScrollView : ScrollView;
    const ink = isDarkMode ? "#FAFAFA" : "#111111";
    const muted = isDarkMode ? "#A1A1AA" : "#71717A";
    const card = isDarkMode ? "#25252B" : "#F5F5F8";
    const surface = isDarkMode ? "#1C1C1F" : "#FFFEFA";
    const deliveryCoordinate = locationCoordinate(shipment?.dropoff_location);
    const total =
        shipment?.total_parcel_count ?? shipment?.parcels?.length ?? 0;
    const currentStatus = shipment?.booking?.status || shipment?.status || "";
    const close = onClose ?? (() => router.back());
    const openPanel = (panel: "files" | "history" | "more") => {
        setActiveAction(null);
        setDetailPanel(panel);
    };
    async function openLocation(url: string) {
        try {
            await Linking.openURL(url);
        } catch {
            setErrorMessage("Unable to open this location. Please try again.");
        }
    }

    return (
        <KeyboardAvoidingView
            style={{
                flex: 1,
                backgroundColor: surface,
                paddingTop: presentation === "page" ? insets.top : 0,
            }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <PageHeader
                title="Shipment"
                leading={
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                            presentation === "sheet"
                                ? "Close shipment details"
                                : "Back"
                        }
                        onPress={close}
                        style={{ minHeight: 44, justifyContent: "center" }}
                    >
                        <ShipmentIcon name="back" />
                    </Pressable>
                }
                action={
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="More shipment actions"
                        disabled={!shipment || isMutating}
                        onPress={() => openPanel("more")}
                        style={{
                            minHeight: 44,
                            minWidth: 44,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ShipmentIcon name="more" />
                    </Pressable>
                }
            />
            <BodyScroll
                style={{ flex: 1 }}
                contentContainerStyle={{
                    padding: 20,
                    paddingBottom: Math.max(insets.bottom, 20) + 20,
                    gap: 16,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {isLoading ? (
                    <ActivityIndicator
                        color="#F54A4A"
                        accessibilityLabel="Loading shipment"
                    />
                ) : null}
                {errorMessage ? (
                    <View
                        accessibilityRole="alert"
                        className="bg-destructive rounded-xl p-4"
                    >
                        <Text className="text-destructive-foreground">
                            {errorMessage}
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={loadShipment}
                            style={{ minHeight: 44, justifyContent: "center" }}
                        >
                            <Text className="text-destructive-foreground font-semibold">
                                Retry
                            </Text>
                        </Pressable>
                    </View>
                ) : null}
                {actionMessage ? (
                    <Text
                        accessibilityRole="alert"
                        className="text-success-foreground"
                    >
                        {actionMessage}
                    </Text>
                ) : null}
                {shipment ? (
                    <>
                        <View
                            style={{
                                backgroundColor: surface,
                                gap: 12,
                            }}
                        >
                            <View
                                style={{
                                    height: 185,
                                    overflow: "hidden",
                                    borderRadius: 12,
                                    backgroundColor: card,
                                }}
                            >
                                {deliveryCoordinate ? (
                                    <StopLocationMap
                                        coordinate={deliveryCoordinate}
                                        name={
                                            shipment.dropoff_location?.name ||
                                            "Delivery location"
                                        }
                                        dark={isDarkMode}
                                    />
                                ) : (
                                    <View
                                        style={{
                                            flex: 1,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: 20,
                                        }}
                                    >
                                        <ShipmentIcon name="delivery" />
                                        <Text
                                            style={{
                                                color: muted,
                                                marginTop: 8,
                                            }}
                                        >
                                            Map coordinates unavailable
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 8,
                                    alignItems: "center",
                                }}
                            >
                                <ShipmentIcon name="delivery" />
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: "600",
                                        color: isDarkMode
                                            ? "#86EFAC"
                                            : "#24753A",
                                    }}
                                >
                                    Delivery
                                </Text>
                            </View>
                            <Text
                                style={{
                                    color: ink,
                                    fontSize: 21,
                                    lineHeight: 28,
                                    fontWeight: "600",
                                }}
                            >
                                {shipment.dropoff_location?.name ||
                                    shipment.dropoff_location?.company ||
                                    "Delivery location"}
                            </Text>
                            <Text
                                style={{
                                    color: muted,
                                    fontSize: 14,
                                    lineHeight: 19,
                                }}
                            >
                                {shipment.dropoff_location?.full_address ||
                                    "No delivery address available"}
                            </Text>
                            {!readOnly ? (
                                <View
                                    style={{
                                        flexDirection: "row",
                                        flexWrap: "wrap",
                                        gap: 10,
                                    }}
                                >
                                    {!!shipment.dropoff_location
                                        ?.full_address && (
                                        <LocationButton
                                            icon="navigate"
                                            label="Navigate"
                                            onPress={() =>
                                                openLocation(
                                                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shipment.dropoff_location!.full_address!)}&travelmode=driving`,
                                                )
                                            }
                                        />
                                    )}
                                    {!!shipment.dropoff_location?.phone && (
                                        <LocationButton
                                            icon="phone"
                                            label="Call location"
                                            onPress={() =>
                                                openLocation(
                                                    `tel:${shipment.dropoff_location!.phone!.replace(/[^+0-9]/g, "")}`,
                                                )
                                            }
                                        />
                                    )}
                                </View>
                            ) : null}
                        </View>
                        <View
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            style={{
                                flexDirection: "row",
                                gap: 5,
                                paddingVertical: 6,
                            }}
                        >
                            {Array.from({ length: 30 }, (_, index) => (
                                <View
                                    key={index}
                                    style={{
                                        flex: 1,
                                        height: 1,
                                        backgroundColor: isDarkMode
                                            ? "#52525B"
                                            : "#C8C6BE",
                                    }}
                                />
                            ))}
                        </View>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: ink,
                                        fontSize: 15,
                                        lineHeight: 22,
                                        fontFamily:
                                            Platform.OS === "ios"
                                                ? "Menlo"
                                                : "monospace",
                                        fontWeight: "600",
                                    }}
                                >
                                    {shipment.merchant_order_ref ||
                                        shipment.delivery_note_number ||
                                        shipment.shipment_id}
                                </Text>
                                <Text
                                    style={{
                                        color: muted,
                                        fontSize: 13,
                                        lineHeight: 18,
                                    }}
                                >
                                    {total} {total === 1 ? "parcel" : "parcels"}
                                    {shipment.service_type
                                        ? ` · ${formatStatus(shipment.service_type)}`
                                        : ""}
                                </Text>
                            </View>
                            <View
                                style={{
                                    backgroundColor: card,
                                    padding: 8,
                                    borderRadius: 8,
                                    maxWidth: "42%",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        fontWeight: "600",
                                        color: ["failed", "cancelled"].includes(
                                            currentStatus,
                                        )
                                            ? "#F54A4A"
                                            : currentStatus === "delivered"
                                              ? "#24753A"
                                              : "#2563EB",
                                    }}
                                >
                                    {formatStatus(currentStatus)}
                                </Text>
                            </View>
                        </View>
                        {readOnly ? (
                            <View
                                style={{
                                    padding: 12,
                                    borderRadius: 12,
                                    backgroundColor: card,
                                    flexDirection: "row",
                                    gap: 12,
                                    alignItems: "center",
                                }}
                            >
                                <ShipmentIcon name="lock" />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            color: ink,
                                            fontSize: 14,
                                            fontWeight: "600",
                                        }}
                                    >
                                        Completed run · Read-only
                                    </Text>
                                    <Text
                                        style={{ color: muted, fontSize: 12 }}
                                    >
                                        Current shipment record. Run visits
                                        retained.
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                        {!readOnly && !shipment.booking ? (
                            <Text style={{ color: muted }}>
                                Driver actions are unavailable because this
                                shipment does not have a booking yet.
                            </Text>
                        ) : null}
                        {!!shipment.dropoff_instructions && (
                            <Text
                                style={{
                                    color: ink,
                                    fontSize: 15,
                                    lineHeight: 21,
                                }}
                            >
                                {shipment.dropoff_instructions}
                            </Text>
                        )}
                        <View style={{ gap: 4 }}>
                            <Text
                                style={{
                                    color: "#2563EB",
                                    fontSize: 12,
                                    fontWeight: "600",
                                }}
                            >
                                {shipment.booking?.collected_at ||
                                shipment.all_parcels_scanned
                                    ? "COLLECTED FROM"
                                    : "COLLECTION"}
                            </Text>
                            <Text
                                style={{
                                    color: ink,
                                    fontSize: 15,
                                    lineHeight: 20,
                                    fontWeight: "600",
                                }}
                            >
                                {[
                                    shipment.pickup_location?.name ||
                                        shipment.pickup_location?.company,
                                    shipment.pickup_location?.full_address,
                                ]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                    "No collection address available"}
                            </Text>
                            {!!shipment.pickup_instructions && (
                                <Text style={{ color: muted, fontSize: 14 }}>
                                    {shipment.pickup_instructions}
                                </Text>
                            )}
                        </View>
                        <View
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                backgroundColor: card,
                                gap: 8,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 12,
                                    alignItems: "center",
                                }}
                            >
                                <ShipmentIcon name="package" />
                                <Text
                                    style={{
                                        flex: 1,
                                        color: ink,
                                        fontSize: 16,
                                        lineHeight: 22,
                                        fontWeight: "600",
                                    }}
                                >
                                    {shipment.scanned_parcel_count ?? 0} of{" "}
                                    {total} parcels scanned
                                </Text>
                            </View>
                            {(shipment.parcels || []).map((parcel, index) => (
                                <View key={parcel.parcel_id}>
                                    <Text
                                        style={{
                                            color: muted,
                                            fontSize: 14,
                                            lineHeight: 19,
                                        }}
                                    >
                                        {parcel.parcel_code || "No code"} ·
                                        Parcel #{index + 1}
                                    </Text>
                                    {!!parcel.contents_description && (
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 13,
                                            }}
                                        >
                                            {parcel.contents_description}
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>
                        <DetailLink
                            icon="files"
                            title="Delivery note & files"
                            subtitle={[
                                shipment.delivery_note_number,
                                "View shipment documents",
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                            onPress={() => openPanel("files")}
                        />
                        <DetailLink
                            icon="history"
                            title="Shipment history"
                            subtitle="Status updates and recorded visits"
                            onPress={() => openPanel("history")}
                        />
                        {!readOnly && (
                            <DetailLink
                                icon="message"
                                title="Message dispatch"
                                subtitle="Ask for help with this shipment"
                                onPress={() => {
                                    if (presentation === "sheet") onClose?.();
                                    router.push("/(tabs)/messages");
                                }}
                            />
                        )}
                    </>
                ) : null}
            </BodyScroll>
            {shipment && readOnly ? (
                <View
                    style={{
                        paddingHorizontal: 20,
                        paddingTop: 20,
                        paddingBottom: Math.max(insets.bottom, 20),
                        gap: 8,
                        backgroundColor: surface,
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        disabled={
                            !readOnly && (!shipment.booking || isMutating)
                        }
                        onPress={() => {
                            if (readOnly) {
                                if (presentation === "sheet") onClose?.();
                                router.push(`/runs/${run_id}`);
                            } else setActiveAction("status");
                        }}
                        style={{
                            minHeight: 52,
                            padding: 14,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: readOnly ? surface : "#F54A4A",
                            borderWidth: readOnly ? 1 : 0,
                            borderColor: isDarkMode ? "#45454D" : "#DBDBE0",
                            opacity:
                                !readOnly && (!shipment.booking || isMutating)
                                    ? 0.5
                                    : 1,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: "600",
                                color: readOnly ? ink : "#FFFFFF",
                            }}
                        >
                            {readOnly
                                ? "View run history"
                                : "Update delivery status"}
                        </Text>
                    </Pressable>
                    <Text style={{ color: muted, fontSize: 12 }}>
                        Read-only · Changes are unavailable
                    </Text>
                </View>
            ) : null}
            <ShipmentPanel
                presentation={presentation}
                visible={
                    !!shipment &&
                    (detailPanel !== null ||
                        (!readOnly &&
                            (activeAction !== null || fileModalVisible)))
                }
                onRequestClose={() => {
                    if (!isMutating) {
                        setDetailPanel(null);
                        setActiveAction(null);
                        setFileModalVisible(false);
                    }
                }}
            >
                <KeyboardAvoidingView
                    style={{
                        flex: 1,
                        backgroundColor: surface,
                        paddingTop: presentation === "page" ? insets.top : 0,
                    }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                >
                    <PageHeader
                        title={
                            fileModalVisible
                                ? "Upload shipment file"
                                : activeAction === "status"
                                  ? "Delivery status"
                                  : activeAction === "pod"
                                    ? "Delivery proof"
                                    : activeAction === "cancel"
                                      ? "Cancel shipment"
                                      : detailPanel === "files"
                                        ? "Shipment files"
                                        : detailPanel === "history"
                                          ? "Shipment history"
                                          : "More actions"
                        }
                        action={
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Close shipment panel"
                                disabled={isMutating}
                                onPress={() => {
                                    setDetailPanel(null);
                                    setActiveAction(null);
                                    setFileModalVisible(false);
                                }}
                                style={{
                                    minHeight: 44,
                                    justifyContent: "center",
                                }}
                            >
                                <Text className="text-primary font-semibold">
                                    Close
                                </Text>
                            </Pressable>
                        }
                    />
                    <ScrollView
                        contentContainerStyle={{
                            padding: 20,
                            paddingBottom: insets.bottom + 24,
                        }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {errorMessage ? (
                            <Text
                                accessibilityRole="alert"
                                className="text-destructive"
                            >
                                {errorMessage}
                            </Text>
                        ) : null}
                        {!readOnly && fileModalVisible ? (
                            <>
                                <View className="bg-card mt-6 rounded-xl px-5 py-5">
                                    <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                                        File type
                                    </Text>
                                    <View className="mt-4 gap-3">
                                        {shipmentFileTypes.map((fileType) => {
                                            const isSelected =
                                                fileType.file_type_id ===
                                                selectedFileTypeId;
                                            return (
                                                <Pressable
                                                    key={fileType.file_type_id}
                                                    onPress={() =>
                                                        setSelectedFileTypeId(
                                                            fileType.file_type_id,
                                                        )
                                                    }
                                                    className={`rounded-[22px] border px-4 py-4 ${
                                                        isSelected
                                                            ? "border-primary bg-accent"
                                                            : "border-border bg-muted"
                                                    }`}
                                                >
                                                    <Text className="text-card-foreground text-base font-semibold">
                                                        {fileType.name}
                                                    </Text>
                                                    {fileType.description ? (
                                                        <Text className="text-muted-foreground mt-1 text-sm leading-6">
                                                            {
                                                                fileType.description
                                                            }
                                                        </Text>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View className="bg-card mt-4 rounded-xl px-5 py-5">
                                    <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                                        Selected file
                                    </Text>
                                    <Pressable
                                        onPress={pickShipmentFile}
                                        className="bg-secondary mt-4 rounded-full px-4 py-4"
                                    >
                                        <Text className="text-secondary-foreground text-center text-base font-semibold">
                                            {selectedDocument
                                                ? "Choose a different file"
                                                : "Choose file"}
                                        </Text>
                                    </Pressable>
                                    <Text className="text-muted-foreground mt-3 text-base">
                                        {selectedDocument
                                            ? selectedDocument.name
                                            : "No file selected"}
                                    </Text>
                                </View>

                                {selectedShipmentFileType?.requires_expiry ? (
                                    <View className="bg-card mt-4 rounded-xl px-5 py-5">
                                        <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                                            Expiry date
                                        </Text>
                                        <DateInput
                                            value={fileExpiresAt}
                                            onChange={setFileExpiresAt}
                                            disabled={isMutating}
                                        />
                                    </View>
                                ) : null}

                                {fileFormError ? (
                                    <View className="border-destructive bg-destructive mt-4 rounded-[24px] border px-4 py-4">
                                        <Text className="text-destructive-foreground text-sm font-semibold">
                                            {fileFormError}
                                        </Text>
                                    </View>
                                ) : null}

                                <Pressable
                                    disabled={
                                        isMutating ||
                                        !selectedDocument ||
                                        !selectedFileTypeId ||
                                        (!!selectedShipmentFileType?.requires_expiry &&
                                            !fileExpiresAt.trim())
                                    }
                                    onPress={uploadShipmentFile}
                                    className={`mt-6 items-center rounded-full px-6 py-4 ${isMutating ? "bg-destructive" : "bg-primary"}`}
                                >
                                    {isMutating ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text className="text-primary-foreground text-base font-semibold">
                                            Upload
                                        </Text>
                                    )}
                                </Pressable>
                            </>
                        ) : null}
                        {shipment && !fileModalVisible && (
                            <>
                                {detailPanel === "more" && !activeAction ? (
                                    <View style={{ gap: 12 }}>
                                        {!readOnly && shipment.booking ? (
                                            <>
                                                <LocationButton
                                                    label="Scan parcels"
                                                    onPress={() => {
                                                        setDetailPanel(null);
                                                        if (
                                                            presentation ===
                                                            "sheet"
                                                        )
                                                            onClose?.();
                                                        router.push(
                                                            `/shipments/${shipment.shipment_id}/scan`,
                                                        );
                                                    }}
                                                />
                                                <LocationButton
                                                    label="Update delivery status"
                                                    onPress={() =>
                                                        setActiveAction(
                                                            "status",
                                                        )
                                                    }
                                                />
                                                <LocationButton
                                                    label="Add delivery proof"
                                                    onPress={() =>
                                                        setActiveAction("pod")
                                                    }
                                                />
                                                <LocationButton
                                                    label="Cancel shipment"
                                                    onPress={() =>
                                                        setActiveAction(
                                                            "cancel",
                                                        )
                                                    }
                                                />
                                            </>
                                        ) : null}
                                        <LocationButton
                                            label="Delivery note & files"
                                            onPress={() => openPanel("files")}
                                        />
                                        <LocationButton
                                            label="Shipment history"
                                            onPress={() => openPanel("history")}
                                        />
                                    </View>
                                ) : null}
                                {!readOnly && shipment.booking ? (
                                    <>
                                        {activeAction === "status" ? (
                                            <ActionCard
                                                title="Update delivery status"
                                                description="Choose the next shipment state available to this driver booking."
                                            >
                                                <OptionRow
                                                    options={getAvailableStatuses(
                                                        shipment.booking.status,
                                                    )}
                                                    selected={statusValue}
                                                    onSelect={setStatusValue}
                                                />
                                                <Input
                                                    label={
                                                        statusValue === "failed"
                                                            ? "Failure reason · Required"
                                                            : "Note"
                                                    }
                                                    value={statusNote}
                                                    onChangeText={setStatusNote}
                                                    placeholder={
                                                        statusValue === "failed"
                                                            ? "Why could delivery not be completed?"
                                                            : "Optional status note"
                                                    }
                                                    multiline
                                                />
                                                {statusRequiresPickupOdometer ? (
                                                    <Input
                                                        label="Pickup odometer"
                                                        value={pickupOdometer}
                                                        onChangeText={
                                                            setPickupOdometer
                                                        }
                                                        placeholder="Current kilometres"
                                                        keyboardType="number-pad"
                                                    />
                                                ) : null}
                                                {statusRequiresDeliveryOdometer ? (
                                                    <Input
                                                        label="Delivery odometer"
                                                        value={deliveryOdometer}
                                                        onChangeText={
                                                            setDeliveryOdometer
                                                        }
                                                        placeholder="Current kilometres"
                                                        keyboardType="number-pad"
                                                    />
                                                ) : null}
                                                <SubmitButton
                                                    label={
                                                        isMutating
                                                            ? "Saving..."
                                                            : "Save status"
                                                    }
                                                    disabled={
                                                        isMutating ||
                                                        needsPickupOdometer ||
                                                        needsDeliveryOdometer ||
                                                        (statusValue ===
                                                            "failed" &&
                                                            !statusNote.trim())
                                                    }
                                                    onPress={() =>
                                                        runAction(
                                                            (token) =>
                                                                driverApi.updateShipmentStatus(
                                                                    token,
                                                                    shipment.shipment_id,
                                                                    {
                                                                        status: statusValue,
                                                                        note:
                                                                            statusNote.trim() ||
                                                                            undefined,
                                                                        odometer_at_collection:
                                                                            parsedPickupOdometer ??
                                                                            undefined,
                                                                        odometer_at_delivery:
                                                                            parsedDeliveryOdometer ??
                                                                            undefined,
                                                                    },
                                                                ),
                                                            "Shipment status updated.",
                                                        )
                                                    }
                                                />
                                            </ActionCard>
                                        ) : null}

                                        {activeAction === "pod" ? (
                                            <ActionCard
                                                title="Attach POD"
                                                description="Save proof-of-delivery metadata against the current booking."
                                            >
                                                <Input
                                                    label="File key"
                                                    value={podFileKey}
                                                    onChangeText={setPodFileKey}
                                                    placeholder="pods/shipment-proof.jpg"
                                                />
                                                <Input
                                                    label="File type"
                                                    value={podFileType}
                                                    onChangeText={
                                                        setPodFileType
                                                    }
                                                    placeholder="image/jpeg"
                                                />
                                                <Input
                                                    label="Signed by"
                                                    value={podSignedBy}
                                                    onChangeText={
                                                        setPodSignedBy
                                                    }
                                                    placeholder="Receiver name"
                                                />
                                                <Input
                                                    label="Delivery odometer"
                                                    value={podDeliveryOdometer}
                                                    onChangeText={
                                                        setPodDeliveryOdometer
                                                    }
                                                    placeholder="Optional delivery kilometres"
                                                    keyboardType="number-pad"
                                                />
                                                <SubmitButton
                                                    label={
                                                        isMutating
                                                            ? "Saving..."
                                                            : "Save POD"
                                                    }
                                                    disabled={
                                                        isMutating ||
                                                        !podFileKey.trim()
                                                    }
                                                    onPress={() =>
                                                        runAction(
                                                            (token) =>
                                                                driverApi.uploadShipmentPod(
                                                                    token,
                                                                    shipment.shipment_id,
                                                                    {
                                                                        file_key:
                                                                            podFileKey.trim(),
                                                                        file_type:
                                                                            podFileType.trim() ||
                                                                            undefined,
                                                                        signed_by:
                                                                            podSignedBy.trim() ||
                                                                            undefined,
                                                                        odometer_at_delivery:
                                                                            parsedPodDeliveryOdometer ??
                                                                            undefined,
                                                                    },
                                                                ),
                                                            "Proof of delivery saved.",
                                                        )
                                                    }
                                                />
                                            </ActionCard>
                                        ) : null}

                                        {activeAction === "cancel" ? (
                                            <ActionCard
                                                title="Cancel shipment"
                                                description="Choose a cancel reason and optionally provide additional detail."
                                            >
                                                <OptionRow
                                                    options={cancelReasons.map(
                                                        (reason) => reason.code,
                                                    )}
                                                    selected={cancelReasonCode}
                                                    onSelect={
                                                        setCancelReasonCode
                                                    }
                                                    renderLabel={(value) =>
                                                        cancelReasons.find(
                                                            (reason) =>
                                                                reason.code ===
                                                                value,
                                                        )?.title || value
                                                    }
                                                    emptyLabel="No cancel reasons available"
                                                />
                                                <Input
                                                    label="Reason text"
                                                    value={cancelReasonText}
                                                    onChangeText={
                                                        setCancelReasonText
                                                    }
                                                    placeholder="Required when using 'other'"
                                                    multiline
                                                />
                                                <Input
                                                    label="Note"
                                                    value={cancelNote}
                                                    onChangeText={setCancelNote}
                                                    placeholder="Optional cancellation note"
                                                    multiline
                                                />
                                                <SubmitButton
                                                    label={
                                                        isMutating
                                                            ? "Cancelling..."
                                                            : "Cancel shipment"
                                                    }
                                                    disabled={
                                                        isMutating ||
                                                        !cancelReasonCode ||
                                                        (cancelReasonCode ===
                                                            "other" &&
                                                            !cancelReasonText.trim())
                                                    }
                                                    destructive
                                                    onPress={() =>
                                                        runAction(
                                                            (token) =>
                                                                driverApi.cancelShipment(
                                                                    token,
                                                                    shipment.shipment_id,
                                                                    {
                                                                        reason_code:
                                                                            cancelReasonCode,
                                                                        reason:
                                                                            cancelReasonText.trim() ||
                                                                            undefined,
                                                                        note:
                                                                            cancelNote.trim() ||
                                                                            undefined,
                                                                    },
                                                                ),
                                                            "Shipment cancelled.",
                                                        )
                                                    }
                                                />
                                            </ActionCard>
                                        ) : null}
                                    </>
                                ) : null}
                                {detailPanel === "files" && !activeAction ? (
                                    <>
                                        <View className="bg-card mt-6 rounded-xl px-5 py-5">
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-card-foreground text-lg font-semibold">
                                                    Shipment files
                                                </Text>
                                                {!readOnly && (
                                                    <Pressable
                                                        onPress={() => {
                                                            resetShipmentFileForm();
                                                            setFileModalVisible(
                                                                true,
                                                            );
                                                        }}
                                                        className="bg-secondary rounded-full px-4 py-3"
                                                    >
                                                        <Text className="text-secondary-foreground text-sm font-semibold">
                                                            Upload
                                                        </Text>
                                                    </Pressable>
                                                )}
                                            </View>

                                            {shipmentFilesError ? (
                                                <Text className="text-destructive-foreground mt-4 text-sm font-medium">
                                                    {shipmentFilesError}
                                                </Text>
                                            ) : shipmentFiles.length === 0 ? (
                                                <Text className="text-muted-foreground mt-4 text-base">
                                                    No shipment files uploaded
                                                    yet.
                                                </Text>
                                            ) : (
                                                <View className="mt-4 gap-3">
                                                    {shipmentFiles.map(
                                                        (file) => (
                                                            <Pressable
                                                                key={
                                                                    file.file_id
                                                                }
                                                                onPress={() =>
                                                                    openShipmentFile(
                                                                        file.file_id,
                                                                    )
                                                                }
                                                                className="border-border rounded-[20px] border px-4 py-4"
                                                            >
                                                                <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                                                                    {file
                                                                        .file_type
                                                                        ?.name ||
                                                                        "Shipment file"}
                                                                </Text>
                                                                <Text className="text-card-foreground mt-2 text-base font-medium">
                                                                    {file.original_name ||
                                                                        "Unnamed file"}
                                                                </Text>
                                                                <Text className="text-muted-foreground mt-1 text-sm">
                                                                    {file.expires_at
                                                                        ? `Expires ${file.expires_at.slice(0, 10)}`
                                                                        : "No expiry"}
                                                                </Text>
                                                            </Pressable>
                                                        ),
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </>
                                ) : null}
                                {detailPanel === "history" && !activeAction ? (
                                    <>
                                        <View className="bg-card mt-6 rounded-xl px-5 py-5">
                                            <Text className="text-card-foreground text-lg font-semibold">
                                                Timeline
                                            </Text>
                                            {shipment.status_history?.map(
                                                (event, index) => (
                                                    <View
                                                        key={index}
                                                        className="mt-4"
                                                    >
                                                        <Text className="text-card-foreground font-semibold">
                                                            {formatStatus(
                                                                event.status,
                                                            )}{" "}
                                                            ·{" "}
                                                            {event.source ===
                                                            "matched_visit"
                                                                ? "Matched recorded visit"
                                                                : event.source ===
                                                                    "driver"
                                                                  ? "Driver update"
                                                                  : "Status update"}
                                                        </Text>
                                                        <Text className="text-muted-foreground">
                                                            {event.description}
                                                        </Text>
                                                        <Text className="text-muted-foreground">
                                                            {event.occurred_at}
                                                        </Text>
                                                    </View>
                                                ),
                                            )}
                                            <InfoRow
                                                label="Booked at"
                                                value={
                                                    shipment.booking?.booked_at
                                                }
                                            />
                                            <InfoRow
                                                label="Collected at"
                                                value={
                                                    shipment.booking
                                                        ?.collected_at
                                                }
                                            />
                                            <InfoRow
                                                label="Pickup odometer"
                                                value={formatOdometerDisplay(
                                                    shipment.booking
                                                        ?.odometer_at_collection,
                                                )}
                                            />
                                            <InfoRow
                                                label="Delivered at"
                                                value={
                                                    shipment.booking
                                                        ?.delivered_at
                                                }
                                            />
                                            <InfoRow
                                                label="Delivery odometer"
                                                value={formatOdometerDisplay(
                                                    shipment.booking
                                                        ?.odometer_at_delivery,
                                                )}
                                            />
                                            <InfoRow
                                                label="Shipment km"
                                                value={formatOdometerDisplay(
                                                    shipment.booking
                                                        ?.total_km_from_collection,
                                                )}
                                            />
                                            <InfoRow
                                                label="Returned at"
                                                value={
                                                    shipment.booking
                                                        ?.returned_at
                                                }
                                            />
                                            <InfoRow
                                                label="Cancelled at"
                                                value={
                                                    shipment.booking
                                                        ?.cancelled_at
                                                }
                                            />
                                        </View>

                                        <View className="bg-card mt-6 rounded-xl px-5 py-5">
                                            <Text className="text-card-foreground text-lg font-semibold">
                                                Shipment info
                                            </Text>
                                            <InfoRow
                                                label="Service type"
                                                value={shipment.service_type}
                                            />
                                            <InfoRow
                                                label="Priority"
                                                value={shipment.priority}
                                            />
                                            <InfoRow
                                                label="Invoice"
                                                value={shipment.invoice_number}
                                            />
                                            <InfoRow
                                                label="Delivery note"
                                                value={
                                                    shipment.delivery_note_number
                                                }
                                            />
                                            <InfoRow
                                                label="Carrier job"
                                                value={
                                                    shipment.booking
                                                        ?.carrier_job_id
                                                }
                                            />
                                            <InfoRow
                                                label="Run status"
                                                value={shipment.run_status}
                                            />
                                            <InfoRow
                                                label="Cancellation reason"
                                                value={
                                                    shipment.booking
                                                        ?.cancel_reason ||
                                                    shipment.booking
                                                        ?.cancellation_reason_code
                                                }
                                            />
                                        </View>

                                        <View className="bg-card mt-6 rounded-xl px-5 py-5">
                                            <Text className="text-card-foreground text-lg font-semibold">
                                                Proof of delivery
                                            </Text>
                                            <InfoRow
                                                label="Signed by"
                                                value={
                                                    shipment.booking?.pod
                                                        ?.signed_by
                                                }
                                            />
                                            <InfoRow
                                                label="File type"
                                                value={
                                                    shipment.booking?.pod
                                                        ?.file_type
                                                }
                                            />
                                            <InfoRow
                                                label="Captured at"
                                                value={
                                                    shipment.booking?.pod
                                                        ?.created_at
                                                }
                                            />
                                        </View>
                                    </>
                                ) : null}
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </ShipmentPanel>
        </KeyboardAvoidingView>
    );
}

const icons = {
    back: require("@/assets/shipment-detail/back.svg"),
    more: require("@/assets/shipment-detail/more.svg"),
    delivery: require("@/assets/shipment-detail/delivery.svg"),
    navigate: require("@/assets/shipment-detail/navigate.svg"),
    phone: require("@/assets/shipment-detail/phone.svg"),
    package: require("@/assets/shipment-detail/package.svg"),
    files: require("@/assets/shipment-detail/files.svg"),
    chevron: require("@/assets/shipment-detail/chevron.svg"),
    history: require("@/assets/shipment-detail/history.svg"),
    message: require("@/assets/shipment-detail/message.svg"),
    lock: require("@/assets/shipment-detail/lock.svg"),
};
type IconName = keyof typeof icons;
function ShipmentIcon({ name }: { name: IconName }) {
    const { colorScheme } = useColorScheme();
    const size =
        name === "back" || name === "more"
            ? 24
            : ["delivery", "navigate", "phone", "chevron"].includes(name)
              ? 18
              : 20;
    return (
        <Image
            source={icons[name]}
            contentFit="contain"
            tintColor={
                colorScheme === "dark"
                    ? name === "delivery"
                        ? "#86EFAC"
                        : "#D4D4D8"
                    : undefined
            }
            style={{ width: size, height: size }}
        />
    );
}
function LocationButton({
    icon,
    label,
    onPress,
}: {
    icon?: IconName;
    label: string;
    onPress: () => void;
}) {
    const { colorScheme } = useColorScheme();
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={{
                backgroundColor: colorScheme === "dark" ? "#25252B" : "#FFFFFF",
                padding: 12,
                minHeight: 44,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
            }}
        >
            {icon && <ShipmentIcon name={icon} />}
            <Text style={{ fontSize: 14, fontWeight: "600" }}>{label}</Text>
        </Pressable>
    );
}
function DetailLink({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon: IconName;
    title: string;
    subtitle: string;
    onPress: () => void;
}) {
    const { colorScheme } = useColorScheme();
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={{
                borderTopWidth: 1,
                borderTopColor: colorScheme === "dark" ? "#45454D" : "#CFCFD6",
                paddingTop: 24,
                paddingBottom: 8,
                minHeight: 70,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
            }}
        >
            <ShipmentIcon name={icon} />
            <View style={{ flex: 1 }}>
                <Text
                    style={{ fontSize: 15, lineHeight: 20, fontWeight: "600" }}
                >
                    {title}
                </Text>
                <Text
                    className="text-muted-foreground"
                    style={{ fontSize: 13, lineHeight: 18 }}
                >
                    {subtitle}
                </Text>
            </View>
            <ShipmentIcon name="chevron" />
        </Pressable>
    );
}

function ActionCard({
    children,
    description,
    title,
}: {
    children: ReactNode;
    description: string;
    title: string;
}) {
    return (
        <View className="bg-muted mt-5 rounded-[24px] px-4 py-4">
            <Text className="text-card-foreground text-base font-semibold">
                {title}
            </Text>
            <Text className="text-muted-foreground mt-1 text-sm leading-6">
                {description}
            </Text>
            <View className="mt-4 gap-4">{children}</View>
        </View>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <View className="mt-4 flex-row justify-between gap-4">
            <Text className="text-muted-foreground flex-1 text-sm uppercase tracking-[2px]">
                {label}
            </Text>
            <Text className="text-card-foreground flex-1 text-right text-base font-medium">
                {value || "Not available"}
            </Text>
        </View>
    );
}

function Input({
    keyboardType,
    label,
    multiline = false,
    onChangeText,
    placeholder,
    value,
}: {
    label: string;
    keyboardType?: "default" | "number-pad" | "numbers-and-punctuation";
    multiline?: boolean;
    onChangeText: (text: string) => void;
    placeholder: string;
    value: string;
}) {
    return (
        <View>
            <Text className="text-muted-foreground mb-2 text-sm uppercase tracking-[2px]">
                {label}
            </Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                multiline={multiline}
                keyboardType={keyboardType ?? "default"}
                textAlignVertical={multiline ? "top" : "center"}
                placeholder={placeholder}
                placeholderTextColor="#A8A29E"
                className={`bg-input text-input-foreground rounded-[9px] px-4 py-4 text-base ${multiline ? "min-h-24" : ""}`}
            />
        </View>
    );
}

function OptionRow({
    emptyLabel,
    onSelect,
    options,
    renderLabel,
    selected,
}: {
    emptyLabel?: string;
    onSelect: (value: string) => void;
    options: string[];
    renderLabel?: (value: string) => string;
    selected: string;
}) {
    if (options.length === 0) {
        return (
            <Text className="text-muted-foreground text-sm">
                {emptyLabel || "No options available"}
            </Text>
        );
    }

    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map((option) => {
                const isSelected = option === selected;

                return (
                    <Pressable
                        key={option}
                        onPress={() => onSelect(option)}
                        className={`rounded-full px-4 py-3 ${isSelected ? "bg-secondary" : "bg-card"}`}
                    >
                        <Text
                            className={`text-sm font-medium ${isSelected ? "text-secondary-foreground" : "text-card-foreground"}`}
                        >
                            {renderLabel
                                ? renderLabel(option)
                                : formatStatus(option)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function SubmitButton({
    destructive = false,
    disabled,
    label,
    onPress,
}: {
    destructive?: boolean;
    disabled: boolean;
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            className={`items-center rounded-full px-5 py-4 ${disabled ? "bg-muted" : destructive ? "bg-destructive" : "bg-secondary"}`}
        >
            <Text
                className={`text-base font-semibold ${disabled ? "text-muted-foreground" : destructive ? "text-destructive-foreground" : "text-secondary-foreground"}`}
            >
                {label}
            </Text>
        </Pressable>
    );
}

function formatStatus(status: string) {
    if (status === "failed") return "Failed Delivery";
    if (status === "at_delivery_location") return "At delivery location";
    const label = status.replaceAll("_", " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function getAvailableStatuses(_currentStatus: string) {
    return STATUS_FLOW;
}

function parseOdometer(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number.parseInt(trimmed, 10);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function formatOdometerInput(value?: number | null) {
    return value === null || value === undefined ? "" : String(value);
}

function formatOdometerDisplay(value?: string | number | null) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return `${numeric.toLocaleString()} km`;
}

function requiresPickupOdometer(status: string) {
    return ["delivered", "in_transit", "failed"].includes(status);
}

function requiresDeliveryOdometer(status: string) {
    return status === "delivered";
}
