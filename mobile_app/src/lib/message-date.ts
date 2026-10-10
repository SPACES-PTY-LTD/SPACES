/** Group timestamps by the calendar day shown on the driver's phone. */
export function messageDayLabel(timestamp: string, previousTimestamp?: string): string | null {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    if (previousTimestamp) {
        const previous = new Date(previousTimestamp);
        if (date.getFullYear() === previous.getFullYear()
            && date.getMonth() === previous.getMonth()
            && date.getDate() === previous.getDate()) return null;
    }
    return date.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
}
