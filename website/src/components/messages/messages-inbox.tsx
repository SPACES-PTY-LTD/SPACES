'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    conversationRequest,
    ChatMessage,
    Conversation,
} from '@/lib/api/conversations';
import { apiFetch, isApiErrorResponse } from '@/lib/api/client';
import type { ApiListResponse, Driver } from '@/lib/types';

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
    const selected = useRef<string | null>(null);
    const retry = useRef<string | null>(null);
    const uploads = useRef<HTMLInputElement>(null);
    const history = useRef<HTMLDivElement>(null);
    const atBottom = useRef(true);
    const cursorLoaded = useRef(false);

    const refreshInbox = useCallback(async () => {
        if (!merchant) return;
        const version = epoch.current;
        const result = await conversationRequest<Conversation[]>(
            token,
            `?merchant_id=${merchant}&page=${page}`,
        );
        if (version !== epoch.current) return;
        setInbox(result.data);
        setLastPage(result.meta.last_page ?? 1);
    }, [merchant, token, page]);

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
    }, [merchant, token]);

    useEffect(() => {
        let live = true;
        let running = false;
        async function refresh() {
            if (document.hidden || running || !merchant) return;
            running = true;
            try {
                await refreshInbox();
                if (live) setError(null);
            } catch (e) {
                if (live)
                    setError(
                        e instanceof Error
                            ? e.message
                            : 'Unable to load conversations.',
                    );
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
    }, [refreshInbox, merchant]);

    useEffect(() => {
        if (!merchant || !canCreate) return;
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
    }, [merchant, token, driverSearch, personSearch, canCreate]);

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
        const version = epoch.current;
        setBusy(true);
        setError(null);
        try {
            await work();
        } catch (e) {
            if (version === epoch.current)
                setError(e instanceof Error ? e.message : 'Request failed.');
        } finally {
            setBusy(false);
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
        await action(async () => {
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
    const control = 'rounded-md border bg-background p-2 text-sm';
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Messages</h1>
            <label className="block">
                Merchant{' '}
                <select
                    aria-label="Merchant"
                    className={control}
                    value={merchant}
                    onChange={(e) => {
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
            {error && (
                <div
                    role="alert"
                    className="rounded border border-destructive p-3 text-destructive"
                >
                    {error}{' '}
                    <button
                        className="underline"
                        onClick={() => void action(refreshInbox)}
                    >
                        Retry inbox
                    </button>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <aside className="space-y-4">
                    {canCreate && (
                        <fieldset
                            disabled={busy || !merchant}
                            className="space-y-2 rounded-lg border p-3"
                        >
                            <legend>Driver chat</legend>
                            <input
                                className={control}
                                aria-label="Search drivers"
                                placeholder="Search drivers"
                                value={driverSearch}
                                onChange={(e) =>
                                    setDriverSearch(e.target.value)
                                }
                            />
                            <select
                                aria-label="Driver"
                                className={`${control} w-full`}
                                value={driver}
                                onChange={(e) => setDriver(e.target.value)}
                            >
                                <option value="">Select driver</option>
                                {drivers.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                disabled={!driver}
                                className={control}
                                onClick={openDriver}
                            >
                                Open driver chat
                            </button>
                        </fieldset>
                    )}
                    {canCreate && (
                        <fieldset
                            disabled={busy || !merchant}
                            className="space-y-2 rounded-lg border p-3"
                        >
                            <legend>New normal conversation</legend>
                            <input
                                aria-label="Conversation title"
                                className={`${control} w-full`}
                                placeholder="Title"
                                maxLength={255}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <input
                                aria-label="Search members"
                                className={control}
                                placeholder="Search members"
                                value={personSearch}
                                onChange={(e) =>
                                    setPersonSearch(e.target.value)
                                }
                            />
                            <select
                                aria-label="Conversation members"
                                className={`${control} w-full`}
                                multiple
                                value={members}
                                onChange={(e) =>
                                    setMembers(
                                        Array.from(
                                            e.target.selectedOptions,
                                        ).map((o) => o.value),
                                    )
                                }
                            >
                                {people
                                    .filter((p) => p.id !== userId)
                                    .map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                            <button
                                disabled={!title.trim() || !members.length}
                                className={control}
                                onClick={createNormal}
                            >
                                Create conversation
                            </button>
                        </fieldset>
                    )}
                    <div className="space-y-2">
                        {inbox.map((c) => (
                            <button
                                disabled={busy}
                                key={c.conversation_id}
                                className={`block w-full rounded-lg border p-3 text-left ${chatId === c.conversation_id ? 'bg-muted' : ''}`}
                                onClick={() => choose(c)}
                            >
                                <strong>{c.title || 'Driver chat'}</strong>
                                <span className="block text-xs text-muted-foreground">
                                    {c.type} · {c.status}
                                </span>
                                <span className="block truncate text-sm">
                                    {c.latest_message?.body ||
                                        (c.latest_message?.attachments.length
                                            ? 'Attachment'
                                            : 'No messages yet')}
                                </span>
                            </button>
                        ))}
                        {!inbox.length && (
                            <p className="text-muted-foreground">
                                No conversations.
                            </p>
                        )}
                    </div>
                    <div className="flex justify-between">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Previous
                        </button>
                        <span>
                            {page} / {lastPage}
                        </span>
                        <button
                            disabled={page >= lastPage}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                </aside>
                <section className="flex min-h-[550px] flex-col rounded-lg border">
                    {!chat ? (
                        <p className="p-6 text-muted-foreground">
                            Select or create a conversation.
                        </p>
                    ) : (
                        <>
                            <header className="border-b p-4">
                                <h2 className="text-lg font-semibold">
                                    {chat.title}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {chat.description}
                                </p>
                                {chat.can_manage && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                            disabled={busy}
                                            className={control}
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
                                        </button>
                                        <button
                                            disabled={busy}
                                            className={control}
                                            onClick={() => {
                                                const value = window.prompt(
                                                    'Conversation title',
                                                    chat.title ?? '',
                                                );
                                                if (value?.trim())
                                                    void manage('', 'PATCH', {
                                                        title: value.trim(),
                                                    });
                                            }}
                                        >
                                            Edit title
                                        </button>
                                        <button
                                            disabled={busy}
                                            className={control}
                                            onClick={() => {
                                                const value = window.prompt(
                                                    'Description',
                                                    chat.description ?? '',
                                                );
                                                if (value !== null)
                                                    void manage('', 'PATCH', {
                                                        description: value,
                                                    });
                                            }}
                                        >
                                            Edit description
                                        </button>
                                    </div>
                                )}
                                {chat.type === 'normal' && (
                                    <div className="mt-3 text-sm">
                                        {chat.members.map((m) => (
                                            <span
                                                key={m.user_id}
                                                className="mr-3 inline-block"
                                            >
                                                {m.name} ({m.role}){' '}
                                                {chat.can_manage &&
                                                    m.role !== 'owner' && (
                                                        <button
                                                            disabled={busy}
                                                            className="underline"
                                                            onClick={() =>
                                                                void manage(
                                                                    `/members/${m.user_id}`,
                                                                    'DELETE',
                                                                )
                                                            }
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                            </span>
                                        ))}
                                        {chat.can_manage && (
                                            <div className="mt-2">
                                                <select
                                                    aria-label="Add member"
                                                    className={control}
                                                    value={newMember}
                                                    onChange={(e) =>
                                                        setNewMember(
                                                            e.target.value,
                                                        )
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
                                                <button
                                                    disabled={
                                                        busy || !newMember
                                                    }
                                                    className={control}
                                                    onClick={() =>
                                                        void manage(
                                                            '/members',
                                                            'POST',
                                                            {
                                                                user_id:
                                                                    newMember,
                                                            },
                                                        )
                                                    }
                                                >
                                                    Add member
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                className="flex max-h-[60vh] flex-1 flex-col gap-3 overflow-y-auto p-4"
                            >
                                {before && (
                                    <button
                                        disabled={olderLoading}
                                        onClick={older}
                                    >
                                        {olderLoading
                                            ? 'Loading…'
                                            : 'Load older messages'}
                                    </button>
                                )}
                                {loading && <p>Loading conversation…</p>}
                                {!loading && !messages.length && (
                                    <p>No messages yet.</p>
                                )}
                                {messages.map((m) => (
                                    <article
                                        key={m.message_id}
                                        className={`max-w-[90%] rounded-lg p-3 ${m.user_id === userId ? 'self-end bg-muted' : 'self-start border'}`}
                                    >
                                        <p className="text-xs text-muted-foreground">
                                            {m.sender_name} ·{' '}
                                            {new Date(
                                                m.created_at,
                                            ).toLocaleString()}
                                        </p>
                                        <p className="whitespace-pre-wrap break-words">
                                            {m.body}
                                        </p>
                                        {m.attachments.map((a) => (
                                            <button
                                                key={a.attachment_id}
                                                className="mt-2 block underline"
                                                onClick={() =>
                                                    void action(async () => {
                                                        const result =
                                                            await conversationRequest<{
                                                                url: string;
                                                            }>(
                                                                token,
                                                                `/${chatId}/attachments/${a.attachment_id}/download`,
                                                            );
                                                        window.open(
                                                            result.data.url,
                                                            '_blank',
                                                            'noopener,noreferrer',
                                                        );
                                                    })
                                                }
                                            >
                                                📎 {a.filename || 'Attachment'}
                                            </button>
                                        ))}
                                    </article>
                                ))}
                            </div>
                            <form
                                className="space-y-2 border-t p-4"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void send();
                                }}
                            >
                                <textarea
                                    aria-label="Message"
                                    disabled={busy || chat.status !== 'active'}
                                    className={`${control} w-full`}
                                    maxLength={10000}
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
                                <input
                                    ref={uploads}
                                    aria-label="Attachments"
                                    type="file"
                                    multiple
                                    disabled={busy || chat.status !== 'active'}
                                    onChange={(e) => {
                                        const next = Array.from(
                                            e.target.files ?? [],
                                        );
                                        if (
                                            next.length > 5 ||
                                            next.some(
                                                (f) =>
                                                    f.size > 20 * 1024 * 1024,
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
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Up to five attachments, 20 MB each.
                                </p>
                                <button
                                    className={control}
                                    disabled={
                                        busy ||
                                        chat.status !== 'active' ||
                                        (!body.trim() && !files.length)
                                    }
                                >
                                    {busy
                                        ? 'Sending…'
                                        : retry.current
                                          ? 'Retry send'
                                          : 'Send'}
                                </button>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
