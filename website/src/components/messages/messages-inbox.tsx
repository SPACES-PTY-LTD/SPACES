'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    conversationRequest,
    ChatMessage,
    Conversation,
} from '@/lib/api/conversations';
import { apiFetch, isApiErrorResponse } from '@/lib/api/client';
import type { ApiListResponse, Driver } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    ArrowLeft,
    Download,
    FileText,
    MessageSquare,
    Paperclip,
    Plus,
    Search,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MessagesInbox({
    token,
    userId,
    merchants,
    initialMerchant,
}: {
    token: string;
    userId: string;
    merchants: { id: string; name: string; canManage: boolean }[];
    initialMerchant?: string;
}) {
    const [merchant, setMerchant] = useState(
        initialMerchant ?? merchants[0]?.id ?? '',
    );
    const canCreate = Boolean(
        merchants.find((m) => m.id === merchant)?.canManage,
    );
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [conversationType, setConversationType] = useState<
        '' | 'driver' | 'normal'
    >('');
    const [inboxLoading, setInboxLoading] = useState(true);
    const [inboxError, setInboxError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [createType, setCreateType] = useState<'driver' | 'normal'>('driver');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [mobileThread, setMobileThread] = useState(false);
    const [inbox, setInbox] = useState<Conversation[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [chat, setChat] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [before, setBefore] = useState<string | null>(null);
    const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
    const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
    const [driver, setDriver] = useState('');
    const [members, setMembers] = useState<string[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [olderLoading, setOlderLoading] = useState(false);
    const [newMember, setNewMember] = useState('');
    const [driverSearch, setDriverSearch] = useState('');
    const [personSearch, setPersonSearch] = useState('');
    const epoch = useRef(0);
    const inboxQuery = useRef('');
    const inboxRequest = useRef(0);
    const actionRunning = useRef(false);
    const selected = useRef<string | null>(null);
    const retry = useRef<string | null>(null);
    const uploads = useRef<HTMLInputElement>(null);
    const history = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const cursorLoaded = useRef(false);

    const query = new URLSearchParams({
        merchant_id: merchant,
        page: String(page),
    });
    if (debouncedSearch) query.set('search', debouncedSearch);
    if (conversationType) query.set('type', conversationType);
    const inboxPath = `?${query.toString()}`;

    const refreshInbox = useCallback(async () => {
        if (!merchant || inboxQuery.current !== inboxPath) return;
        const version = epoch.current;
        const request = ++inboxRequest.current;
        const result = await conversationRequest<Conversation[]>(
            token,
            inboxPath,
        );
        if (
            version !== epoch.current ||
            inboxQuery.current !== inboxPath ||
            request !== inboxRequest.current
        )
            return;
        setInbox(result.data);
        setLastPage(result.meta.last_page ?? 1);
        setInboxError(null);
    }, [merchant, token, inboxPath]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 250);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        epoch.current++;
        selected.current = null;
        setChat(null);
        setMessages([]);
        setBefore(null);
        setBody('');
        setFiles([]);
        retry.current = null;
        setInbox([]);
        setDrivers([]);
        setPeople([]);
        setDriver('');
        setMembers([]);
        setError(null);
        setInboxError(null);
        setCreateOpen(false);
        setDetailsOpen(false);
        setMobileThread(false);
        setTitle('');
        setSearch('');
        setDebouncedSearch('');
        setConversationType('');
        setPage(1);
        setNewMember('');
        setDriverSearch('');
        setPersonSearch('');
        setBusy(false);
        actionRunning.current = false;
        if (uploads.current) uploads.current.value = '';
    }, [merchant, token]);

    useEffect(() => {
        let live = true;
        let running = false;
        inboxQuery.current = inboxPath;
        setInboxLoading(Boolean(merchant));
        setInbox([]);
        setInboxError(null);
        async function refresh() {
            if (document.hidden || running || !merchant) return;
            running = true;
            try {
                await refreshInbox();
            } catch (e) {
                if (live && inboxQuery.current === inboxPath)
                    setInboxError(
                        e instanceof Error
                            ? e.message
                            : 'Unable to load conversations.',
                    );
            } finally {
                running = false;
                if (live && inboxQuery.current === inboxPath)
                    setInboxLoading(false);
            }
        }
        void refresh();
        const interval = setInterval(() => void refresh(), 10000);
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            live = false;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [refreshInbox, merchant, inboxPath]);

    useEffect(() => {
        if (!merchant || (!canCreate && !chat?.can_manage)) return;
        let live = true;
        const timer = setTimeout(() => {
            void apiFetch<ApiListResponse<Driver>>('/api/v1/drivers', {
                token,
                params: {
                    merchant_id: merchant,
                    search: driverSearch,
                    per_page: 100,
                },
            }).then((result) => {
                if (live && !isApiErrorResponse(result))
                    setDrivers(
                        result.data.map((d) => ({
                            id: d.driver_id,
                            name: d.name ?? d.email ?? d.driver_id,
                        })),
                    );
            });
            void apiFetch<{ data: { user_id: string; name: string }[] }>(
                '/api/v1/conversations/participants',
                {
                    token,
                    params: { merchant_id: merchant, search: personSearch },
                },
            ).then((result) => {
                if (live && !isApiErrorResponse(result))
                    setPeople(
                        result.data.map((p) => ({
                            id: p.user_id,
                            name: p.name,
                        })),
                    );
            });
        }, 250);
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, [
        merchant,
        token,
        driverSearch,
        personSearch,
        canCreate,
        chat?.can_manage,
    ]);

    const chatId = chat?.conversation_id;
    useEffect(() => {
        if (!chatId) return;
        let live = true;
        let running = false;
        const version = epoch.current;
        async function refresh() {
            if (!live || document.hidden || running) return;
            running = true;
            try {
                const [detail, result] = await Promise.all([
                    conversationRequest<Conversation>(token, `/${chatId}`),
                    conversationRequest<ChatMessage[]>(
                        token,
                        `/${chatId}/messages`,
                    ),
                ]);
                if (
                    !live ||
                    version !== epoch.current ||
                    selected.current !== chatId
                )
                    return;
                setChat(detail.data);
                setMessages((previous) =>
                    [
                        ...new Map(
                            [...previous, ...result.data].map((m) => [
                                m.message_id,
                                m,
                            ]),
                        ).values(),
                    ].sort((a, b) => a.created_at.localeCompare(b.created_at)),
                );
                if (!cursorLoaded.current) {
                    setBefore(result.meta.next_before ?? null);
                    cursorLoaded.current = true;
                }
                setLoading(false);
                const last = result.data.at(-1);
                if (last)
                    await conversationRequest(
                        token,
                        `/${chatId}/read`,
                        'POST',
                        { message_id: last.message_id },
                    );
            } catch (e) {
                if (
                    live &&
                    version === epoch.current &&
                    selected.current === chatId
                ) {
                    setError(
                        e instanceof Error ? e.message : 'Unable to load chat.',
                    );
                    setLoading(false);
                }
            } finally {
                running = false;
            }
        }
        void refresh();
        const interval = setInterval(() => void refresh(), 10000);
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            live = false;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [chatId, token]);

    useEffect(() => {
        if (atBottom.current)
            history.current?.scrollTo({ top: history.current.scrollHeight });
    }, [messages]);

    function choose(next: Conversation) {
        setMobileThread(true);
        setDetailsOpen(false);
        if (selected.current === next.conversation_id) return;
        setOlderLoading(false);
        if (uploads.current) uploads.current.value = '';
        cursorLoaded.current = false;
        selected.current = next.conversation_id;
        setChat(next);
        setMessages([]);
        setBefore(null);
        setBody('');
        setFiles([]);
        retry.current = null;
        setError(null);
        setLoading(true);
        atBottom.current = true;
    }
    async function action(work: () => Promise<void>) {
        if (actionRunning.current) return false;
        const version = epoch.current;
        actionRunning.current = true;
        setBusy(true);
        setError(null);
        try {
            await work();
            return version === epoch.current;
        } catch (e) {
            if (version === epoch.current)
                setError(e instanceof Error ? e.message : 'Request failed.');
            return false;
        } finally {
            if (version === epoch.current) {
                actionRunning.current = false;
                setBusy(false);
            }
        }
    }
    async function openDriver() {
        const version = epoch.current;
        await action(async () => {
            const result = await conversationRequest<Conversation>(
                token,
                '/driver',
                'POST',
                { merchant_id: merchant, driver_id: driver },
            );
            if (version === epoch.current) {
                choose(result.data);
                setCreateOpen(false);
                await refreshInbox();
            }
        });
    }
    async function createNormal() {
        const version = epoch.current;
        await action(async () => {
            const result = await conversationRequest<Conversation>(
                token,
                '',
                'POST',
                { merchant_id: merchant, title, member_ids: members },
            );
            if (version === epoch.current) {
                choose(result.data);
                setTitle('');
                setMembers([]);
                setCreateOpen(false);
                await refreshInbox();
            }
        });
    }
    async function send() {
        if (!chat || (!body.trim() && !files.length)) return;
        const id = chat.conversation_id;
        const version = epoch.current;
        retry.current ??= crypto.randomUUID();
        await action(async () => {
            const form = new FormData();
            form.append('body', body);
            form.append('temporary_id', retry.current!);
            files.forEach((f) => form.append('attachments[]', f));
            const result = await conversationRequest<ChatMessage>(
                token,
                `/${id}/messages`,
                'POST',
                form,
            );
            if (version !== epoch.current || selected.current !== id) return;
            setMessages((previous) => [
                ...previous.filter(
                    (m) => m.message_id !== result.data.message_id,
                ),
                result.data,
            ]);
            setBody('');
            setFiles([]);
            retry.current = null;
            if (uploads.current) uploads.current.value = '';
            atBottom.current = true;
            await refreshInbox();
        });
    }
    async function older() {
        if (!chatId || !before || olderLoading) return;
        const version = epoch.current;
        setOlderLoading(true);
        atBottom.current = false;
        try {
            const result = await conversationRequest<ChatMessage[]>(
                token,
                `/${chatId}/messages?before=${before}`,
            );
            if (version === epoch.current && selected.current === chatId) {
                setMessages((prev) => [
                    ...new Map(
                        [...result.data, ...prev].map((m) => [m.message_id, m]),
                    ).values(),
                ]);
                setBefore(result.meta.next_before ?? null);
            }
        } catch (e) {
            if (version === epoch.current && selected.current === chatId)
                setError(
                    e instanceof Error
                        ? e.message
                        : 'Unable to load older messages.',
                );
        } finally {
            if (version === epoch.current && selected.current === chatId)
                setOlderLoading(false);
        }
    }
    async function manage(
        path: string,
        method: 'POST' | 'PATCH' | 'DELETE',
        payload?: unknown,
    ) {
        if (!chatId) return;
        const version = epoch.current;
        return action(async () => {
            const result = await conversationRequest<Conversation>(
                token,
                `/${chatId}${path}`,
                method,
                payload,
            );
            if (version === epoch.current && selected.current === chatId) {
                setChat(result.data);
                setNewMember('');
                await refreshInbox();
            }
        });
    }
    const control =
        'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
    const chatTitle =
        chat?.title ||
        (chat?.type === 'driver' ? 'Driver chat' : 'Group conversation');
    const formatTime = (value?: string | null) =>
        value
            ? new Date(value).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '';
    const formatSize = (size: number | null) =>
        size === null
            ? ''
            : size >= 1024 * 1024
              ? `${(size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.ceil(size / 1024)} KB`;
    const errorAlert = error && (
        <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
            {error}
        </div>
    );
    const invalidateInbox = () => {
        inboxQuery.current = '';
        inboxRequest.current++;
        setInboxLoading(true);
    };

    return (
        <div className="flex h-[calc(100dvh-7rem)] min-h-[560px] min-w-0 flex-col gap-5 lg:h-[calc(100dvh-3rem)]">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-bold leading-tight">
                        Messages
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Your conversations, clearly organised.
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-xs text-muted-foreground">
                        Merchant
                        <select
                            aria-label="Merchant"
                            className={cn(control, 'max-w-64 text-foreground')}
                            value={merchant}
                            onChange={(e) => {
                                if (e.target.value === merchant) return;
                                invalidateInbox();
                                setMerchant(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">Select merchant</option>
                            {merchants.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {canCreate && (
                        <Button
                            className="h-10 rounded-lg"
                            disabled={busy || !merchant}
                            onClick={() => {
                                setError(null);
                                setCreateOpen(true);
                            }}
                        >
                            <Plus aria-hidden="true" />
                            New conversation
                        </Button>
                    )}
                </div>
            </header>
            {!createOpen && !detailsOpen && errorAlert}
            <div className="grid min-h-[320px] flex-1 overflow-hidden rounded-xl border bg-background lg:grid-cols-[352px_minmax(0,1fr)]">
                <aside
                    aria-label="Conversation inbox"
                    className={cn(
                        'min-h-0 min-w-0 flex-col border-r p-4',
                        mobileThread ? 'hidden lg:flex' : 'flex',
                    )}
                >
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            aria-label="Search conversations"
                            placeholder="Search conversations"
                            maxLength={255}
                            className="h-11 rounded-lg border-0 bg-muted/60 pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div
                        role="group"
                        aria-label="Conversation type"
                        className="my-3 flex gap-2"
                    >
                        {(
                            [
                                ['', 'All'],
                                ['driver', 'Drivers'],
                                ['normal', 'Groups'],
                            ] as const
                        ).map(([value, label]) => (
                            <Button
                                key={label}
                                aria-pressed={conversationType === value}
                                variant={
                                    conversationType === value
                                        ? 'secondary'
                                        : 'outline'
                                }
                                className="h-10 flex-1 rounded-lg"
                                onClick={() => {
                                    if (conversationType !== value) {
                                        invalidateInbox();
                                        setConversationType(value);
                                        setPage(1);
                                    }
                                }}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                    {inboxError && (
                        <div
                            role="alert"
                            className="mb-3 rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
                        >
                            {inboxError}
                            <Button
                                variant="link"
                                size="sm"
                                className="text-destructive"
                                onClick={() => void action(refreshInbox)}
                            >
                                Retry inbox
                            </Button>
                        </div>
                    )}
                    <div
                        className="min-h-0 flex-1 space-y-1 overflow-y-auto"
                        aria-busy={inboxLoading}
                    >
                        {inboxLoading ? (
                            <p
                                role="status"
                                className="p-4 text-sm text-muted-foreground"
                            >
                                Loading conversations…
                            </p>
                        ) : (
                            inbox.map((c) => (
                                <button
                                    disabled={busy}
                                    key={c.conversation_id}
                                    aria-current={
                                        chatId === c.conversation_id
                                            ? 'true'
                                            : undefined
                                    }
                                    className={cn(
                                        'block w-full rounded-lg p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50',
                                        chatId === c.conversation_id &&
                                            'bg-muted',
                                    )}
                                    onClick={() => choose(c)}
                                >
                                    <span className="block truncate text-sm font-medium">
                                        {c.title ||
                                            (c.type === 'driver'
                                                ? 'Driver chat'
                                                : 'Group conversation')}
                                    </span>
                                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                                        {c.latest_message?.body
                                            ? `${c.latest_message.user_id === userId ? 'You: ' : ''}${c.latest_message.body}`
                                            : c.latest_message?.attachments
                                                    .length
                                              ? 'Attachment'
                                              : 'No messages yet'}
                                    </span>
                                    <span className="mt-1 flex flex-wrap gap-x-1 text-xs text-muted-foreground">
                                        <span>
                                            {c.type === 'driver'
                                                ? 'Driver'
                                                : 'Group'}{' '}
                                            ·{' '}
                                            {c.status === 'active'
                                                ? 'Active'
                                                : 'Closed'}
                                        </span>
                                        {(c.latest_message?.created_at ||
                                            c.updated_at) && (
                                            <span>
                                                ·{' '}
                                                {formatTime(
                                                    c.latest_message
                                                        ?.created_at ||
                                                        c.updated_at,
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            ))
                        )}
                        {!inboxLoading && !inboxError && !inbox.length && (
                            <div className="px-4 py-10 text-center">
                                <MessageSquare
                                    aria-hidden="true"
                                    className="mx-auto mb-3 size-6 text-muted-foreground"
                                />
                                <p className="text-sm font-medium">
                                    {!merchant
                                        ? 'Select a merchant'
                                        : search.trim() || conversationType
                                          ? 'No matching conversations'
                                          : 'No conversations yet'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {!merchant
                                        ? 'Choose a workspace to view messages.'
                                        : search.trim() || conversationType
                                          ? 'Try another search or conversation type.'
                                          : 'Start a driver chat or group conversation.'}
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={inboxLoading || page === 1}
                            onClick={() => {
                                invalidateInbox();
                                setPage((p) => p - 1);
                            }}
                        >
                            Previous
                        </Button>
                        <span>
                            {page} / {lastPage}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={inboxLoading || page >= lastPage}
                            onClick={() => {
                                invalidateInbox();
                                setPage((p) => p + 1);
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </aside>
                <section
                    aria-label="Conversation"
                    className={cn(
                        'min-h-0 min-w-0 flex-col',
                        mobileThread ? 'flex' : 'hidden lg:flex',
                    )}
                >
                    {!chat ? (
                        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                            <MessageSquare
                                className="mb-4 size-8 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <h2 className="text-lg font-semibold">
                                Select a conversation
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Choose a thread from your inbox or start a new
                                conversation.
                            </p>
                        </div>
                    ) : (
                        <>
                            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 py-5 sm:px-6">
                                <div className="w-full lg:hidden">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-2 lg:hidden"
                                        onClick={() => setMobileThread(false)}
                                    >
                                        <ArrowLeft aria-hidden="true" />
                                        Back to conversations
                                    </Button>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="break-words text-lg font-bold">
                                        {chatTitle}
                                    </h2>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {chat.type === 'driver'
                                            ? 'Driver'
                                            : 'Group'}{' '}
                                        conversation ·{' '}
                                        {chat.status === 'active'
                                            ? 'Active'
                                            : 'Closed'}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="rounded-lg"
                                    aria-label="Conversation details"
                                    disabled={loading}
                                    onClick={() => {
                                        setError(null);
                                        setEditTitle(chat.title ?? '');
                                        setEditDescription(
                                            chat.description ?? '',
                                        );
                                        setDetailsOpen(true);
                                    }}
                                >
                                    <span className="hidden sm:inline">
                                        Conversation details
                                    </span>
                                    <span className="sm:hidden">Details</span>
                                </Button>
                            </header>
                            <div
                                ref={history}
                                onScroll={() => {
                                    const el = history.current;
                                    if (el)
                                        atBottom.current =
                                            el.scrollHeight -
                                                el.scrollTop -
                                                el.clientHeight <
                                            60;
                                }}
                                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3 sm:px-6"
                                aria-busy={loading}
                            >
                                {before && (
                                    <Button
                                        variant="ghost"
                                        className="mx-auto shrink-0"
                                        disabled={olderLoading}
                                        onClick={() => void older()}
                                    >
                                        {olderLoading
                                            ? 'Loading…'
                                            : 'Load older messages'}
                                    </Button>
                                )}
                                {loading && (
                                    <p
                                        role="status"
                                        className="text-sm text-muted-foreground"
                                    >
                                        Loading conversation…
                                    </p>
                                )}
                                {!loading && !messages.length && (
                                    <div className="m-auto py-8 text-center">
                                        <p className="text-sm font-medium">
                                            No messages yet
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {chat.status === 'active'
                                                ? 'Send the first message to get started.'
                                                : 'This conversation is closed.'}
                                        </p>
                                    </div>
                                )}
                                {messages.map((m, index) => {
                                    const outgoing = m.user_id === userId;
                                    const date = new Date(
                                        m.created_at,
                                    ).toLocaleDateString();
                                    const showDate =
                                        index === 0 ||
                                        date !==
                                            new Date(
                                                messages[index - 1].created_at,
                                            ).toLocaleDateString();
                                    return (
                                        <div
                                            key={m.message_id}
                                            className="flex shrink-0 flex-col gap-4"
                                        >
                                            {showDate && (
                                                <p className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    {new Date(
                                                        m.created_at,
                                                    ).toLocaleDateString([], {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                            )}
                                            <article
                                                className={cn(
                                                    'max-w-[90%] rounded-lg p-4 text-sm sm:max-w-[min(80%,400px)]',
                                                    outgoing
                                                        ? 'self-end bg-primary text-primary-foreground'
                                                        : 'self-start bg-muted/60',
                                                )}
                                            >
                                                {m.body && (
                                                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                                                        {m.body}
                                                    </p>
                                                )}
                                                {m.attachments.map((a) => (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        key={a.attachment_id}
                                                        className={cn(
                                                            'mt-2 flex w-full min-w-0 items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                            outgoing
                                                                ? 'border-primary-foreground/20 hover:bg-primary-foreground/10'
                                                                : 'border-border hover:bg-background',
                                                        )}
                                                        onClick={() =>
                                                            void action(
                                                                async () => {
                                                                    const result =
                                                                        await conversationRequest<{
                                                                            url: string;
                                                                        }>(
                                                                            token,
                                                                            `/${chatId}/attachments/${a.attachment_id}/download`,
                                                                        );
                                                                    window.open(
                                                                        result
                                                                            .data
                                                                            .url,
                                                                        '_blank',
                                                                        'noopener,noreferrer',
                                                                    );
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <FileText
                                                            aria-hidden="true"
                                                            className="size-5 shrink-0"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block break-words font-medium [overflow-wrap:anywhere]">
                                                                {a.filename ||
                                                                    'Attachment'}
                                                            </span>
                                                            <span className="mt-1 block text-xs opacity-70">
                                                                {formatSize(
                                                                    a.size,
                                                                )}
                                                                {a.size !==
                                                                    null &&
                                                                    ' · '}
                                                                Download
                                                            </span>
                                                        </span>
                                                        <Download
                                                            aria-hidden="true"
                                                            className="size-4 shrink-0"
                                                        />
                                                    </button>
                                                ))}
                                                <p className="mt-2 text-xs opacity-70">
                                                    {outgoing
                                                        ? 'You'
                                                        : m.sender_name}{' '}
                                                    · {formatTime(m.created_at)}
                                                </p>
                                            </article>
                                        </div>
                                    );
                                })}
                            </div>
                            <form
                                className="shrink-0 p-4 sm:p-6"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void send();
                                }}
                            >
                                <div className="space-y-3 rounded-xl border p-3">
                                    <textarea
                                        aria-label="Message"
                                        disabled={
                                            busy ||
                                            loading ||
                                            chat.status !== 'active'
                                        }
                                        className="max-h-40 min-h-12 w-full resize-y bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                                        maxLength={10000}
                                        rows={2}
                                        placeholder={
                                            chat.status === 'closed'
                                                ? 'This conversation is closed.'
                                                : 'Write a message…'
                                        }
                                        value={body}
                                        onChange={(e) => {
                                            setBody(e.target.value);
                                            retry.current = null;
                                        }}
                                    />
                                    {files.length > 0 && (
                                        <ul
                                            className="flex flex-wrap gap-2"
                                            aria-label="Pending attachments"
                                        >
                                            {files.map((f, i) => (
                                                <li
                                                    key={`${f.name}-${i}`}
                                                    className="flex max-w-full items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs"
                                                >
                                                    <span className="min-w-0 truncate">
                                                        {f.name}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        size="icon-xs"
                                                        variant="ghost"
                                                        aria-label={`Remove ${f.name}`}
                                                        disabled={busy}
                                                        onClick={() => {
                                                            setFiles((prev) =>
                                                                prev.filter(
                                                                    (
                                                                        _,
                                                                        index,
                                                                    ) =>
                                                                        index !==
                                                                        i,
                                                                ),
                                                            );
                                                            retry.current =
                                                                null;
                                                            if (uploads.current)
                                                                uploads.current.value =
                                                                    '';
                                                        }}
                                                    >
                                                        <X aria-hidden="true" />
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                        <input
                                            ref={uploads}
                                            aria-label="Attachments"
                                            type="file"
                                            className="sr-only"
                                            tabIndex={-1}
                                            multiple
                                            disabled={
                                                busy ||
                                                loading ||
                                                chat.status !== 'active'
                                            }
                                            onChange={(e) => {
                                                const next = [
                                                    ...files,
                                                    ...Array.from(
                                                        e.target.files ?? [],
                                                    ),
                                                ];
                                                if (
                                                    next.length > 5 ||
                                                    next.some(
                                                        (f) =>
                                                            f.size >
                                                            20 * 1024 * 1024,
                                                    )
                                                ) {
                                                    setError(
                                                        'Choose up to five files, each no larger than 20 MB.',
                                                    );
                                                    e.target.value = '';
                                                    return;
                                                }
                                                setFiles(next);
                                                retry.current = null;
                                                e.target.value = '';
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-lg"
                                            disabled={
                                                busy ||
                                                loading ||
                                                chat.status !== 'active'
                                            }
                                            onClick={() =>
                                                uploads.current?.click()
                                            }
                                        >
                                            <Paperclip aria-hidden="true" />
                                            Attach files
                                        </Button>
                                        <Button
                                            type="submit"
                                            className="min-w-24 rounded-lg"
                                            disabled={
                                                busy ||
                                                loading ||
                                                chat.status !== 'active' ||
                                                (!body.trim() && !files.length)
                                            }
                                        >
                                            {busy
                                                ? 'Working…'
                                                : retry.current
                                                  ? 'Retry send'
                                                  : 'Send'}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Up to 5 attachments · 20 MB each
                                    </p>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            </div>
            <Dialog
                open={createOpen && canCreate}
                onOpenChange={(open) => {
                    if (!busy) setCreateOpen(open);
                }}
            >
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>New conversation</DialogTitle>
                        <DialogDescription>
                            Start a driver chat or create a group in this
                            merchant workspace.
                        </DialogDescription>
                    </DialogHeader>
                    {errorAlert}
                    <div
                        role="group"
                        aria-label="New conversation type"
                        className="flex gap-2"
                    >
                        <Button
                            variant={
                                createType === 'driver'
                                    ? 'secondary'
                                    : 'outline'
                            }
                            aria-pressed={createType === 'driver'}
                            disabled={busy}
                            onClick={() => setCreateType('driver')}
                        >
                            Driver chat
                        </Button>
                        <Button
                            variant={
                                createType === 'normal'
                                    ? 'secondary'
                                    : 'outline'
                            }
                            aria-pressed={createType === 'normal'}
                            disabled={busy}
                            onClick={() => setCreateType('normal')}
                        >
                            Group conversation
                        </Button>
                    </div>
                    {createType === 'driver' ? (
                        <form
                            className="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (driver) void openDriver();
                            }}
                        >
                            <fieldset
                                disabled={busy || !merchant}
                                className="space-y-4"
                            >
                                <label className="grid gap-2 text-sm font-medium">
                                    Search drivers
                                    <Input
                                        aria-label="Search drivers"
                                        placeholder="Search by name"
                                        value={driverSearch}
                                        onChange={(e) =>
                                            setDriverSearch(e.target.value)
                                        }
                                    />
                                </label>
                                <label className="grid gap-2 text-sm font-medium">
                                    Driver
                                    <select
                                        aria-label="Driver"
                                        className={control}
                                        value={driver}
                                        onChange={(e) =>
                                            setDriver(e.target.value)
                                        }
                                    >
                                        <option value="">Select driver</option>
                                        {drivers.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <Button type="submit" disabled={!driver}>
                                    {busy ? 'Opening…' : 'Open driver chat'}
                                </Button>
                            </fieldset>
                        </form>
                    ) : (
                        <form
                            className="space-y-4"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (title.trim() && members.length)
                                    void createNormal();
                            }}
                        >
                            <fieldset
                                disabled={busy || !merchant}
                                className="space-y-4"
                            >
                                <label className="grid gap-2 text-sm font-medium">
                                    Conversation title
                                    <Input
                                        aria-label="Conversation title"
                                        placeholder="e.g. Dispatch team"
                                        maxLength={255}
                                        value={title}
                                        onChange={(e) =>
                                            setTitle(e.target.value)
                                        }
                                    />
                                </label>
                                <label className="grid gap-2 text-sm font-medium">
                                    Search members
                                    <Input
                                        aria-label="Search members"
                                        value={personSearch}
                                        onChange={(e) =>
                                            setPersonSearch(e.target.value)
                                        }
                                    />
                                </label>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                        Members
                                    </p>
                                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                                        {people
                                            .filter((p) => p.id !== userId)
                                            .map((p) => (
                                                <label
                                                    key={p.id}
                                                    className="flex items-center gap-2 text-sm"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={members.includes(
                                                            p.id,
                                                        )}
                                                        onChange={(e) =>
                                                            setMembers(
                                                                (prev) =>
                                                                    e.target
                                                                        .checked
                                                                        ? [
                                                                              ...prev,
                                                                              p.id,
                                                                          ]
                                                                        : prev.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  id !==
                                                                                  p.id,
                                                                          ),
                                                            )
                                                        }
                                                    />
                                                    {p.name}
                                                </label>
                                            ))}
                                        {!people.filter((p) => p.id !== userId)
                                            .length && (
                                            <p className="text-sm text-muted-foreground">
                                                No members found.
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {members.length} selected
                                    </p>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={!title.trim() || !members.length}
                                >
                                    {busy ? 'Creating…' : 'Create conversation'}
                                </Button>
                            </fieldset>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog
                open={detailsOpen && Boolean(chat)}
                onOpenChange={(open) => {
                    if (!busy) setDetailsOpen(open);
                }}
            >
                <DialogContent className="max-h-[85dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Conversation details</DialogTitle>
                        <DialogDescription>
                            {chatTitle} ·{' '}
                            {chat?.status === 'active' ? 'Active' : 'Closed'}
                        </DialogDescription>
                    </DialogHeader>
                    {errorAlert}
                    {chat?.can_manage ? (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (editTitle.trim())
                                    void manage('', 'PATCH', {
                                        title: editTitle.trim(),
                                        description: editDescription,
                                    });
                            }}
                        >
                            <fieldset disabled={busy} className="space-y-4">
                                <label className="grid gap-2 text-sm font-medium">
                                    Title
                                    <Input
                                        aria-label="Edit conversation title"
                                        maxLength={255}
                                        value={editTitle}
                                        onChange={(e) =>
                                            setEditTitle(e.target.value)
                                        }
                                    />
                                </label>
                                <label className="grid gap-2 text-sm font-medium">
                                    Description
                                    <textarea
                                        aria-label="Edit conversation description"
                                        className={control}
                                        maxLength={10000}
                                        rows={3}
                                        value={editDescription}
                                        onChange={(e) =>
                                            setEditDescription(e.target.value)
                                        }
                                    />
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="submit"
                                        disabled={
                                            !editTitle.trim() ||
                                            (editTitle.trim() ===
                                                (chat.title ?? '') &&
                                                editDescription ===
                                                    (chat.description ?? ''))
                                        }
                                    >
                                        Save details
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            void manage('', 'PATCH', {
                                                status:
                                                    chat.status === 'active'
                                                        ? 'closed'
                                                        : 'active',
                                            })
                                        }
                                    >
                                        {chat.status === 'active'
                                            ? 'Close conversation'
                                            : 'Reopen conversation'}
                                    </Button>
                                </div>
                            </fieldset>
                        </form>
                    ) : (
                        <div className="space-y-2 text-sm">
                            <p className="font-medium">{chatTitle}</p>
                            <p className="whitespace-pre-wrap break-words text-muted-foreground">
                                {chat?.description || 'No description.'}
                            </p>
                        </div>
                    )}
                    {chat?.type === 'normal' && (
                        <div className="space-y-3 border-t pt-4">
                            <h3 className="text-sm font-semibold">Members</h3>
                            <ul className="space-y-2">
                                {chat.members.map((m) => (
                                    <li
                                        key={m.user_id}
                                        className="flex items-center justify-between gap-3 text-sm"
                                    >
                                        <span className="min-w-0 break-words">
                                            {m.name}{' '}
                                            <span className="text-xs text-muted-foreground">
                                                ({m.role})
                                            </span>
                                        </span>
                                        {chat.can_manage &&
                                            m.role !== 'owner' && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void manage(
                                                            `/members/${m.user_id}`,
                                                            'DELETE',
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                    </li>
                                ))}
                            </ul>
                            {chat.can_manage && (
                                <div className="space-y-2">
                                    <Input
                                        aria-label="Search available members"
                                        placeholder="Search members"
                                        disabled={busy}
                                        value={personSearch}
                                        onChange={(e) =>
                                            setPersonSearch(e.target.value)
                                        }
                                    />
                                    <div className="flex gap-2">
                                        <select
                                            aria-label="Add member"
                                            className={control}
                                            disabled={busy}
                                            value={newMember}
                                            onChange={(e) =>
                                                setNewMember(e.target.value)
                                            }
                                        >
                                            <option value="">
                                                Select member
                                            </option>
                                            {people
                                                .filter(
                                                    (p) =>
                                                        !chat.members.some(
                                                            (m) =>
                                                                m.user_id ===
                                                                p.id,
                                                        ),
                                                )
                                                .map((p) => (
                                                    <option
                                                        key={p.id}
                                                        value={p.id}
                                                    >
                                                        {p.name}
                                                    </option>
                                                ))}
                                        </select>
                                        <Button
                                            disabled={busy || !newMember}
                                            onClick={() =>
                                                void manage(
                                                    '/members',
                                                    'POST',
                                                    { user_id: newMember },
                                                )
                                            }
                                        >
                                            Add
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
