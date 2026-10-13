import { DateInput } from "@/component/ui/DateInput";
import { formatDateOnly, parseDateOnly } from "@/src/lib/date-only";

export function RunDatePicker({
    value,
    onChange,
}: {
    value: Date;
    onChange: (date: Date) => void;
    onDismiss: () => void;
}) {
    return (
        <DateInput
            label="Run date"
            value={formatDateOnly(value)}
            onChange={(date) => {
                const parsed = parseDateOnly(date);
                if (parsed) onChange(parsed);
            }}
        />
    );
}
