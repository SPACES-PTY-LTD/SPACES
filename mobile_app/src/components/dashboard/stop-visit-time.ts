/** Recorded visit duration only: never infer an exit from the current clock. */
export function stopVisitDuration(enteredAt: string | null, exitedAt?: string | null) {
  if (!enteredAt || !exitedAt) return null;
  const start = new Date(enteredAt).getTime();
  const end = new Date(exitedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remaining = minutes % 60;
  return [days ? `${days} ${days === 1 ? 'day' : 'days'}` : '', hours ? `${hours} hr` : '', remaining ? `${remaining} min` : '', seconds % 60 ? `${seconds % 60} sec` : ''].filter(Boolean).join(' ');
}
