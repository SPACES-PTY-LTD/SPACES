import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { DeliveryNoteFilePreview } from "@/src/components/DeliveryNoteFilePreview";
import { unfinishedDocumentImport } from '@/src/lib/unfinished-document-import';
import { pollDocumentImport } from '@/src/lib/document-import-poll';
import { MessageSheet, type MessageSheetRef } from "@/component/ui/MessageSheet";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
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
            borderColor: "#15803d",
            backgroundColor: dark ? "#142e20" : "#f0fdf4",
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
    async function previewPdf(url: string) {
        const handoff = handoffRef.current;
        if (!handoff?.active || handoff.running) return;
        try {
            // Wait for the sheet portal and iOS FullWindowOverlay to detach.
            await handoff.run(async () => {
                await WebBrowser.openBrowserAsync(url, { showTitle: true });
            });
        } catch {
            if (handoff.active) setError("Could not open the PDF. Please try again.");
        }
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
    const [analysisFailed, setAnalysisFailed] = useState(false);
    const [pendingImport, setPendingImport] = useState<{ id: string; filename: string } | null>(null);
    const polling = useRef<AbortController | null>(null);
    const pendingStorageKey = session ? `delivery-note-processing:${session.user.user_id}` : null;
    const [startNew, setStartNew] = useState(false);
    const [recoveryReady, setRecoveryReady] = useState(false);
    const loadVersion = useRef(0);
    const unfinished = !resumeImportId && !startNew && !file && !analysisFailed && recoveryReady
        ? unfinishedDocumentImport(context?.recent_imports ?? [], pendingImport)
        : null;
    function cancelLoad() { loadVersion.current++; polling.current?.abort(); }
    async function clearPending() {
        setPendingImport(null);
        if (pendingStorageKey) await AsyncStorage.removeItem(pendingStorageKey).catch(() => { /* Do not block completed analysis on local storage failure. */ });
    }
    async function checkProcessing(pending: { id: string; filename: string }, controller: AbortController) {
        if (!session || !handoffRef.current?.active || controller.signal.aborted) return;
        const result = await pollDocumentImport(
            (signal) => documentImportApi.show(session.token, pending.id, signal),
            controller.signal,
            () => setUploaded(true),
        );
        if (controller.signal.aborted || !handoffRef.current?.active) return;
        await clearPending();
        if (result.status === 'failed') {
            setAnalysisFailed(true);
            setFile(undefined);
            throw new Error(result.failure_message?.trim() || 'Document analysis failed.');
        }
        openReview(result.import_id);
    }

    const inFlight = useRef(false);
    const [error, setError] = useState("");
    async function load() {
        if (!session) return;
        const version = ++loadVersion.current;
        try {
            const [result, stored] = await Promise.all([
                documentImportApi.context(session.token),
                pendingStorageKey ? AsyncStorage.getItem(pendingStorageKey).catch(() => null) : Promise.resolve(null),
            ]);
            if (version !== loadVersion.current || !handoffRef.current?.active || inFlight.current) return;
            let restored: { id: string; filename: string } | null = null;
            try {
                const saved = stored ? JSON.parse(stored) : null;
                if (typeof saved?.id === 'string' && typeof saved?.filename === 'string') restored = saved;
            } catch { /* Ignore invalid local references. */ }
            const known = result.recent_imports.find(item => item.import_id === restored?.id);
            setPendingImport(known ? null : restored);
            setContext(result);
            setRecoveryReady(true);
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
            if (version !== loadVersion.current || !handoffRef.current?.active) return;
            setError((e as Error).message);
        }
    }
    useEffect(() => {
        setContext(undefined);
        setPendingImport(null);
        setRecoveryReady(false);
        setStartNew(false);
        void load(); /* Reload for a different account or dashboard run. */
        return cancelLoad;
    }, [session?.token, requestedRun]); // eslint-disable-line react-hooks/exhaustive-deps
    function continueUnfinished() {
        if (!unfinished || busy || inFlight.current) return;
        if (unfinished.needsStatusCheck) void analyze();
        else openReview(unfinished.id);
    }
    async function startNewUpload() {
        setStartNew(true);
        await chooseDocument();
    }
    async function pick(): Promise<DocumentPicker.DocumentPickerAsset | undefined> {
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
                return result.assets[0];
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
    async function pickImage(camera: boolean): Promise<DocumentPicker.DocumentPickerAsset | undefined> {
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
            return selected;
        } catch {
            if (handoffRef.current?.active) setError("Unable to open this source. Try File or another source.");
        }
    }
    async function chooseDocument() {
        if (!session || busy || inFlight.current) return;
        const handoff = handoffRef.current;
        if (!handoff?.active || handoff.running) return;
        let selected: DocumentPicker.DocumentPickerAsset | undefined;
        try {
            await handoff.run(async () => {
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
                if (source === "file") selected = await pick();
                else if (source === "photo" || source === "camera") selected = await pickImage(source === "camera");
                if (selected && handoff.active) {
                    setStartNew(true);
                    setAnalysisFailed(false);
                    setFile(selected);
                    setError("");
                    setUploaded(false);
                    // Restore the sheet directly into Step 2, without flashing file confirmation.
                    setBusy(true);
                }
            });
            if (selected && handoff.active) { await clearPending(); await analyze(selected, true); }
        } catch {
            if (handoff.active) setError("Unable to open this source. Please try again.");
        }
    }
    async function analyze(selected = file, replacement = false) {
        if ((!selected && !pendingImport) || !session || inFlight.current || handoffRef.current?.running) return;
        inFlight.current = true;
        const controller = new AbortController();
        polling.current = controller;
        setStartNew(false);
        setUploaded(false);
        setBusy(true);
        setError("");
        try {
            if (pendingImport && !replacement) {
                setUploaded(true);
                await checkProcessing(pendingImport, controller);
                return;
            }
            if (!selected) return;
            let uploadRun = run;
            if (!context) {
                const available = await documentImportApi.context(session.token);
                if (controller.signal.aborted || !handoffRef.current?.active) return;
                setContext(available);
                uploadRun = requestedRun
                    ? available.runs.find(item => item.run_id === requestedRun)?.run_id || null
                    : available.runs.length === 1 ? available.runs[0].run_id : null;
                setRun(uploadRun);
            }
            const body = new FormData();
            body.append("file", {
                uri: selected.uri,
                name: selected.name,
                type: selected.mimeType || "application/pdf",
            } as unknown as Blob);
            if (uploadRun) body.append("run_id", uploadRun);
            const pending = { id: Crypto.randomUUID(), filename: selected.name };
            body.append('async', '1');
            body.append('import_id', pending.id);
            // Persist before sending so a lost 202/504 can be recovered by the same UUID.
            if (pendingStorageKey) await AsyncStorage.setItem(pendingStorageKey, JSON.stringify(pending));
            if (controller.signal.aborted || !handoffRef.current?.active) return;
            setPendingImport(pending);
            try {
                await documentImportApi.upload(session.token, body, () => { if (!controller.signal.aborted && handoffRef.current?.active) setUploaded(true); });
                if (controller.signal.aborted) return;
                setUploaded(true);
            } catch (error) {
                if (controller.signal.aborted) return;
                const status = (error as { status?: number }).status;
                if (status && status >= 400 && status < 500 && ![408, 429].includes(status)) {
                    await clearPending();
                    throw error;
                }
                // Upload may have been accepted even when the acknowledgement was lost.
            }
            await checkProcessing(pending, controller);
        } catch (e) {
            if (!handoffRef.current?.active || controller.signal.aborted) return;
            setError(
                (e as Error).message ||
                    "Could not read this document. Please try again.",
            );
        } finally {
            if (!reviewDestination.current && handoffRef.current?.active && polling.current === controller) {
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
                showCloseButton={!busy}
                showHandle={!busy}
                headerBottomSpacing={busy ? 16 : 4}
                onDismiss={dismissUpload}
            >
                {busy ? (
                    <>
                        <DeliveryNoteProgress uploaded={uploaded} />
                    </>
                ) : (
                    <>
                        <ImportStepIndicator step={1} />
                        {unfinished ? (
                            <View style={s.card}>
                                <Text style={s.heading}>Continue your last upload?</Text>
                                <Text style={s.body}>We noticed that you didn’t finish processing your last upload. Would you like to continue with it?</Text>
                                <DeliveryNoteFilePreview key={`${session?.user.user_id}:${unfinished.id}`} importId={unfinished.id} filename={unfinished.filename} token={session!.token} openBrowser={previewPdf} />
                                <ImportButton label="Yes, continue" onPress={continueUnfinished} />
                                <ImportButton secondary label="No, let’s start a new upload" onPress={() => void startNewUpload()} />
                            </View>
                        ) : (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={analysisFailed ? "Upload another file" : file || (!startNew && pendingImport) ? "Change document" : "Choose document"}
                            accessibilityHint="Opens photo, file and camera options"
                            accessibilityState={{ disabled: busy || !recoveryReady }}
                            onPress={chooseDocument}
                            disabled={busy || !recoveryReady}
                            style={{
                                alignItems: "center",
                                padding: 20,
                                gap: 12,
                                borderWidth: 1.5,
                                borderStyle: "dashed",
                                borderColor: dark ? "#52525b" : "#cfcfd6",
                                borderRadius: 12,
                                backgroundColor: dark ? "#18181b" : "#ffffff",
                            }}
                        >
                            <Feather name="upload-cloud" size={32} color={dark ? "#fde68a" : "#15803d"} />
                            <Text style={[s.heading, { fontSize: 21, textAlign: "center", alignSelf: "stretch" }]}>
                                {file?.name || (!startNew ? pendingImport?.filename : null) || "Upload a delivery note"}
                            </Text>
                            <Text style={[s.note, { fontSize: 12, lineHeight: 16, textAlign: "center", alignSelf: "stretch" }]}>
                                PDF, JPG, PNG or WebP · up to 20 MB
                            </Text>
                            <View
                                pointerEvents="none"
                                style={{
                                    alignSelf: "stretch",
                                    minHeight: 48,
                                    padding: 14,
                                    borderRadius: 12,
                                    backgroundColor: "#15803d",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 16, fontWeight: "600", color: "#ffffff", textAlign: "center" }}>
                                    {analysisFailed ? "Upload another file" : file || (!startNew && pendingImport) ? "Change document" : "Choose document"}
                                </Text>
                            </View>
                        </Pressable>
                        )}
                        {!!pendingImport && !startNew && !unfinished && !error && <Text style={s.note}>Your document is saved for processing. Check its status to continue without uploading again.</Text>}
                        {!!error && (
                            <Text accessibilityRole="alert" style={s.error}>
                                {error}{analysisFailed ? "\n\nPlease upload another file to continue." : ""}
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
                        {!unfinished && !analysisFailed && (file || (!startNew && pendingImport)) ? (
                            <ImportButton
                                label={pendingImport ? "Check processing status" : "Retry reading document"}
                                disabled={busy}
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
