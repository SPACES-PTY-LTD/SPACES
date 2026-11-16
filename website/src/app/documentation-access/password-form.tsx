"use client";
import { useState, useRef } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";

export function DocumentationPasswordForm({ length, destination }: { length: number; destination: string }) {
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState("");
    return <form className="mt-8 space-y-6" onSubmit={async event => {
        event.preventDefault();
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await fetch("/api/documentation/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, next: destination }) });
            const body = await result.json();
            if (!result.ok) { setError(body.error || "Unable to unlock documentation. Please try again."); return; }
            setPassword("");
            // Full navigation discards any previously prefetched lock screen.
            window.location.assign(body.destination);
        } catch { setError("We couldn’t connect. Please try again."); }
        finally { saving.current = false; setBusy(false); }
    }}>
        <div>
            <label htmlFor="documentation-password" className="mb-3 block text-sm font-medium">Documentation password</label>
            <InputOTP id="documentation-password" name="password" type="password" inputMode="text" autoComplete="current-password" maxLength={length} value={password} onChange={value => { setPassword(value); setError(""); }} disabled={busy} required aria-invalid={!!error} aria-describedby="password-help password-error">
                {Array.from({ length: Math.ceil(length / 8) }, (_, group) => <InputOTPGroup key={group}>{Array.from({ length: Math.min(8, length - group * 8) }, (_, offset) => <InputOTPSlot key={offset} index={group * 8 + offset} masked />)}</InputOTPGroup>)}
            </InputOTP>
            <p id="password-help" className="mt-3 text-sm leading-6 text-slate-500">Enter or paste the password shared by our team. Access lasts one hour.</p>
            <p id="password-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>
        </div>
        <Button type="submit" disabled={busy || password.length !== length} className="h-12 w-full rounded-full bg-violet-700 text-white hover:bg-violet-800">{busy ? "Checking password…" : "Unlock documentation"}</Button>
    </form>;
}
