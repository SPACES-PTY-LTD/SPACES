import { Image } from "expo-image";
import {
    BottomSheetModal,
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useRef,
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

import { ActionSheet, type ActionSheetRef } from "@/component/ui/ActionSheet";
import { BottomSheet } from "@/component/ui/BottomSheet";
import { createSheetHandoff } from "@/component/ui/sheet-handoff";
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
    /** Sheet mode uses bounded native scrolling and leaves safe-area ownership to its host. */
    presentation?: "page" | "sheet";
    /** Keep state outside the sheet portal while native selection is open. */
    renderSurface?: (content: ReactNode) => ReactNode;
    runFileSourceFlow?: (task: () => Promise<void>) => Promise<void>;
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
    const [dismissalCount, setDismissalCount] = useState(0);
    const receiptHandoff = useRef<ReturnType<typeof createSheetHandoff> | null>(
        null,
    );
    useEffect(() => {
        const handoff = createSheetHandoff(
            () => modalRef.current?.dismiss(),
            () => modalRef.current?.present(),
        );
        receiptHandoff.current = handoff;
        return () => handoff.dispose();
    }, [modalRef, props.shipmentId, props.runId]);
    useEffect(() => {
        if (dismissalCount === 0) return;
        if (!receiptHandoff.current?.onDismiss()) onDismiss?.();
        // Only completed portal removals trigger navigation or picker handoff.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dismissalCount]);
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
    // State and sibling upload/source sheets survive receipt portal removal.
    return (
        <ShipmentDetails
            {...props}
            presentation="sheet"
            onClose={() => modalRef.current?.dismiss()}
            runFileSourceFlow={async (task) => {
                await receiptHandoff.current?.run(task);
            }}
            renderSurface={(content) => (
                <BottomSheetModal
                    ref={modalRef}
                    accessible={false}
                    snapPoints={["90%"]}
                    enableDynamicSizing={false}
                    // Receipt controls/native scrolling own content touches; drag via the handle.
                    enableContentPanningGesture={false}
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
                        setDismissalCount((count) => count + 1);
                    }}
                    backgroundStyle={{
                        backgroundColor:
                            colorScheme === "dark" ? "#1C1C1F" : "#FFFEFA",
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    }}
                    backdropComponent={ShipmentSheetBackdrop}
                >
                    <View style={{ height: contentHeight }}>
                        {content}
                    </View>
                </BottomSheetModal>
            )}
        />
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

// Keep this component identity stable: FullWindowOverlay mounts new native
// children above existing ones, so remounting a backdrop can cover the receipt.
function ShipmentSheetBackdrop(props: BottomSheetBackdropProps) {
    return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />;
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
    renderSurface = (content) => content,
    runFileSourceFlow = async (task) => {
        await task();
    },
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
    const shipmentActions = useRef<ActionSheetRef>(null);
    const deliveryStatuses = useRef<ActionSheetRef>(null);
    const [detailPanel, setDetailPanel] = useState<"history" | null>(
        null,
    );
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
    const [shipmentFilesLoading, setShipmentFilesLoading] = useState(true);
    const shipmentFilesRequest = useRef(0);
    const [shipmentFiles, setShipmentFiles] = useState<DriverEntityFile[]>([]);
    const [shipmentFileTypes, setShipmentFileTypes] = useState<
        DriverFileType[]
    >([]);
    const [shipmentFilesError, setShipmentFilesError] = useState<string | null>(
        null,
    );
    const shipmentUploadSheet = useRef<BottomSheetModal>(null);
    const shipmentFileSources = useRef<ActionSheetRef>(null);
    const filePickerHandoff = useRef<ReturnType<
        typeof createSheetHandoff
    > | null>(null);
    const resolveFileSource = useRef<((source?: string) => void) | null>(null);
    const [isPickingFile, setIsPickingFile] = useState(false);
    const [fileModalVisible, setFileModalVisible] = useState(false);
    const [selectedFileTypeId, setSelectedFileTypeId] = useState("");
    const [fileTypeDropdownOpen, setFileTypeDropdownOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] =
        useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [fileExpiresAt, setFileExpiresAt] = useState("");
    const [fileFormError, setFileFormError] = useState<string | null>(null);

    useEffect(() => {
        const handoff = createSheetHandoff(
            () => shipmentUploadSheet.current?.dismiss(),
            () => shipmentUploadSheet.current?.present(),
        );
        filePickerHandoff.current = handoff;
        return () => {
            handoff.dispose();
            resolveFileSource.current?.();
            resolveFileSource.current = null;
        };
    }, []);
    useEffect(() => {
        if (fileModalVisible) shipmentUploadSheet.current?.present();
        else shipmentUploadSheet.current?.dismiss();
    }, [fileModalVisible]);

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
        const request = ++shipmentFilesRequest.current;
        if (!session?.token || !shipment_id) {
            setShipmentFiles([]);
            setShipmentFileTypes([]);
            setShipmentFilesLoading(false);
            return;
        }

        setShipmentFilesLoading(true);
        setShipmentFilesError(null);
        try {
            const [filesResponse, typesResponse] = await Promise.all([
                driverApi.listShipmentFiles(session.token, shipment_id, run_id),
                readOnly
                    ? Promise.resolve({ data: [] as DriverFileType[] })
                    : driverApi.listFileTypes(session.token, "shipment"),
            ]);

            if (request !== shipmentFilesRequest.current) return;
            setShipmentFiles(filesResponse.data);
            setShipmentFileTypes(typesResponse.data);
            setShipmentFilesError(null);
        } catch (error) {
            if (request !== shipmentFilesRequest.current) return;
            const requestError = error as ApiRequestError;
            setShipmentFilesError(
                requestError.message || "Unable to load shipment files.",
            );
        } finally {
            if (request === shipmentFilesRequest.current)
                setShipmentFilesLoading(false);
        }
    }, [session, shipment_id, run_id, readOnly]);

    useEffect(() => {
        let mounted = true;
        const filesRequests = shipmentFilesRequest;
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
            filesRequests.current++;
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
        const handoff = filePickerHandoff.current;
        if (readOnly || isMutating || !handoff || handoff.running) return;
        setIsPickingFile(true);
        setFileTypeDropdownOpen(false);
        await handoff.run(async () => {
            await runFileSourceFlow(async () => {
                try {
                    const source = await new Promise<string | undefined>(
                        (resolve) => {
                            if (!shipmentFileSources.current)
                                return resolve(undefined);
                            resolveFileSource.current = resolve;
                            shipmentFileSources.current.present({
                                title: "Choose file",
                                actions: [
                                    {
                                        id: "file",
                                        label: "File",
                                        onPress: () => {},
                                    },
                                    {
                                        id: "photo",
                                        label: "Photo",
                                        onPress: () => {},
                                    },
                                    {
                                        id: "camera",
                                        label: "Camera",
                                        onPress: () => {},
                                    },
                                ],
                                onDismiss: (choice) => {
                                    resolveFileSource.current = null;
                                    resolve(choice);
                                },
                            });
                        },
                    );
                    if (!handoff.active || !source) return;
                    let asset: DocumentPicker.DocumentPickerAsset | undefined;
                    if (source === "file") {
                        const result = await DocumentPicker.getDocumentAsync({
                            multiple: false,
                            copyToCacheDirectory: true,
                        });
                        if (!result.canceled) asset = result.assets[0];
                    } else {
                        if (source === "camera") {
                            const permission =
                                await ImagePicker.requestCameraPermissionsAsync();
                            if (!handoff.active) return;
                            if (!permission.granted) {
                                setFileFormError(
                                    "Allow camera access in device settings, or choose File or Photo.",
                                );
                                return;
                            }
                        }
                        const options: ImagePicker.ImagePickerOptions = {
                            mediaTypes: ["images"],
                            quality: 0.9,
                            allowsEditing: false,
                        };
                        const result =
                            source === "camera"
                                ? await ImagePicker.launchCameraAsync(options)
                                : await ImagePicker.launchImageLibraryAsync(
                                      options,
                                  );
                        if (!result.canceled && result.assets[0]) {
                            const image = result.assets[0];
                            const mimeType = image.mimeType || "image/jpeg";
                            asset = {
                                lastModified: Date.now(),
                                uri: image.uri,
                                name:
                                    image.fileName ||
                                    `shipment-file-${Date.now()}.${mimeType.split("/")[1] || "jpg"}`,
                                mimeType,
                                size: image.fileSize,
                            };
                        }
                    }
                    if (handoff.active && asset) {
                        setSelectedDocument(asset);
                        setFileFormError(null);
                    }
                } catch (error) {
                    if (handoff.active)
                        setFileFormError(
                            (error as Error).message ||
                                "Unable to choose a file.",
                        );
                }
            });
        });
        if (handoff.active) setIsPickingFile(false);
    }

    function resetShipmentFileForm() {
        setFileTypeDropdownOpen(false);
        setSelectedFileTypeId("");
        setSelectedDocument(null);
        setFileExpiresAt("");
        setFileFormError(null);
    }

    async function uploadShipmentFile() {
        if (
            readOnly ||
            isPickingFile ||
            isMutating ||
            !session?.token ||
            !shipment_id
        ) {
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

    // A bounded receipt uses native scrolling rather than a second Gorhom
    // scrollable registration competing with the outer sheet content.
    const BodyScroll = ScrollView;
    const ink = isDarkMode ? "#FAFAFA" : "#111111";
    const muted = isDarkMode ? "#A1A1AA" : "#71717A";
    const card = isDarkMode ? "#25252B" : "#F5F5F8";
    const surface = isDarkMode ? "#1C1C1F" : "#FFFEFA";
    const deliveryCoordinate = locationCoordinate(shipment?.dropoff_location);
    const total =
        shipment?.total_parcel_count ?? shipment?.parcels?.length ?? 0;
    const currentStatus = shipment?.booking?.status || shipment?.status || "";
    const close = onClose ?? (() => router.back());
    const openPanel = (panel: "history") => {
        setActiveAction(null);
        setDetailPanel(panel);
    };
    const filesSection = (
        <ShipmentFilesSection
            files={shipmentFiles}
            loading={shipmentFilesLoading}
            error={shipmentFilesError}
            readOnly={readOnly}
            busy={isMutating || isPickingFile}
            onRetry={() => void loadShipmentFiles()}
            onOpen={(fileId) => void openShipmentFile(fileId)}
            onUpload={() => {
                resetShipmentFileForm();
                setActiveAction(null);
                setDetailPanel(null);
                setFileModalVisible(true);
            }}
        />
    );
    const openDeliveryStatuses = () => {
        if (readOnly || !shipment?.booking || isMutating) return;
        deliveryStatuses.current?.present({
            title: "Update delivery status",
            accessibilityLabel: "Available delivery statuses",
            stackBehavior: "push",
            actions: getAvailableStatuses(shipment.booking.status).map(status => ({
                id: status,
                label: formatStatus(status),
                selected: status === (activeAction === "status" ? statusValue : shipment.booking!.status),
                onPress: () => {
                    setStatusValue(status);
                    setActiveAction("status");
                },
            })),
        });
    };
    const openShipmentActions = () => {
        if (!shipment || isMutating) return;
        shipmentActions.current?.present({
            title: "Shipment options",
            showCloseButton: true,
            accessibilityLabel: "Shipment options",
            stackBehavior: "push",
            actions: [
                // Scan and proof actions remain temporarily hidden.
                ...(!readOnly && shipment.booking
                    ? [
                          {
                              id: "status",
                              label: "Update delivery status",
                              onPress: openDeliveryStatuses,
                          },
                      ]
                    : []),
                {
                    id: "history",
                    label: "Shipment history",
                    onPress: () => openPanel("history"),
                },
                ...(!readOnly && shipment.booking
                    ? [
                          {
                              id: "cancel-shipment",
                              label: "Cancel shipment",
                              variant: "destructive" as const,
                              onPress: () => setActiveAction("cancel"),
                          },
                      ]
                    : []),
            ],
        });
    };
    async function openLocation(url: string) {
        try {
            await Linking.openURL(url);
        } catch {
            setErrorMessage("Unable to open this location. Please try again.");
        }
    }

    const surfaceContent = (
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
                        accessibilityLabel="Shipment actions"
                        accessibilityHint="Opens shipment options"
                        accessibilityState={{ disabled: !shipment || isMutating }}
                        disabled={!shipment || isMutating}
                        onPress={openShipmentActions}
                        style={{
                            minHeight: 44,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: isDarkMode ? "#52525B" : "#E4E4E7",
                            backgroundColor: isDarkMode ? "#27272A" : "#F5F5F8",
                            flexDirection: "row",
                            gap: 6,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: !shipment || isMutating ? 0.5 : 1,
                        }}
                    >
                        <Text style={{ color: ink, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>Actions</Text>
                        <View style={{ transform: [{ rotate: "90deg" }] }}><ShipmentIcon name="chevron" /></View>
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
                        color="#15803d"
                        accessibilityLabel="Loading shipment"
                    />
                ) : null}
                {errorMessage ? (
                    <View
                        accessibilityRole="alert"
                        className="bg-warning rounded-xl p-4"
                    >
                        <Text className="text-warning-foreground">
                            {errorMessage}
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={loadShipment}
                            style={{ minHeight: 44, justifyContent: "center" }}
                        >
                            <Text className="text-warning-foreground font-semibold">
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
                        <ReceiptDivider isDarkMode={isDarkMode} />
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
                                            ? "#b45309"
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
                                paddingHorizontal: 16,
                                borderRadius: 16,
                                backgroundColor: card,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 12,
                                    alignItems: "center",
                                    paddingVertical: 16,
                                }}
                            >
                                <ShipmentIcon name="package" />
                                <View style={{ flex: 1, gap: 3 }}>
                                    <Text
                                        style={{
                                            color: ink,
                                            fontSize: 16,
                                            lineHeight: 22,
                                            fontWeight: "600",
                                        }}
                                    >
                                        Parcels
                                    </Text>
                                </View>
                            </View>
                            {(shipment.parcels || []).map((parcel, index) => (
                                <View
                                    key={parcel.parcel_id}
                                    style={{
                                        borderTopWidth: 1,
                                        borderTopColor: isDarkMode
                                            ? "#3F3F46"
                                            : "#E4E4E7",
                                        paddingVertical: 14,
                                        gap: 4,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: muted,
                                            fontSize: 11,
                                            lineHeight: 16,
                                            fontWeight: "600",
                                            letterSpacing: 0.6,
                                        }}
                                    >
                                        PARCEL {index + 1}
                                    </Text>
                                    <Text
                                        style={{
                                            color: ink,
                                            fontFamily:
                                                Platform.OS === "ios"
                                                    ? "Menlo"
                                                    : "monospace",
                                            fontSize: 14,
                                            lineHeight: 21,
                                            fontWeight: "600",
                                        }}
                                    >
                                        {parcel.parcel_code ||
                                            "No code available"}
                                    </Text>
                                    {!!parcel.contents_description && (
                                        <Text
                                            style={{
                                                color: muted,
                                                fontSize: 13,
                                                lineHeight: 19,
                                            }}
                                        >
                                            {parcel.contents_description}
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>
                        {filesSection}
                        <ReceiptDivider isDarkMode={isDarkMode} />
                        <ShipmentHistorySection shipment={shipment} />
                        {!readOnly && (
                            <DetailLink
                                icon="message"
                                title="Message dispatch"
                                subtitle="Ask for help with this shipment"
                                onPress={() => {
                                    if (presentation === "sheet") onClose?.();
                                    router.push({ pathname: "/(tabs)/messages", params: {
                                        draft_shipment_id: shipment.shipment_id,
                                        draft_shipment_label: shipment.merchant_order_ref || shipment.delivery_note_number || shipment.shipment_id,
                                        draft_shipment_request: Crypto.randomUUID(),
                                        draft_owner: session?.user.user_id,
                                    } });
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
                            } else openDeliveryStatuses();
                        }}
                        style={{
                            minHeight: 52,
                            padding: 14,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: readOnly ? surface : "#15803d",
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
                        (!readOnly && activeAction !== null))
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
                            activeAction === "status"
                                ? "Delivery status"
                                : activeAction === "pod"
                                  ? "Delivery proof"
                                  : activeAction === "cancel"
                                    ? "Cancel shipment"
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
                                    setFileTypeDropdownOpen(false);
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
                                className="text-warning-foreground"
                            >
                                {errorMessage}
                            </Text>
                        ) : null}
                        {shipment && !fileModalVisible && (
                            <>
                                {!readOnly && shipment.booking ? (
                                    <>
                                        {activeAction === "status" ? (
                                            <ActionCard
                                                title="Update delivery status"
                                                description="Choose the next shipment state available to this driver booking."
                                            >
                                                <Pressable accessibilityRole="button" accessibilityLabel={`Delivery status: ${formatStatus(statusValue)}. Choose a different status`} disabled={isMutating} onPress={openDeliveryStatuses} style={{ minHeight: 48, justifyContent: "center" }}>
                                                    <Text className="text-card-foreground font-semibold">{formatStatus(statusValue)}</Text>
                                                    <Text className="text-primary text-sm">Choose a different status</Text>
                                                </Pressable>
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
                                {detailPanel === "history" && !activeAction ? (
                                    <ShipmentHistorySection
                                        shipment={shipment}
                                    />
                                ) : null}
                            </>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </ShipmentPanel>
        </KeyboardAvoidingView>
    );
    return (
        <>
            {renderSurface(surfaceContent)}
            <BottomSheet
                modalRef={shipmentUploadSheet}
                title="Upload shipment file"
                scrollable
                plainScroll
                showHandle={false}
                dismissible={!isMutating && !isPickingFile}
                onDismiss={() => {
                    if (filePickerHandoff.current?.onDismiss()) return;
                    setFileModalVisible(false);
                    setFileTypeDropdownOpen(false);
                }}
            >
                {!readOnly && (
                    <>
                        <View className="bg-card mt-6 rounded-xl px-5 py-5">
                            <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                                File type
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="File type"
                                accessibilityValue={{
                                    text:
                                        selectedShipmentFileType?.name ||
                                        "Select a file type",
                                }}
                                accessibilityState={{
                                    expanded: fileTypeDropdownOpen,
                                    disabled:
                                        isMutating ||
                                        shipmentFilesLoading ||
                                        shipmentFileTypes.length === 0,
                                }}
                                disabled={
                                    isMutating ||
                                    shipmentFilesLoading ||
                                    shipmentFileTypes.length === 0
                                }
                                onPress={() =>
                                    setFileTypeDropdownOpen((open) => !open)
                                }
                                className="border-border bg-muted mt-4 flex-row items-center rounded-xl border px-4 py-3"
                                style={{ minHeight: 48, gap: 12 }}
                            >
                                <Text
                                    className={
                                        selectedShipmentFileType
                                            ? "text-card-foreground flex-1 text-base font-semibold"
                                            : "text-muted-foreground flex-1 text-base"
                                    }
                                >
                                    {selectedShipmentFileType?.name ||
                                        (shipmentFilesLoading
                                            ? "Loading file types…"
                                            : shipmentFileTypes.length
                                              ? "Select a file type"
                                              : "No file types available")}
                                </Text>
                                <View
                                    style={{
                                        transform: [
                                            {
                                                rotate: fileTypeDropdownOpen
                                                    ? "-90deg"
                                                    : "90deg",
                                            },
                                        ],
                                    }}
                                >
                                    <ShipmentIcon name="chevron" />
                                </View>
                            </Pressable>
                            {fileTypeDropdownOpen && (
                                <ScrollView
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                    className="border-border bg-muted mt-2 rounded-xl border"
                                    style={{ maxHeight: 220 }}
                                >
                                    {shipmentFileTypes.map((fileType) => {
                                        const selected =
                                            fileType.file_type_id ===
                                            selectedFileTypeId;
                                        return (
                                            <Pressable
                                                key={fileType.file_type_id}
                                                accessibilityRole="radio"
                                                accessibilityState={{
                                                    checked: selected,
                                                    disabled: isMutating,
                                                }}
                                                disabled={isMutating}
                                                onPress={() => {
                                                    setSelectedFileTypeId(
                                                        fileType.file_type_id,
                                                    );
                                                    setFileTypeDropdownOpen(
                                                        false,
                                                    );
                                                    setFileFormError(null);
                                                }}
                                                className={
                                                    selected
                                                        ? "bg-accent px-4 py-3"
                                                        : "px-4 py-3"
                                                }
                                                style={{ minHeight: 48 }}
                                            >
                                                <Text className="text-card-foreground text-base">
                                                    {fileType.name}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            )}
                            {!!selectedShipmentFileType?.description && (
                                <Text className="text-muted-foreground mt-3 text-sm leading-6">
                                    {selectedShipmentFileType.description}
                                </Text>
                            )}
                        </View>

                        <View className="bg-card mt-4 rounded-xl px-5 py-5">
                            <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">
                                Selected file
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                disabled={isPickingFile || isMutating}
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
                            <View className="border-warning bg-warning mt-4 rounded-[24px] border px-4 py-4">
                                <Text className="text-warning-foreground text-sm font-semibold">
                                    {fileFormError}
                                </Text>
                            </View>
                        ) : null}

                        <Pressable
                            disabled={
                                isMutating ||
                                isPickingFile ||
                                !selectedDocument ||
                                !selectedFileTypeId ||
                                (!!selectedShipmentFileType?.requires_expiry &&
                                    !fileExpiresAt.trim())
                            }
                            onPress={uploadShipmentFile}
                            className={`mt-6 items-center rounded-full px-6 py-4 bg-primary disabled:opacity-50`}
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
                )}
            </BottomSheet>
            <ActionSheet ref={shipmentFileSources} />
            <ActionSheet ref={shipmentActions} />
            <ActionSheet ref={deliveryStatuses} />
        </>
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
function ShipmentFilesSection({
    files,
    loading,
    error,
    readOnly,
    busy,
    onRetry,
    onOpen,
    onUpload,
}: {
    files: DriverEntityFile[];
    loading: boolean;
    error: string | null;
    readOnly: boolean;
    busy: boolean;
    onRetry: () => void;
    onOpen: (fileId: string) => void;
    onUpload: () => void;
}) {
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === "dark";
    const ink = dark ? "#FAFAFA" : "#111111";
    const muted = dark ? "#A1A1AA" : "#71717A";
    const uploadButton = (label: string) => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload shipment file"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onUpload}
            style={{
                minHeight: 44,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: "#15803D",
                opacity: busy ? 0.5 : 1,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                {label}
            </Text>
        </Pressable>
    );
    return (
        <View
            style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: dark ? "#25252B" : "#F5F5F8",
                gap: 16,
            }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <Text
                    accessibilityRole="header"
                    style={{
                        color: ink,
                        fontSize: 16,
                        lineHeight: 22,
                        fontWeight: "600",
                    }}
                >
                    Files
                </Text>
                {!readOnly && files.length > 0 && uploadButton("Upload")}
            </View>
            {loading ? (
                <View
                    accessibilityLiveRegion="polite"
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 12,
                    }}
                >
                    <ActivityIndicator color="#15803D" />
                    <Text style={{ color: muted, flex: 1 }}>
                        Loading files…
                    </Text>
                </View>
            ) : (
                <>
                    {error ? (
                        <View style={{ gap: 8 }}>
                            <Text
                                accessibilityRole="alert"
                                style={{ color: dark ? "#FBBF24" : "#B45309" }}
                            >
                                {error}
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                onPress={onRetry}
                                style={{
                                    minHeight: 44,
                                    justifyContent: "center",
                                    alignSelf: "flex-start",
                                    paddingHorizontal: 12,
                                }}
                            >
                                <Text className="text-primary font-semibold">
                                    Retry
                                </Text>
                            </Pressable>
                        </View>
                    ) : null}
                    {files.length > 0 ? (
                        files.map((file) => (
                            <Pressable
                                key={file.file_id}
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${file.original_name || "Unnamed file"}`}
                                onPress={() => onOpen(file.file_id)}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                    minHeight: 64,
                                    borderTopWidth: 1,
                                    borderTopColor: dark
                                        ? "#3F3F46"
                                        : "#E4E4E7",
                                    paddingTop: 14,
                                }}
                            >
                                <ShipmentIcon name="files" />
                                <View style={{ flex: 1, gap: 4 }}>
                                    <Text
                                        style={{
                                            color: ink,
                                            fontSize: 14,
                                            lineHeight: 20,
                                            fontWeight: "600",
                                        }}
                                    >
                                        {file.original_name || "Unnamed file"}
                                    </Text>
                                    <Text
                                        style={{
                                            color: muted,
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }}
                                    >
                                        {file.file_type?.name ||
                                            "Shipment file"}
                                    </Text>
                                    <Text
                                        style={{
                                            color: muted,
                                            fontSize: 12,
                                            lineHeight: 18,
                                        }}
                                    >
                                        {file.expires_at
                                            ? `Expires ${file.expires_at.slice(0, 10)}`
                                            : "No expiry"}
                                    </Text>
                                </View>
                                <ShipmentIcon name="chevron" />
                            </Pressable>
                        ))
                    ) : !error ? (
                        <View
                            style={{
                                alignItems: "center",
                                paddingVertical: 20,
                                gap: 12,
                            }}
                        >
                            <ShipmentIcon name="files" />
                            <Text
                                style={{
                                    color: muted,
                                    fontSize: 14,
                                    lineHeight: 20,
                                    textAlign: "center",
                                }}
                            >
                                No files uploaded yet
                            </Text>
                            {!readOnly && uploadButton("Upload a file")}
                        </View>
                    ) : null}
                </>
            )}
        </View>
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

function ReceiptDivider({ isDarkMode }: { isDarkMode: boolean }) {
    return (
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
                        backgroundColor: isDarkMode ? "#52525B" : "#C8C6BE",
                    }}
                />
            ))}
        </View>
    );
}

function hasDetailValue(value?: string | null) {
    return !!value?.trim() && value.trim().toLowerCase() !== "not available";
}

function formatShipmentDateTime(value?: string | null) {
    if (!hasDetailValue(value)) return null;
    const date = new Date(value!);
    if (!Number.isFinite(date.getTime())) return value;
    return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function ShipmentHistorySection({ shipment }: { shipment: DriverShipment }) {
    const { colorScheme } = useColorScheme();
    const hasTimeline = !!shipment.status_history?.length || [
        shipment.booking?.booked_at, shipment.booking?.collected_at,
        shipment.booking?.delivered_at, shipment.booking?.returned_at,
        shipment.booking?.cancelled_at,
        formatOdometerDisplay(shipment.booking?.odometer_at_collection),
        formatOdometerDisplay(shipment.booking?.odometer_at_delivery),
        formatOdometerDisplay(shipment.booking?.total_km_from_collection),
    ].some(hasDetailValue);
    const hasInfo = [shipment.service_type, shipment.priority, shipment.invoice_number,
        shipment.delivery_note_number, shipment.booking?.carrier_job_id, shipment.run_status,
        shipment.booking?.cancel_reason || shipment.booking?.cancellation_reason_code,
    ].some(hasDetailValue);
    const hasPod = [shipment.booking?.pod?.signed_by, shipment.booking?.pod?.file_type,
        shipment.booking?.pod?.created_at,
    ].some(hasDetailValue);
    if (!hasTimeline && !hasInfo && !hasPod) return null;
    return (
        <View
            style={{
                backgroundColor: colorScheme === "dark" ? "#25252B" : "#F5F5F8",
                borderRadius: 16,
                padding: 16,
            }}
        >
            {hasInfo && <View>
                <Text className="text-card-foreground text-lg font-semibold">
                    Shipment info
                </Text>
                <InfoRow label="Service type" value={shipment.service_type} />
                <InfoRow label="Priority" value={shipment.priority} />
                <InfoRow label="Invoice" value={shipment.invoice_number} />
                <InfoRow
                    label="Delivery note"
                    value={shipment.delivery_note_number}
                />
                <InfoRow
                    label="Carrier job"
                    value={shipment.booking?.carrier_job_id}
                />
                <InfoRow label="Run status" value={shipment.run_status} />
                <InfoRow
                    label="Cancellation reason"
                    value={
                        shipment.booking?.cancel_reason ||
                        shipment.booking?.cancellation_reason_code
                    }
                />
            </View>}

            {hasTimeline && <View className={hasInfo ? "border-border mt-5 border-t pt-5" : undefined}>
                {!shipment.status_history?.length && (
                    <Text className="text-muted-foreground">
                        No history recorded yet
                    </Text>
                )}
                {shipment.status_history?.map((event, index) => (
                    <View key={index} className={index === 0 ? undefined : "mt-4"}>
                        <Text className="text-card-foreground font-semibold">
                            {formatStatus(event.status)} ·{" "}
                            {event.source === "matched_visit"
                                ? "Matched recorded visit"
                                : event.source === "driver"
                                  ? "Driver update"
                                  : "Status update"}
                        </Text>
                        <Text className="text-muted-foreground">
                            {event.description}
                        </Text>
                        <Text className="text-muted-foreground">
                            {formatShipmentDateTime(event.occurred_at)}
                        </Text>
                    </View>
                ))}
                <InfoRow
                    label="Booked at"
                    value={formatShipmentDateTime(shipment.booking?.booked_at)}
                />
                <InfoRow
                    label="Collected at"
                    value={formatShipmentDateTime(shipment.booking?.collected_at)}
                />
                <InfoRow
                    label="Pickup odometer"
                    value={formatOdometerDisplay(
                        shipment.booking?.odometer_at_collection,
                    )}
                />
                <InfoRow
                    label="Delivered at"
                    value={formatShipmentDateTime(shipment.booking?.delivered_at)}
                />
                <InfoRow
                    label="Delivery odometer"
                    value={formatOdometerDisplay(
                        shipment.booking?.odometer_at_delivery,
                    )}
                />
                <InfoRow
                    label="Shipment km"
                    value={formatOdometerDisplay(
                        shipment.booking?.total_km_from_collection,
                    )}
                />
                <InfoRow
                    label="Returned at"
                    value={formatShipmentDateTime(shipment.booking?.returned_at)}
                />
                <InfoRow
                    label="Cancelled at"
                    value={formatShipmentDateTime(shipment.booking?.cancelled_at)}
                />
            </View>}

            {hasPod && <View className={hasInfo || hasTimeline ? "border-border mt-5 border-t pt-5" : undefined}>
                <Text className="text-card-foreground text-lg font-semibold">
                    Proof of delivery
                </Text>
                <InfoRow
                    label="Signed by"
                    value={shipment.booking?.pod?.signed_by}
                />
                <InfoRow
                    label="File type"
                    value={shipment.booking?.pod?.file_type}
                />
                <InfoRow
                    label="Captured at"
                    value={formatShipmentDateTime(shipment.booking?.pod?.created_at)}
                />
            </View>}
        </View>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    if (!hasDetailValue(value)) return null;
    return (
        <View className="mt-4 flex-row justify-between gap-4">
            <Text className="text-muted-foreground flex-1 text-sm uppercase tracking-[2px]">
                {label}
            </Text>
            <Text className="text-card-foreground flex-1 text-right text-base font-medium">
                {value}
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
