import type { ChatAttachment, ChatMessage } from './api';

export function isChatImage(attachment: ChatAttachment): boolean {
    if (attachment.reference || attachment.type === 'run' || attachment.type === 'shipment') return false;
    const mime = attachment.mime_type?.toLowerCase();
    if (mime?.startsWith('image/')) return true;
    if (mime && mime !== 'application/octet-stream') return false;
    return /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(attachment.filename ?? '');
}

export function chatImages(messages: ChatMessage[]): ChatAttachment[] {
    return messages.flatMap(message => message.attachments.filter(isChatImage));
}

export function photoSwipeDirection(translation: number, velocity: number): number {
    'worklet';
    if (Math.abs(translation) < 50 && Math.abs(velocity) < 500) return 0;
    return (Math.abs(translation) >= 50 ? translation : velocity) < 0 ? 1 : -1;
}

export function photoPanOffset(value: number, size: number, scale: number): number {
    'worklet';
    const limit = size * (scale - 1) / 2;
    return Math.max(-limit, Math.min(limit, value));
}
