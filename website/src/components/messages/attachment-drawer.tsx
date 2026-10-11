'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { conversationRequest, type ChatAttachment } from '@/lib/api/conversations';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

export type AttachmentSelection = { attachment: ChatAttachment; images: ChatAttachment[] };

function FilePreview({ attachment, token, conversationId }: {
    attachment: ChatAttachment; token: string; conversationId: string;
}) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [imageFailed, setImageFailed] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void conversationRequest<{ url: string }>(token,
            `/${conversationId}/attachments/${attachment.attachment_id}/download`,
        ).then((result) => {
            if (!cancelled) setUrl(result.data.url);
        }, (reason) => {
            if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load attachment.');
        });
        return () => { cancelled = true; };
    }, [token, conversationId, attachment.attachment_id]);

    if (error) return <p role="alert" className="p-6 text-destructive">{error}</p>;
    if (!url) return <p role="status" className="p-6 text-muted-foreground">Loading attachment…</p>;
    const image = attachment.mime_type?.startsWith('image/');
    const pdf = attachment.mime_type === 'application/pdf' || attachment.filename?.toLowerCase().endsWith('.pdf');
    return <>
        <div className="min-h-0 flex-1 overflow-auto">
            {image && !imageFailed ? (
                <div className="flex h-full items-center justify-center p-4">
                    {/* Signed URLs load directly without a public image proxy. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={attachment.filename || 'Image attachment'} className="max-h-full max-w-full object-contain" onError={() => setImageFailed(true)} />
                </div>
            ) : pdf ? (
                <iframe title={attachment.filename || 'PDF attachment'} src={url} className="h-full min-h-80 w-full border-0" />
            ) : <p className="p-6 text-muted-foreground">{imageFailed ? 'This image cannot be previewed.' : 'Preview is not available for this file.'} You can download it below.</p>}
        </div>
        <div className="shrink-0 border-t p-4">
            <Button variant="outline" asChild><a href={url} download={attachment.filename || undefined}><Download className="size-4" />Download</a></Button>
        </div>
    </>;
}

export function AttachmentDrawer({ selection, token, conversationId, onClose }: {
    selection: AttachmentSelection; token: string; conversationId: string; onClose: () => void;
}) {
    const imageIndex = selection.images.findIndex((a) => a.attachment_id === selection.attachment.attachment_id);
    const [index, setIndex] = useState(Math.max(0, imageIndex));
    const attachment = imageIndex >= 0 ? selection.images[index] : selection.attachment;
    const reference = attachment.reference;
    const gallery = imageIndex >= 0 && selection.images.length > 1;

    return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent className="h-dvh w-full gap-0 sm:max-w-5xl">
            <SheetHeader className="shrink-0 border-b pr-12">
                <SheetTitle className="break-words">{reference ? `${reference.type === 'run' ? 'Run' : 'Shipment'} · ${reference.label || attachment.filename || reference.id}` : attachment.filename || 'Attachment'}</SheetTitle>
                <SheetDescription>{reference ? 'Record details' : imageIndex >= 0 ? `Image ${index + 1} of ${selection.images.length}` : 'Attachment preview'}</SheetDescription>
            </SheetHeader>
            {gallery && <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
                <Button variant="outline" size="icon" aria-label="Previous image" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft className="size-4" /></Button>
                <span className="text-sm text-muted-foreground">{index + 1} / {selection.images.length}</span>
                <Button variant="outline" size="icon" aria-label="Next image" disabled={index === selection.images.length - 1} onClick={() => setIndex(index + 1)}><ChevronRight className="size-4" /></Button>
            </div>}
            {reference ? <iframe title={`${reference.type} details`} src={`/admin/messages/attachments/${reference.type}/${encodeURIComponent(reference.id)}`} className="min-h-0 w-full flex-1 border-0" /> : <FilePreview key={attachment.attachment_id} attachment={attachment} token={token} conversationId={conversationId} />}
        </SheetContent>
    </Sheet>;
}
