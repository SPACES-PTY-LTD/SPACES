import { apiFetch, isApiErrorResponse } from '@/lib/api/client';

export type ChatMember = {
    user_id: string;
    name: string;
    role: 'owner' | 'member';
    state: string;
    last_read_at: string | null;
};
export type ChatAttachment = {
    attachment_id: string;
    filename: string | null;
    mime_type: string | null;
    size: number | null;
};
export type ChatMessage = {
    message_id: string;
    user_id: string | null;
    sender_name: string;
    body: string | null;
    created_at: string;
    attachments: ChatAttachment[];
};
export type Conversation = {
    conversation_id: string;
    merchant_id: string;
    type: 'driver' | 'normal';
    driver_id: string | null;
    title: string | null;
    description: string | null;
    status: 'active' | 'closed';
    can_manage: boolean;
    members: ChatMember[];
    latest_message: ChatMessage | null;
};
export type ChatResult<T> = {
    data: T;
    meta: {
        next_before?: string | null;
        current_page?: number;
        last_page?: number;
        total?: number;
    };
};
export async function conversationRequest<T>(
    token: string,
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
): Promise<ChatResult<T>> {
    const result = await apiFetch<ChatResult<T>>(
        `/api/v1/conversations${path}`,
        { token, method, body },
    );
    if (isApiErrorResponse(result)) throw new Error(result.message);
    return result;
}
