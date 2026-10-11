'use client';

import { useEffect, useState } from 'react';
import { conversationRequest, type ChatAttachment } from '@/lib/api/conversations';

export function MessageImagePreview({
    token,
    conversationId,
    attachment,
    onOpen,
}: {
    token: string;
    conversationId: string;
    attachment: ChatAttachment;
    onOpen: () => void;
}) {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void conversationRequest<{ url: string }>(
            token,
            `/${conversationId}/attachments/${attachment.attachment_id}/download`,
        ).then(
            (result) => {
                if (!cancelled) setUrl(result.data.url);
            },
            () => {
                if (!cancelled) setFailed(true);
            },
        );
        return () => { cancelled = true; };
    }, [token, conversationId, attachment.attachment_id]);

    if (failed) return null;

    return (
        <button type="button" onClick={onOpen} aria-label={`Preview ${attachment.filename || 'image'}`} className="relative mt-2 block overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {!loaded && (
                <div
                    role="status"
                    aria-label="Loading image preview"
                    className="h-40 w-60 max-w-full animate-pulse bg-current/10 motion-reduce:animate-none"
                />
            )}
            {url && (
                // Signed, private URLs must load directly without Next's public image proxy.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={url}
                    alt={attachment.filename || 'Image attachment'}
                    className={`max-h-72 max-w-full rounded-lg object-contain ${loaded ? 'block' : 'absolute inset-0 opacity-0'}`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                />
            )}
        </button>
    );
}
