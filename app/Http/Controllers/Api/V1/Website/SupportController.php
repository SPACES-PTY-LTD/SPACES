<?php

namespace App\Http\Controllers\Api\V1\Website;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Website\Attachment;
use App\Models\Website\Reply;
use App\Models\Website\Setting;
use App\Models\Website\Ticket;
use App\Services\Website\MailService;
use App\Support\MerchantAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SupportController extends Controller
{
    private function authorizeTicket(Request $r, Ticket $ticket): void
    {
        abort_unless(MerchantAccess::hasMerchantAccess($r->user(), Merchant::findOrFail($ticket->merchant_id)), 403);
    }

    public function index(Request $r)
    {
        $query = Ticket::query();
        if ($r->user()->role !== 'super_admin') {
            $merchant = Merchant::where('uuid', $r->input('merchant_id'))->firstOrFail();
            abort_unless(MerchantAccess::hasMerchantAccess($r->user(), $merchant), 403);
            $query->where('merchant_id', $merchant->id);
        }

        return response()->json(['data' => $query->latest('updated_at')->paginate(50)]);
    }

    public function show(Request $r, Ticket $ticket)
    {
        $this->authorizeTicket($r, $ticket);
        $replies = Reply::where('ticket_id', $ticket->id)->oldest()->get()->map(function ($reply) {
            return array_merge($reply->only(['id', 'body', 'created_at']), [
                'author' => User::find($reply->user_id)?->name ?? 'Former user',
                'attachments' => Attachment::where('reply_id', $reply->id)->get(['id', 'name', 'mime']),
            ]);
        });

        return response()->json(['data' => ['ticket' => $ticket, 'replies' => $replies]]);
    }

    public function store(Request $r)
    {
        $data = $r->validate(['merchant_id' => 'required|uuid', 'subject' => 'required|string|max:180', 'category' => 'required|string|max:80']);
        $this->validateReply($r);
        $merchant = Merchant::where('uuid', $data['merchant_id'])->firstOrFail();
        abort_unless(MerchantAccess::hasMerchantAccess($r->user(), $merchant), 403);
        $ticket = DB::transaction(function () use ($r, $data, $merchant) {
            $ticket = Ticket::create(['merchant_id' => $merchant->id, 'created_by' => $r->user()->id, 'subject' => $data['subject'], 'category' => $data['category']]);
            $this->addReply($r, $ticket);

            return $ticket;
        });

        return response()->json(['data' => $ticket], 201);
    }

    private function validateReply(Request $r): array
    {
        return $r->validate(['body' => 'required|string|max:20000', 'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'required|file|mimes:pdf,jpg,jpeg,png|mimetypes:application/pdf,image/jpeg,image/png|max:10240']);
    }

    public function reply(Request $r, Ticket $ticket)
    {
        $this->authorizeTicket($r, $ticket);
        $this->validateReply($r);
        DB::transaction(fn () => $this->addReply($r, $ticket));

        return $this->show($r, $ticket->fresh());
    }

    private function addReply(Request $r, Ticket $ticket): void
    {
        $reply = Reply::create(['ticket_id' => $ticket->id, 'user_id' => $r->user()->id, 'body' => $r->input('body')]);
        $paths = [];
        try {
            foreach ($r->file('attachments', []) as $file) {
                $disk = config('website.support_disk');
                $path = $file->store('support', ['disk' => $disk, 'visibility' => 'private']);
                if (! $path) {
                    throw new \RuntimeException('Unable to store attachment.');
                }
                $paths[] = $path;
                Attachment::create(['reply_id' => $reply->id, 'path' => $path, 'disk' => $disk, 'name' => basename($file->getClientOriginalName()), 'mime' => $file->getMimeType()]);
            }
            $ticket->update(['status' => $r->user()->role === 'super_admin' ? 'awaiting_customer' : 'open']);
            $this->notify($ticket);
        } catch (\Throwable $e) {
            Storage::disk(config('website.support_disk'))->delete($paths);
            throw $e;
        }
    }

    private function notify(Ticket $ticket): void
    {
        $ids = Reply::where('ticket_id', $ticket->id)->pluck('user_id')->push($ticket->created_by)->push($ticket->assigned_to)->filter()->unique();
        $merchant = Merchant::findOrFail($ticket->merchant_id);
        $emails = User::whereIn('id', $ids)->get()->filter(fn ($u) => in_array($u->role, ['user', 'super_admin']) && MerchantAccess::hasMerchantAccess($u, $merchant))->pluck('email');
        $support = Setting::findOrFail(1)->data['support_email'] ?? null;
        if ($support) {
            $emails->push($support);
        }
        $url = rtrim(config('website.admin_url'), '/').'/admin/support?ticket='.$ticket->id;
        foreach ($emails->unique() as $email) {
            app(MailService::class)->queue($email, 'Support request updated', "Your support request has an update. Sign in to read it:\n{$url}");
        }
    }

    public function update(Request $r, Ticket $ticket)
    {
        $this->authorizeTicket($r, $ticket);
        $rules = ['status' => ['sometimes', Rule::in($r->user()->role === 'super_admin' ? ['open', 'awaiting_customer', 'resolved'] : ['resolved'])]];
        if ($r->user()->role === 'super_admin') {
            $rules['assigned_to'] = ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'super_admin')];
        } else {
            abort_if($r->has('assigned_to'), 403);
        }
        $data = $r->validate($rules);
        DB::transaction(function () use ($ticket, $data) {
            $ticket->update($data);
            $this->notify($ticket);
        });

        return response()->json(['data' => $ticket]);
    }

    public function download(Request $r, Attachment $attachment)
    {
        $reply = Reply::findOrFail($attachment->reply_id);
        $this->authorizeTicket($r, Ticket::findOrFail($reply->ticket_id));
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->name, ['Content-Type' => $attachment->mime, 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
    }
}
