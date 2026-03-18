<?php

namespace App\Http\Resources;

use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MerchantPersonResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isMember = $this->resource instanceof User;
        $merchant = $this->resource->merchant ?? $this->additional['merchant'] ?? null;
        $effectiveRole = $isMember
            ? ($this->effective_role ?? MerchantAccess::normalizeRole($this->pivot->role ?? null))
            : MerchantAccess::normalizeRole($this->role);

        return [
            'person_id' => $isMember ? $this->uuid : $this->uuid,
            'kind' => $isMember ? 'member' : 'invite',
            'status' => $isMember
                ? 'active'
                : ($this->accepted_at ? 'accepted' : ($this->revoked_at ? 'revoked' : ($this->expires_at?->isPast() ? 'expired' : 'pending'))),
            'email' => $this->email,
            'name' => $isMember ? $this->name : null,
            'telephone' => $isMember ? $this->telephone : null,
            'role' => $effectiveRole,
            'merchant_id' => $merchant instanceof Merchant ? $merchant->uuid : null,
            'invited_by' => !$isMember && $this->relationLoaded('invitedBy') && $this->invitedBy
                ? [
                    'user_id' => $this->invitedBy->uuid,
                    'name' => $this->invitedBy->name,
                    'email' => $this->invitedBy->email,
                ]
                : null,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'expires_at' => optional($this->expires_at ?? null)?->toIso8601String(),
            'accepted_at' => optional($this->accepted_at ?? null)?->toIso8601String(),
            'can_resend' => !$isMember && !$this->accepted_at && !$this->revoked_at,
            'can_edit' => $effectiveRole !== MerchantAccess::ROLE_ACCOUNT_HOLDER
                && (!$isMember || (int) $request->user()?->id !== (int) $this->id),
            'can_edit_role' => $effectiveRole !== MerchantAccess::ROLE_ACCOUNT_HOLDER
                && (!$isMember || (int) $request->user()?->id !== (int) $this->id),
            'can_edit_profile' => $isMember,
            'can_delete' => $effectiveRole !== MerchantAccess::ROLE_ACCOUNT_HOLDER,
            'memberships' => $this->when(
                $isMember && $this->relationLoaded('merchants'),
                fn () => $this->merchants->map(fn (Merchant $membershipMerchant) => [
                    'merchant_id' => $membershipMerchant->uuid,
                    'name' => $membershipMerchant->name,
                    'role' => MerchantAccess::normalizeRole($membershipMerchant->pivot->role ?? null),
                ])->values()->all()
            ),
        ];
    }
}
