<p>Hello,</p>
<p>You have been invited to join <strong>{{ $invite->merchant->name }}</strong>.</p>
<p>Invited by: {{ $invite->invitedBy->name ?? 'System' }}</p>
<p>Role granted: {{ $invite->role }}</p>
<p>Invite expires: {{ optional($invite->expires_at)->toDayDateTimeString() }}</p>
<p>Accept invite: <a href="{{ $acceptUrl }}">{{ $acceptUrl }}</a></p>
