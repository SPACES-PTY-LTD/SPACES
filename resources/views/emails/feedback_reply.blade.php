<!doctype html>
<html lang="en">
<body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <p>Hello {{ $recipient->name }},</p>
    <p>{{ $message->sender?->name ?? 'A user' }} replied to a {{ str_replace('_', ' ', $feedback->category) }} feedback thread.</p>
    <blockquote style="border-left: 3px solid #111827; margin: 16px 0; padding-left: 16px;">
        {{ $message->body }}
    </blockquote>
    <p><a href="{{ $threadUrl }}">Open the feedback conversation</a></p>
</body>
</html>
