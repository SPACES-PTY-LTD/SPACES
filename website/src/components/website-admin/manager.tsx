"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentRecord, ContentData } from "@/lib/website/types";
import { websiteRequest } from "@/lib/website/request";
import "./workspace.css";
type Settings = {
    hours: Record<string, { from: string; to: string }>;
    blackouts: string[];
    sales_email?: string;
    support_email?: string;
    privacy_email?: string;
    security_email?: string;
    company_name?: string;
};
type Plan = {
    id: number;
    title: string;
    monthly_charge_zar: string;
    extra_vehicle_price_zar: string;
    vehicle_limit: number;
    public_vat_wording: string | null;
    public_order: number;
    approved: boolean;
    is_free: boolean;
    is_active: boolean;
};
type Booking = {
    id: string;
    starts_at: string;
    name: string;
    email: string;
    company: string;
    fleet_size: string;
    phone?: string;
    message?: string;
    meeting_url?: string;
    status: string;
};
type Data = {
    contents: ContentRecord[];
    settings: Settings;
    plans: Plan[];
    bookings: Booking[];
    mail: {
        id: string;
        recipient: string;
        subject: string;
        status: string;
        attempts: number;
        error?: string;
    }[];
};
const empty: ContentData = {
    title: "",
    description: "",
    body: "<p>Write your content here.</p>",
    author: "",
};
export function WebsiteManager({ token }: { token: string }) {
    const [data, setData] = useState<Data | null>(null);
    const [tab, setTab] = useState("Content");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [edit, setEdit] = useState<ContentRecord | null>(null);
    const [preview, setPreview] = useState(false);
    const load = useCallback(async () => {
        try {
            setData(await websiteRequest<Data>("website/admin", token));
        } catch (e) {
            setError(String(e));
        }
    }, [token]);
    useEffect(() => {
        void load();
    }, [load]);
    async function act(
        path: string,
        body: unknown,
        method: "POST" | "PATCH" = "POST",
    ) {
        setError("");
        setNotice("");
        setBusy(true);
        try {
            const result = await websiteRequest<ContentRecord>(
                `website/admin/${path}`,
                token,
                method,
                body,
            );
            await load();
            setNotice("Saved successfully.");
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save.");
            return null;
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="web-workspace">
            <header>
                <h1>Website</h1>
                <p>
                    Publish verified content, approve pricing and manage demo
                    appointments.
                </p>
            </header>
            <nav className="workspace-tabs" aria-label="Website management">
                {[
                    "Content",
                    "Pricing",
                    "Demo calendar",
                    "Settings",
                    "Email delivery",
                ].map((t) => (
                    <button
                        key={t}
                        aria-pressed={tab === t}
                        onClick={() => {
                            setTab(t);
                            setEdit(null);
                            setPreview(false);
                        }}
                    >
                        {t}
                    </button>
                ))}
            </nav>
            {error && (
                <p className="workspace-error" role="alert">
                    {error}
                </p>
            )}
            {notice && <p role="status">{notice}</p>}
            {!data && (
                <p>
                    Loading website settings…{" "}
                    <button onClick={() => void load()}>Retry</button>
                </p>
            )}
            {data && tab === "Content" && (
                <>
                    {!edit ? (
                        <>
                            <button
                                onClick={() =>
                                    setEdit({
                                        id: 0,
                                        kind: "page",
                                        slug: "",
                                        draft: { ...empty },
                                        published: null,
                                        published_at: null,
                                    })
                                }
                            >
                                New content
                            </button>
                            <div className="workspace-list">
                                {data.contents.map((c) => (
                                    <button
                                        className="workspace-row"
                                        key={c.id}
                                        onClick={() => {
                                            setEdit(c);
                                            setPreview(false);
                                        }}
                                    >
                                        <strong>{c.draft.title}</strong>
                                        <span>
                                            /{c.slug} · {c.kind} ·{" "}
                                            {c.published
                                                ? "Published · edits remain draft until published"
                                                : "Draft / unpublished"}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    setEdit(null);
                                    setPreview(false);
                                }}
                            >
                                ← All content
                            </button>
                            <ContentEditor
                                key={edit.id}
                                record={edit}
                                busy={busy}
                                onSave={async (draft, slug, kind) => {
                                    const result = await act("content", {
                                        ...(edit.id ? { id: edit.id } : {}),
                                        draft,
                                        slug,
                                        kind,
                                    });
                                    if (result) setEdit(result);
                                }}
                            />
                            {edit.id > 0 && (
                                <div className="workspace-actions">
                                    <button
                                        disabled={busy}
                                        onClick={() => setPreview(!preview)}
                                    >
                                        Preview saved draft
                                    </button>
                                    <button
                                        disabled={busy}
                                        onClick={async () => {
                                            const result = await act(
                                                `content/${edit.id}/publication`,
                                                { action: "publish" },
                                            );
                                            if (result) setEdit(result);
                                        }}
                                    >
                                        Publish saved draft
                                    </button>
                                    <button
                                        disabled={busy || !edit.published}
                                        onClick={async () => {
                                            const result = await act(
                                                `content/${edit.id}/publication`,
                                                { action: "unpublish" },
                                            );
                                            if (result) setEdit(result);
                                        }}
                                    >
                                        Unpublish
                                    </button>
                                </div>
                            )}
                            {preview && (
                                <article className="draft-preview">
                                    <p>Private preview · saved draft</p>
                                    <h1>{edit.draft.title}</h1>
                                    <p>{edit.draft.description}</p>
                                    {edit.draft.image && (
                                        <Image
                                            src={edit.draft.image}
                                            alt={edit.draft.image_alt ?? ""}
                                            width={1200}
                                            height={750}
                                            unoptimized
                                            style={{ height: "auto" }}
                                        />
                                    )}
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: edit.draft.body,
                                        }}
                                    />
                                </article>
                            )}
                        </>
                    )}
                </>
            )}
            {data && tab === "Pricing" && (
                <>
                    <p>
                        Prices come from billing. Approval applies only to the
                        current amounts and VAT wording. Free and inactive plans
                        cannot be published.
                    </p>
                    {data.plans.map((p) => (
                        <PriceEditor
                            key={`${p.id}-${p.approved}-${p.public_vat_wording}`}
                            plan={p}
                            busy={busy}
                            save={(body) =>
                                act(`pricing/${p.id}`, body, "PATCH")
                            }
                        />
                    ))}
                </>
            )}
            {data && tab === "Settings" && (
                <SettingsEditor
                    initial={data.settings}
                    busy={busy}
                    save={(body) => act("settings", body, "PATCH")}
                />
            )}
            {data && tab === "Demo calendar" && (
                <>
                    <p>
                        One shared schedule · Africa/Johannesburg · 30 minutes +
                        15-minute buffer. Working hours and blackouts are
                        configured in Settings. Dates below use South African
                        time.
                    </p>
                    <BookingList
                        token={token}
                        bookings={data.bookings}
                        busy={busy}
                        save={(id, body) =>
                            act(`bookings/${id}`, body, "PATCH")
                        }
                    />
                </>
            )}
            {data && tab === "Email delivery" && (
                <>
                    <p>
                        Pending and failed notifications. The scheduler and
                        queue worker must be running. Failed messages retry up
                        to five times.
                    </p>
                    {data.mail.length === 0 && (
                        <p>No pending or failed messages.</p>
                    )}
                    {data.mail.map((m) => (
                        <div className="workspace-panel" key={m.id}>
                            <strong>{m.subject}</strong>
                            <p>
                                {m.recipient} · {m.status} · {m.attempts}{" "}
                                attempts
                            </p>
                            {m.error && <p>{m.error}</p>}
                            {m.status === "failed" && (
                                <button
                                    disabled={busy}
                                    onClick={() =>
                                        void act(`mail/${m.id}/retry`, {})
                                    }
                                >
                                    Retry delivery
                                </button>
                            )}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
function ContentEditor({
    record,
    busy,
    onSave,
}: {
    record: ContentRecord;
    busy: boolean;
    onSave: (d: ContentData, slug: string, kind: string) => Promise<void>;
}) {
    const [draft, setDraft] = useState(record.draft);
    const [slug, setSlug] = useState(record.slug);
    const [kind, setKind] = useState(record.kind);
    const editor = useRef<HTMLDivElement>(null);
    const field = (
        key: keyof ContentData,
        label: string,
        required = false,
        type = "text",
    ) => (
        <label key={key}>
            {label}
            <input
                type={type}
                value={draft[key] ?? ""}
                required={required}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
        </label>
    );
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void onSave(
                    { ...draft, body: editor.current?.innerHTML ?? draft.body },
                    slug,
                    kind,
                );
            }}
        >
            <div className="workspace-grid">
                <label>
                    Content type
                    <select
                        value={kind}
                        disabled={record.id > 0}
                        onChange={(e) => setKind(e.target.value)}
                    >
                        {["page", "blog", "help", "update", "vacancy"].map(
                            (k) => (
                                <option key={k}>{k}</option>
                            ),
                        )}
                    </select>
                </label>
                <label>
                    Address (without leading slash)
                    <input
                        required
                        disabled={record.id > 0}
                        pattern="[a-z0-9]+([-\/][a-z0-9]+)*"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                    />
                </label>
                {field("title", "Title", true)}
                {field("description", "Short description", true)}
                {field(
                    "author",
                    "Named author (required for articles and updates)",
                )}
                {field("category", "Category")}
                {field("image", "Approved image URL", false, "url")}
                {field("image_alt", "Image description")}
                {field("seo_title", "Search title")}
                {field("seo_description", "Search description")}
                {kind === "vacancy" && (
                    <>
                        {field("location", "Location", true)}
                        {field("employment_type", "Employment type", true)}
                        {field(
                            "application_email",
                            "Application email",
                            true,
                            "email",
                        )}
                    </>
                )}
            </div>
            <label id="body-label">Article sections</label>
            <div className="workspace-actions">
                {[
                    ["bold", "Bold"],
                    ["italic", "Italic"],
                    ["insertUnorderedList", "Bullets"],
                    ["formatBlock", "Heading"],
                ].map(([command, label]) => (
                    <button
                        key={command}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            editor.current?.focus();
                            document.execCommand(
                                command,
                                false,
                                command === "formatBlock" ? "h2" : undefined,
                            );
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div
                className="rich-editor"
                ref={editor}
                contentEditable
                onPaste={(e) => {
                    e.preventDefault();
                    document.execCommand(
                        "insertText",
                        false,
                        e.clipboardData.getData("text/plain"),
                    );
                }}
                suppressContentEditableWarning
                role="textbox"
                aria-labelledby="body-label"
                aria-multiline
                dangerouslySetInnerHTML={{ __html: record.draft.body }}
            />
            <p>
                Formatting is sanitised when saved. Only headings, paragraphs,
                lists, emphasis and quotes are retained. Save before previewing
                or publishing.
            </p>
            <button disabled={busy} type="submit">
                Save draft
            </button>
        </form>
    );
}
function PriceEditor({
    plan: p,
    busy,
    save,
}: {
    plan: Plan;
    busy: boolean;
    save: (v: unknown) => Promise<unknown>;
}) {
    const [vat, setVat] = useState(p.public_vat_wording ?? "");
    const [order, setOrder] = useState(p.public_order);
    return (
        <form
            className="workspace-panel"
            onSubmit={(e) => {
                e.preventDefault();
                void save({
                    public_vat_wording: vat,
                    public_order: order,
                    approved: true,
                });
            }}
        >
            <h2>{p.title}</h2>
            <p>
                R{p.monthly_charge_zar}/month · {p.vehicle_limit} vehicles · R
                {p.extra_vehicle_price_zar} per additional vehicle
            </p>
            <p>
                {p.approved
                    ? "Approved for public display"
                    : "Not publicly approved"}
            </p>
            <label>
                VAT wording
                <input
                    required
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                    placeholder="Enter approved tax wording"
                />
            </label>
            <label>
                Display order
                <input
                    type="number"
                    min={0}
                    max={1000}
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                />
            </label>
            <div className="workspace-actions">
                <button disabled={busy || p.is_free || !p.is_active}>
                    Approve current values
                </button>
                <button
                    type="button"
                    disabled={busy || !p.approved}
                    onClick={() =>
                        void save({
                            public_vat_wording: vat,
                            public_order: order,
                            approved: false,
                        })
                    }
                >
                    Withdraw approval
                </button>
            </div>
        </form>
    );
}
function SettingsEditor({
    initial,
    busy,
    save,
}: {
    initial: Settings;
    busy: boolean;
    save: (v: unknown) => Promise<unknown>;
}) {
    const [settings, setSettings] = useState(initial);
    const [blackouts, setBlackouts] = useState(initial.blackouts.join("\n"));
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                void save({
                    ...settings,
                    blackouts: blackouts.split(/\s+/).filter(Boolean),
                });
            }}
        >
            <h2>Working hours</h2>
            <p>
                Enable only the days your team can take appointments. No hours
                means no public booking availability.
            </p>
            {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ].map((day, index) => {
                const key = String(index + 1);
                const hours = settings.hours[key];
                return (
                    <div className="hours-row" key={day}>
                        <label>
                            <input
                                type="checkbox"
                                checked={!!hours}
                                onChange={(e) => {
                                    const next = { ...settings.hours };
                                    if (e.target.checked)
                                        next[key] = {
                                            from: "09:00",
                                            to: "17:00",
                                        };
                                    else delete next[key];
                                    setSettings({ ...settings, hours: next });
                                }}
                            />
                            {day}
                        </label>
                        {hours && (
                            <>
                                <label>
                                    From
                                    <input
                                        type="time"
                                        required
                                        value={hours.from}
                                        onChange={(e) =>
                                            setSettings({
                                                ...settings,
                                                hours: {
                                                    ...settings.hours,
                                                    [key]: {
                                                        ...hours,
                                                        from: e.target.value,
                                                    },
                                                },
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    To
                                    <input
                                        type="time"
                                        required
                                        value={hours.to}
                                        onChange={(e) =>
                                            setSettings({
                                                ...settings,
                                                hours: {
                                                    ...settings.hours,
                                                    [key]: {
                                                        ...hours,
                                                        to: e.target.value,
                                                    },
                                                },
                                            })
                                        }
                                    />
                                </label>
                            </>
                        )}
                    </div>
                );
            })}
            <label>
                Blackout dates (one YYYY-MM-DD date per line)
                <textarea
                    rows={4}
                    value={blackouts}
                    onChange={(e) => setBlackouts(e.target.value)}
                />
            </label>
            <h2>Verified company contact details</h2>
            <p>Only enter addresses and details approved for public display.</p>
            {[
                "company_name",
                "sales_email",
                "support_email",
                "security_email",
                "privacy_email",
            ].map((key) => (
                <label key={key}>
                    {key.replaceAll("_", " ")}
                    <input
                        type={key.endsWith("email") ? "email" : "text"}
                        value={
                            (settings[key as keyof Settings] as string) ?? ""
                        }
                        onChange={(e) =>
                            setSettings({ ...settings, [key]: e.target.value })
                        }
                    />
                </label>
            ))}
            <button disabled={busy}>Save settings</button>
        </form>
    );
}
function BookingList({
    token,
    bookings,
    busy,
    save,
}: {
    token: string;
    bookings: Booking[];
    busy: boolean;
    save: (id: string, b: unknown) => Promise<unknown>;
}) {
    const [day, setDay] = useState("");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<Booking[]>(bookings);
    const [lastPage, setLastPage] = useState(1);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        websiteRequest<{ data: Booking[]; last_page: number }>(
            `website/admin/bookings?page=${page}${day ? `&date=${day}` : ""}`,
            token,
        )
            .then((d) => {
                if (active) {
                    setRows(d.data);
                    setLastPage(d.last_page);
                    setError("");
                }
            })
            .catch((e) => {
                if (active) setError(String(e));
            });
        return () => {
            active = false;
        };
    }, [token, day, page, bookings]);
    return (
        <>
            <label>
                Filter by day
                <input
                    type="date"
                    value={day}
                    onChange={(e) => {
                        setDay(e.target.value);
                        setPage(1);
                    }}
                />
            </label>
            {error && <p role="alert">{error}</p>}
            {rows.map((b) => (
                <form
                    key={b.id}
                    className="workspace-panel"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void save(b.id, {
                            meeting_url: new FormData(e.currentTarget).get(
                                "meeting_url",
                            ),
                        });
                    }}
                >
                    <h2>
                        {new Date(b.starts_at).toLocaleString("en-ZA", {
                            timeZone: "Africa/Johannesburg",
                        })}
                    </h2>
                    <p>
                        {b.name} · {b.company} · {b.status}
                    </p>
                    <p>
                        {b.email} · {b.phone} · Fleet: {b.fleet_size}
                    </p>
                    <p>{b.message}</p>
                    <label>
                        Unique meeting link
                        <input
                            name="meeting_url"
                            type="url"
                            required
                            defaultValue={b.meeting_url ?? ""}
                            placeholder="https://…"
                        />
                    </label>
                    <div className="workspace-actions">
                        <button disabled={busy || b.status !== "confirmed"}>
                            Save link & email update
                        </button>
                        <button
                            type="button"
                            disabled={busy || b.status !== "confirmed"}
                            onClick={() => {
                                if (
                                    window.confirm(
                                        "Cancel this appointment and notify the attendee?",
                                    )
                                )
                                    void save(b.id, {
                                        status: "cancelled",
                                    });
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            ))}
            {!rows.length && <p>No demo bookings for this selection.</p>}
            <div className="workspace-actions">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}>
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
        </>
    );
}
