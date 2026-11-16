"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Calendar dates are civil days. Do not round-trip them through UTC.
const civilDate = (value: string) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); };
const civilValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
export function DemoDatePicker({ id, value, min, max, disabled, onChange }: { id: string; value: string; min: string; max: string; disabled?: boolean; onChange: (value: string) => void }) {
    const [open, setOpen] = useState(false);
    const selected = value ? civilDate(value) : undefined;
    return <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button id={id} type="button" variant="outline" disabled={disabled} className="demo-date-trigger" aria-describedby="demo-date-help">
            <span>{selected ? selected.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "Select a date"}</span><CalendarDays size={18} aria-hidden="true" />
        </Button></PopoverTrigger>
        <PopoverContent align="start" className="demo-date-popover w-auto p-0" aria-label="Choose a demo date">
            <Calendar mode="single" required autoFocus selected={selected} defaultMonth={selected ?? civilDate(min)} startMonth={civilDate(min)} endMonth={civilDate(max)} disabled={[{ before: civilDate(min) }, { after: civilDate(max) }]} onSelect={day => {
                if (!day || disabled) return;
                const next = civilValue(day);
                if (next < min || next > max) return;
                onChange(next); setOpen(false);
            }} />
            <p className="demo-calendar-note">Dates shown for South Africa (SAST).<br />Choose a date to check available times.</p>
        </PopoverContent>
    </Popover>;
}
