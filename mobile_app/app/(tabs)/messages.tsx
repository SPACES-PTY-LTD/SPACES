import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import { ChatReferenceSheet } from '@/src/components/ChatReferenceSheet';
import { ShipmentDetailsSheet } from '@/src/components/shipments/ShipmentDetails';
import { RunDetailsSheet } from '@/src/components/runs/RunDetailsSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    FlatList,
    KeyboardAvoidingView,
    Keyboard,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/component/ui/Text';
import { PageHeader } from '@/component/ui/PageHeader';
import {
    appendUploadFile,
    chatApi,
    ChatConversation,
    ChatMessage,
    ChatReference,
} from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';
import { useUnreadMessages } from '@/src/providers/unread-messages-provider';
import { setVisibleDriverChat } from '@/src/providers/message-notifications';

function isDraftPicture(file: DocumentPicker.DocumentPickerAsset) {
    const mime = file.mimeType?.toLowerCase();
    if (mime?.startsWith('image/')) return true;
    if (mime && mime !== 'application/octet-stream') return false;
    return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(file.name);
}

export default function MessagesScreen() {
    const { session } = useAuth();
    const { conversation_id, draft_shipment_id, draft_shipment_label, draft_shipment_request, draft_owner } = useLocalSearchParams<{
        conversation_id?: string | string[]; draft_shipment_id?: string | string[];
        draft_shipment_label?: string | string[]; draft_shipment_request?: string | string[]; draft_owner?: string | string[];
    }>();
    const requestedConversation = typeof conversation_id === 'string' ? conversation_id : undefined;
    const shipment = typeof draft_shipment_id === 'string' && typeof draft_shipment_request === 'string' && draft_owner === session?.user.user_id
        ? { id: draft_shipment_id, type: 'shipment' as const, label: typeof draft_shipment_label === 'string' ? draft_shipment_label : draft_shipment_id, subtitle: '' } : undefined;
    return <DriverChat key={`${session?.user.user_id ?? 'signed-out'}:${requestedConversation ?? 'default'}`} requestedConversation={requestedConversation} draftShipment={shipment} draftRequest={typeof draft_shipment_request === 'string' ? draft_shipment_request : undefined} />;
}

function DriverChat({ requestedConversation, draftShipment, draftRequest }: { requestedConversation?: string; draftShipment?: ChatReference; draftRequest?: string }) {
    const { refresh: refreshUnread } = useUnreadMessages();
    const { session } = useAuth();
    const token = session?.token;
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const dark = colorScheme === 'dark';
    const colors = {
        background: dark ? '#111111' : '#FFFFFF',
        ink: dark ? '#FAFAFA' : '#111111',
        muted: dark ? '#A1A1AA' : '#71717A',
        line: dark ? '#303036' : '#ECECF0',
        soft: dark ? '#24242B' : '#F5F5F8',
        shelf: dark ? '#19191E' : '#FAFAFC',
        selectedSurface: dark ? '#142e20' : '#f0fdf4',
    };
    const [conversation, setConversation] = useState<ChatConversation | null>(
        null,
    );
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [before, setBefore] = useState<string | null>(null);
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>(
        [],
    );
    const attachmentActions = useRef<ActionSheetRef>(null);
    const [referenceType, setReferenceType] = useState<ChatReference['type'] | null>(null);
    const [references, setReferences] = useState<ChatReference[]>([]);
    const [detailReference, setDetailReference] = useState<ChatReference | null>(null);
    const referenceModal = useRef<BottomSheetModal>(null);
    const openReference = (reference: ChatReference) => {
        Keyboard.dismiss();
        focusShipment.current = null;
        setDetailReference(reference);
    };
    const [picking, setPicking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [sending, setSending] = useState(false);
    const [olderLoading, setOlderLoading] = useState(false);
    const generation = useRef(0);
    const retry = useRef<string | null>(null);
    const conversationRef = useRef<ChatConversation | null>(null);
    const list = useRef<FlatList<ChatMessage>>(null);
    const active = useRef(false);
    const cursorLoaded = useRef(false);
    const atBottom = useRef(true);
    const [reload, setReload] = useState(0);
    const [failedSend, setFailedSend] = useState(false);
    const consumedShipment = useRef<string | null>(null);
    const composer = useRef<TextInput>(null);
    const focusShipment = useRef<string | null>(null);

    useFocusEffect(useCallback(() => {
        if (!draftShipment || !draftRequest || !conversation || sending || consumedShipment.current === draftRequest) return;
        consumedShipment.current = draftRequest;
        if (conversation.status !== 'active') setError('This conversation is closed. The shipment could not be attached.');
        else if (!references.some(item => item.type === 'shipment' && item.id === draftShipment.id)) {
            if (files.length + references.length >= 5) setError('Choose up to five attachments. Remove one, then open Message dispatch again.');
            else { focusShipment.current = draftShipment.id; setReferences(previous => [...previous, draftShipment]); retry.current = null; }
        }
        router.setParams({ draft_shipment_id: undefined, draft_shipment_label: undefined, draft_shipment_request: undefined, draft_owner: undefined });
    }, [draftShipment, draftRequest, conversation, sending, references, files.length]));

    useFocusEffect(useCallback(() => {
        if (!hasLoaded || sending || picking || conversation?.status !== 'active' ||
            !references.some(item => item.type === 'shipment' && item.id === focusShipment.current)) return;
        const frame = requestAnimationFrame(() => {
            if (!active.current || !focusShipment.current) return;
            composer.current?.focus();
            focusShipment.current = null;
        });
        return () => cancelAnimationFrame(frame);
    }, [hasLoaded, sending, picking, conversation?.status, references]));

    useFocusEffect(
        useCallback(() => {
            const current = ++generation.current;
            const reloadVersion = reload; // Re-enter the focused loader on explicit Retry.
            void reloadVersion;
            let busy = false;
            active.current = true;
            setError(null);
            const valid = () =>
                generation.current === current &&
                active.current &&
                AppState.currentState === 'active';
            async function refresh() {
                if (!token || !valid() || busy) return;
                busy = true;
                setLoading(true);
                try {
                    const chat = conversationRef.current
                        ? await chatApi.show(
                              token,
                              conversationRef.current.conversation_id,
                          )
                        : requestedConversation
                          ? await chatApi.show(token, requestedConversation)
                          : await chatApi.openDriver(token);
                    if (chat.type !== 'driver') throw new Error('This notification does not link to a driver conversation.');
                    if (!valid()) return;
                    conversationRef.current = chat;
                    setConversation(chat);
                    setVisibleDriverChat(chat.conversation_id);
                    const result = await chatApi.messages(
                        token,
                        chat.conversation_id,
                    );
                    if (!valid()) return;
                    setMessages((previous) =>
                        [
                            ...new Map(
                                [...previous, ...result.data].map((m) => [
                                    m.message_id,
                                    m,
                                ]),
                            ).values(),
                        ].sort((a, b) =>
                            a.created_at.localeCompare(b.created_at),
                        ),
                    );
                    if (!cursorLoaded.current) {
                        setBefore(result.meta.next_before);
                        cursorLoaded.current = true;
                    }
                    setHasLoaded(true);
                    setError(null);
                    const latest = result.data.at(-1);
                    if (latest) {
                        await chatApi.read(
                            token,
                            chat.conversation_id,
                            latest.message_id,
                        );
                        if (valid()) void refreshUnread();
                    }
                } catch (e) {
                    if (valid())
                        setError(
                            e instanceof Error
                                ? e.message
                                : 'Unable to load messages.',
                        );
                } finally {
                    busy = false;
                    if (valid()) setLoading(false);
                }
            }
            void refresh();
            const interval = setInterval(() => void refresh(), 10000);
            const state = AppState.addEventListener('change', (state) => {
                setVisibleDriverChat(
                    state === 'active'
                        ? (conversationRef.current?.conversation_id ?? null)
                        : null,
                );
                if (state === 'active') void refresh();
            });
            return () => {
                active.current = false;
                generation.current++;
                clearInterval(interval);
                state.remove();
                setVisibleDriverChat(null);
            };
        }, [token, reload, refreshUnread, requestedConversation]),
    );

    useEffect(() => {
        if (atBottom.current && !loading)
            setTimeout(
                () => list.current?.scrollToEnd({ animated: false }),
                100,
            );
    }, [messages, loading]);

    async function older() {
        if (!session || !conversation || !before || olderLoading) return;
        const current = generation.current;
        atBottom.current = false;
        setOlderLoading(true);
        try {
            const result = await chatApi.messages(
                session.token,
                conversation.conversation_id,
                before,
            );
            if (current !== generation.current) return;
            setMessages((previous) => [
                ...new Map(
                    [...result.data, ...previous].map((m) => [m.message_id, m]),
                ).values(),
            ]);
            setBefore(result.meta.next_before);
        } catch (e) {
            if (current === generation.current)
                setError(
                    e instanceof Error
                        ? e.message
                        : 'Unable to load older messages.',
                );
        } finally {
            if (current === generation.current) setOlderLoading(false);
        }
    }
    function addFiles(assets: DocumentPicker.DocumentPickerAsset[]) {
        const next = [...files, ...assets];
        if (next.length + references.length > 5 || next.some(f => (f.size ?? 0) > 20 * 1024 * 1024)) {
            setError('Choose up to five attachments, each file no larger than 20 MB.');
            return;
        }
        setFiles(next);
        retry.current = null;
    }
    async function pick(source: 'file' | 'photo' | 'camera') {
        const current = generation.current;
        setPicking(true);
        try {
            if (source === 'file') {
                const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
                if (!result.canceled && current === generation.current) addFiles(result.assets);
                return;
            }
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (current !== generation.current) return;
            if (!permission.granted) {
                setError(`Allow ${source === 'camera' ? 'camera' : 'photo library'} access in Settings to add an attachment.`);
                return;
            }
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, 5 - files.length - references.length), quality: 0.85 });
            if (!result.canceled && current === generation.current) addFiles(result.assets.map(asset => ({
                uri: asset.uri, name: asset.fileName || `photo-${Crypto.randomUUID()}.jpg`, lastModified: Date.now(), mimeType: asset.mimeType || 'image/jpeg', size: asset.fileSize,
            })));
        } catch (e) {
            if (current === generation.current) setError(e instanceof Error ? e.message : 'Unable to select attachment.');
        } finally { setPicking(false); }
    }
    function attach() {
        Keyboard.dismiss();
        attachmentActions.current?.present({
            title: 'Attach',
            actions: [
                { id: 'file', label: 'File', onPress: () => pick('file') },
                { id: 'photo', label: 'Photo', onPress: () => pick('photo') },
                { id: 'camera', label: 'Camera', onPress: () => pick('camera') },
                { id: 'run', label: 'Run', onPress: () => setReferenceType('run') },
                { id: 'shipment', label: 'Shipment', onPress: () => setReferenceType('shipment') },
            ],
        });
    }
    async function send() {
        if (
            !session ||
            !conversation ||
            sending || picking ||
            (!body.trim() && !files.length && !references.length)
        )
            return;
        const current = generation.current;
        atBottom.current = true;
        setSending(true);
        setError(null);
        retry.current ??= Crypto.randomUUID();
        try {
            const form = new FormData();
            form.append('body', body);
            form.append('temporary_id', retry.current);
            references.forEach((reference, index) => {
                form.append(`references[${index}][type]`, reference.type);
                form.append(`references[${index}][id]`, reference.id);
            });
            for (const file of files)
                await appendUploadFile(
                    form,
                    { uri: file.uri, name: file.name, type: file.mimeType },
                    'attachments[]',
                );
            const message = await chatApi.send(
                session.token,
                conversation.conversation_id,
                form,
            );
            if (current !== generation.current) return;
            setMessages((previous) => [
                ...previous.filter((m) => m.message_id !== message.message_id),
                message,
            ]);
            setBody('');
            setFiles([]);
            setReferences([]);
            retry.current = null;
            setFailedSend(false);
            setTimeout(
                () => list.current?.scrollToEnd({ animated: true }),
                100,
            );
        } catch (e) {
            if (current === generation.current) {
                setFailedSend(true);
                setError(
                    e instanceof Error
                        ? e.message
                        : 'Unable to send. Retry your draft.',
                );
            }
        } finally {
            setSending(false);
        }
    }
    async function download(id: string) {
        if (!session || !conversation) return;
        try {
            const result = await chatApi.download(
                session.token,
                conversation.conversation_id,
                id,
            );
            await Linking.openURL(result.url);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Unable to open attachment.',
            );
        }
    }
    const initialLoading = loading && !hasLoaded && messages.length === 0;
    const canCompose = hasLoaded && !sending && !picking && conversation?.status === 'active';
    const canSend = canCompose && (!!body.trim() || files.length > 0 || references.length > 0);
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}
        >
            <PageHeader title="Messages" status={conversation?.status === 'closed' ? 'Closed' : undefined}
                action={loading && !initialLoading ? <ActivityIndicator size="small" color="#15803D" accessibilityLabel="Refreshing messages" /> : undefined} />
            {error && (
                <View style={[styles.error, { backgroundColor: colors.selectedSurface }]}>
                    <Text accessibilityRole="alert" style={{ color: colors.ink }}>{error}</Text>
                    <Pressable accessibilityRole="button" style={styles.retry} onPress={() => setReload((n) => n + 1)}>
                        <Text className="text-primary">Retry loading</Text>
                    </Pressable>
                </View>
            )}
            {initialLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator color="#15803d" />
                    <Text style={[styles.subtitle, { color: colors.muted }]}>Loading your conversation…</Text>
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    ref={list}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScroll={(event) => {
                        const {
                            contentOffset,
                            contentSize,
                            layoutMeasurement,
                        } = event.nativeEvent;
                        atBottom.current =
                            contentSize.height -
                                contentOffset.y -
                                layoutMeasurement.height <
                            60;
                    }}
                    scrollEventThrottle={100}
                    data={messages}
                    keyExtractor={(m) => m.message_id}
                    contentContainerStyle={{ padding: 20, paddingTop: messages.length ? 20 : 0, flexGrow: 1 }}
                    ListHeaderComponent={
                        before ? (
                            <Pressable
                                disabled={olderLoading}
                                onPress={older}
                                className="mb-4"
                            >
                                <Text className="text-primary text-center">
                                    {olderLoading
                                        ? 'Loading…'
                                        : 'Load older messages'}
                                </Text>
                            </Pressable>
                        ) : null
                    }
                    ListEmptyComponent={conversation ? (
                        <View style={styles.empty}>
                            <View style={styles.emptyMessage}>
                                <View style={[styles.emptyIcon, { backgroundColor: colors.soft }]}>
                                    <Image source={require('@/assets/images/messages/chat.svg')} style={styles.heroIcon} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: colors.ink }]}>No messages yet</Text>
                                <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                                    Have a question or an update?{'\n'}Send your first message to dispatch.
                                </Text>
                            </View>
                        </View>
                    ) : null}
                    renderItem={({ item }) => (
                        <View
                            style={[styles.bubble, { alignSelf: item.user_id === session?.user.user_id ? 'flex-end' : 'flex-start', backgroundColor: item.user_id === session?.user.user_id ? colors.selectedSurface : colors.soft }]}
                        >
                            <Text
                                style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}
                            >
                                {item.sender_name} ·{' '}
                                {new Date(item.created_at).toLocaleString()}
                            </Text>
                            {item.body && (
                                <Text
                                    style={{ marginTop: 6, fontSize: 16, lineHeight: 23, color: colors.ink }}
                                >
                                    {item.body}
                                </Text>
                            )}
                            {item.attachments.map((a) => (
                                <Pressable
                                    key={a.attachment_id}
                                    onPress={() => {
                                        if (a.reference) {
                                            openReference(a.reference);
                                        } else void download(a.attachment_id);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open ${a.filename || 'attachment'}`}
                                    style={styles.attachment}
                                >
                                    <Feather name="file-text" size={18} color="#15803d" />
                                    <Text style={{ color: '#15803d', flexShrink: 1 }}>
                                        {a.filename || 'Attachment'}
                                    </Text>
                                    <Feather name={a.reference ? "chevron-right" : "download"} size={16} color="#15803d" />
                                </Pressable>
                            ))}
                        </View>
                    )}
                />
            )}
            <View style={[styles.composerShelf, { backgroundColor: colors.shelf }]}>
                {references.map(reference => <View key={`${reference.type}-${reference.id}`} style={[styles.draftFile, { backgroundColor: colors.background, borderColor: colors.line }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${reference.label}`} onPress={() => openReference(reference)} style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Feather name={reference.type === 'run' ? 'navigation' : 'package'} size={18} color={colors.muted} />
                        <Text numberOfLines={1} style={{ flex: 1, color: colors.ink }}>{reference.label}</Text>
                    </Pressable>
                    <Pressable disabled={sending} accessibilityRole="button" accessibilityLabel={`Remove ${reference.label}`} onPress={() => {
                        setReferences(previous => previous.filter(item => item.id !== reference.id || item.type !== reference.type)); retry.current = null;
                    }} style={styles.removeFile}><Feather name="x" size={18} color={colors.muted} /></Pressable>
                </View>)}
                {files.map((f, index) => (
                    <View key={`${f.uri}-${index}`} style={[styles.draftFile, isDraftPicture(f) && styles.draftPicture, { backgroundColor: colors.background, borderColor: colors.line }]}>
                        {isDraftPicture(f) ? (
                            <View style={[styles.picturePreview, { backgroundColor: colors.soft }]}>
                                <Feather name="image" size={24} color={colors.muted} />
                                <Image source={{ uri: f.uri }} contentFit="cover" accessible accessibilityLabel={`Selected picture: ${f.name}`} style={StyleSheet.absoluteFill} />
                            </View>
                        ) : <>
                            <Feather name="file-text" size={18} color={colors.muted} />
                            <Text numberOfLines={1} style={{ flex: 1, color: colors.ink }}>{f.name}</Text>
                        </>}
                        <Pressable disabled={sending} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} onPress={() => {
                            setFiles((prev) => prev.filter((_, i) => i !== index));
                            retry.current = null;
                        }} style={styles.removeFile}>
                            <Feather name="x" size={18} color={colors.muted} />
                        </Pressable>
                    </View>
                ))}
                <View style={[styles.composer, { backgroundColor: colors.background, borderColor: colors.line }]}>
                    <Pressable disabled={!canCompose} onPress={attach} accessibilityRole="button" accessibilityLabel="Add attachment" accessibilityState={{ disabled: !canCompose }} style={[styles.roundButton, { backgroundColor: colors.soft, opacity: canCompose ? 1 : 0.5 }]}>
                        <Image source={require('@/assets/images/messages/attachment.svg')} style={styles.attachmentIcon} />
                    </Pressable>
                    <TextInput
                        ref={composer}
                        accessibilityLabel="Message dispatch"
                        editable={canCompose}
                        value={body}
                        onChangeText={(value) => { setBody(value); retry.current = null; }}
                        maxLength={10000}
                        multiline
                        placeholder="Message dispatch…"
                        placeholderTextColor={colors.muted}
                        style={[styles.input, { color: colors.ink }]}
                    />
                    <Pressable disabled={!canSend} onPress={send} accessibilityRole="button" accessibilityLabel={sending ? 'Sending message' : failedSend ? 'Retry send' : 'Send message'} accessibilityState={{ disabled: !canSend, busy: sending }} style={[styles.roundButton, { backgroundColor: canSend ? '#15803d' : dark ? '#315a40' : '#bbdfc5' }]}>
                        {sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : failedSend ? <Feather name="rotate-cw" size={22} color="#FFFFFF" /> : <Image source={require('@/assets/images/messages/send.svg')} style={styles.sendIcon} />}
                    </Pressable>
                </View>
                {(conversation?.status === 'closed' || failedSend) && (
                    <Text style={[styles.composerHint, { color: colors.muted }]}>
                        {conversation?.status === 'closed' ? 'This conversation is closed. You can still read its messages.' : 'Your draft is saved. Tap retry to send again.'}
                    </Text>
                )}
            </View>
            <ActionSheet ref={attachmentActions} />
            {detailReference?.type === 'shipment' && <ShipmentDetailsSheet key={`${detailReference.id}:${detailReference.run_id ?? ''}`} modalRef={referenceModal} shipmentId={detailReference.id} runId={detailReference.run_id ?? undefined} autoPresent onDismiss={() => setDetailReference(null)} />}
            {detailReference?.type === 'run' && token && <RunDetailsSheet key={detailReference.id} token={token} runId={detailReference.id} onDismiss={() => setDetailReference(null)} />}
            {referenceType && session && conversation && <ChatReferenceSheet token={session.token} conversationId={conversation.conversation_id} type={referenceType} onDismiss={() => setReferenceType(null)} onSelect={record => {
                if (!active.current || conversationRef.current?.status !== 'active') return;
                if (references.some(item => item.id === record.id && item.type === record.type)) return;
                if (files.length + references.length >= 5) { setError('Choose up to five attachments.'); return; }
                setReferences(previous => [...previous, record]); retry.current = null;
            }} />}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    subtitle: { fontSize: 14, lineHeight: 20 },
    empty: { flex: 1, justifyContent: 'center', paddingVertical: 32 },
    heroIcon: { width: 32, height: 32 },
    emptyMessage: { alignItems: 'center', gap: 12 },
    emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    emptyTitle: { fontSize: 24, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
    emptyCopy: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    error: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 16 },
    retry: { minHeight: 44, justifyContent: 'center' },
    bubble: { maxWidth: '88%', padding: 14, borderRadius: 20, marginBottom: 12 },
    attachment: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, minHeight: 44 },
    composerShelf: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 6 },
    composer: { minHeight: 54, borderWidth: 1, borderRadius: 27, padding: 4, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    attachmentIcon: { width: 22, height: 22 },
    sendIcon: { width: 24, height: 24 },
    input: { flex: 1, fontSize: 16, lineHeight: 23, minHeight: 44, maxHeight: 120, paddingVertical: 6, paddingHorizontal: 0, textAlignVertical: 'center' },
    composerHint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
    draftFile: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingLeft: 12 },
    draftPicture: { alignSelf: 'flex-start', paddingLeft: 6, paddingVertical: 6 },
    picturePreview: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    removeFile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
