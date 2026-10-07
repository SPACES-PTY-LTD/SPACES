import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    FlatList,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/component/ui/Text';
import {
    appendUploadFile,
    chatApi,
    ChatConversation,
    ChatMessage,
} from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';
import { useUnreadMessages } from '@/src/providers/unread-messages-provider';
import { setVisibleDriverChat } from '@/src/providers/message-notifications';

export default function MessagesScreen() {
    const { session } = useAuth();
    return <DriverChat key={session?.user.user_id ?? 'signed-out'} />;
}

function DriverChat() {
    const { refresh: refreshUnread } = useUnreadMessages();
    const { session } = useAuth();
    const insets = useSafeAreaInsets();
    const [conversation, setConversation] = useState<ChatConversation | null>(
        null,
    );
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [before, setBefore] = useState<string | null>(null);
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>(
        [],
    );
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
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

    useFocusEffect(
        useCallback(() => {
            const current = ++generation.current;
            const reloadVersion = reload; // Re-enter the focused loader on explicit Retry.
            void reloadVersion;
            const token = session?.token;
            let busy = false;
            active.current = true;
            conversationRef.current = null;
            cursorLoaded.current = false;
            atBottom.current = true;
            setConversation(null);
            setMessages([]);
            setBefore(null);
            setLoading(true);
            setError(null);
            const valid = () =>
                generation.current === current &&
                active.current &&
                AppState.currentState === 'active';
            async function refresh() {
                if (!token || !valid() || busy) return;
                busy = true;
                try {
                    const chat = conversationRef.current
                        ? await chatApi.show(
                              token,
                              conversationRef.current.conversation_id,
                          )
                        : await chatApi.openDriver(token);
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
        }, [session, reload, refreshUnread]),
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
    async function pick() {
        const result = await DocumentPicker.getDocumentAsync({
            multiple: true,
            copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const next = [...files, ...result.assets];
        if (
            next.length > 5 ||
            next.some((f) => (f.size ?? 0) > 20 * 1024 * 1024)
        ) {
            setError('Choose up to five files, each no larger than 20 MB.');
            return;
        }
        setFiles(next);
        retry.current = null;
    }
    async function send() {
        if (
            !session ||
            !conversation ||
            sending ||
            (!body.trim() && !files.length)
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
    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, paddingTop: insets.top }}
        >
            <View className="px-5 py-4">
                <Text className="text-foreground text-2xl font-semibold">
                    Messages
                </Text>
                <Text className="text-muted-foreground">
                    {conversation?.title || 'Contact dispatch'}
                    {conversation?.status === 'closed' ? ' · Closed' : ''}
                </Text>
            </View>
            {error && (
                <View className="px-5 py-2">
                    <Text className="text-destructive">{error}</Text>
                    <Pressable onPress={() => setReload((n) => n + 1)}>
                        <Text className="text-primary">Retry loading</Text>
                    </Pressable>
                </View>
            )}
            {loading ? (
                <ActivityIndicator className="flex-1" color="#F54A4A" />
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    ref={list}
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
                    contentContainerStyle={{ padding: 18, flexGrow: 1 }}
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
                    ListEmptyComponent={
                        <Text className="text-muted-foreground">
                            Send a message to dispatch to start the
                            conversation.
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <View
                            className={`mb-3 rounded-xl p-4 ${item.user_id === session?.user.user_id ? 'self-end bg-secondary' : 'self-start bg-card'}`}
                            style={{ maxWidth: '90%' }}
                        >
                            <Text
                                className={`text-xs ${item.user_id === session?.user.user_id ? 'text-secondary-foreground opacity-75' : 'text-muted-foreground'}`}
                            >
                                {item.sender_name} ·{' '}
                                {new Date(item.created_at).toLocaleString()}
                            </Text>
                            {item.body && (
                                <Text
                                    className={`mt-1 ${item.user_id === session?.user.user_id ? 'text-secondary-foreground' : 'text-card-foreground'}`}
                                >
                                    {item.body}
                                </Text>
                            )}
                            {item.attachments.map((a) => (
                                <Pressable
                                    key={a.attachment_id}
                                    onPress={() => download(a.attachment_id)}
                                >
                                    <Text className="text-primary mt-2">
                                        📎 {a.filename || 'Attachment'}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                />
            )}
            <View className="border-border border-t px-4 py-3">
                {files.map((f, index) => (
                    <Pressable
                        disabled={sending}
                        key={`${f.uri}-${index}`}
                        onPress={() => {
                            setFiles((prev) =>
                                prev.filter((_, i) => i !== index),
                            );
                            retry.current = null;
                        }}
                    >
                        <Text className="text-muted-foreground">
                            📎 {f.name} · Remove
                        </Text>
                    </Pressable>
                ))}
                <TextInput
                    accessibilityLabel="Message"
                    editable={!sending && conversation?.status === 'active'}
                    value={body}
                    onChangeText={(value) => {
                        setBody(value);
                        retry.current = null;
                    }}
                    maxLength={10000}
                    multiline
                    placeholder="Message dispatch…"
                    className="text-foreground bg-card rounded-xl px-4 py-3"
                    style={{ maxHeight: 120 }}
                />
                <View className="mt-3 flex-row justify-between">
                    <Pressable
                        disabled={sending || conversation?.status !== 'active'}
                        onPress={pick}
                    >
                        <Text className="text-primary">Attach file</Text>
                    </Pressable>
                    <Pressable
                        disabled={sending || conversation?.status !== 'active'}
                        onPress={send}
                    >
                        <Text className="text-primary font-semibold">
                            {sending
                                ? 'Sending…'
                                : failedSend
                                  ? 'Retry send'
                                  : 'Send'}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
