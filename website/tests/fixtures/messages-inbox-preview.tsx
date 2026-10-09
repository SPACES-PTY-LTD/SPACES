'use client';

// Local verification only. Mounted by a temporary route, never by /admin/messages.
import { useEffect, useState } from 'react';
import { MessagesInbox } from '@/components/messages/messages-inbox';
import type { Conversation, ChatMessage } from '@/lib/api/conversations';

export default function MessagesPreview() {
    const [ready, setReady] = useState(false);
    const [readonly, setReadonly] = useState(false);
    useEffect(() => {
        const original = window.fetch;
        let failSend = true;
        const groupMembers = [
            {
                user_id: 'staff',
                name: 'Operations administrator',
                role: 'owner' as const,
                state: 'active',
                last_read_at: null,
            },
            {
                user_id: 'member',
                name: 'Warehouse team member',
                role: 'member' as const,
                state: 'active',
                last_read_at: null,
            },
        ];
        const conversations: Conversation[] = [
            {
                conversation_id: 'alex',
                merchant_id: 'isando',
                type: 'driver',
                driver_id: 'driver',
                title: 'Alex Mokoena',
                description: 'Driver communication',
                status: 'active',
                can_manage: !readonly,
                members: [],
                latest_message: null,
                updated_at: '2026-10-09T10:42:00+02:00',
            },
            {
                conversation_id: 'team',
                merchant_id: 'isando',
                type: 'normal',
                driver_id: null,
                title: 'Dispatch team',
                description: 'Daily handover',
                status: 'active',
                can_manage: !readonly,
                members: groupMembers,
                latest_message: null,
            },
            ...Array.from(
                { length: 21 },
                (_, i): Conversation => ({
                    conversation_id: `driver-${i}`,
                    merchant_id: 'isando',
                    type: 'driver',
                    driver_id: String(i),
                    title: `Driver ${i + 1}`,
                    description: null,
                    status: i === 0 ? 'closed' : 'active',
                    can_manage: !readonly,
                    members: [],
                    latest_message: null,
                }),
            ),
        ];
        const messages: Record<string, ChatMessage[]> = {
            alex: [
                {
                    message_id: 'out',
                    user_id: 'staff',
                    sender_name: 'Operations administrator',
                    body: 'Good morning. Could you share the updated documents?',
                    created_at: '2026-10-09T10:36:00+02:00',
                    attachments: [],
                },
                {
                    message_id: 'in',
                    user_id: 'driver',
                    sender_name: 'Alex Mokoena',
                    body: 'Morning! The documents are ready. I have attached the file below.',
                    created_at: '2026-10-09T10:42:00+02:00',
                    attachments: [
                        {
                            attachment_id: 'file',
                            filename: 'document.pdf',
                            mime_type: 'application/pdf',
                            size: 245760,
                        },
                    ],
                },
            ],
        };
        conversations[0].latest_message = messages.alex[1];
        const sent = new Map<string, ChatMessage>();
        const response = (data: unknown, meta = {}, status = 200) =>
            new Response(JSON.stringify({ data, meta }), {
                status,
                headers: { 'Content-Type': 'application/json' },
            });
        window.fetch = async (input, init) => {
            const url = new URL(String(input), location.origin);
            if (!url.pathname.startsWith('/api/v1/'))
                return original(input, init);
            const method = init?.method || 'GET';
            if (url.pathname.endsWith('/drivers'))
                return response([
                    { driver_id: 'driver', name: 'Alex Mokoena' },
                ]);
            if (url.pathname.endsWith('/participants'))
                return response([
                    { user_id: 'staff', name: 'Operations administrator' },
                    { user_id: 'member', name: 'Warehouse team member' },
                    { user_id: 'new-member', name: 'New team member' },
                ]);
            if (url.pathname.endsWith('/conversations/driver'))
                return response(conversations[0]);
            if (url.pathname.endsWith('/conversations') && method === 'POST') {
                const body = JSON.parse(String(init?.body));
                const c = {
                    ...conversations[1],
                    conversation_id: `new-${conversations.length}`,
                    title: body.title,
                };
                conversations.unshift(c);
                return response(c, {}, 201);
            }
            if (url.pathname.endsWith('/conversations')) {
                const search = (
                    url.searchParams.get('search') || ''
                ).toLowerCase();
                if (search === 'slow')
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                const filtered =
                    url.searchParams.get('merchant_id') === 'empty'
                        ? []
                        : conversations.filter(
                              (c) =>
                                  (!search ||
                                      `${c.title} ${c.description}`
                                          .toLowerCase()
                                          .includes(search)) &&
                                  (!url.searchParams.get('type') ||
                                      c.type === url.searchParams.get('type')),
                          );
                const page = Number(url.searchParams.get('page') || 1);
                return response(filtered.slice((page - 1) * 20, page * 20), {
                    last_page: Math.max(1, Math.ceil(filtered.length / 20)),
                    total: filtered.length,
                });
            }
            const id = url.pathname.split('/')[4];
            const c = conversations.find((c) => c.conversation_id === id)!;
            if (url.pathname.endsWith('/read')) return response({});
            if (url.pathname.endsWith('/download'))
                return response({ url: 'about:blank' });
            if (url.pathname.endsWith('/messages')) {
                if (method === 'POST') {
                    if (failSend) {
                        failSend = false;
                        return new Response(
                            JSON.stringify({
                                message:
                                    'Simulated send failure. Retry your message.',
                            }),
                            { status: 500 },
                        );
                    }
                    const form = init?.body as FormData;
                    const temporaryId = String(form.get('temporary_id'));
                    if (sent.has(temporaryId))
                        return response(sent.get(temporaryId));
                    const m: ChatMessage = {
                        message_id: temporaryId,
                        user_id: 'staff',
                        sender_name: 'Operations administrator',
                        body: String(form.get('body')),
                        created_at: new Date().toISOString(),
                        attachments: form
                            .getAll('attachments[]')
                            .map((file, i) => ({
                                attachment_id: `upload-${i}`,
                                filename: (file as File).name,
                                mime_type: (file as File).type,
                                size: (file as File).size,
                            })),
                    };
                    sent.set(temporaryId, m);
                    (messages[id] ??= []).push(m);
                    c.latest_message = m;
                    return response(m, {}, 201);
                }
                if (url.searchParams.has('before'))
                    return response([
                        {
                            message_id: 'older',
                            user_id: 'driver',
                            sender_name: 'Alex Mokoena',
                            body: 'Previous message from yesterday.',
                            created_at: '2026-10-08T10:00:00+02:00',
                            attachments: [],
                        },
                    ]);
                return response(messages[id] || [], {
                    next_before: id === 'alex' ? 'older' : null,
                });
            }
            if (method === 'PATCH')
                Object.assign(c, JSON.parse(String(init?.body)));
            if (url.pathname.includes('/members')) {
                if (method === 'DELETE')
                    c.members = c.members.filter(
                        (m) => m.user_id !== url.pathname.split('/').at(-1),
                    );
                else
                    c.members.push({
                        user_id: 'new-member',
                        name: 'New team member',
                        role: 'member',
                        state: 'active',
                        last_read_at: null,
                    });
            }
            return response(c);
        };
        setReady(true);
        return () => {
            window.fetch = original;
        };
    }, [readonly]);
    return (
        <main className="mx-auto max-w-[1440px] bg-muted/40 p-6">
            <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                    LOCAL TEST FIXTURE · Synthetic data · No live API mutations
                </span>
                <button
                    className="underline"
                    onClick={() => setReadonly((v) => !v)}
                >
                    {readonly ? 'Enable management' : 'Read-only mode'}
                </button>
            </div>
            {ready && (
                <MessagesInbox
                    key={String(readonly)}
                    token="local-test"
                    userId="staff"
                    merchants={[
                        {
                            id: 'isando',
                            name: 'Isando test workspace',
                            canManage: !readonly,
                        },
                        {
                            id: 'empty',
                            name: 'Empty test workspace',
                            canManage: !readonly,
                        },
                    ]}
                    initialMerchant="isando"
                />
            )}
        </main>
    );
}
