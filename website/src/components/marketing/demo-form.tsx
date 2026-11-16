"use client";
import { DemoDatePicker } from "./demo-date-picker";
import { CalendarDays, Check, CheckCircle2, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { websiteRequest, WebsiteRequestError } from "@/lib/website/request";

const time = (value: string) => new Date(value).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" });
const dateLabel = (value: string) => new Date(value).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateValue = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
type Booking = { starts_at: string; status: string };
export function DemoForm({ manage = false, salesEmail }: { manage?: boolean; salesEmail?: string }) {
    const managementLoaded = useRef(false);
    const pending = useRef(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const [step, setStep] = useState<"time" | "details" | "confirmation">("time");
    const [refresh, setRefresh] = useState(0);
    const [date, setDate] = useState("");
    const [slots, setSlots] = useState<string[]>([]);
    const [slot, setSlot] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [booking, setBooking] = useState<Booking | null>(null);
    const [token, setToken] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [cancelPrompt, setCancelPrompt] = useState(false);
    const [details, setDetails] = useState({ name: "", email: "", company: "", phone: "", fleet_size: "", message: "", website: "" });
    useEffect(() => {
        if (manage && !managementLoaded.current) {
            managementLoaded.current = true;
            setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
            window.history.replaceState(null, "", window.location.pathname);
        }
    }, [manage]);
    useEffect(() => { heading.current?.focus(); }, [step]);
    useEffect(() => {
        if (!date) return;
        let active = true;
        setSlot(""); setSlots([]); setLoading(true); setLoaded(false); setError("");
        websiteRequest<string[]>(`website/demo/slots?date=${encodeURIComponent(date)}`)
            .then(s => { if (active) { setSlots(s); setLoaded(true); } })
            .catch(() => { if (active) setError("We couldn’t check availability. Please try again."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [date, refresh]);
    async function save(action: "book" | "reschedule" | "cancel") {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError(""); setFieldErrors({});
        try {
            const result = await websiteRequest<Booking>(manage ? "website/demo/manage" : "website/demo/book", undefined, "POST", manage ? { token, action, starts_at: slot || undefined } : { ...details, starts_at: slot });
            setBooking(result); setStep("confirmation");
        } catch (e) {
            if (e instanceof WebsiteRequestError && e.status === 422 && !!e.fields.starts_at) {
                setStep("time"); setRefresh(n => n + 1);
                setFieldErrors({ starts_at: ["That time is no longer available. Please choose another; your details have been saved."] });
            } else {
                setError(e instanceof WebsiteRequestError && e.status && e.status < 500 ? e.message : "Unable to save your appointment. Please try again.");
                if (e instanceof WebsiteRequestError) setFieldErrors(e.fields);
            }
        } finally { pending.current = false; setBusy(false); }
    }
    const minDate = dateValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const maxDate = dateValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    return <div className="booking-panel">
        <ol className="booking-steps" aria-label="Booking progress">
            {["Choose a time", manage ? "Review change" : "Your details", "Confirmation"].map((label, index) => <li key={label} aria-current={index === ["time", "details", "confirmation"].indexOf(step) ? "step" : undefined}><span>{index < ["time", "details", "confirmation"].indexOf(step) ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{label}</li>)}
        </ol>
        <h2 tabIndex={-1} ref={heading}>{step === "confirmation" ? booking?.status === "cancelled" ? "Appointment cancelled" : "You’re booked in." : step === "details" ? manage ? "Review your new time" : "Tell us about your operation" : "Find a time that works"}</h2>
        {step === "confirmation" && booking ? <div className="booking-confirmation" role="status"><CheckCircle2 className="confirmation-icon" size={36} aria-hidden="true" />
            {booking.status !== "cancelled" && <div className="appointment-summary"><strong>{dateLabel(booking.starts_at)}</strong><span>{time(booking.starts_at)} · 30 minutes · SAST (UTC+2)</span></div>}
            <p>{booking.status === "cancelled" ? "Your appointment has been cancelled. We’ll email an update." : manage ? "Your appointment has been rescheduled. We’ll email the updated details." : "We’ll email your confirmation and private appointment-management link. Your meeting link will be sent separately."}</p>
            <a href="/platform">Explore the platform →</a>
        </div> : <>
            {manage && !token ? <p className="notice">Open the private management link in your confirmation email to change your appointment.</p> : <>
                <p className="booking-meta"><Clock3 size={15} aria-hidden="true" />30 minutes · South African Standard Time (UTC+2)</p>
                <form onSubmit={event => { event.preventDefault(); if (step === "time") setStep("details"); else void save(manage ? "reschedule" : "book"); }}>
                    {step === "time" ? <div className="booking-time">
                        <label htmlFor="demo-date">Choose a date</label>
                        <DemoDatePicker id="demo-date" value={date} min={minDate} max={maxDate} disabled={busy} onChange={value => { setDate(value); setFieldErrors({}); }} />
                        <p className="meta" id="demo-date-help">Book at least 24 hours ahead, up to 30 days in advance.</p>
                        {loading && <p role="status">Checking available times…</p>}
                        {!date && <p className="booking-empty">Select a date to see available appointments.</p>}
                        {loaded && !slots.length && <p className="booking-empty" role="status">No appointments are available on this date. Please choose another day.</p>}
                        {!!slots.length && <fieldset className="booking-slots"><legend>Available times · SAST</legend><div className="slots">{slots.map(s => <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}>{time(s)}</button>)}</div></fieldset>}
                        {fieldErrors.starts_at && <p className="error" role="alert">{fieldErrors.starts_at[0]}</p>}
                        {error && <button type="button" className="booking-text-button" onClick={() => setRefresh(n => n + 1)}>Retry availability</button>}
                    </div> : <>
                        <div className="appointment-summary"><strong><CalendarDays size={16} aria-hidden="true" />{dateLabel(slot)}</strong><span>{time(slot)} · 30 minutes · SAST</span><button type="button" disabled={busy} onClick={() => { setStep("time"); setError(""); }}>Change time</button></div>
                        {!manage && <>
                            <div className="form-grid">{([
                                ["name", "Your name", "text", 120, "name"], ["email", "Email", "email", 254, "email"], ["company", "Company", "text", 150, "organization"], ["phone", "Phone (optional)", "tel", 40, "tel"],
                            ] as const).map(([name, label, type, limit, autocomplete]) => <div key={name}><label htmlFor={`demo-${name}`}>{label}</label><input id={`demo-${name}`} name={name} type={type} autoComplete={autocomplete} required={name !== "phone"} maxLength={limit} value={details[name]} disabled={busy} aria-invalid={!!fieldErrors[name]} aria-describedby={fieldErrors[name] ? `error-${name}` : undefined} onChange={e => setDetails(d => ({ ...d, [name]: e.target.value }))} />{fieldErrors[name] && <p className="error" id={`error-${name}`}>{fieldErrors[name][0]}</p>}</div>)}</div>
                            <label htmlFor="fleet-size">Fleet size</label><select id="fleet-size" required value={details.fleet_size} disabled={busy} aria-invalid={!!fieldErrors.fleet_size} onChange={e => setDetails(d => ({ ...d, fleet_size: e.target.value }))}><option value="">Select fleet size</option>{["1–10", "11–20", "21–50", "51–100", "100+"].map(s => <option key={s}>{s}</option>)}</select>
                            {fieldErrors.fleet_size && <p className="error">{fieldErrors.fleet_size[0]}</p>}
                            <label htmlFor="demo-message">What would you like to explore? (optional)</label><textarea id="demo-message" maxLength={2000} rows={3} value={details.message} disabled={busy} onChange={e => setDetails(d => ({ ...d, message: e.target.value }))} />
                            <div hidden aria-hidden><label htmlFor="company-website">Leave empty</label><input id="company-website" tabIndex={-1} autoComplete="off" value={details.website} onChange={e => setDetails(d => ({ ...d, website: e.target.value }))} /></div>
                            <p className="meta">We use these details to arrange your demo and send appointment updates.</p>
                        </>}
                    </>}
                    {error && <p className="error" role="alert">{error}</p>}
                    <button className="cta booking-submit" type="submit" disabled={busy || !slot || loading}>{busy ? "Saving appointment…" : step === "time" ? "Continue →" : manage ? "Confirm new time" : "Confirm appointment"}</button>
                </form>
                {manage && <div className="booking-cancel">{cancelPrompt ? <><p>Cancel this demo appointment?</p><button type="button" disabled={busy} onClick={() => void save("cancel")}>Yes, cancel appointment</button><button type="button" disabled={busy} onClick={() => setCancelPrompt(false)}>Keep appointment</button></> : <button type="button" disabled={busy} onClick={() => setCancelPrompt(true)}>Cancel appointment</button>}</div>}
            </>}
            {salesEmail && <p className="booking-contact">Can’t find a suitable time? <a href={`mailto:${salesEmail}`}>Contact our team</a>.</p>}
        </>}
    </div>;
}
