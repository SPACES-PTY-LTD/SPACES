"use client";
import { useCallback, useEffect, useState } from "react";
import { websiteRequest } from "@/lib/website/request";
import { apiFetch, isApiErrorResponse } from "@/lib/api/client";
import "./workspace.css";
type Ticket = {
    id: string;
    subject: string;
    category: string;
    status: string;
    assigned_to: number | null;
    merchant_id: number;
};
type Detail = {
    ticket: Ticket;
    replies: {
        id: string;
        body: string;
        author: string;
        created_at: string;
        attachments: { id: string; name: string }[];
    }[];
};
export function SupportManager({
    token,
    merchantId,
    superAdmin,
}: {
    token: string;
    merchantId?: string;
    superAdmin: boolean;
}) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [detail, setDetail] = useState<Detail | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
    const [merchants, setMerchants] = useState<
        { merchant_id: string; name: string }[]
    >([]);
    const [merchantSearch, setMerchantSearch] = useState("");
    async function findMerchants(search: string) {
        try {
            setMerchants(
                await websiteRequest<{ merchant_id: string; name: string }[]>(
                    `merchants?per_page=100&search=${encodeURIComponent(search)}`,
                    token,
                ),
            );
        } catch (e) {
            setError(String(e));
        }
    }
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const load = useCallback(async () => {
        if (!superAdmin && !merchantId) return;
        try {
            const result = await websiteRequest<{
                data: Ticket[];
                last_page: number;
            }>(
                `support/tickets?page=${page}${merchantId ? `&merchant_id=${encodeURIComponent(merchantId)}` : ""}`,
                token,
            );
            setTickets(result.data);
            setLastPage(result.last_page);
        } catch (e) {
            setError(String(e));
        }
    }, [token, merchantId, superAdmin, page]);
    const open = useCallback(
        async (id: string) => {
            setError("");
            try {
                setDetail(
                    await websiteRequest<Detail>(
                        `support/tickets/${id}`,
                        token,
                    ),
                );
                setCreating(false);
            } catch (e) {
                setError(String(e));
            }
        },
        [token],
    );
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("ticket");
        if (id) void open(id);
        if (superAdmin)
            websiteRequest<{ staff: { id: number; name: string }[] }>(
                "website/admin",
                token,
            )
                .then((d) => setStaff(d.staff))
                .catch((e) => setError(String(e)));
    }, [token, superAdmin, open]);
    useEffect(() => {
        if (superAdmin)
            websiteRequest<{ merchant_id: string; name: string }[]>(
                "merchants?per_page=100",
                token,
            )
                .then(setMerchants)
                .catch((e) => setError(String(e)));
    }, [token, superAdmin]);
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);
        const files = body
            .getAll("attachments[]")
            .filter((f) => f instanceof File && f.size > 0) as File[];
        body.delete("attachments[]");
        files.forEach((f) => body.append("attachments[]", f));
        if (files.length > 5 || files.some((f) => f.size > 10 * 1024 * 1024)) {
            setError(
                "Use up to five PDF, JPEG or PNG files, no larger than 10 MB each.",
            );
            return;
        }
        if (creating && merchantId) body.set("merchant_id", merchantId);
        setBusy(true);
        setError("");
        try {
            if (creating) {
                const t = await websiteRequest<Ticket>(
                    "support/tickets",
                    token,
                    "POST",
                    body,
                );
                await open(t.id);
                setCreating(false);
            } else if (detail) {
                setDetail(
                    await websiteRequest<Detail>(
                        `support/tickets/${detail.ticket.id}/replies`,
                        token,
                        "POST",
                        body,
                    ),
                );
            }
            form.reset();
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to send.");
        } finally {
            setBusy(false);
        }
    }
    async function update(body: unknown) {
        if (!detail) return;
        setBusy(true);
        setError("");
        try {
            await websiteRequest(
                `support/tickets/${detail.ticket.id}`,
                token,
                "PATCH",
                body,
            );
            await open(detail.ticket.id);
            await load();
        } catch (e) {
            setError(String(e));
        } finally {
            setBusy(false);
        }
    }
    async function download(id: string, name: string) {
        try {
            const result = await apiFetch<Blob>(
                `/api/v1/support/attachments/${id}`,
                { token },
            );
            if (isApiErrorResponse(result)) throw new Error(result.message);
            const url = URL.createObjectURL(result);
            const link = document.createElement("a");
            link.href = url;
            link.download = name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            setError(String(e));
        }
    }
    if (!superAdmin && !merchantId)
        return (
            <div className="web-workspace">
                <h1>Support tickets</h1>
                <p>Select a merchant to view or create support requests.</p>
            </div>
        );
    return (
        <div className="web-workspace">
            <h1>Support tickets</h1>
            <p>
                Private support conversations for your merchant. Do not include
                passwords or API keys.
            </p>
            {error && (
                <p className="workspace-error" role="alert">
                    {error}
                </p>
            )}
            <div className="workspace-actions">
                <button
                    onClick={() => {
                        setCreating(true);
                        setDetail(null);
                    }}
                >
                    New ticket
                </button>
                <button onClick={() => void load()}>Refresh</button>
            </div>
            <div className="ticket-layout">
                <aside>
                    {tickets.map((t) => (
                        <button
                            className="workspace-row"
                            key={t.id}
                            onClick={() => void open(t.id)}
                        >
                            <strong>{t.subject}</strong>
                            <span>
                                {t.category} · {t.status.replaceAll("_", " ")}
                            </span>
                        </button>
                    ))}
                    {!tickets.length && <p>No tickets to display.</p>}
                    <div className="workspace-actions">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Previous
                        </button>
                        <span>
                            {page} / {lastPage}
                        </span>
                        <button
                            disabled={page >= lastPage}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                        </button>
                    </div>
                </aside>
                <section>
                    {detail && (
                        <>
                            <h2>{detail.ticket.subject}</h2>
                            <p>
                                {detail.ticket.category} ·{" "}
                                {detail.ticket.status.replaceAll("_", " ")}
                            </p>
                            {superAdmin ? (
                                <div className="workspace-grid">
                                    <label>
                                        Status
                                        <select
                                            disabled={busy}
                                            value={detail.ticket.status}
                                            onChange={(e) =>
                                                void update({
                                                    status: e.target.value,
                                                })
                                            }
                                        >
                                            {[
                                                "open",
                                                "awaiting_customer",
                                                "resolved",
                                            ].map((s) => (
                                                <option key={s}>{s}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Assigned staff
                                        <select
                                            disabled={busy}
                                            value={
                                                detail.ticket.assigned_to ?? ""
                                            }
                                            onChange={(e) =>
                                                void update({
                                                    assigned_to: e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                })
                                            }
                                        >
                                            <option value="">Unassigned</option>
                                            {staff.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            ) : (
                                <button
                                    disabled={
                                        busy ||
                                        detail.ticket.status === "resolved"
                                    }
                                    onClick={() =>
                                        void update({ status: "resolved" })
                                    }
                                >
                                    Mark resolved
                                </button>
                            )}
                            {detail.replies.map((r) => (
                                <article className="workspace-panel" key={r.id}>
                                    <strong>{r.author}</strong>
                                    <p>
                                        {new Date(
                                            r.created_at,
                                        ).toLocaleString()}
                                    </p>
                                    <p className="ticket-reply">{r.body}</p>
                                    {r.attachments.map((a) => (
                                        <button
                                            className="ticket-file"
                                            key={a.id}
                                            onClick={() =>
                                                void download(a.id, a.name)
                                            }
                                        >
                                            {a.name} ↓
                                        </button>
                                    ))}
                                </article>
                            ))}
                        </>
                    )}
                    {(creating || detail) && (
                        <form
                            key={creating ? "new" : detail?.ticket.id}
                            onSubmit={submit}
                        >
                            {creating && (
                                <>
                                    <h2>New support request</h2>
                                    {superAdmin && !merchantId && (
                                        <div>
                                            <label>
                                                Find merchant
                                                <input
                                                    value={merchantSearch}
                                                    onChange={(e) =>
                                                        setMerchantSearch(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void findMerchants(
                                                        merchantSearch,
                                                    )
                                                }
                                            >
                                                Search merchants
                                            </button>
                                            <label>
                                                Merchant
                                                <select
                                                    name="merchant_id"
                                                    required
                                                >
                                                    <option value="">
                                                        Select a merchant
                                                    </option>
                                                    {merchants.map((m) => (
                                                        <option
                                                            value={
                                                                m.merchant_id
                                                            }
                                                            key={m.merchant_id}
                                                        >
                                                            {m.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                    <label>
                                        Subject
                                        <input
                                            name="subject"
                                            maxLength={180}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Category
                                        <select name="category">
                                            {[
                                                "Getting started",
                                                "Administrators",
                                                "Dispatchers",
                                                "Drivers",
                                                "Billing",
                                                "Integrations",
                                            ].map((c) => (
                                                <option key={c}>{c}</option>
                                            ))}
                                        </select>
                                    </label>
                                </>
                            )}
                            <label>
                                {creating ? "Describe the issue" : "Your reply"}
                                <textarea
                                    name="body"
                                    required
                                    maxLength={20000}
                                    rows={5}
                                />
                            </label>
                            <label>
                                Attachments (up to five files, 10 MB each)
                                <input
                                    name="attachments[]"
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                            </label>
                            <button disabled={busy}>
                                {busy
                                    ? "Sending…"
                                    : creating
                                      ? "Create ticket"
                                      : "Send reply"}
                            </button>
                        </form>
                    )}
                    {!creating && !detail && (
                        <p>
                            Select a ticket to read the conversation, or create
                            a new request.
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
