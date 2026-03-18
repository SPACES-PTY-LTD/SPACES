<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\MerchantInvite;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class MerchantUserService
{
    public function __construct(
        private readonly InviteService $inviteService,
        private readonly MerchantService $merchantService,
    ) {
    }

    public function listPeople(Merchant $merchant, int $perPage = 15): LengthAwarePaginator
    {
        $page = Paginator::resolveCurrentPage();
        $perPage = min($perPage, 100);

        $members = $this->memberCollection($merchant);
        $invites = MerchantInvite::query()
            ->with('invitedBy')
            ->where('merchant_id', $merchant->id)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->get()
            ->each(fn (MerchantInvite $invite) => $invite->setRelation('merchant', $merchant));

        $people = $members
            ->concat($invites)
            ->sortByDesc(function ($person) {
                return optional($person->created_at)->timestamp ?? 0;
            })
            ->values();

        return $this->paginateCollection($people, $perPage, $page);
    }

    public function getPerson(Merchant $merchant, string $personUuid): User|MerchantInvite
    {
        $member = $this->memberCollection($merchant)->first(fn (User $user) => $user->uuid === $personUuid);
        if ($member) {
            $member->loadMissing('merchants');
            return $member;
        }

        return MerchantInvite::query()
            ->with('invitedBy')
            ->where('merchant_id', $merchant->id)
            ->where('uuid', $personUuid)
            ->firstOrFail();
    }

    public function invite(Merchant $merchant, User $inviter, array $data): MerchantInvite
    {
        return $this->inviteService->createInvite($merchant, $inviter, $data);
    }

    public function updatePerson(Merchant $merchant, User $actor, string $personUuid, array $data): User|MerchantInvite
    {
        $person = $this->getPerson($merchant, $personUuid);

        if ($person instanceof MerchantInvite) {
            if (array_key_exists('role', $data) && $data['role']) {
                $person->role = $data['role'];
                $person->save();
            }

            return $person->fresh(['invitedBy']);
        }

        if (array_key_exists('role', $data) && $data['role']) {
            if ((int) $actor->id === (int) $person->id) {
                throw ValidationException::withMessages([
                    'role' => ['SELF_ROLE_UPDATE_NOT_ALLOWED'],
                ]);
            }

            if (MerchantAccess::isAccountHolder($person, $merchant)) {
                throw ValidationException::withMessages([
                    'role' => ['ACCOUNT_HOLDER_ROLE_LOCKED'],
                ]);
            }

            $this->merchantService->updateMemberRole($merchant, $person, $data['role']);
        }

        if (array_key_exists('name', $data)) {
            $person->name = $data['name'];
        }

        if (array_key_exists('telephone', $data)) {
            $person->telephone = $data['telephone'];
        }

        if (array_key_exists('name', $data) || array_key_exists('telephone', $data)) {
            $person->save();
        }

        return $person->fresh(['merchants']);
    }

    public function deletePerson(Merchant $merchant, string $personUuid): void
    {
        $person = $this->getPerson($merchant, $personUuid);

        if ($person instanceof MerchantInvite) {
            $this->inviteService->revokeInvite($person);
            return;
        }

        $this->merchantService->removeMember($merchant, $person);
    }

    public function resendInvite(Merchant $merchant, string $personUuid): MerchantInvite
    {
        $invite = MerchantInvite::query()
            ->where('merchant_id', $merchant->id)
            ->where('uuid', $personUuid)
            ->firstOrFail();

        $this->inviteService->resendInvite($invite);

        return $invite->fresh(['invitedBy']);
    }

    private function memberCollection(Merchant $merchant): Collection
    {
        return $this->merchantService->listMembers($merchant, 1000)
            ->getCollection()
            ->map(function (User $user) use ($merchant) {
                $user->setRelation('merchant', $merchant);
                return $user;
            });
    }

    private function paginateCollection(Collection $items, int $perPage, int $page): LengthAwarePaginator
    {
        $total = $items->count();
        $results = $items->slice(($page - 1) * $perPage, $perPage)->values();

        return new Paginator(
            $results,
            $total,
            $perPage,
            $page,
            ['path' => Paginator::resolveCurrentPath()]
        );
    }
}
