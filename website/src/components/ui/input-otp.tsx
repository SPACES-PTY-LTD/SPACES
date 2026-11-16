"use client";

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/lib/utils";

// shadcn composition, using the same input-otp primitive as the Base UI example.
export function InputOTP({ className, containerClassName, ...props }: React.ComponentProps<typeof OTPInput>) {
    return <OTPInput data-slot="input-otp" containerClassName={cn("flex w-full flex-wrap gap-2 has-disabled:opacity-50", containerClassName)} className={cn("disabled:cursor-not-allowed", className)} {...props} />;
}
export function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="input-otp-group" className={cn("flex w-full max-w-80 items-center gap-1", className)} {...props} />;
}
export function InputOTPSlot({ index, className, masked = false, ...props }: React.ComponentProps<"div"> & { index: number; masked?: boolean }) {
    const { slots } = React.useContext(OTPInputContext);
    const slot = slots[index];
    return <div data-slot="input-otp-slot" aria-hidden="true" className={cn("relative flex h-10 w-8 min-w-0 max-w-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white text-base text-slate-900", slot?.isActive && "border-violet-600 ring-2 ring-violet-200", className)} {...props}>{slot?.char ? (masked ? "•" : slot.char) : slot?.hasFakeCaret ? <span className="h-4 w-px bg-slate-900" /> : null}</div>;
}
