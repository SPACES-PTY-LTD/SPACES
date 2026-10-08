import { MessageSheet, type MessageSheetRef } from "@/component/ui/MessageSheet";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { documentImportApi, ImportContext } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";
import {
    ImportButton,
    importStyles,
} from "@/src/components/document-import-ui";
import { Text } from "@/component/ui/Text";
import { ImportStepIndicator } from "@/src/components/ImportStepIndicator";
import { DeliveryNoteProgress } from "@/src/components/delivery-note-progress";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomSheet } from "@/component/ui/BottomSheet";
import { ActionSheet, ActionSheetRef } from "@/component/ui/ActionSheet";
import { createSheetHandoff } from "@/component/ui/sheet-handoff";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function LoadShipment() {
    const router = useRouter();
    const modalRef = useRef<BottomSheetModal>(null);
    const messageSheet = useRef<MessageSheetRef>(null);
    const actionsRef = useRef<ActionSheetRef>(null);
    const handoffRef = useRef<ReturnType<typeof createSheetHandoff> | null>(null);
    useEffect(() => {
        const handoff = createSheetHandoff(
            () => modalRef.current?.dismiss(),
            () => modalRef.current?.present(),
        );
        handoffRef.current = handoff;
        return () => { handoff.dispose(); handoffRef.current = null; };
    }, []);
    const reviewDestination = useRef<string | null>(null);
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === "dark";
    const s = {
        ...importStyles,
        body: [importStyles.body, { color: dark ? "#fafafa" : "#111" }],
        heading: [importStyles.heading, { color: dark ? "#fafafa" : "#111" }],
        subtitle: [
            importStyles.subtitle,
            { color: dark ? "#a1a1aa" : "#606067" },
        ],
        note: [importStyles.note, { color: dark ? "#a1a1aa" : "#666" }],
        card: [
            importStyles.card,
            { backgroundColor: dark ? "#27272a" : "#f5f5f5" },
        ],
        selected: {
            borderColor: "#f54a4a",
            backgroundColor: dark ? "#401e22" : "#fff0f0",
        },
    };
    useEffect(() => {
        const frame = requestAnimationFrame(() => modalRef.current?.present());
        return () => cancelAnimationFrame(frame);
    }, []);
    function openReview(id: string) {
        reviewDestination.current = id;
        modalRef.current?.dismiss();
    }
    function dismissUpload() {
        if (handoffRef.current?.onDismiss()) return;
        if (reviewDestination.current)
            router.replace(`/shipments/imports/${reviewDestination.current}`);
        else if (resumeImportId) router.replace(`/shipments/imports/${resumeImportId}`);
        else if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
    }
    const { run_id: requestedRun, resume_import_id: resumeImportId } = useLocalSearchParams<{
        run_id?: string;
        resume_import_id?: string;
    }>();
    const { session } = useAuth();
    const [context, setContext] = useState<ImportContext>();
    const [run, setRun] = useState<string | null>(null);
    const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset>();
    const [busy, setBusy] = useState(false);
    const [uploaded, setUploaded] = useState(false);
    const inFlight = useRef(false);
    const [error, setError] = useState("");
    async function load() {
        if (!session) return;
        try {
            const result = await documentImportApi.context(session.token);
            setContext(result);
            const matchingRun = result.runs.find(
                (item) => item.run_id === requestedRun,
            );
            setRun(
                requestedRun
                    ? matchingRun?.run_id || null
                    : result.runs.length === 1
                      ? result.runs[0].run_id
                      : null,
            );
            setError(
                requestedRun && !matchingRun
                    ? "That run is no longer available. Choose an eligible run or create a new run in the final step."
                    : "",
            );
        } catch (e) {
            setError((e as Error).message);
        }
    }
    useEffect(() => {
        void load(); /* Reload for a different account or dashboard run. */
    }, [session?.token, requestedRun]); // eslint-disable-line react-hooks/exhaustive-deps
    async function pick() {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    "application/pdf",
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                ],
                copyToCacheDirectory: true,
            });
            if (handoffRef.current?.active && !result.canceled) {
                if ((result.assets[0].size || 0) > 20 * 1024 * 1024) {
                    setError("Choose a document smaller than 20 MB.");
                    return;
                }
                setFile(result.assets[0]);
                setError("");
            }
        } catch {
            if (handoffRef.current?.active) setError("Unable to open your documents. Please try again.");
        }
    }
    // Resolve only after the message overlay is removed, including swipe/backdrop.
    function showPickerMessage(title: string, message: string, choices: string[]) {
        return new Promise<string | undefined>(resolve => {
            if (!handoffRef.current?.active || !messageSheet.current) return resolve(undefined);
            messageSheet.current.present(title, message, choices.map(text => ({ text })), resolve);
        });
    }
    async function pickImage(camera: boolean): Promise<void> {
        try {
            // The system photo picker grants access to the chosen asset only;
            // this Expo SDK requires a permission request for camera capture.
            const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : null;
            if (!handoffRef.current?.active) return;
            if (permission && !permission.granted) {
                const choice = await showPickerMessage(
                    "Permission needed",
                    `Allow ${camera ? "camera" : "photo"} access in Settings, or choose File.`,
                    ["Cancel", "Open Settings"],
                );
                if (choice === "Open Settings" && handoffRef.current?.active) await Linking.openSettings();
                return;
            }
            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ["images"], quality: 0.9, allowsEditing: false,
            };
            const result = camera
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (!handoffRef.current?.active || result.canceled) return;
            const asset = result.assets[0];
            const mime = asset.mimeType || "image/jpeg";
            if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
                setError("Choose a JPG, PNG or WebP image.");
                return;
            }
            if ((asset.fileSize || 0) > 20 * 1024 * 1024) {
                setError("Choose a document smaller than 20 MB.");
                return;
            }
            const selected = {
                lastModified: Date.now(), uri: asset.uri,
                name: asset.fileName || `delivery-note.${mime.split("/")[1]}`,
                mimeType: mime, size: asset.fileSize,
            };
            if (camera) {
                const choice = await showPickerMessage(
                    "Use this delivery note photo?",
                    "You can retake it if the document is not clear.",
                    ["Retake", "Use photo"],
                );
                if (!handoffRef.current?.active) return;
                if (choice === "Retake") return await pickImage(true);
                if (choice !== "Use photo") return;
            }
            setFile(selected);
            setError("");
        } catch {
            if (handoffRef.current?.active) setError("Unable to open this source. Try File or another source.");
        }
    }
    function chooseDocument() {
        if (busy || inFlight.current) return;
        void handoffRef.current?.run(async () => {
            const source = await new Promise<string | undefined>(resolve => {
                if (!actionsRef.current) return resolve(undefined);
                actionsRef.current.present({
                    title: "Choose document",
                    actions: [
                        { id: "photo", label: "Photo", onPress: () => {} },
                        { id: "file", label: "File", onPress: () => {} },
                        { id: "camera", label: "Camera", onPress: () => {} },
                    ],
                    onDismiss: resolve,
                });
            });
            if (!handoffRef.current?.active) return;
            if (source === "file") await pick();
            else if (source === "photo" || source === "camera") await pickImage(source === "camera");
        }).catch(() => {
            if (handoffRef.current?.active) setError("Unable to open this source. Please try again.");
        });
    }
    async function analyze() {
        if (!file || !session || inFlight.current || handoffRef.current?.running) return;
        inFlight.current = true;
        setUploaded(false);
        setBusy(true);
        setError("");
        try {
            const body = new FormData();
            body.append("file", {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || "application/pdf",
            } as unknown as Blob);
            if (run) body.append("run_id", run);
            const result = await documentImportApi.upload(
                session.token,
                body,
                () => setUploaded(true),
            );
            openReview(result.import_id);
        } catch (e) {
            setError(
                (e as Error).message ||
                    "Could not read this document. Please try again.",
            );
        } finally {
            if (!reviewDestination.current) {
                inFlight.current = false;
                setBusy(false);
            }
        }
    }
    return (
        <>
            <BottomSheet
                modalRef={modalRef}
                title={
                    busy
                        ? "Reading your delivery note"
                        : "Upload a delivery note"
                }
                scrollable
                dismissible={!busy}
                onDismiss={dismissUpload}
            >
                {busy ? (
                    <>
                        <DeliveryNoteProgress uploaded={uploaded} />
                    </>
                ) : (
                    <>
                        <ImportStepIndicator step={1} />
                        <Text style={s.subtitle}>
                            Upload a delivery note or manifest. AI will extract
                            the details for you to review before any shipments
                            are created.
                        </Text>
                        <View style={s.card}>
                            <Feather
                                name="upload-cloud"
                                size={36}
                                color="#f54a4a"
                            />
                            <Text style={s.heading}>
                                {file?.name || "Choose a document"}
                            </Text>
                            <Text style={s.subtitle}>
                                PDF, JPG, PNG or WebP · up to 20 MB
                            </Text>
                            <ImportButton
                                label={
                                    file ? "Change document" : "Choose document"
                                }
                                onPress={chooseDocument}
                                disabled={busy}
                                secondary
                            />
                        </View>
                        {!!error && (
                            <Text accessibilityRole="alert" style={s.error}>
                                {error}
                            </Text>
                        )}
                        {!!resumeImportId && <ImportButton secondary label="Return to existing draft" onPress={() => openReview(resumeImportId)} />}
                        {!context && (
                            <ImportButton
                                secondary
                                label="Retry loading"
                                onPress={() => void load()}
                            />
                        )}
                        {file ? (
                            <ImportButton
                                label="Continue"
                                disabled={!context || busy}
                                onPress={() => void analyze()}
                            />
                        ) : null}
                    </>
                )}
            </BottomSheet>
            <MessageSheet ref={messageSheet} />
            <ActionSheet ref={actionsRef} />
        </>
    );
}
