<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ConversationService
{
    public function staff(User $user, Merchant $merchant): bool
    {
        return $user->role !== 'driver' && (MerchantAccess::isSuperAdmin($user) ||
            ((int) $user->account_id === (int) $merchant->account_id && MerchantAccess::canCreateOrUpdateResources($user, $merchant)));
    }

    public function merchant(User $user, ?string $uuid): Merchant
    {
        if ($user->role === 'driver') {
            $driver = $user->driver;
            abort_unless($driver && $driver->merchant_id && (int) $driver->account_id === (int) $user->account_id, 403, 'Driver merchant not found.');
            $merchant = Merchant::findOrFail($driver->merchant_id);
            abort_if($uuid && $uuid !== $merchant->uuid, 403);
        } else {
            if (! $uuid) {
                throw ValidationException::withMessages(['merchant_id' => 'Select a merchant.']);
            }
            $merchant = Merchant::where('uuid', $uuid)->firstOrFail();
            abort_unless(MerchantAccess::hasMerchantAccess($user, $merchant) &&
                (MerchantAccess::isSuperAdmin($user) || (int) $user->account_id === (int) $merchant->account_id), 403);
        }

        return $merchant;
    }

    public function canAccess(User $user, Conversation $conversation): bool
    {
        if (! $conversation->merchant || (int) $conversation->merchant->account_id !== (int) $conversation->account_id) {
            return false;
        }
        if (! MerchantAccess::isSuperAdmin($user) && (int) $user->account_id !== (int) $conversation->account_id) {
            return false;
        }
        if ($conversation->type === 'driver') {
            $driver = $conversation->driver;
            if (! $driver || (int) $driver->merchant_id !== (int) $conversation->merchant_id || (int) $driver->account_id !== (int) $conversation->account_id) {
                return false;
            }

            return ($user->role === 'driver' && (int) $driver->user_id === (int) $user->id) || $this->staff($user, $conversation->merchant);
        }

        return MerchantAccess::hasMerchantAccess($user, $conversation->merchant) && $conversation->members()
            ->where('user_id', $user->id)->where('state', 'active')->exists();
    }

    public function resolve(User $user, string $uuid): Conversation
    {
        $conversation = Conversation::with(['merchant', 'driver'])->where('uuid', $uuid)->firstOrFail();
        abort_unless($this->canAccess($user, $conversation), 403);

        return $conversation;
    }

    public function owner(User $user, Conversation $conversation): bool
    {
        return $conversation->members()->where('user_id', $user->id)->where('state', 'active')->where('role', 'owner')->exists();
    }

    public function driverChat(User $user, Merchant $merchant, ?string $driverUuid): Conversation
    {
        $driver = $user->role === 'driver' ? $user->driver : Driver::where('uuid', $driverUuid)->firstOrFail();
        abort_unless($driver && (int) $driver->merchant_id === (int) $merchant->id && (int) $driver->account_id === (int) $merchant->account_id, 403);
        abort_unless($user->role === 'driver' || $this->staff($user, $merchant), 403);

        // Lock the existing parent row so even first-time concurrent opens serialize.
        return DB::transaction(function () use ($driver, $merchant) {
            Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
            $identity = [
                'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
                'type' => 'driver', 'type_entry_id' => $driver->id,
            ];
            // A current locking read also sees the winner under an outer MySQL REPEATABLE READ transaction.
            $conversation = Conversation::withTrashed()->where($identity)->lockForUpdate()->first();
            if (! $conversation) {
                $conversation = Conversation::create($identity + ['title' => $driver->user?->name ?? 'Driver chat']);
            }
            abort_if($conversation->trashed(), 410, 'Conversation was deleted.');

            return $conversation;
        });
    }

    public function memberUser(Merchant $merchant, string $uuid): User
    {
        $user = User::where('uuid', $uuid)->firstOrFail();
        abort_unless((int) $user->account_id === (int) $merchant->account_id && MerchantAccess::hasMerchantAccess($user, $merchant), 422, 'Member must belong to this merchant.');

        return $user;
    }

    public function addMember(Conversation $conversation, User $user, string $role = 'member'): ConversationMember
    {
        $member = ConversationMember::withTrashed()->firstOrNew(['conversation_id' => $conversation->id, 'user_id' => $user->id]);
        $member->fill(['account_id' => $conversation->account_id, 'merchant_id' => $conversation->merchant_id,
            'role' => $role, 'state' => 'active', 'last_read_at' => null]);
        $member->deleted_at = null;
        $member->save();

        return $member;
    }
}
