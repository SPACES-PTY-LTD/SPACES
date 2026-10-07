import { requireRole } from '@/lib/auth';
import { apiFetch } from '@/lib/api/client';
import type { ApiListResponse, Merchant } from '@/lib/types';
import { isApiErrorResponse } from '@/lib/api/client';
import { MessagesInbox } from '@/components/messages/messages-inbox';

export default async function MessagesPage() {
    const session = await requireRole(['user', 'super_admin']);
    let merchants = session.merchants ?? [];
    if (session.user.role === 'super_admin') {
        merchants = [];
        for (let page = 1; ; page++) {
            const result = await apiFetch<ApiListResponse<Merchant>>(
                '/api/v1/admin/merchants',
                { token: session.accessToken, params: { page, per_page: 100 } },
            );
            if (isApiErrorResponse(result)) throw new Error(result.message);
            merchants.push(...result.data);
            if (page >= (result.meta?.last_page ?? 1)) break;
        }
    }
    return (
        <MessagesInbox
            token={session.accessToken}
            userId={session.user.uuid ?? ''}
            merchants={merchants.map((m) => ({
                id: m.merchant_id,
                name: m.name,
                canManage:
                    session.user.role === 'super_admin' ||
                    Boolean(m.access?.permissions.can_create_update_resources),
            }))}
            initialMerchant={session.selected_merchant?.merchant_id}
        />
    );
}
